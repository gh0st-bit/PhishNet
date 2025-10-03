import { BaseThreatFeedProvider, ThreatData } from './threat-feed-base';

export class OTXProvider extends BaseThreatFeedProvider {
  name = 'alienvault-otx';
  
  private readonly API_KEY = process.env.OTX_API_KEY || 'b128d86565af4483a5d113cc98ccb69f75f7ee48ab5610ae5213fa97b1ebec15';
  private readonly BASE_URL = 'https://otx.alienvault.com/api/v1';
  
  private readonly FEED_URLS = {
    pulses: `${this.BASE_URL}/pulses/subscribed`,
    indicators: `${this.BASE_URL}/indicators/domain`,
    recent: `${this.BASE_URL}/pulses/activity`,
    // Try public endpoint instead
    public_recent: `${this.BASE_URL}/pulses/activity`
  };

  async fetchThreats(): Promise<ThreatData[]> {
    try {
      console.log(`[${this.name}] Fetching recent pulses...`);
      
      // Try public endpoint first, then fallback to authenticated
      let response: Response;
      try {
        // Public endpoint for recent pulses (no auth required)
        response = await this.withTimeout(
          fetch(`${this.BASE_URL}/pulses/activity?limit=20`),
          15000
        ) as Response;
        console.log(`[${this.name}] Using public endpoint, status: ${response.status}`);
      } catch (publicError) {
        console.log(`[${this.name}] Public endpoint failed, trying authenticated...`);
        // Fallback to authenticated endpoint
        response = await this.withTimeout(
          this.fetchWithAuth(`${this.BASE_URL}/pulses/activity?limit=20`),
          15000
        ) as Response;
      }
      
      const data = await response.json();
      
      if (!data.results || !Array.isArray(data.results)) {
        console.warn(`[${this.name}] Invalid response format`);
        return [];
      }

      const threats: ThreatData[] = [];
      
      // Process each pulse
      for (const pulse of data.results.slice(0, 20)) { // Limit to 20 pulses
        const pulseThreats = await this.processPulse(pulse);
        threats.push(...pulseThreats);
      }

      console.log(`[${this.name}] Successfully fetched ${threats.length} threats from ${data.results.length} pulses`);
      return threats;
      
    } catch (error) {
      console.error(`[${this.name}] Error fetching threats:`, error);
      return [];
    }
  }

  private async processPulse(pulse: any): Promise<ThreatData[]> {
    try {
      if (!pulse.indicators || !Array.isArray(pulse.indicators)) {
        return [];
      }

      const threats: ThreatData[] = [];
      
      // Process indicators from the pulse
      for (const indicator of pulse.indicators.slice(0, 10)) { // Limit to 10 indicators per pulse
        const threat = this.parseOTXIndicator(indicator, pulse);
        if (threat) {
          threats.push(threat);
        }
      }

      return threats;
    } catch (error) {
      console.warn(`[${this.name}] Error processing pulse:`, error);
      return [];
    }
  }

  private parseOTXIndicator(indicator: any, pulse: any): ThreatData | null {
    try {
      if (!indicator.indicator || !indicator.type) return null;

      const indicatorValue = indicator.indicator.trim();
      const indicatorType = indicator.type.toLowerCase();
      
      // Map OTX indicator types to our types
      let mappedType: 'url' | 'domain' | 'ip' | 'hash' = 'unknown' as any;
      let domain: string | undefined;
      let url: string | undefined;

      switch (indicatorType) {
        case 'url':
          url = indicatorValue;
          domain = this.extractDomain(indicatorValue);
          mappedType = 'url';
          break;
        case 'domain':
        case 'hostname':
          domain = indicatorValue;
          mappedType = 'domain';
          break;
        case 'ipv4':
        case 'ipv6':
          mappedType = 'ip';
          break;
        case 'filehash-md5':
        case 'filehash-sha1':
        case 'filehash-sha256':
          mappedType = 'hash';
          break;
        default:
          return null; // Skip unsupported types
      }

      return {
        url,
        domain,
        indicator: indicatorValue,
        indicatorType: mappedType,
        threatType: this.mapThreatType(pulse.tags, pulse.malware_families),
        malwareFamily: this.extractMalwareFamily(pulse.malware_families),
        campaignName: pulse.name || undefined,
        confidence: this.calculateConfidence(pulse, indicator),
        firstSeen: new Date(pulse.created || indicator.created || Date.now()),
        lastSeen: pulse.modified ? new Date(pulse.modified) : undefined,
        tags: this.extractTags(pulse.tags, indicator.type),
        description: pulse.description || `${pulse.name} - ${indicatorValue}`,
        source: this.name,
        rawData: { pulse, indicator }
      };
    } catch (error) {
      console.warn(`[${this.name}] Error parsing indicator:`, error);
      return null;
    }
  }

  private mapThreatType(tags?: string[], malwareFamilies?: any[]): 'phishing' | 'malware' | 'c2' | 'unknown' {
    const allTags = [
      ...(tags || []),
      ...(malwareFamilies || []).map((m: any) => m.display_name || m.name || '')
    ].map(tag => tag.toLowerCase());

    console.log(`[OTX] Mapping threat type for tags: ${JSON.stringify(tags)}, malware families: ${JSON.stringify(malwareFamilies)}`);
    console.log(`[OTX] All tags processed: ${JSON.stringify(allTags)}`);

    if (allTags.some(tag => tag.includes('phish'))) {
      console.log(`[OTX] Detected phishing threat`);
      return 'phishing';
    }
    if (allTags.some(tag => tag.includes('c2') || tag.includes('command') || tag.includes('botnet'))) {
      console.log(`[OTX] Detected C2 threat`);
      return 'c2';
    }
    if (allTags.some(tag => tag.includes('malware') || tag.includes('trojan') || tag.includes('rat'))) {
      console.log(`[OTX] Detected specific malware threat`);
      return 'malware';
    }
    
    console.log(`[OTX] Using default malware classification`);
    return 'malware'; // Default for OTX
  }

  private extractMalwareFamily(malwareFamilies?: any[]): string | undefined {
    if (!malwareFamilies || malwareFamilies.length === 0) return undefined;
    return malwareFamilies[0].display_name || malwareFamilies[0].name || undefined;
  }

  private calculateConfidence(pulse: any, indicator: any): number {
    let confidence = 70; // Base confidence
    
    // Increase confidence based on pulse reputation
    if (pulse.author_name && pulse.author_name.includes('AlienVault')) confidence += 10;
    if (pulse.votes && pulse.votes.up > pulse.votes.down) confidence += 5;
    if (pulse.subscriber_count > 100) confidence += 5;
    
    // Decrease confidence for old indicators
    const ageInDays = (Date.now() - new Date(pulse.created).getTime()) / (1000 * 60 * 60 * 24);
    if (ageInDays > 30) confidence -= 10;
    if (ageInDays > 90) confidence -= 20;
    
    return Math.max(50, Math.min(95, confidence));
  }

  private extractTags(tags?: string[], indicatorType?: string): string[] {
    const result = ['otx'];
    
    if (indicatorType) result.push(indicatorType);
    if (tags && Array.isArray(tags)) {
      result.push(...tags.slice(0, 3)); // Limit to 3 additional tags
    }
    
    return result.slice(0, 5); // Max 5 tags total
  }

  private async fetchWithAuth(url: string): Promise<Response> {
    const response = await fetch(url, {
      headers: {
        'X-OTX-API-KEY': this.API_KEY,
        'User-Agent': 'PhishNet-ThreatIntel/1.0',
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    return response;
  }
}
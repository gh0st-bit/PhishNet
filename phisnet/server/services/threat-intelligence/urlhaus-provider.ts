import { BaseThreatFeedProvider, ThreatData } from './threat-feed-base';

export class UrlhausFeedProvider extends BaseThreatFeedProvider {
  name = 'abuse.ch-urlhaus';
  
  private readonly FEED_URLS = {
    recent: 'https://urlhaus.abuse.ch/downloads/csv_recent/',
    online: 'https://urlhaus.abuse.ch/downloads/csv_online/'
  };

  async fetchThreats(): Promise<ThreatData[]> {
    try {
      console.log(`[${this.name}] Fetching recent threats...`);
      
      const response = await this.withTimeout(
        this.fetchWithRetry(this.FEED_URLS.recent),
        15000
      );
      
      const csvText = await response.text();
      const threats = this.parseCsvData(csvText);

      console.log(`[${this.name}] Successfully fetched ${threats.length} threats`);
      return threats;
      
    } catch (error) {
      console.error(`[${this.name}] Error fetching threats:`, error);
      return [];
    }
  }

  private parseCsvData(csvText: string): ThreatData[] {
    try {
      const lines = csvText.split('\n');
      
      // Debug: Log first few lines to understand format
      console.log(`[${this.name}] CSV sample (first 3 lines):`, lines.slice(0, 3));
      
      // Skip header lines (URLhaus CSV has comments starting with #)
      const dataLines = lines
        .filter(line => line.trim() && !line.startsWith('#'))
        .slice(0, 20); // Limit to 20 entries for testing

      console.log(`[${this.name}] Found ${dataLines.length} data lines to process`);

      const threats = dataLines
        .map(line => this.parseCsvLine(line))
        .filter(Boolean) as ThreatData[];
        
      console.log(`[${this.name}] Successfully parsed ${threats.length} threats from CSV`);
      return threats;
        
    } catch (error) {
      console.warn(`[${this.name}] Error parsing CSV:`, error);
      return [];
    }
  }

  private parseCsvLine(line: string): ThreatData | null {
    try {
      // URLhaus CSV format: id,dateadded,url,url_status,last_online,threat,tags,urlhaus_link,reporter
      const fields = line.split(',');
      
      if (fields.length < 6) return null;
      
      const [, dateAdded, url, urlStatus, lastOnline, threat, tags] = fields;
      
      if (!url || urlStatus !== 'online') return null;

      const cleanUrl = url.replace(/"/g, '');
      const domain = this.extractDomain(cleanUrl);
      
      if (!domain) return null;

      return {
        url: cleanUrl,
        domain,
        indicator: cleanUrl,
        indicatorType: 'url',
        threatType: this.mapThreatType(threat?.replace(/"/g, '')),
        malwareFamily: threat?.replace(/"/g, '') || undefined,
        confidence: 85,
        firstSeen: new Date(dateAdded?.replace(/"/g, '') || Date.now()),
        lastSeen: lastOnline ? new Date(lastOnline.replace(/"/g, '')) : undefined,
        tags: tags ? tags.replace(/"/g, '').split('|').filter(Boolean) : [],
        description: `Malicious URL hosting ${threat?.replace(/"/g, '') || 'unknown malware'}`,
        source: this.name,
        rawData: { csv_line: line }
      };
    } catch (error) {
      console.warn(`[${this.name}] Error parsing CSV line:`, error);
      return null;
    }
  }

  private parseUrlhausItem(item: any): ThreatData | null {
    try {
      if (!item.url) return null;

      const url = item.url.trim();
      const domain = this.extractDomain(url);
      
      if (!domain) return null;

      return {
        url,
        domain,
        indicator: url,
        indicatorType: 'url',
        threatType: this.mapThreatType(item.threat),
        malwareFamily: item.payload || undefined,
        confidence: 85,
        firstSeen: new Date(item.date_added || Date.now()),
        lastSeen: item.last_online ? new Date(item.last_online) : undefined,
        tags: item.tags || [],
        description: `Malicious URL hosting ${item.payload || 'unknown malware'}`,
        source: this.name,
        rawData: item
      };
    } catch (error) {
      console.warn(`[${this.name}] Error parsing item:`, error);
      return null;
    }
  }

  private mapThreatType(threat?: string): 'phishing' | 'malware' | 'c2' | 'unknown' {
    if (!threat) return 'unknown';
    
    const threatLower = threat.toLowerCase();
    
    if (threatLower.includes('phish')) return 'phishing';
    if (threatLower.includes('malware') || threatLower.includes('trojan') || 
        threatLower.includes('backdoor') || threatLower.includes('rat')) return 'malware';
    if (threatLower.includes('c2') || threatLower.includes('command')) return 'c2';
    
    return 'malware'; // Default for URLhaus
  }
}
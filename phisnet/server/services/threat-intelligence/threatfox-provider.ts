import { BaseThreatFeedProvider, ThreatData } from './threat-feed-base';

export class ThreatFoxProvider extends BaseThreatFeedProvider {
  name = 'abuse.ch-threatfox';
  
  private readonly FEED_URLS = {
    recent: 'https://threatfox.abuse.ch/downloads/csv_recent/',
    // Alternative: recent IOCs in the last 30 days
    recent30: 'https://threatfox.abuse.ch/export/csv/recent/'
  };

  async fetchThreats(): Promise<ThreatData[]> {
    try {
      console.log(`[${this.name}] Fetching recent IOCs...`);
      
      const response = await this.withTimeout(
        this.fetchWithRetry(this.FEED_URLS.recent30),
        20000
      );
      
      const csvText = await response.text();
      const threats = this.parseCsvData(csvText);

      console.log(`[${this.name}] Successfully fetched ${threats.length} IOCs`);
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
      
      // Skip header lines (ThreatFox CSV has comments starting with #)
      const dataLines = lines
        .filter(line => line.trim() && !line.startsWith('#'))
        .slice(0, 20); // Limit to 20 entries for testing

      console.log(`[${this.name}] Found ${dataLines.length} data lines to process`);

      return dataLines
        .map(line => this.parseCsvLine(line))
        .filter(Boolean) as ThreatData[];
        
    } catch (error) {
      console.warn(`[${this.name}] Error parsing CSV:`, error);
      return [];
    }
  }

  private parseCsvLine(line: string): ThreatData | null {
    try {
      // ThreatFox CSV format: first_seen,ioc_id,ioc_value,ioc_type,threat_type,malware,malware_printable,malware_alias,malware_malpedia,confidence_level,fk_malware,reference,tags,anonymous,reporter
      const fields = this.parseCSVLine(line);
      
      // Debug first few lines to understand format (limit to first 3 for cleaner output)
      if (fields.length > 0 && Math.random() < 0.1) { // Only log 10% of lines
        console.log(`[${this.name}] Sample line with ${fields.length} fields:`, fields.slice(0, 4));
      }
      
      if (fields.length < 7) {
        console.log(`[${this.name}] Skipping line with insufficient fields (${fields.length})`);
        return null;
      }
      
      const [firstSeen, iocId, iocValue, iocType, threatType, malware, malwarePrintable] = fields;
      
      if (!iocValue || !iocType) {
        console.log(`[${this.name}] Skipping line: missing IOC value or type`);
        return null;
      }

      const cleanIoc = iocValue.replace(/"/g, '').trim();
      const cleanIocType = iocType.replace(/"/g, '').toLowerCase();
      
      // Skip unsupported IOC types
      if (!['url', 'domain', 'ip:port', 'md5_hash', 'sha1_hash', 'sha256_hash'].includes(cleanIocType)) {
        return null;
      }

      let domain: string | undefined;
      let url: string | undefined;
      let indicator = cleanIoc;
      let indicatorType: 'url' | 'domain' | 'ip' | 'hash' = 'unknown' as any;

      // Process based on IOC type
      switch (cleanIocType) {
        case 'url':
          url = cleanIoc;
          domain = this.extractDomain(cleanIoc);
          indicatorType = 'url';
          break;
        case 'domain':
          domain = cleanIoc;
          indicatorType = 'domain';
          break;
        case 'ip:port':
          indicatorType = 'ip';
          indicator = cleanIoc.split(':')[0]; // Remove port
          break;
        case 'md5_hash':
        case 'sha1_hash':
        case 'sha256_hash':
          indicatorType = 'hash';
          break;
      }

      return {
        url,
        domain,
        indicator,
        indicatorType,
        threatType: this.mapThreatType(malwarePrintable?.replace(/"/g, '')),
        malwareFamily: malwarePrintable?.replace(/"/g, '') || undefined,
        confidence: fields[9] ? parseInt(fields[9].replace(/"/g, '')) || 75 : 75,
        firstSeen: new Date(firstSeen?.replace(/"/g, '') || Date.now()),
        lastSeen: fields[10] ? new Date(fields[10].replace(/"/g, '')) : undefined,
        tags: fields[12] ? fields[12].replace(/"/g, '').split(',').filter(Boolean) : ['threatfox'],
        description: `${malwarePrintable?.replace(/"/g, '') || 'Malicious'} IOC: ${cleanIoc}`,
        source: this.name,
        rawData: { csv_line: line }
      };
    } catch (error) {
      console.warn(`[${this.name}] Error parsing CSV line:`, error);
      return null;
    }
  }

  private parseCSVLine(line: string): string[] {
    const result = [];
    let current = '';
    let inQuotes = false;
    
    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      
      if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === ',' && !inQuotes) {
        result.push(current);
        current = '';
      } else {
        current += char;
      }
    }
    
    result.push(current);
    return result;
  }

  private parseThreatFoxItem(item: any): ThreatData | null {
    try {
      if (!item.ioc || !item.ioc_type) return null;

      const ioc = item.ioc.trim();
      const iocType = item.ioc_type.toLowerCase();
      
      // Skip unsupported IOC types
      if (!['url', 'domain', 'ip', 'md5_hash', 'sha1_hash', 'sha256_hash'].includes(iocType)) {
        return null;
      }

      let domain: string | undefined;
      let url: string | undefined;
      let indicator = ioc;
      let indicatorType: 'url' | 'domain' | 'ip' | 'hash' = 'unknown' as any;

      // Process based on IOC type
      switch (iocType) {
        case 'url':
          url = ioc;
          domain = this.extractDomain(ioc);
          indicatorType = 'url';
          break;
        case 'domain':
          domain = ioc;
          indicatorType = 'domain';
          break;
        case 'ip':
          indicatorType = 'ip';
          break;
        case 'md5_hash':
        case 'sha1_hash':
        case 'sha256_hash':
          indicatorType = 'hash';
          break;
      }

      return {
        url,
        domain,
        indicator,
        indicatorType,
        threatType: this.mapThreatType(item.malware_printable),
        malwareFamily: item.malware_printable || item.malware || undefined,
        confidence: item.confidence_level || 75,
        firstSeen: new Date(item.first_seen || item.date_added || Date.now()),
        lastSeen: item.last_seen ? new Date(item.last_seen) : undefined,
        tags: this.extractTags(item),
        description: item.comment || `${item.malware_printable || 'Malicious'} IOC: ${ioc}`,
        source: this.name,
        rawData: item
      };
    } catch (error) {
      console.warn(`[${this.name}] Error parsing item:`, error);
      return null;
    }
  }

  private mapThreatType(malware?: string): 'phishing' | 'malware' | 'c2' | 'unknown' {
    if (!malware) return 'unknown';
    
    const malwareLower = malware.toLowerCase();
    
    if (malwareLower.includes('phish')) return 'phishing';
    if (malwareLower.includes('c2') || malwareLower.includes('command') || 
        malwareLower.includes('botnet')) return 'c2';
    
    return 'malware'; // Default for ThreatFox
  }

  private extractTags(item: any): string[] {
    const tags = ['threatfox'];
    
    if (item.malware_printable) {
      tags.push(item.malware_printable.toLowerCase().replace(/\s+/g, '_'));
    }
    
    if (item.tags && Array.isArray(item.tags)) {
      tags.push(...item.tags);
    }
    
    return tags.slice(0, 5); // Limit tags
  }
}
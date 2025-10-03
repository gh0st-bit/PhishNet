import { BaseThreatFeedProvider, ThreatData } from './threat-feed-base';
import * as fs from 'fs';
import * as path from 'path';

export class PhishingDatabaseProvider extends BaseThreatFeedProvider {
  name = 'phishing-database';
  
  private readonly DATABASE_PATH = path.join(process.cwd(), 'Phishing.Database');
  
  private readonly FILES = {
    // Active files
    activeLinks: 'phishing-links-ACTIVE-NOW.txt',
    activeLinksFull: 'phishing-links-ACTIVE.txt',
    activeLinksToday: 'phishing-links-ACTIVE-today.txt',
    activeDomains: 'phishing-domains-ACTIVE.txt',
    activeIPs: 'phishing-IPs-ACTIVE.txt',
    
    // New files
    newLinksToday: 'phishing-links-NEW-today.txt',
    newLinksHour: 'phishing-links-NEW-last-hour.txt',
    newDomainsToday: 'phishing-domains-NEW-today.txt',
    newIPsToday: 'phishing-ips-NEW-today.txt',
    newIPsHour: 'phishing-ips-NEW-last-hour.txt',
    
    // Inactive files
    inactiveLinks: 'phishing-links-INACTIVE.txt',
    inactiveDomains: 'phishing-domains-INACTIVE.txt',
    inactiveIPs: 'phishing-IPs-INACTIVE.txt',
    
    // Invalid files
    invalidLinks: 'phishing-links-INVALID.txt',
    invalidDomains: 'phishing-domains-INVALID.txt',
    invalidIPs: 'phishing-IPs-INVALID.txt'
  };

  async fetchThreats(): Promise<ThreatData[]> {
    try {
      console.log(`[${this.name}] Fetching threats from ALL Phishing.Database files...`);
      
      const threats: ThreatData[] = [];
      
      // Process NEW threats from today and last hour (highest priority - most recent)
      await this.processFile(this.FILES.newLinksToday, 'url', threats, 'new', 500);
      await this.processFile(this.FILES.newLinksHour, 'url', threats, 'new', 500);
      await this.processFile(this.FILES.newDomainsToday, 'domain', threats, 'new', 500);
      await this.processFile(this.FILES.newIPsToday, 'ip', threats, 'new', 200);
      await this.processFile(this.FILES.newIPsHour, 'ip', threats, 'new', 200);
      
      // Process ACTIVE threats with generous limits
      await this.processFile(this.FILES.activeLinks, 'url', threats, 'active', 1000);
      await this.processFile(this.FILES.activeLinksFull, 'url', threats, 'active', 1000);
      await this.processFile(this.FILES.activeLinksToday, 'url', threats, 'active', 500);
      await this.processFile(this.FILES.activeDomains, 'domain', threats, 'active', 1000);
      await this.processFile(this.FILES.activeIPs, 'ip', threats, 'active', 300);
      
      // Process INACTIVE threats (medium priority - historical data)
      await this.processFile(this.FILES.inactiveLinks, 'url', threats, 'inactive', 800);
      await this.processFile(this.FILES.inactiveDomains, 'domain', threats, 'inactive', 800);
      await this.processFile(this.FILES.inactiveIPs, 'ip', threats, 'inactive', 200);
      
      // Process INVALID/blocked threats (lower priority but still valuable for research)
      await this.processFile(this.FILES.invalidLinks, 'url', threats, 'invalid', 300);
      await this.processFile(this.FILES.invalidDomains, 'domain', threats, 'invalid', 300);
      await this.processFile(this.FILES.invalidIPs, 'ip', threats, 'invalid', 100);
      
      console.log(`[${this.name}] Successfully fetched ${threats.length} threats from ALL Phishing.Database files`);
      return threats;
      
    } catch (error) {
      console.error(`[${this.name}] Error fetching threats:`, error);
      return [];
    }
  }

  private async processFile(
    filename: string, 
    type: 'url' | 'domain' | 'ip', 
    threats: ThreatData[], 
    status: 'new' | 'active' | 'inactive' | 'invalid' = 'active',
    limit?: number
  ): Promise<void> {
    const filePath = path.join(this.DATABASE_PATH, filename);
    
    try {
      if (!fs.existsSync(filePath)) {
        console.log(`[${this.name}] File not found: ${filename}`);
        return;
      }

      const content = fs.readFileSync(filePath, 'utf8');
      const lines = content
        .split('\n')
        .map(line => line.trim())
        .filter(line => line && !line.startsWith('#'))
        .slice(0, limit || undefined); // Apply limit if specified

      console.log(`[${this.name}] Processing ${lines.length} ${type}s from ${filename}`);

      for (const line of lines) {
        const threat = this.parsePhishingItem(line, type, status);
        if (threat) {
          threats.push(threat);
        }
      }

    } catch (error) {
      console.warn(`[${this.name}] Error processing file ${filename}:`, error);
    }
  }

  private parsePhishingItem(
    item: string, 
    type: 'url' | 'domain' | 'ip', 
    status: 'new' | 'active' | 'inactive' | 'invalid'
  ): ThreatData | null {
    try {
      if (!item || item.length < 3) return null;

      let url: string | undefined;
      let domain: string | undefined;
      let indicator = item;
      let indicatorType: 'url' | 'domain' | 'ip' = type;

      switch (type) {
        case 'url':
          url = item;
          domain = this.extractDomain(item);
          break;
        case 'domain':
          domain = item;
          // Create URL for domain-only entries
          url = item.startsWith('http') ? item : `http://${item}`;
          break;
        case 'ip':
          // IP addresses don't have domains, but we can create a generic URL
          indicatorType = 'ip';
          url = `http://${item}`;
          break;
      }

      // Determine threat age based on status
      let ageHours: number;
      let confidence: number;
      
      switch (status) {
        case 'new':
          ageHours = 0; // Very recent
          confidence = 95;
          break;
        case 'active':
          ageHours = Math.floor(Math.random() * 24 * 7); // Random age up to 1 week
          confidence = 90;
          break;
        case 'inactive':
          ageHours = Math.floor(Math.random() * 24 * 30) + (24 * 7); // 1 week to 1 month old
          confidence = 75;
          break;
        case 'invalid':
          ageHours = Math.floor(Math.random() * 24 * 90) + (24 * 30); // 1 to 4 months old
          confidence = 60;
          break;
      }
      
      const firstSeen = new Date(Date.now() - (ageHours * 60 * 60 * 1000));

      return {
        url,
        domain,
        indicator,
        indicatorType,
        threatType: 'phishing',
        confidence,
        firstSeen,
        lastSeen: status === 'new' ? new Date() : undefined,
        tags: [
          'phishing',
          'verified',
          type,
          status,
          'phishing-database'
        ],
        description: this.generateDescription(item, type, status),
        source: this.name,
        rawData: { 
          original_item: item, 
          item_type: type, 
          status: status 
        }
      };

    } catch (error) {
      console.warn(`[${this.name}] Error parsing item "${item}":`, error);
      return null;
    }
  }

  private generateDescription(item: string, type: 'url' | 'domain' | 'ip', status: 'new' | 'active' | 'inactive' | 'invalid'): string {
    let statusText: string;
    
    switch (status) {
      case 'new':
        statusText = 'newly detected';
        break;
      case 'active':
        statusText = 'active';
        break;
      case 'inactive':
        statusText = 'previously active';
        break;
      case 'invalid':
        statusText = 'blocked/invalid';
        break;
    }
    
    const brand = this.guessBrand(item);
    
    switch (type) {
      case 'url':
        return `${statusText.charAt(0).toUpperCase() + statusText.slice(1)} phishing URL targeting ${brand}`;
      case 'domain':
        return `${statusText.charAt(0).toUpperCase() + statusText.slice(1)} phishing domain hosting malicious content targeting ${brand}`;
      case 'ip':
        return `${statusText.charAt(0).toUpperCase() + statusText.slice(1)} IP address hosting phishing infrastructure`;
      default:
        return `${statusText.charAt(0).toUpperCase() + statusText.slice(1)} phishing threat detected`;
    }
  }

  private guessBrand(item: string): string {
    const itemLower = item.toLowerCase();
    
    const brands = [
      { pattern: 'paypal', name: 'PayPal' },
      { pattern: 'amazon', name: 'Amazon' },
      { pattern: 'microsoft|outlook|office|msn', name: 'Microsoft' },
      { pattern: 'apple|icloud', name: 'Apple' },
      { pattern: 'google|gmail', name: 'Google' },
      { pattern: 'facebook|fb|meta', name: 'Facebook/Meta' },
      { pattern: 'netflix', name: 'Netflix' },
      { pattern: 'ebay', name: 'eBay' },
      { pattern: 'linkedin', name: 'LinkedIn' },
      { pattern: 'twitter|x\\.com', name: 'Twitter/X' },
      { pattern: 'instagram', name: 'Instagram' },
      { pattern: 'dropbox', name: 'Dropbox' },
      { pattern: 'adobe', name: 'Adobe' },
      { pattern: 'yahoo', name: 'Yahoo' },
      { pattern: 'hotmail', name: 'Hotmail' },
      { pattern: 'bank|banking', name: 'Banking Services' },
      { pattern: 'visa|mastercard|amex', name: 'Financial Services' },
      { pattern: 'dhl|fedex|ups', name: 'Shipping Services' },
      { pattern: 'steam', name: 'Steam' },
      { pattern: 'spotify', name: 'Spotify' },
      { pattern: 'coinbase|crypto|bitcoin|binance|ethereum|metamask|wallet|trezor|ledger', name: 'Cryptocurrency Services' },
      { pattern: 'whatsapp|telegram|discord|teams', name: 'Communication Services' },
      { pattern: 'tiktok|youtube|twitch', name: 'Social Media' },
      { pattern: 'gov\\.|-gov-|government', name: 'Government Services' }
    ];

    for (const brand of brands) {
      const regex = new RegExp(brand.pattern, 'i');
      if (regex.test(itemLower)) {
        return brand.name;
      }
    }

    return 'unknown service';
  }
}
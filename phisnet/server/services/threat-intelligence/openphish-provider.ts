import { BaseThreatFeedProvider, ThreatData } from './threat-feed-base';

export class OpenPhishFeedProvider extends BaseThreatFeedProvider {
  name = 'openphish';
  
  private readonly FEED_URL = 'https://openphish.com/feed.txt';

  async fetchThreats(): Promise<ThreatData[]> {
    try {
      console.log(`[${this.name}] Fetching phishing URLs...`);
      
      const response = await this.withTimeout(
        this.fetchWithRetry(this.FEED_URL),
        15000
      );
      
      const text = await response.text();
      const urls = text
        .split('\n')
        .map(url => url.trim())
        .filter(url => url && url.startsWith('http'))
        .slice(0, 200); // Limit to latest 200 URLs

      const threats = urls
        .map(url => this.parsePhishingUrl(url))
        .filter(Boolean) as ThreatData[];

      console.log(`[${this.name}] Successfully fetched ${threats.length} phishing URLs`);
      return threats;
      
    } catch (error) {
      console.error(`[${this.name}] Error fetching threats:`, error);
      return [];
    }
  }

  private parsePhishingUrl(url: string): ThreatData | null {
    try {
      const domain = this.extractDomain(url);
      
      if (!domain) return null;

      return {
        url,
        domain,
        indicator: url,
        indicatorType: 'url',
        threatType: 'phishing',
        confidence: 90,
        firstSeen: new Date(),
        tags: ['phishing', 'verified'],
        description: `Verified phishing URL targeting ${this.guessBrand(url, domain)}`,
        source: this.name,
        rawData: { original_url: url }
      };
    } catch (error) {
      console.warn(`[${this.name}] Error parsing URL:`, error);
      return null;
    }
  }

  private guessBrand(url: string, domain: string): string {
    const urlLower = (url + domain).toLowerCase();
    
    const brands = [
      'paypal', 'amazon', 'microsoft', 'apple', 'google', 'facebook',
      'netflix', 'ebay', 'linkedin', 'twitter', 'instagram', 'dropbox',
      'adobe', 'office365', 'outlook', 'gmail', 'yahoo', 'hotmail',
      'banking', 'bank', 'credit', 'visa', 'mastercard', 'amex'
    ];

    for (const brand of brands) {
      if (urlLower.includes(brand)) {
        return brand.charAt(0).toUpperCase() + brand.slice(1);
      }
    }

    return 'unknown service';
  }
}
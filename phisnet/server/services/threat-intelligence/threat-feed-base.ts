export interface ThreatData {
  url?: string;
  domain?: string;
  indicator?: string;
  indicatorType?: 'url' | 'domain' | 'ip' | 'hash';
  threatType?: 'phishing' | 'malware' | 'spam' | 'c2' | 'unknown';
  malwareFamily?: string;
  campaignName?: string;
  confidence?: number;
  firstSeen?: Date;
  lastSeen?: Date;
  tags?: string[];
  description?: string;
  rawData?: any;
  source: string;
}

export interface ThreatFeedProvider {
  name: string;
  fetchThreats(): Promise<ThreatData[]>;
}

export abstract class BaseThreatFeedProvider implements ThreatFeedProvider {
  abstract name: string;
  
  abstract fetchThreats(): Promise<ThreatData[]>;

  protected extractDomain(url: string): string {
    try {
      return new URL(url).hostname;
    } catch {
      return '';
    }
  }

  protected withTimeout<T>(promise: Promise<T>, timeoutMs: number = 10000): Promise<T> {
    return Promise.race([
      promise,
      new Promise<T>((_, reject) => 
        setTimeout(() => reject(new Error(`Timeout after ${timeoutMs}ms`)), timeoutMs)
      )
    ]);
  }

  protected async fetchWithRetry(url: string, retries: number = 3): Promise<Response> {
    for (let i = 0; i < retries; i++) {
      try {
        const response = await fetch(url, {
          headers: {
            'User-Agent': 'PhishNet-ThreatIntel/1.0'
          }
        });
        
        if (response.ok) {
          return response;
        }
        
        if (i === retries - 1) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        
        // Wait before retry (exponential backoff)
        await this.sleep(Math.pow(2, i) * 1000);
      } catch (error) {
        if (i === retries - 1) {
          throw error;
        }
        await this.sleep(Math.pow(2, i) * 1000);
      }
    }
    
    throw new Error('Max retries exceeded');
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
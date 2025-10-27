import { promises as dns } from 'dns';
import axios from 'axios';

export interface DomainInfo {
  domain: string;
  subdomain?: string;
  mxRecords: string[];
  txtRecords: string[];
  emailPatterns: string[];
  discoveredAt: Date;
}

export interface EmailPattern {
  pattern: string;
  confidence: number;
  examples: string[];
}

class DomainDiscoveryService {
  private commonSubdomains = [
    'www', 'mail', 'email', 'smtp', 'pop', 'imap', 'webmail', 
    'mx', 'mx1', 'mx2', 'exchange', 'outlook', 'office365',
    'admin', 'portal', 'intranet', 'extranet', 'vpn',
    'remote', 'citrix', 'rdp', 'terminal'
  ];

  /**
   * Discover subdomains for a given domain
   */
  async discoverSubdomains(domain: string): Promise<string[]> {
    const discoveredSubdomains: string[] = [];
    
    for (const subdomain of this.commonSubdomains) {
      const fullDomain = `${subdomain}.${domain}`;
      
      try {
        await dns.lookup(fullDomain);
        discoveredSubdomains.push(fullDomain);
        console.log(`✓ Found subdomain: ${fullDomain}`);
      } catch (error) {
        // Subdomain doesn't exist, continue
      }
    }
    
    return discoveredSubdomains;
  }

  /**
   * Get DNS records for a domain
   */
  async getDNSInfo(domain: string): Promise<DomainInfo> {
    const domainInfo: DomainInfo = {
      domain,
      mxRecords: [],
      txtRecords: [],
      emailPatterns: [],
      discoveredAt: new Date()
    };

    try {
      // Get MX records
      const mxRecords = await dns.resolveMx(domain);
      domainInfo.mxRecords = mxRecords.map(mx => mx.exchange);
    } catch (error) {
      console.log(`No MX records found for ${domain}`);
    }

    try {
      // Get TXT records
      const txtRecords = await dns.resolveTxt(domain);
      domainInfo.txtRecords = txtRecords.flat();
    } catch (error) {
      console.log(`No TXT records found for ${domain}`);
    }

    return domainInfo;
  }

  /**
   * Detect email patterns from sample emails
   */
  analyzeEmailPatterns(emails: string[], domain: string): EmailPattern[] {
    const patterns: { [key: string]: EmailPattern } = {};
    
    for (const email of emails) {
      const [localPart, emailDomain] = email.split('@');
      
      if (emailDomain.toLowerCase() !== domain.toLowerCase()) {
        continue; // Skip emails from other domains
      }

      // Analyze the local part pattern
      const detectedPatterns = this.detectPatternFromEmail(localPart);
      
      for (const pattern of detectedPatterns) {
        if (!patterns[pattern.pattern]) {
          patterns[pattern.pattern] = {
            pattern: pattern.pattern,
            confidence: 0,
            examples: []
          };
        }
        
        patterns[pattern.pattern].confidence += pattern.confidence;
        patterns[pattern.pattern].examples.push(email);
      }
    }

    // Sort by confidence and return top patterns
    return Object.values(patterns)
      .sort((a, b) => b.confidence - a.confidence)
      .slice(0, 5);
  }

  /**
   * Generate email variations based on detected patterns
   */
  generateEmailVariations(firstName: string, lastName: string, domain: string, patterns?: string[]): string[] {
    const defaultPatterns = [
      'firstname.lastname',
      'firstnamelastname', 
      'firstname',
      'flastname',
      'first.last',
      'f.lastname',
      'firstname.l',
      'firstinital.lastname'
    ];

    const patternsToUse = patterns && patterns.length > 0 ? patterns : defaultPatterns;
    const variations: string[] = [];

    const first = firstName.toLowerCase();
    const last = lastName.toLowerCase();
    const f = first.charAt(0);
    const l = last.charAt(0);

    for (const pattern of patternsToUse) {
      let email = '';
      
      switch (pattern) {
        case 'firstname.lastname':
          email = `${first}.${last}@${domain}`;
          break;
        case 'firstnamelastname':
          email = `${first}${last}@${domain}`;
          break;
        case 'firstname':
          email = `${first}@${domain}`;
          break;
        case 'flastname':
          email = `${f}${last}@${domain}`;
          break;
        case 'first.last':
          email = `${first}.${last}@${domain}`;
          break;
        case 'f.lastname':
          email = `${f}.${last}@${domain}`;
          break;
        case 'firstname.l':
          email = `${first}.${l}@${domain}`;
          break;
        case 'firstinital.lastname':
          email = `${f}.${last}@${domain}`;
          break;
        default:
          // Try to parse custom pattern
          email = this.applyCustomPattern(pattern, first, last, domain);
      }
      
      if (email && !variations.includes(email)) {
        variations.push(email);
      }
    }

    return variations;
  }

  /**
   * Perform autodiscovery on a target domain
   */
  async performAutodiscovery(domain: string): Promise<{
    domainInfo: DomainInfo;
    subdomains: string[];
    emailFormats: string[];
  }> {
    console.log(`🔍 Starting autodiscovery for domain: ${domain}`);
    
    // Get basic domain information
    const domainInfo = await this.getDNSInfo(domain);
    
    // Discover subdomains
    const subdomains = await this.discoverSubdomains(domain);
    
    // Analyze email formats from MX records and common patterns
    const emailFormats = this.inferEmailFormats(domainInfo);
    
    console.log(`✅ Autodiscovery complete for ${domain}`);
    console.log(`   - Found ${subdomains.length} subdomains`);
    console.log(`   - Detected ${emailFormats.length} email formats`);
    
    return {
      domainInfo,
      subdomains,
      emailFormats
    };
  }

  private detectPatternFromEmail(localPart: string): EmailPattern[] {
    const patterns: EmailPattern[] = [];
    
    // Check for dot separation
    if (localPart.includes('.')) {
      const parts = localPart.split('.');
      if (parts.length === 2) {
        patterns.push({
          pattern: 'firstname.lastname',
          confidence: 0.8,
          examples: []
        });
      }
    }
    
    // Check for single name
    if (!localPart.includes('.') && !localPart.includes('_') && localPart.length > 1) {
      patterns.push({
        pattern: 'firstnamelastname',
        confidence: 0.6,
        examples: []
      });
    }
    
    // Check for initial + lastname pattern
    if (localPart.length > 2 && !localPart.includes('.')) {
      patterns.push({
        pattern: 'flastname',
        confidence: 0.5,
        examples: []
      });
    }
    
    return patterns;
  }

  private applyCustomPattern(pattern: string, firstName: string, lastName: string, domain: string): string {
    return pattern
      .replace(/firstname/g, firstName)
      .replace(/lastname/g, lastName)
      .replace(/first/g, firstName)
      .replace(/last/g, lastName)
      .replace(/f/g, firstName.charAt(0))
      .replace(/l/g, lastName.charAt(0)) + `@${domain}`;
  }

  private inferEmailFormats(domainInfo: DomainInfo): string[] {
    const formats: string[] = [];
    
    // Check MX records for hosted email services
    const mxRecords = domainInfo.mxRecords.join(' ').toLowerCase();
    
    if (mxRecords.includes('google') || mxRecords.includes('gmail')) {
      formats.push('firstname.lastname@domain');
      formats.push('firstnamelastname@domain');
    } else if (mxRecords.includes('outlook') || mxRecords.includes('office365')) {
      formats.push('firstname.lastname@domain');
      formats.push('flastname@domain');
    } else {
      // Default patterns for unknown providers
      formats.push('firstname.lastname@domain');
      formats.push('firstnamelastname@domain');
      formats.push('flastname@domain');
    }
    
    return formats;
  }
}

export const domainDiscoveryService = new DomainDiscoveryService();
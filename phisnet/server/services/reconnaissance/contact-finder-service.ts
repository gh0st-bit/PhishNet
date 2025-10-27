import axios from 'axios';

export interface ContactInfo {
  email: string;
  firstName?: string;
  lastName?: string;
  fullName?: string;
  title?: string;
  company?: string;
  linkedinUrl?: string;
  source: 'apollo' | 'rocketreach' | 'manual' | 'osint';
  confidence: number;
  lastUpdated: Date;
}

export interface CompanyInfo {
  domain: string;
  name: string;
  industry?: string;
  size?: string;
  location?: string;
  description?: string;
}

export interface ContactSearchResult {
  contacts: ContactInfo[];
  company?: CompanyInfo;
  totalFound: number;
  searchMetadata: {
    provider: string;
    searchTerm: string;
    searchDate: Date;
    creditsUsed: number;
  };
}

class ContactFinderService {
  private apolloApiKey: string | undefined;
  private rocketreachApiKey: string | undefined;

  constructor() {
    this.apolloApiKey = process.env.APOLLO_API_KEY;
    this.rocketreachApiKey = process.env.ROCKETREACH_API_KEY;
  }

  /**
   * Search for contacts at a specific company domain
   */
  async findContactsByDomain(domain: string, limit: number = 10): Promise<ContactSearchResult> {
    console.log(`🔍 Searching for contacts at domain: ${domain}`);
    
    const results: ContactInfo[] = [];
    let company: CompanyInfo | undefined;
    
    // Try Apollo.io first (if API key available)
    if (this.apolloApiKey) {
      try {
        const apolloResults = await this.searchApollo(domain, limit);
        results.push(...apolloResults.contacts);
        if (!company) company = apolloResults.company;
      } catch (error) {
        console.warn('Apollo search failed:', error);
      }
    }
    
    // Try RocketReach if we need more results (if API key available)
    if (results.length < limit && this.rocketreachApiKey) {
      try {
        const rocketreachResults = await this.searchRocketReach(domain, limit - results.length);
        results.push(...rocketreachResults.contacts);
        if (!company) company = rocketreachResults.company;
      } catch (error) {
        console.warn('RocketReach search failed:', error);
      }
    }
    
    // If no API keys or results, try manual OSINT methods
    if (results.length === 0) {
      const osintResults = await this.performOSINTSearch(domain);
      results.push(...osintResults);
    }
    
    console.log(`✅ Found ${results.length} contacts for ${domain}`);
    
    return {
      contacts: results,
      company,
      totalFound: results.length,
      searchMetadata: {
        provider: results.length > 0 ? results[0].source : 'none',
        searchTerm: domain,
        searchDate: new Date(),
        creditsUsed: results.length
      }
    };
  }

  /**
   * Search for specific person by name and company
   */
  async findPersonByName(firstName: string, lastName: string, company: string): Promise<ContactInfo[]> {
    const results: ContactInfo[] = [];
    
    // Try Apollo.io
    if (this.apolloApiKey) {
      try {
        const apolloResult = await this.searchApolloByName(firstName, lastName, company);
        if (apolloResult) results.push(apolloResult);
      } catch (error) {
        console.warn('Apollo person search failed:', error);
      }
    }
    
    // Try RocketReach
    if (this.rocketreachApiKey && results.length === 0) {
      try {
        const rocketreachResult = await this.searchRocketReachByName(firstName, lastName, company);
        if (rocketreachResult) results.push(rocketreachResult);
      } catch (error) {
        console.warn('RocketReach person search failed:', error);
      }
    }
    
    return results;
  }

  /**
   * Verify email addresses using available services
   */
  async verifyEmail(email: string): Promise<{ valid: boolean; confidence: number; provider?: string }> {
    // Simple format validation first
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return { valid: false, confidence: 0 };
    }
    
    // For now, return basic validation
    // In production, you might integrate with email verification APIs
    return { 
      valid: true, 
      confidence: 0.7, // Basic format validation
      provider: 'basic_validation' 
    };
  }

  /**
   * Apollo.io API integration (free tier: 50 credits/month)
   */
  private async searchApollo(domain: string, limit: number): Promise<ContactSearchResult> {
    if (!this.apolloApiKey) {
      throw new Error('Apollo API key not configured');
    }

    const url = 'https://api.apollo.io/v1/mixed_people/search';
    const payload = {
      api_key: this.apolloApiKey,
      q_organization_domains: domain,
      page: 1,
      per_page: Math.min(limit, 25), // Apollo free tier limit
      person_titles: ['CEO', 'CTO', 'Manager', 'Director', 'VP', 'President']
    };

    const response = await axios.post(url, payload, {
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-cache'
      }
    });

    const contacts: ContactInfo[] = response.data.people?.map((person: any) => ({
      email: person.email,
      firstName: person.first_name,
      lastName: person.last_name,
      fullName: person.name,
      title: person.title,
      company: person.organization?.name,
      linkedinUrl: person.linkedin_url,
      source: 'apollo' as const,
      confidence: person.email ? 0.9 : 0.6,
      lastUpdated: new Date()
    })) || [];

    const organization = response.data.organizations?.[0];
    const company: CompanyInfo | undefined = organization ? {
      domain,
      name: organization.name,
      industry: organization.industry,
      size: organization.estimated_num_employees?.toString(),
      location: `${organization.city || ''} ${organization.state || ''} ${organization.country || ''}`.trim(),
      description: organization.short_description
    } : undefined;

    return {
      contacts,
      company,
      totalFound: contacts.length,
      searchMetadata: {
        provider: 'apollo',
        searchTerm: domain,
        searchDate: new Date(),
        creditsUsed: contacts.length
      }
    };
  }

  /**
   * RocketReach API integration (free tier: 50 searches/month)
   */
  private async searchRocketReach(domain: string, limit: number): Promise<ContactSearchResult> {
    if (!this.rocketreachApiKey) {
      throw new Error('RocketReach API key not configured');
    }

    const url = 'https://api.rocketreach.co/v2/api/search';
    const params = {
      api_key: this.rocketreachApiKey,
      current_employer: domain,
      start: 0,
      size: Math.min(limit, 10) // RocketReach free tier limit
    };

    const response = await axios.get(url, { params });

    const contacts: ContactInfo[] = response.data.profiles?.map((profile: any) => ({
      email: profile.emails?.[0]?.email,
      firstName: profile.name?.first,
      lastName: profile.name?.last,
      fullName: profile.name?.full,
      title: profile.current_title,
      company: profile.current_employer,
      linkedinUrl: profile.linkedin_url,
      source: 'rocketreach' as const,
      confidence: profile.emails?.[0] ? 0.8 : 0.5,
      lastUpdated: new Date()
    })) || [];

    return {
      contacts,
      totalFound: contacts.length,
      searchMetadata: {
        provider: 'rocketreach',
        searchTerm: domain,
        searchDate: new Date(),
        creditsUsed: contacts.length
      }
    };
  }

  /**
   * Apollo.io person search by name
   */
  private async searchApolloByName(firstName: string, lastName: string, company: string): Promise<ContactInfo | null> {
    if (!this.apolloApiKey) return null;

    const url = 'https://api.apollo.io/v1/mixed_people/search';
    const payload = {
      api_key: this.apolloApiKey,
      first_name: firstName,
      last_name: lastName,
      q_organization_name: company,
      page: 1,
      per_page: 1
    };

    try {
      const response = await axios.post(url, payload);
      const person = response.data.people?.[0];
      
      if (person) {
        return {
          email: person.email,
          firstName: person.first_name,
          lastName: person.last_name,
          fullName: person.name,
          title: person.title,
          company: person.organization?.name,
          linkedinUrl: person.linkedin_url,
          source: 'apollo',
          confidence: person.email ? 0.9 : 0.6,
          lastUpdated: new Date()
        };
      }
    } catch (error) {
      console.warn('Apollo person search error:', error);
    }

    return null;
  }

  /**
   * RocketReach person search by name
   */
  private async searchRocketReachByName(firstName: string, lastName: string, company: string): Promise<ContactInfo | null> {
    if (!this.rocketreachApiKey) return null;

    const url = 'https://api.rocketreach.co/v2/api/search';
    const params = {
      api_key: this.rocketreachApiKey,
      name: `${firstName} ${lastName}`,
      current_employer: company,
      start: 0,
      size: 1
    };

    try {
      const response = await axios.get(url, { params });
      const profile = response.data.profiles?.[0];
      
      if (profile) {
        return {
          email: profile.emails?.[0]?.email,
          firstName: profile.name?.first,
          lastName: profile.name?.last,
          fullName: profile.name?.full,
          title: profile.current_title,
          company: profile.current_employer,
          linkedinUrl: profile.linkedin_url,
          source: 'rocketreach',
          confidence: profile.emails?.[0] ? 0.8 : 0.5,
          lastUpdated: new Date()
        };
      }
    } catch (error) {
      console.warn('RocketReach person search error:', error);
    }

    return null;
  }

  /**
   * Manual OSINT methods when APIs are not available
   */
  private async performOSINTSearch(domain: string): Promise<ContactInfo[]> {
    console.log(`🔍 Performing OSINT search for ${domain}`);
    
    // This is a placeholder for OSINT techniques
    // In a real implementation, you might:
    // 1. Search LinkedIn using automated tools
    // 2. Use theHarvester for email enumeration
    // 3. Search company websites for staff pages
    // 4. Check social media profiles
    
    // For now, return empty array with guidance
    console.log('⚠️ No API keys configured. Consider adding Apollo.io or RocketReach API keys for better results');
    console.log('💡 Manual OSINT techniques can be implemented here');
    
    return [];
  }

  /**
   * Get service status and remaining credits
   */
  async getServiceStatus(): Promise<{
    apollo: { available: boolean; credits?: number };
    rocketreach: { available: boolean; credits?: number };
  }> {
    const status = {
      apollo: { available: !!this.apolloApiKey },
      rocketreach: { available: !!this.rocketreachApiKey }
    };

    // You could add API calls here to check remaining credits
    // For now, just return availability status
    
    return status;
  }
}

export const contactFinderService = new ContactFinderService();
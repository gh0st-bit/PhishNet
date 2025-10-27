import { domainDiscoveryService } from './domain-discovery-service';
import { contactFinderService } from './contact-finder-service';
import { geminiService } from '../ai/gemini-service';
import { conversionService } from '../content/conversion-service';
import { pool } from '../../db';

export interface ReconnaissanceRequest {
  campaignId: number;
  domains: string[];
  options: {
    enableContactDiscovery: boolean;
    enableProfileGeneration: boolean;
    enablePretextGeneration: boolean;
    maxContactsPerDomain: number;
    campaignType?: 'credential_harvest' | 'malware_delivery' | 'social_engineering' | 'awareness_test';
    urgencyLevel?: 'low' | 'medium' | 'high';
    pretextType?: 'it_support' | 'hr_update' | 'security_alert' | 'document_share' | 'custom';
  };
}

export interface ReconnaissanceResult {
  jobId: number;
  campaignId: number;
  status: 'pending' | 'running' | 'completed' | 'failed';
  progress: number;
  results: {
    domainsProcessed: number;
    contactsFound: number;
    profilesGenerated: number;
    pretextsCreated: number;
  };
  startedAt?: Date;
  completedAt?: Date;
  error?: string;
}

class ReconnaissanceOrchestrator {
  /**
   * Start a complete reconnaissance job for a campaign
   */
  async startReconnaissance(request: ReconnaissanceRequest): Promise<ReconnaissanceResult> {
    console.log(`🎯 Starting reconnaissance for campaign ${request.campaignId}`);
    
    // Create a reconnaissance job record
    const jobResult = await pool.query(
      `INSERT INTO reconnaissance_jobs (campaign_id, job_type, status, target_data, started_at, created_at)
       VALUES ($1, $2, $3, $4, NOW(), NOW()) RETURNING id`,
      [request.campaignId, 'full_reconnaissance', 'running', JSON.stringify(request)]
    );
    
    const jobId = jobResult.rows[0].id;
    
    try {
      // Update campaign status
      await pool.query(
        `UPDATE campaigns SET reconnaissance_status = 'in_progress' WHERE id = $1`,
        [request.campaignId]
      );
      
      const result: ReconnaissanceResult = {
        jobId,
        campaignId: request.campaignId,
        status: 'running',
        progress: 0,
        results: {
          domainsProcessed: 0,
          contactsFound: 0,
          profilesGenerated: 0,
          pretextsCreated: 0
        },
        startedAt: new Date()
      };
      
      // Process domains sequentially to avoid overwhelming APIs
      for (let i = 0; i < request.domains.length; i++) {
        const domain = request.domains[i];
        console.log(`🔍 Processing domain ${i + 1}/${request.domains.length}: ${domain}`);
        
        // Phase 1: Domain Discovery
        const domainInfo = await this.processDomain(domain, request.campaignId);
        result.results.domainsProcessed++;
        
        // Phase 2: Contact Discovery (if enabled)
        if (request.options.enableContactDiscovery && domainInfo.domainId) {
          const contacts = await this.processContacts(domain, domainInfo.domainId, request.options.maxContactsPerDomain);
          result.results.contactsFound += contacts.length;
          
          // Phase 3: Profile Generation (if enabled)
          if (request.options.enableProfileGeneration) {
            for (const contact of contacts) {
              if (contact.contactId) {
                await this.generateProfile(contact.contactId);
                result.results.profilesGenerated++;
                
                // Phase 4: Pretext Generation (if enabled)
                if (request.options.enablePretextGeneration) {
                  await this.generatePretext(contact.contactId, {
                    campaignType: request.options.campaignType || 'awareness_test',
                    urgencyLevel: request.options.urgencyLevel || 'medium',
                    pretextType: request.options.pretextType || 'security_alert'
                  });
                  result.results.pretextsCreated++;
                }
              }
            }
          }
        }
        
        // Update progress
        result.progress = Math.round(((i + 1) / request.domains.length) * 100);
        await this.updateJobProgress(jobId, result.progress, result.results);
      }
      
      // Mark job as completed
      result.status = 'completed';
      result.completedAt = new Date();
      
      await pool.query(
        `UPDATE reconnaissance_jobs SET status = $1, progress = $2, result_data = $3, completed_at = NOW()
         WHERE id = $4`,
        ['completed', 100, JSON.stringify(result.results), jobId]
      );
      
      // Update campaign status
      await pool.query(
        `UPDATE campaigns SET 
         reconnaissance_status = 'completed',
         domains_discovered = $1,
         contacts_found = $2,
         profiles_generated = $3
         WHERE id = $4`,
        [result.results.domainsProcessed, result.results.contactsFound, result.results.profilesGenerated, request.campaignId]
      );
      
      console.log(`✅ Reconnaissance completed for campaign ${request.campaignId}`);
      return result;
      
    } catch (error) {
      console.error(`❌ Reconnaissance failed for campaign ${request.campaignId}:`, error);
      
      // Mark job as failed
      await pool.query(
        `UPDATE reconnaissance_jobs SET status = $1, error_message = $2, completed_at = NOW()
         WHERE id = $3`,
        ['failed', error instanceof Error ? error.message : 'Unknown error', jobId]
      );
      
      throw error;
    }
  }
  
  /**
   * Get the status of a reconnaissance job
   */
  async getReconnaissanceStatus(jobId: number): Promise<ReconnaissanceResult | null> {
    const result = await pool.query(
      `SELECT * FROM reconnaissance_jobs WHERE id = $1`,
      [jobId]
    );
    
    if (result.rows.length === 0) {
      return null;
    }
    
    const job = result.rows[0];
    return {
      jobId: job.id,
      campaignId: job.campaign_id,
      status: job.status,
      progress: job.progress,
      results: job.result_data || { domainsProcessed: 0, contactsFound: 0, profilesGenerated: 0, pretextsCreated: 0 },
      startedAt: job.started_at,
      completedAt: job.completed_at,
      error: job.error_message
    };
  }
  
  /**
   * Get reconnaissance results for a campaign
   */
  async getCampaignReconResults(campaignId: number) {
    // Get domain discovery results
    const domainsResult = await pool.query(
      `SELECT rd.*, COUNT(dc.id) as contact_count
       FROM reconnaissance_domains rd
       LEFT JOIN discovered_contacts dc ON rd.id = dc.domain_id
       WHERE rd.campaign_id = $1
       GROUP BY rd.id
       ORDER BY rd.created_at DESC`,
      [campaignId]
    );
    
    // Get all discovered contacts with profiles
    const contactsResult = await pool.query(
      `SELECT dc.*, ap.id as profile_id, ap.summary, ap.interests, 
              COUNT(apt.id) as pretext_count
       FROM discovered_contacts dc
       JOIN reconnaissance_domains rd ON dc.domain_id = rd.id
       LEFT JOIN ai_profiles ap ON dc.id = ap.contact_id
       LEFT JOIN ai_pretexts apt ON ap.id = apt.profile_id
       WHERE rd.campaign_id = $1
       GROUP BY dc.id, ap.id
       ORDER BY dc.confidence DESC, dc.created_at DESC`,
      [campaignId]
    );
    
    return {
      domains: domainsResult.rows,
      contacts: contactsResult.rows,
      summary: {
        totalDomains: domainsResult.rows.length,
        totalContacts: contactsResult.rows.length,
        totalProfiles: contactsResult.rows.filter(c => c.profile_id).length,
        totalPretexts: contactsResult.rows.reduce((sum, c) => sum + (c.pretext_count || 0), 0)
      }
    };
  }
  
  private async processDomain(domain: string, campaignId: number) {
    console.log(`🌐 Processing domain: ${domain}`);
    
    // Perform autodiscovery
    const discoveryResult = await domainDiscoveryService.performAutodiscovery(domain);
    
    // Store domain information
    const domainResult = await pool.query(
      `INSERT INTO reconnaissance_domains (campaign_id, domain, email_formats, mx_records, txt_records, subdomains, discovery_status, discovered_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, NOW()) RETURNING id`,
      [
        campaignId,
        domain,
        discoveryResult.emailFormats,
        discoveryResult.domainInfo.mxRecords,
        discoveryResult.domainInfo.txtRecords,
        discoveryResult.subdomains,
        'completed'
      ]
    );
    
    return {
      domainId: domainResult.rows[0].id,
      discoveryResult
    };
  }
  
  private async processContacts(domain: string, domainId: number, maxContacts: number) {
    console.log(`👥 Discovering contacts for: ${domain}`);
    
    const searchResult = await contactFinderService.findContactsByDomain(domain, maxContacts);
    const contactIds: Array<{contactId: number}> = [];
    
    // Store discovered contacts
    for (const contact of searchResult.contacts) {
      try {
        const contactResult = await pool.query(
          `INSERT INTO discovered_contacts (domain_id, email, first_name, last_name, full_name, title, company, linkedin_url, source, confidence, verification_status)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11) RETURNING id`,
          [
            domainId,
            contact.email,
            contact.firstName,
            contact.lastName,
            contact.fullName,
            contact.title,
            contact.company,
            contact.linkedinUrl,
            contact.source,
            contact.confidence,
            'unverified'
          ]
        );
        
        contactIds.push({ contactId: contactResult.rows[0].id });
      } catch (error) {
        console.warn(`Failed to store contact ${contact.email}:`, error);
      }
    }
    
    return contactIds;
  }
  
  private async generateProfile(contactId: number) {
    // Get contact information
    const contactResult = await pool.query(
      `SELECT * FROM discovered_contacts WHERE id = $1`,
      [contactId]
    );
    
    if (contactResult.rows.length === 0) return;
    
    const contact = contactResult.rows[0];
    
    // Generate AI profile
    const profileRequest = {
      firstName: contact.first_name || '',
      lastName: contact.last_name || '',
      email: contact.email || '',
      title: contact.title,
      company: contact.company || '',
      linkedinProfile: contact.linkedin_url
    };
    
    const profile = await geminiService.generateProfile(profileRequest);
    
    // Store profile
    await pool.query(
      `INSERT INTO ai_profiles (contact_id, summary, interests, work_style, vulnerabilities, recommended_approach, profile_data)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [
        contactId,
        profile.summary,
        profile.interests,
        profile.workStyle,
        profile.likelyVulnerabilities,
        profile.recommendedApproach,
        JSON.stringify(profile)
      ]
    );
  }
  
  private async generatePretext(contactId: number, options: any) {
    // Get contact and profile information
    const result = await pool.query(
      `SELECT dc.*, ap.* FROM discovered_contacts dc
       JOIN ai_profiles ap ON dc.id = ap.contact_id
       WHERE dc.id = $1`,
      [contactId]
    );
    
    if (result.rows.length === 0) return;
    
    const data = result.rows[0];
    
    const pretextRequest = {
      profile: {
        firstName: data.first_name || '',
        lastName: data.last_name || '',
        email: data.email || '',
        title: data.title,
        company: data.company || ''
      },
      campaignType: options.campaignType,
      urgencyLevel: options.urgencyLevel,
      pretext: options.pretextType
    };
    
    const pretext = await geminiService.generatePretext(pretextRequest);
    
    // Store pretext
    await pool.query(
      `INSERT INTO ai_pretexts (profile_id, campaign_type, urgency_level, pretext_type, subject, email_body, call_to_action, urgency_indicators, personalization_elements, pretext_data)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
      [
        data.id, // profile_id
        options.campaignType,
        options.urgencyLevel,
        options.pretextType,
        pretext.subject,
        pretext.emailBody,
        pretext.callToAction,
        pretext.urgencyIndicators,
        pretext.personalizationElements,
        JSON.stringify(pretext)
      ]
    );
  }
  
  private async updateJobProgress(jobId: number, progress: number, results: any) {
    await pool.query(
      `UPDATE reconnaissance_jobs SET progress = $1, result_data = $2 WHERE id = $3`,
      [progress, JSON.stringify(results), jobId]
    );
  }
}

export const reconnaissanceOrchestrator = new ReconnaissanceOrchestrator();
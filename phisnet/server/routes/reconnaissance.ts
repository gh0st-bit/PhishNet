import { Router } from 'express';
import { isAuthenticated, hasOrganization } from '../auth';
import { reconnaissanceOrchestrator } from '../services/reconnaissance/reconnaissance-orchestrator';
import { domainDiscoveryService } from '../services/reconnaissance/domain-discovery-service';
import { contactFinderService } from '../services/reconnaissance/contact-finder-service';
import { geminiService } from '../services/ai/gemini-service';
import { conversionService } from '../services/content/conversion-service';
import { db } from '../db';
import { assertUser } from '../error-handler';
import { 
  reconnaissanceDomains, 
  discoveredContacts, 
  aiProfiles, 
  aiPretexts,
  reconnaissanceJobs,
  campaigns
} from '@shared/schema';
import { eq, desc } from 'drizzle-orm';

const router = Router();

// All reconnaissance routes require authentication
router.use(isAuthenticated);
router.use(hasOrganization);

/**
 * Start reconnaissance for a campaign
 * POST /api/reconnaissance/start
 */
router.post('/start', async (req, res) => {
  try {
    assertUser(req.user);
    const { campaignId, domains, options } = req.body;
    
    if (!campaignId || !domains || !Array.isArray(domains)) {
      return res.status(400).json({
        success: false,
        message: 'Campaign ID and domains array are required'
      });
    }
    
    const result = await reconnaissanceOrchestrator.startReconnaissance({
      campaignId,
      domains,
      options: {
        enableContactDiscovery: options?.enableContactDiscovery ?? true,
        enableProfileGeneration: options?.enableProfileGeneration ?? true,
        enablePretextGeneration: options?.enablePretextGeneration ?? false,
        maxContactsPerDomain: options?.maxContactsPerDomain ?? 10,
        campaignType: options?.campaignType ?? 'awareness_test',
        urgencyLevel: options?.urgencyLevel ?? 'medium',
        pretextType: options?.pretextType ?? 'security_alert'
      }
    });
    
    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    console.error('Reconnaissance start error:', error);
    res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : 'Failed to start reconnaissance'
    });
  }
});

/**
 * Get reconnaissance job status
 * GET /api/reconnaissance/status/:jobId
 */
router.get('/status/:jobId', async (req, res) => {
  try {
    const jobId = parseInt(req.params.jobId);
    if (isNaN(jobId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid job ID'
      });
    }
    
    const status = await reconnaissanceOrchestrator.getReconnaissanceStatus(jobId);
    
    if (!status) {
      return res.status(404).json({
        success: false,
        message: 'Reconnaissance job not found'
      });
    }
    
    res.json({
      success: true,
      data: status
    });
  } catch (error) {
    console.error('Get reconnaissance status error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get reconnaissance status'
    });
  }
});

/**
 * Get reconnaissance results for a campaign
 * GET /api/reconnaissance/results/:campaignId
 */
router.get('/results/:campaignId', async (req, res) => {
  try {
    const campaignId = parseInt(req.params.campaignId);
    if (isNaN(campaignId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid campaign ID'
      });
    }
    
    const results = await reconnaissanceOrchestrator.getCampaignReconResults(campaignId);
    
    res.json({
      success: true,
      data: results
    });
  } catch (error) {
    console.error('Get reconnaissance results error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get reconnaissance results'
    });
  }
});

/**
 * Test domain discovery
 * POST /api/reconnaissance/test-domain
 */
router.post('/test-domain', async (req, res) => {
  try {
    const { domain } = req.body;
    
    if (!domain) {
      return res.status(400).json({
        success: false,
        message: 'Domain is required'
      });
    }
    
    const result = await domainDiscoveryService.performAutodiscovery(domain);
    
    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    console.error('Domain discovery test error:', error);
    res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : 'Failed to test domain discovery'
    });
  }
});

/**
 * Test contact discovery
 * POST /api/reconnaissance/test-contacts
 */
router.post('/test-contacts', async (req, res) => {
  try {
    const { domain, limit = 5 } = req.body;
    
    if (!domain) {
      return res.status(400).json({
        success: false,
        message: 'Domain is required'
      });
    }
    
    const result = await contactFinderService.findContactsByDomain(domain, limit);
    
    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    console.error('Contact discovery test error:', error);
    res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : 'Failed to test contact discovery'
    });
  }
});

/**
 * Generate AI profile for a contact
 * POST /api/reconnaissance/generate-profile
 */
router.post('/generate-profile', async (req, res) => {
  try {
    const { firstName, lastName, email, title, company, linkedinProfile } = req.body;
    
    if (!firstName || !lastName || !email || !company) {
      return res.status(400).json({
        success: false,
        message: 'First name, last name, email, and company are required'
      });
    }
    
    const profile = await geminiService.generateProfile({
      firstName,
      lastName,
      email,
      title,
      company,
      linkedinProfile
    });
    
    res.json({
      success: true,
      data: profile
    });
  } catch (error) {
    console.error('Profile generation error:', error);
    res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : 'Failed to generate profile'
    });
  }
});

/**
 * Generate AI pretext
 * POST /api/reconnaissance/generate-pretext
 */
router.post('/generate-pretext', async (req, res) => {
  try {
    const { profile, campaignType, urgencyLevel, pretext, customContext } = req.body;
    
    if (!profile || !campaignType || !pretext) {
      return res.status(400).json({
        success: false,
        message: 'Profile, campaign type, and pretext are required'
      });
    }
    
    const generatedPretext = await geminiService.generatePretext({
      profile,
      campaignType,
      urgencyLevel: urgencyLevel || 'medium',
      pretext,
      customContext
    });
    
    res.json({
      success: true,
      data: generatedPretext
    });
  } catch (error) {
    console.error('Pretext generation error:', error);
    res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : 'Failed to generate pretext'
    });
  }
});

/**
 * Scrape and convert web page
 * POST /api/reconnaissance/scrape
 */
router.post('/scrape', async (req, res) => {
  try {
    const { url } = req.body;
    
    if (!url) {
      return res.status(400).json({
        success: false,
        message: 'URL is required'
      });
    }
    
    const result = await conversionService.scrapeAndConvert(url);
    
    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    console.error('Web scraping error:', error);
    res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : 'Failed to scrape web page'
    });
  }
});

/**
 * Convert HTML to Markdown
 * POST /api/reconnaissance/convert
 */
router.post('/convert', async (req, res) => {
  try {
    const { html } = req.body;
    
    if (!html) {
      return res.status(400).json({
        success: false,
        message: 'HTML content is required'
      });
    }
    
    const result = conversionService.convertHtmlToMarkdown(html);
    
    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    console.error('HTML conversion error:', error);
    res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : 'Failed to convert HTML'
    });
  }
});

/**
 * Get service status and API availability
 * GET /api/reconnaissance/service-status
 */
router.get('/service-status', async (req, res) => {
  try {
    const contactFinderStatus = await contactFinderService.getServiceStatus();
    
    const status = {
      geminiAI: {
        available: !!process.env.GEMINI_API_KEY,
        configured: !!process.env.GEMINI_API_KEY
      },
      contactFinder: contactFinderStatus,
      domainDiscovery: {
        available: true,
        configured: true
      },
      webScraping: {
        available: true,
        configured: true
      }
    };
    
    res.json({
      success: true,
      data: status
    });
  } catch (error) {
    console.error('Service status error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get service status'
    });
  }
});

/**
 * Generate email variations for a person
 * POST /api/reconnaissance/email-variations
 */
router.post('/email-variations', async (req, res) => {
  try {
    const { firstName, lastName, domain, patterns } = req.body;
    
    if (!firstName || !lastName || !domain) {
      return res.status(400).json({
        success: false,
        message: 'First name, last name, and domain are required'
      });
    }
    
    const variations = domainDiscoveryService.generateEmailVariations(firstName, lastName, domain, patterns);
    
    res.json({
      success: true,
      data: {
        variations,
        count: variations.length
      }
    });
  } catch (error) {
    console.error('Email variations error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to generate email variations'
    });
  }
});

/**
 * Get all pretexts for a campaign
 * GET /api/reconnaissance/pretexts/:campaignId
 */
router.get('/pretexts/:campaignId', async (req, res) => {
  try {
    const campaignId = parseInt(req.params.campaignId);
    if (isNaN(campaignId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid campaign ID'
      });
    }
    
    const result = await db
      .select()
      .from(aiPretexts)
      .innerJoin(aiProfiles, eq(aiPretexts.profileId, aiProfiles.id))
      .innerJoin(discoveredContacts, eq(aiProfiles.contactId, discoveredContacts.id))
      .innerJoin(reconnaissanceDomains, eq(discoveredContacts.domainId, reconnaissanceDomains.id))
      .where(eq(reconnaissanceDomains.campaignId, campaignId))
      .orderBy(desc(aiPretexts.generatedAt));
    
    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    console.error('Get pretexts error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get pretexts'
    });
  }
});

/**
 * Approve a pretext for use
 * PUT /api/reconnaissance/pretexts/:pretextId/approve
 */
router.put('/pretexts/:pretextId/approve', async (req, res) => {
  try {
    const pretextId = parseInt(req.params.pretextId);
    if (isNaN(pretextId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid pretext ID'
      });
    }
    
    await db
      .update(aiPretexts)
      .set({ approved: true })
      .where(eq(aiPretexts.id, pretextId));
    
    res.json({
      success: true,
      message: 'Pretext approved successfully'
    });
  } catch (error) {
    console.error('Approve pretext error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to approve pretext'
    });
  }
});

export default router;
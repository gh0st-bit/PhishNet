import nodemailer from 'nodemailer';
import { storage } from '../storage';
import type { Campaign, Target, SmtpProfile, EmailTemplate } from '@shared/schema';
import { NotificationService } from './notification-service';

// Base URL for tracking links & pixels (allow override via env)
const BASE_URL = process.env.APP_BASE_URL || 'http://localhost:5000';

/**
 * Rewrites hyperlinks in the HTML so clicks route via tracking endpoint.
 * Current rule set (kept intentionally simple):
 *  - Only rewrites absolute http/https URLs (skips mailto:, tel:, javascript:, relative links, already-tracked links)
 */
function rewriteLinks(html: string, campaign: Campaign, target: Target): string {
  return html.replace(/href="([^"]+)"/gi, (match, url) => {
    const lower = (url || '').toLowerCase();
    if (!url) return match;
    if (lower.startsWith('mailto:') || lower.startsWith('tel:') || lower.startsWith('javascript:')) return match;
    if (lower.includes('/c/')) return match; // already rewritten
    // Skip relative links (start with / or #)
    if (lower.startsWith('/') || lower.startsWith('#')) return match;
    // Only rewrite http/https
    if (!lower.startsWith('http://') && !lower.startsWith('https://')) return match;
    try {
      const encoded = encodeURIComponent(Buffer.from(url, 'utf8').toString('base64'));
      const tracking = `${BASE_URL}/c/${campaign.id}/${target.id}?u=${encoded}`;
      return `href="${tracking}"`;
    } catch {
      return match; // fallback silently
    }
  });
}

/**
 * Injects a 1x1 tracking pixel just before </body> (or appends if no body tag)
 */
function injectOpenPixel(html: string, campaign: Campaign, target: Target): string {
  const pixelTag = `<img src="${BASE_URL}/o/${campaign.id}/${target.id}.gif" width="1" height="1" style="display:none" alt="" />`;
  if (/<\/body\s*>/i.test(html)) {
    return html.replace(/<\/body\s*>/i, `${pixelTag}</body>`);
  }
  return html + pixelTag;
}

function renderTemplate(html: string, target: Target, template: EmailTemplate, campaign: Campaign, landingId?: number) {
  const trackingUrl = `${BASE_URL}/l/${campaign.id}/${target.id}`;
  
  // Build credential capture link (localhost for local demo)
  const captureLink = landingId ? `${BASE_URL}/c/login?cid=${campaign.id}&tid=${template.id}&lid=${landingId}&targetId=${target.id}` : '';
  
  let out = html
    .replace(/{{\.?(FirstName)}}/g, target.firstName || '')
    .replace(/{{\.?(LastName)}}/g, target.lastName || '')
    .replace(/{{\.?(SenderName)}}/g, (template as any).sender_name || 'PhishNet Team')
    .replace(/{{\.?(TrackingURL)}}/g, trackingUrl)
    .replace(/{{\.?(CredentialCaptureLink)}}/g, captureLink);
  
  // Rewrite links for click tracking & inject open pixel
  out = rewriteLinks(out, campaign, target);
  out = injectOpenPixel(out, campaign, target);
  return out;
}

async function createTransport(profile: SmtpProfile) {
  const enableDebug = process.env.SMTP_DEBUG === '1' || process.env.SMTP_DEBUG === 'true';
  const transporter = nodemailer.createTransport({
    host: profile.host,
    port: profile.port,
    secure: profile.port === 465, // true for 465, false for 587 (STARTTLS)
    auth: {
      user: profile.username,
      pass: profile.password,
    },
    logger: enableDebug,
    debug: enableDebug,
  });
  // Verify once (non-fatal) and log outcome
  try {
    const verified = await transporter.verify();
    console.log('[SMTP] transporter.verify():', verified);
  } catch (e) {
    console.warn('[SMTP] transporter.verify() failed:', e);
  }
  return transporter;
}

export async function sendCampaignEmails(campaignId: number, organizationId: number) {
  // Load campaign and dependencies
  const campaign = await storage.getCampaign(campaignId);
  if (!campaign || campaign.organizationId !== organizationId) {
    throw new Error('Campaign not found or access denied');
  }

  const targets = await storage.listTargets(campaign.targetGroupId);
  const smtp = await storage.getSmtpProfile(campaign.smtpProfileId);
  const template = await storage.getEmailTemplate(campaign.emailTemplateId);
  
  // Load landing page for credential capture link generation
  let landingId: number | undefined;
  if ((campaign as any).landingPageId) {
    landingId = (campaign as any).landingPageId;
  }

  if (!smtp) throw new Error('SMTP profile missing');
  if (!template) throw new Error('Email template missing');

  const transporter = await createTransport(smtp);

  let sentCount = 0;
  for (const target of targets) {
    if (!target.email) continue;
    const html = renderTemplate((template as any).html_content || (template as any).htmlContent || '', target, template, campaign, landingId);
    const subject = (template as any).subject || 'Security Awareness';

    try {
      const info = await transporter.sendMail({
        from: `${smtp.fromName} <${smtp.fromEmail}>`,
        to: target.email,
        subject,
        html,
      });
      console.log(`[SMTP] Sent to ${target.email}: messageId=${info.messageId}`);
      sentCount += 1;
      await storage.createCampaignResult({
        campaignId: campaign.id,
        targetId: target.id,
  organizationId: campaign.organizationId,
        status: 'sent',
        sent: true,
        sentAt: new Date(),
        opened: false,
        clicked: false,
        submitted: false,
      } as any);
    } catch (err: unknown) {
      // Handle and record failure as pending to allow retry later
      console.error(`[SMTP] Error sending to ${target.email}:`, err);
      await storage.createCampaignResult({
        campaignId: campaign.id,
        targetId: target.id,
  organizationId: campaign.organizationId,
        status: 'pending',
        sent: false,
      } as any);
    }
  }

  // Mark campaign status accordingly
  await storage.updateCampaign(campaign.id, { status: 'Completed' });
  
  // Create notification about campaign completion
  try {
    // Get organization users to notify
    const users = await storage.listUsers(organizationId);
    
    if (users && users.length > 0) {
      for (const user of users) {
        // Only notify admins or users with appropriate permissions
        if (user.isAdmin) {
          await NotificationService.createNotification({
            userId: user.id,
            organizationId: organizationId,
            type: 'campaign',
            title: 'Campaign Completed',
            message: `The campaign "${campaign.name}" has been sent to ${sentCount} of ${targets.length} targets.`,
            priority: 'medium',
            actionUrl: `/campaigns/${campaign.id}`,
            metadata: {
              campaignId: campaign.id,
              sentCount,
              totalTargets: targets.length
            }
          });
        }
      }
    }
  } catch (error) {
    console.error('Error creating campaign notification:', error);
  }
  
  return { sent: sentCount, total: targets.length };
}

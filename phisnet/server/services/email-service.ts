import { load } from 'cheerio';
import { trackingToken } from './tracking-token';
import nodemailer from 'nodemailer';
import {assertTemplateVariables} from './template-validation';
import type { Campaign, Target, SmtpProfile, EmailTemplate } from '@shared/schema';

// Base URL for tracking links & pixels (allow override via env)
const BASE_URL = process.env.APP_BASE_URL || 'http://localhost:5000';

/**
 * Rewrites hyperlinks in the HTML so clicks route via tracking endpoint.
 * Current rule set (kept intentionally simple):
 *  - Only rewrites absolute http/https URLs (skips mailto:, tel:, javascript:, relative links, already-tracked links)
 */
function rewriteLinks(html: string, campaign: Campaign, target: Target): string {
  const $ = load(html);
  $('a[href]').each((_index, element) => {
    const anchor = $(element);
    const url = anchor.attr('href') || '';
    if (!/^https?:\/\//i.test(url)) return;
    // Capture links and existing simulation links already carry signed tokens.
    const parsed = new URL(url);
    if (parsed.origin === new URL(BASE_URL).origin && /^\/(c|l)\//.test(parsed.pathname)) return;
    anchor.attr('href', `${BASE_URL}/c/${campaign.id}/${target.id}?token=${trackingToken(campaign.id,target.id)}`);
  });
  return $.html();
}
function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, character => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[character]!));
}

/**
 * Injects a 1x1 tracking pixel just before </body> (or appends if no body tag)
 */
function injectOpenPixel(html: string, campaign: Campaign, target: Target): string {
  const pixelTag = `<img src="${BASE_URL}/o/${campaign.id}/${target.id}.gif?token=${trackingToken(campaign.id, target.id)}" width="1" height="1" style="display:none" alt="" />`;
  if (/<\/body\s*>/i.test(html)) {
    return html.replace(/<\/body\s*>/i, `${pixelTag}</body>`);
  }
  return html + pixelTag;
}

export function renderTemplate(html: string, target: Target, template: EmailTemplate, campaign: Campaign, landingId?: number) {
  const trackingUrl = `${BASE_URL}/l/${campaign.id}/${target.id}?token=${trackingToken(campaign.id, target.id)}`;
  
  // Signed capture link bound to this campaign and recipient.
  const captureLink = landingId ? `${BASE_URL}/c/login?cid=${campaign.id}&tid=${template.id}&lid=${landingId}&targetId=${target.id}&token=${trackingToken(campaign.id, target.id)}` : '';
  
  assertTemplateVariables(html);
  const values:Record<string,string>={FirstName:target.firstName||'',LastName:target.lastName||'',Email:target.email||'',SenderName:template.sender_name||'PhishNet Team',Position:target.position||'',Department:target.department||'',TrackingURL:trackingUrl,CredentialCaptureLink:captureLink};
  let out=html.replace(/{{\s*\.?([A-Za-z][A-Za-z0-9_]*)\s*}}/g,(_match,name)=>escapeHtml(values[name]||''));
  
  // Rewrite links for click tracking & inject open pixel
  out = rewriteLinks(out, campaign, target);
  out = injectOpenPixel(out, campaign, target);
  return out;
}

export async function createTransport(profile: SmtpProfile, onDataStarted?:()=>void) {
  const enableDebug = process.env.NODE_ENV !== 'production' && (process.env.SMTP_DEBUG === '1' || process.env.SMTP_DEBUG === 'true');
  if (process.env.MAIL_TRANSPORT === 'sink') return nodemailer.createTransport({ jsonTransport: true });
  const {pool}=await import('../db');
  const oauth=await pool.query('SELECT 1 FROM smtp_oauth_connections WHERE profile_id=$1 AND organization_id=$2 AND enabled',[profile.id,profile.organizationId]);
  if(oauth.rowCount){const {microsoftSmtpTransport}=await import('./microsoft-smtp');return microsoftSmtpTransport(profile.id,profile.organizationId,onDataStarted);}
  const logger={trace(){},info(){},warn(){},error(){},fatal(){},debug(data:any,message:string,...args:any[]){
    if(data?.tnx==='client'&&(message==='DATA'||message==='%s'&&args[0]==='DATA'))onDataStarted?.();
  }};
  const transporter = nodemailer.createTransport({
    host: profile.host,
    port: profile.port,
    secure: profile.port === 465, // true for 465, false for 587 (STARTTLS)
    requireTLS: process.env.NODE_ENV === 'production' && profile.port !== 465,
    auth: {
      user: profile.username,
      pass: profile.password,
    },
    connectionTimeout: 10000,
    greetingTimeout: 10000,
    socketTimeout: 30000,
    logger,
    debug: true,
  });
  return transporter;
}

// Compatibility entry point: request handlers enqueue; only the worker sends.
export async function sendCampaignEmails(campaignId: number, organizationId: number) {
  const { enqueueCampaign } = await import('./campaign-dispatch');
  return enqueueCampaign(campaignId, organizationId);
}

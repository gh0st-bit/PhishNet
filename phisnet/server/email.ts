import { MailService } from '@sendgrid/mail';
import nodemailer from 'nodemailer';
import { storage } from './storage';
import jwt from 'jsonwebtoken';
import { User } from '@shared/schema';

// Configure SendGrid if available
const SENDGRID_AVAILABLE = !!process.env.SENDGRID_API_KEY;
const mailService = new MailService();
if (SENDGRID_AVAILABLE) {
  mailService.setApiKey(process.env.SENDGRID_API_KEY as string);
}

// Email configuration
const EMAIL_FROM = 'noreply@phishnet.io';
const EMAIL_NAME = 'PhishNet Security';

// JWT secret for password reset tokens
const JWT_SECRET = process.env.JWT_SECRET || 'phishnet-password-reset-secret';
// Token expiration time (1 hour)
const TOKEN_EXPIRY = '1h';

/**
 * Title-cases a string (each word capitalized)
 */
function toTitleCase(s: string) {
  return s
    .toLowerCase()
    .replace(/\b\w+/g, (w) => w.charAt(0).toUpperCase() + w.slice(1));
}

/**
 * Attempt to derive a human-friendly name from an email address.
 * Examples:
 *  - "umar.waqar@mail.com" -> "Umar Waqar"
 *  - "umarwaqar390@mail.com" -> "Umar Waqar" (best-effort)
 */
function guessNameFromEmail(email?: string): string | null {
  if (!email) return null;
  let local = email.split('@')[0] || '';
  // Replace separators with spaces and remove trailing numbers
  local = local.replace(/[._+-]+/g, ' ').replace(/\d+/g, ' ').trim();

  if (!local) return null;

  // If still a single token like "umarwaqar", try a best-effort split
  if (!/\s/.test(local)) {
    const re = /^([a-z]{3,})([a-z]{3,})$/i;
    const m = re.exec(local);
    if (m) {
      local = `${m[1]} ${m[2]}`;
    }
  }

  // Collapse multiple spaces and title case
  local = local.replace(/\s{2,}/g, ' ').trim();
  return local ? toTitleCase(local) : null;
}

/**
 * Resolve the best display name for a user.
 * Priority: displayName/name -> firstName + lastName -> derived from email -> generic fallback.
 */
function getRecipientName(user: User): string {
  const anyUser = user as any;
  const candidates = [
    anyUser?.displayName,
    anyUser?.name,
    `${user.firstName ?? ''} ${user.lastName ?? ''}`.trim(),
  ].filter((v: any) => typeof v === 'string' && v.trim().length > 0) as string[];

  if (candidates.length > 0) {
    return toTitleCase(candidates[0]);
  }

  const guessed = guessNameFromEmail(user.email);
  return guessed || 'there';
}

/**
 * Generates a JWT token for password reset
 */
export function generatePasswordResetToken(user: User) {
  return jwt.sign(
    {
      userId: user.id,
      email: user.email,
      purpose: 'password-reset',
    },
    JWT_SECRET,
    { expiresIn: TOKEN_EXPIRY }
  );
}

/**
 * Generates a JWT token for email verification
 */
export function generateEmailVerificationToken(user: User) {
  return jwt.sign(
    {
      userId: user.id,
      email: user.email,
      purpose: 'email-verification',
    },
    JWT_SECRET,
    { expiresIn: '24h' } // 24 hour expiry for email verification
  );
}

/**
 * Verifies the email verification token
 */
export function verifyEmailVerificationToken(token: string): { userId: number; email: string } | null {
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as {
      userId: number;
      email: string;
      purpose: string;
    };
    
    // Check if the token was generated for email verification
    if (decoded.purpose !== 'email-verification') {
      return null;
    }
    
    return {
      userId: decoded.userId,
      email: decoded.email,
    };
  } catch (error) {
    console.error('Email verification token failed:', error);
    return null;
  }
}

/**
 * Verifies the reset token
 */
export function verifyPasswordResetToken(token: string): { userId: number; email: string } | null {
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as {
      userId: number;
      email: string;
      purpose: string;
    };
    
    // Check if the token was generated for password reset
    if (decoded.purpose !== 'password-reset') {
      return null;
    }
    
    return {
      userId: decoded.userId,
      email: decoded.email,
    };
  } catch (error) {
    console.error('Token verification failed:', error);
    return null;
  }
}

/**
 * Sends a password reset email
 */
export async function sendPasswordResetEmail(user: User, resetUrl: string) {
  try {
    const subject = 'Reset Your PhishNet Password';
    const recipientName = getRecipientName(user);
    const text = `
        Hello ${recipientName},
        
        You've requested to reset your password for your PhishNet account.
        
        Please click the link below to reset your password:
        ${resetUrl}
        
        This link will expire in 1 hour for security reasons.
        
        If you didn't request this password reset, please ignore this email or contact support if you have concerns.
        
        Thank you,
        PhishNet Security Team
      `;
    const html = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #ddd; border-radius: 5px;">
          <div style="text-align: center; margin-bottom: 20px;">
            <h2 style="color: #FF8000;">PhishNet Password Reset</h2>
          </div>
          
          <p>Hello ${recipientName},</p>
          
          <p>You've requested to reset your password for your PhishNet account.</p>
          
          <p>Please click the button below to reset your password:</p>
          
          <div style="text-align: center; margin: 30px 0;">
            <a href="${resetUrl}" style="background-color: #FF8000; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px; font-weight: bold;">
              Reset Password
            </a>
          </div>
          
          <p style="color: #666; font-size: 14px;">This link will expire in 1 hour for security reasons.</p>
          
          <p>If you didn't request this password reset, please ignore this email or contact support if you have concerns.</p>
          
          <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #ddd; color: #666; font-size: 12px;">
            <p>Thank you,<br>PhishNet Security Team</p>
          </div>
        </div>
      `;

    if (SENDGRID_AVAILABLE) {
      const msg = {
        to: user.email,
        from: { email: EMAIL_FROM, name: EMAIL_NAME },
        subject,
        text,
        html,
      } as any;
      await mailService.send(msg);
      console.log('Password reset email sent via SendGrid to:', user.email);
      return true;
    }

    // Fallback to SMTP using first available SMTP profile in user's org or env
    try {
      let fromEmail = process.env.SMTP_FROM_EMAIL || EMAIL_FROM;
      let fromName = process.env.SMTP_FROM_NAME || EMAIL_NAME;
      let host = process.env.SMTP_HOST;
      let port = process.env.SMTP_PORT ? parseInt(process.env.SMTP_PORT, 10) : undefined;
      let username = process.env.SMTP_USERNAME;
      let password = process.env.SMTP_PASSWORD;

      if (!host || !port || !username || !password) {
        // Try fetching an SMTP profile from the same organization
        if ((user as any).organizationId) {
          const profiles = await storage.listSmtpProfiles((user as any).organizationId);
          if (profiles && profiles.length > 0) {
            const p = profiles[0];
            host = p.host; port = p.port; username = p.username; password = p.password;
            fromEmail = p.fromEmail || fromEmail; fromName = p.fromName || fromName;
          }
        }
      }

      if (!host || !port || !username || !password) {
        console.error('SMTP not configured and SendGrid unavailable');
        return false;
      }

      const transporter = nodemailer.createTransport({
        host,
        port,
        secure: port === 465,
        auth: { user: username, pass: password },
      });
      try { await transporter.verify(); } catch {}
      const info = await transporter.sendMail({
        from: `${fromName} <${fromEmail}>`,
        to: user.email,
        subject,
        text,
        html,
      });
      console.log('Password reset email sent via SMTP to:', user.email, 'messageId:', (info as any).messageId);
      return true;
    } catch (smtpErr) {
      console.error('SMTP fallback failed:', smtpErr);
      return false;
    }
  } catch (error) {
    console.error('Error sending password reset email:', error);
    return false;
  }
}

/**
 * Sends an email verification email
 */
export async function sendEmailVerificationEmail(user: User, verificationUrl: string) {
  try {
    const subject = 'Verify Your PhishNet Email Address';
    const recipientName = getRecipientName(user);
    const text = `
        Hello ${recipientName},
        
        Welcome to PhishNet! Please verify your email address to complete your registration.
        
        Click the link below to verify your email:
        ${verificationUrl}
        
        This link will expire in 24 hours for security reasons.
        
        If you didn't create this account, please ignore this email.
        
        Thank you,
        PhishNet Security Team
      `;
    const html = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #ddd; border-radius: 5px;">
          <div style="text-align: center; margin-bottom: 20px;">
            <h2 style="color: #FF8000;">Welcome to PhishNet!</h2>
          </div>
          
          <p>Hello ${recipientName},</p>
          
          <p>Thank you for registering with PhishNet. Please verify your email address to complete your registration and access all features.</p>
          
          <div style="text-align: center; margin: 30px 0;">
            <a href="${verificationUrl}" style="background-color: #FF8000; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px; font-weight: bold;">
              Verify Email Address
            </a>
          </div>
          
          <p style="color: #666; font-size: 14px;">This link will expire in 24 hours for security reasons.</p>
          
          <p>If you didn't create this account, please ignore this email.</p>
          
          <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #ddd; color: #666; font-size: 12px;">
            <p>Thank you,<br>PhishNet Security Team</p>
          </div>
        </div>
      `;

    if (SENDGRID_AVAILABLE) {
      const msg = {
        to: user.email,
        from: { email: EMAIL_FROM, name: EMAIL_NAME },
        subject,
        text,
        html,
      } as any;
      await mailService.send(msg);
      console.log('Email verification sent via SendGrid to:', user.email);
      return true;
    }

    // Fallback to SMTP
    try {
      let fromEmail = process.env.SMTP_FROM_EMAIL || EMAIL_FROM;
      let fromName = process.env.SMTP_FROM_NAME || EMAIL_NAME;
      let host = process.env.SMTP_HOST;
      let port = process.env.SMTP_PORT ? parseInt(process.env.SMTP_PORT, 10) : undefined;
      let username = process.env.SMTP_USERNAME;
      let password = process.env.SMTP_PASSWORD;

      if (!host || !port || !username || !password) {
        // Try fetching an SMTP profile from the same organization
        if ((user as any).organizationId) {
          const profiles = await storage.listSmtpProfiles((user as any).organizationId);
          if (profiles && profiles.length > 0) {
            const p = profiles[0];
            host = p.host; port = p.port; username = p.username; password = p.password;
            fromEmail = p.fromEmail || fromEmail; fromName = p.fromName || fromName;
          }
        }
      }

      if (!host || !port || !username || !password) {
        console.warn('SMTP not configured for email verification - user must verify manually');
        return false;
      }

      const transporter = nodemailer.createTransport({
        host,
        port,
        secure: port === 465,
        auth: { user: username, pass: password },
      });
      try { await transporter.verify(); } catch {}
      const info = await transporter.sendMail({
        from: `${fromName} <${fromEmail}>`,
        to: user.email,
        subject,
        text,
        html,
      });
      console.log('Email verification sent via SMTP to:', user.email, 'messageId:', (info as any).messageId);
      return true;
    } catch (smtpErr) {
      console.error('SMTP fallback failed for verification email:', smtpErr);
      return false;
    }
  } catch (error) {
    console.error('Error sending email verification:', error);
    return false;
  }
}

/**
 * Sends an enrollment/invitation email with accept link
 */
export async function sendEnrollmentInviteEmail(params: { toEmail: string; organizationName?: string; inviteUrl: string; }) {
  const { toEmail, organizationName, inviteUrl } = params;
  try {
    const subject = `You're invited to join ${organizationName || 'PhishNet'}`;
    const text = `
        Hello,
        
        You've been invited to join ${organizationName || 'PhishNet'}.
        Click the link below to set your password and activate your account:
        ${inviteUrl}
        
        This link will expire soon for security reasons.
        
        If you weren't expecting this, you can ignore this email.
      `;
    const html = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #ddd; border-radius: 5px;">
          <div style="text-align: center; margin-bottom: 20px;">
            <h2 style="color: #FF8000;">You're Invited</h2>
          </div>
          <p>Hello,</p>
          <p>You've been invited to join ${organizationName || 'PhishNet'}.</p>
          <p>Please click the button below to set your password and activate your account:</p>
          <div style="text-align: center; margin: 30px 0;">
            <a href="${inviteUrl}" style="background-color: #FF8000; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px; font-weight: bold;">
              Accept Invitation
            </a>
          </div>
          <p style="color: #666; font-size: 14px;">This link will expire soon for security reasons.</p>
          <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #ddd; color: #666; font-size: 12px;">
            <p>Thank you,<br/>PhishNet Security Team</p>
          </div>
        </div>
      `;

    if (SENDGRID_AVAILABLE) {
      const msg = {
        to: toEmail,
        from: { email: EMAIL_FROM, name: EMAIL_NAME },
        subject,
        text,
        html,
      } as any;
      await mailService.send(msg);
      console.log('Enrollment invite email sent via SendGrid to:', toEmail);
      return true;
    }

    // Fallback to SMTP
    try {
      let fromEmail = process.env.SMTP_FROM_EMAIL || EMAIL_FROM;
      let fromName = process.env.SMTP_FROM_NAME || EMAIL_NAME;
      const host = process.env.SMTP_HOST;
      const port = process.env.SMTP_PORT ? parseInt(process.env.SMTP_PORT, 10) : undefined;
      const username = process.env.SMTP_USERNAME;
      const password = process.env.SMTP_PASSWORD;

      if (!host || !port || !username || !password) {
        console.warn('SMTP not configured for enrollment invites');
        return false;
      }

      const transporter = nodemailer.createTransport({
        host,
        port,
        secure: port === 465,
        auth: { user: username, pass: password },
      });
      try { await transporter.verify(); } catch {}
      const info = await transporter.sendMail({
        from: `${fromName} <${fromEmail}>`,
        to: toEmail,
        subject,
        text,
        html,
      });
      console.log('Enrollment invite email sent via SMTP to:', toEmail, 'messageId:', (info as any).messageId);
      return true;
    } catch (smtpErr) {
      console.error('SMTP enrollment invite failed:', smtpErr);
      return false;
    }
  } catch (error) {
    console.error('Error sending enrollment invite email:', error);
    return false;
  }
}

/**
 * Sends an email to admins when an invitation is accepted (subject to preferences).
 */
export async function sendInviteAcceptedEmail(params: { toEmail: string; organizationName?: string; userFullName: string; invitedEmail: string; }) {
  const { toEmail, organizationName, userFullName, invitedEmail } = params;
  try {
    const subject = `Invitation accepted in ${organizationName || 'PhishNet'}`;
    const text = `Hello,

${userFullName} (${invitedEmail}) has accepted their invitation and activated an account in ${organizationName || 'PhishNet'}.

You can review users in the admin enrollment section.

— PhishNet Security Team`;
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin:0 auto; padding:20px; border:1px solid #ddd; border-radius:6px;">
        <h2 style="color:#FF8000; margin-top:0;">Invitation Accepted</h2>
        <p><strong>${userFullName}</strong> (<code>${invitedEmail}</code>) has accepted an invitation and activated an account in <strong>${organizationName || 'PhishNet'}</strong>.</p>
        <p style="margin:24px 0;">
          <a href="${process.env.BASE_URL || 'http://localhost:5000'}/admin/enroll" style="background:#FF8000;color:#fff;padding:12px 20px;text-decoration:none;border-radius:4px;font-weight:bold;">View Enrollment</a>
        </p>
        <p style="color:#666;font-size:13px;">If you did not expect this action you can revoke access or adjust user roles.</p>
        <hr style="border:none;border-top:1px solid #eee;margin:28px 0;" />
        <p style="color:#666;font-size:12px;">PhishNet Security Team</p>
      </div>
    `;

    if (SENDGRID_AVAILABLE) {
      const msg = { to: toEmail, from: { email: EMAIL_FROM, name: EMAIL_NAME }, subject, text, html } as any;
      await mailService.send(msg);
      console.log('Invite accepted email sent via SendGrid to:', toEmail);
      return true;
    }

    // SMTP fallback
    try {
      let fromEmail = process.env.SMTP_FROM_EMAIL || EMAIL_FROM;
      let fromName = process.env.SMTP_FROM_NAME || EMAIL_NAME;
      const host = process.env.SMTP_HOST;
      const port = process.env.SMTP_PORT ? parseInt(process.env.SMTP_PORT, 10) : undefined;
      const username = process.env.SMTP_USERNAME;
      const password = process.env.SMTP_PASSWORD;
      if (!host || !port || !username || !password) {
        console.warn('SMTP not configured for invite accepted emails');
        return false;
      }
      const transporter = nodemailer.createTransport({ host, port, secure: port === 465, auth: { user: username, pass: password } });
      try { await transporter.verify(); } catch {}
      const info = await transporter.sendMail({ from: `${fromName} <${fromEmail}>`, to: toEmail, subject, text, html });
      console.log('Invite accepted email sent via SMTP to:', toEmail, 'messageId:', (info as any).messageId);
      return true;
    } catch (smtpErr) {
      console.error('SMTP invite accepted email failed:', smtpErr);
      return false;
    }
  } catch (error) {
    console.error('Error sending invite accepted email:', error);
    return false;
  }
}
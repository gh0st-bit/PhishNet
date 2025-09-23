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
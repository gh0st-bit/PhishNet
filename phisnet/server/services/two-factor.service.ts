import speakeasy from 'speakeasy';
import QRCode from 'qrcode';
import { randomBytes, scrypt, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';

const scryptAsync = promisify(scrypt);

/**
 * TwoFactorService encapsulates TOTP secret generation, verification, QR code rendering
 * and backup code issuance / validation.
 */
export class TwoFactorService {
  private static readonly ISSUER = 'PhishNet';
  private static readonly WINDOW = 1; // allow previous/next 30s window

  /** Generate a new TOTP secret (base32 + otpauth URL info) */
  static generateSecret(email: string) {
    return speakeasy.generateSecret({
      length: 32,
      name: `${this.ISSUER} (${email})`,
      issuer: this.ISSUER
    });
  }

  /** Render a QR code data URL for authenticator apps */
  static async generateQRCode(base32Secret: string, email: string): Promise<string> {
    const otpauth = speakeasy.otpauthURL({
      secret: base32Secret,
      label: email,
      issuer: this.ISSUER,
      encoding: 'base32'
    });
    return QRCode.toDataURL(otpauth);
  }

  /** Verify a 6‑digit token against a base32 secret */
  static verifyToken(base32Secret: string, token: string): boolean {
    if (!/^\d{6}$/.test(token)) return false;
    return speakeasy.totp.verify({
      secret: base32Secret,
      encoding: 'base32',
      token,
      window: this.WINDOW
    });
  }

  /** Generate human‑friendly one‑time backup codes */
  static generateBackupCodes(count = 8): string[] {
    const codes: string[] = [];
    for (let i = 0; i < count; i++) {
      const raw = randomBytes(4).toString('hex').toUpperCase(); // 8 hex chars
      codes.push(`${raw.slice(0,4)}-${raw.slice(4)}`);
    }
    return codes;
  }

  /** Hash backup code using scrypt (similar pattern to password hashing) */
  static async hashBackupCode(code: string): Promise<string> {
    const salt = randomBytes(16).toString('hex');
    const buf = (await scryptAsync(code, salt, 32)) as Buffer;
    return `${buf.toString('hex')}.${salt}`;
  }

  /** Constant‑time verification of a supplied backup code */
  static async verifyBackupCode(hashed: string, supplied: string): Promise<boolean> {
    const [storedHex, salt] = hashed.split('.');
    if (!storedHex || !salt) return false;
    const storedBuf = Buffer.from(storedHex, 'hex');
    const suppliedBuf = (await scryptAsync(supplied, salt, 32)) as Buffer;
    return timingSafeEqual(storedBuf, suppliedBuf);
  }
}

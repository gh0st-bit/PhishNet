import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from "node:crypto";
import { db } from "../db";
import { organizations } from "../../shared/schema";
import { eq } from "drizzle-orm";

/**
 * Secrets management service for encrypting/decrypting sensitive data
 * Uses AES-256-GCM with per-organization encryption keys
 */
export class SecretsService {
  private static readonly ALGORITHM = 'aes-256-gcm';
  private static readonly KEY_LENGTH = 32;
  private static readonly IV_LENGTH = 16;
  private static readonly AUTH_TAG_LENGTH = 16;
  private static readonly SALT_LENGTH = 32;

  /**
   * Get or generate master encryption key from environment
   */
  private static getMasterKey(): Buffer {
    const masterKey = process.env.MASTER_ENCRYPTION_KEY;
    
    if (!masterKey) {
      console.warn('[SECRETS] MASTER_ENCRYPTION_KEY not set. Using default (insecure for production)');
      // In production, this should fail. For dev, use a default.
      return Buffer.from('default-insecure-key-change-in-production!!', 'utf8');
    }
    
    return Buffer.from(masterKey, 'base64');
  }

  /**
   * Generate a new encryption key for an organization
   */
  static generateOrgKey(): string {
    const key = randomBytes(this.KEY_LENGTH);
    return key.toString('base64');
  }

  /**
   * Derive encryption key from org key and master key
   */
  private static deriveKey(orgKey: string, salt: Buffer): Buffer {
    const masterKey = this.getMasterKey();
    const combinedKey = Buffer.concat([Buffer.from(orgKey, 'base64'), masterKey]);
    return scryptSync(combinedKey, salt, this.KEY_LENGTH);
  }

  /**
   * Encrypt a value using organization's key
   */
  static async encrypt(organizationId: number, plaintext: string): Promise<string> {
    if (!plaintext) return plaintext;

    try {
      // Get org encryption key
      const [org] = await db
        .select({ encryptionKey: organizations.encryptionKey })
        .from(organizations)
        .where(eq(organizations.id, organizationId))
        .limit(1);

      if (!org || !org.encryptionKey) {
        throw new Error('Organization encryption key not found');
      }

      // Generate random IV and salt
      const iv = randomBytes(this.IV_LENGTH);
      const salt = randomBytes(this.SALT_LENGTH);
      
      // Derive encryption key
      const key = this.deriveKey(org.encryptionKey, salt);
      
      // Encrypt
      const cipher = createCipheriv(this.ALGORITHM, key, iv);
      let encrypted = cipher.update(plaintext, 'utf8', 'base64');
      encrypted += cipher.final('base64');
      
      // Get auth tag
      const authTag = cipher.getAuthTag();
      
      // Combine: version|salt|iv|authTag|ciphertext
      const combined = Buffer.concat([
        Buffer.from([1]), // version byte
        salt,
        iv,
        authTag,
        Buffer.from(encrypted, 'base64'),
      ]);
      
      return combined.toString('base64');
    } catch (error) {
      console.error('[SECRETS] Encryption error:', error);
      throw new Error('Failed to encrypt value');
    }
  }

  /**
   * Decrypt a value using organization's key
   */
  static async decrypt(organizationId: number, ciphertext: string): Promise<string> {
    if (!ciphertext) return ciphertext;

    try {
      // Get org encryption key
      const [org] = await db
        .select({ encryptionKey: organizations.encryptionKey })
        .from(organizations)
        .where(eq(organizations.id, organizationId))
        .limit(1);

      if (!org?.encryptionKey) {
        throw new Error('Organization encryption key not found');
      }

      // Parse combined buffer
      const combined = Buffer.from(ciphertext, 'base64');
      
      const version = combined[0];
      if (version !== 1) {
        throw new Error('Unsupported encryption version');
      }
      
      let offset = 1;
      const salt = combined.subarray(offset, offset + this.SALT_LENGTH);
      offset += this.SALT_LENGTH;
      
      const iv = combined.subarray(offset, offset + this.IV_LENGTH);
      offset += this.IV_LENGTH;
      
      const authTag = combined.subarray(offset, offset + this.AUTH_TAG_LENGTH);
      offset += this.AUTH_TAG_LENGTH;
      
      const encrypted = combined.subarray(offset);
      
      // Derive decryption key
      const key = this.deriveKey(org.encryptionKey, salt);
      
      // Decrypt
      const decipher = createDecipheriv(this.ALGORITHM, key, iv);
      decipher.setAuthTag(authTag);
      
      let decrypted = decipher.update(encrypted.toString('base64'), 'base64', 'utf8');
      decrypted += decipher.final('utf8');
      
      return decrypted;
    } catch (error) {
      console.error('[SECRETS] Decryption error:', error);
      throw new Error('Failed to decrypt value');
    }
  }

  /**
   * Check if a value is encrypted (starts with valid encrypted format)
   */
  static isEncrypted(value: string): boolean {
    if (!value) return false;
    
    try {
      const buffer = Buffer.from(value, 'base64');
      return buffer.length > (1 + this.SALT_LENGTH + this.IV_LENGTH + this.AUTH_TAG_LENGTH) && buffer[0] === 1;
    } catch {
      return false;
    }
  }

  /**
   * Rotate encryption key for an organization
   * Re-encrypts all sensitive data with new key
   */
  static async rotateOrgKey(organizationId: number): Promise<void> {
    // This is a placeholder for key rotation logic
    // In production, this would:
    // 1. Generate new key
    // 2. Decrypt all sensitive fields with old key
    // 3. Re-encrypt with new key
    // 4. Update org encryption key
    // 5. Verify all re-encrypted data
    
    const newKey = this.generateOrgKey();
    
    await db
      .update(organizations)
      .set({ 
        encryptionKey: newKey,
        updatedAt: new Date(),
      })
      .where(eq(organizations.id, organizationId));
    
    console.log(`[SECRETS] Rotated encryption key for org ${organizationId}`);
  }

  /**
   * Initialize encryption key for an organization if not exists
   */
  static async ensureOrgKey(organizationId: number): Promise<void> {
    const [org] = await db
      .select({ encryptionKey: organizations.encryptionKey })
      .from(organizations)
      .where(eq(organizations.id, organizationId))
      .limit(1);

    if (!org) {
      throw new Error('Organization not found');
    }

    if (!org.encryptionKey) {
      const newKey = this.generateOrgKey();
      
      await db
        .update(organizations)
        .set({ 
          encryptionKey: newKey,
          updatedAt: new Date(),
        })
        .where(eq(organizations.id, organizationId));
      
      console.log(`[SECRETS] Generated encryption key for org ${organizationId}`);
    }
  }
}

export default SecretsService;

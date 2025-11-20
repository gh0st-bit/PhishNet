# Secrets Management Guide

## Overview
PhishNet implements industry-standard secrets management with AES-256-GCM encryption for securing sensitive data including:
- SMTP passwords
- SSO certificates and client secrets
- API keys
- Other organization-specific secrets

## Architecture

### Encryption Strategy
- **Algorithm**: AES-256-GCM (Galois/Counter Mode)
- **Key Derivation**: scrypt with per-organization salts
- **Key Hierarchy**: Master key → Organization keys → Encrypted data

### Storage Format
```
[version:1 byte][salt:32 bytes][iv:16 bytes][authTag:16 bytes][ciphertext:variable]
```
All components are base64-encoded for storage.

## Setup

### 1. Generate Master Encryption Key

```bash
# Generate secure 32-byte key
openssl rand -base64 32
```

### 2. Configure Environment

Add to `.env`:
```bash
MASTER_ENCRYPTION_KEY=<your-generated-key-here>
```

**CRITICAL**: Never commit this key to version control!

### 3. Initialize Organization Keys

Organization encryption keys are automatically generated when:
- A new organization is created during user registration
- The `SecretsService.ensureOrgKey()` method is called

## Usage

### Encrypting Sensitive Data

```typescript
import SecretsService from './services/secrets.service';

// Encrypt password
const encryptedPassword = await SecretsService.encrypt(
  organizationId,
  plainTextPassword
);

// Store in database
await db.insert(smtpProfiles).values({
  password: encryptedPassword,
  // ... other fields
});
```

### Decrypting Sensitive Data

```typescript
// Retrieve from database
const profile = await db.select()
  .from(smtpProfiles)
  .where(eq(smtpProfiles.id, profileId));

// Decrypt password
const plainPassword = await SecretsService.decrypt(
  organizationId,
  profile.password
);
```

### Key Rotation

```typescript
// Rotate organization encryption key (re-encrypts all data)
await SecretsService.rotateOrgKey(organizationId);
```

**Note**: Key rotation is currently a placeholder and requires implementation of:
1. Fetching all encrypted fields for the organization
2. Decrypting with old key
3. Generating new key
4. Re-encrypting with new key
5. Updating all records

## Security Best Practices

### Environment Variables
1. **Never commit** `.env` files with production keys
2. Use `.env.example` for templates only
3. Consider using secrets management services in production:
   - AWS Secrets Manager
   - Azure Key Vault
   - HashiCorp Vault
   - dotenv-vault for team environments

### Key Management
1. **Master Key**:
   - Store in secure vault service
   - Rotate periodically (e.g., every 90 days)
   - Use different keys for dev/staging/production
   
2. **Organization Keys**:
   - Automatically generated per tenant
   - Stored encrypted in database
   - Never expose in API responses

### Access Control
1. Only decrypt when absolutely necessary
2. Never log decrypted values
3. Use time-limited access where possible
4. Audit all decryption operations

## API Endpoints

### SMTP Profiles
```http
# Create SMTP profile (auto-encrypts password)
POST /api/smtp-profiles
Content-Type: application/json

{
  "name": "Gmail SMTP",
  "host": "smtp.gmail.com",
  "port": 587,
  "username": "user@example.com",
  "password": "plaintext-password",  # Encrypted before storage
  "fromEmail": "sender@example.com",
  "fromName": "Sender Name"
}

# List SMTP profiles (auto-decrypts passwords)
GET /api/smtp-profiles
```

### SSO Configuration
```http
# Update SSO config (auto-encrypts secrets)
PUT /api/sso/config
Content-Type: application/json
Authorization: Bearer <admin-token>

{
  "provider": "saml",
  "enabled": true,
  "entityId": "https://idp.example.com",
  "ssoUrl": "https://idp.example.com/sso",
  "certificate": "-----BEGIN CERTIFICATE-----...",  # Encrypted
  "clientSecret": "secret-value"  # Encrypted (OIDC)
}

# Get SSO config (sensitive fields excluded)
GET /api/sso/config
Authorization: Bearer <token>
```

## Monitoring

### Health Checks
- Verify `MASTER_ENCRYPTION_KEY` is set on startup
- Log warnings for insecure default keys
- Monitor failed encryption/decryption operations

### Audit Logging
All encryption operations should be audited:
- Which organization's data was accessed
- When decryption occurred
- Which user/service initiated the operation

## Troubleshooting

### "Invalid authentication tag" Error
- **Cause**: Wrong encryption key or corrupted data
- **Solution**: Verify organization encryption key is correct; check database integrity

### "Decryption failed" Error
- **Cause**: Data format mismatch or key rotation issue
- **Solution**: Check encryption version byte; verify data wasn't manually modified

### Missing Encryption Key
- **Cause**: Organization created before encryption feature
- **Solution**: Run `SecretsService.ensureOrgKey(organizationId)` to initialize

## Migration Guide

### Encrypting Existing Data

```typescript
import { db } from './db';
import { smtpProfiles } from '../shared/schema';
import SecretsService from './services/secrets.service';

// Encrypt existing SMTP passwords
const profiles = await db.select().from(smtpProfiles);

for (const profile of profiles) {
  // Check if already encrypted
  if (!SecretsService.isEncrypted(profile.password)) {
    const encrypted = await SecretsService.encrypt(
      profile.organizationId,
      profile.password
    );
    
    await db.update(smtpProfiles)
      .set({ password: encrypted })
      .where(eq(smtpProfiles.id, profile.id));
  }
}
```

## Production Considerations

### Backup and Recovery
1. **Master Key**: Store encrypted backup in secure location
2. **Organization Keys**: Backed up with database
3. **Recovery Process**: Restore from secure vault + database backup

### Performance
- Encryption/decryption adds ~1-5ms per operation
- Use connection pooling for database operations
- Cache decrypted values in memory (with TTL) if needed

### Compliance
This implementation supports:
- **GDPR**: Encryption at rest requirement
- **HIPAA**: Administrative, physical, and technical safeguards
- **PCI DSS**: Protection of cardholder data
- **SOC 2**: Security controls for data protection

### High Availability
- Master key must be available to all application instances
- Consider using distributed secrets management
- Implement key rotation without downtime

## References

- [NIST SP 800-38D (GCM Specification)](https://nvlpubs.nist.gov/nistpubs/Legacy/SP/nistspecialpublication800-38d.pdf)
- [OWASP Cryptographic Storage Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Cryptographic_Storage_Cheat_Sheet.html)
- [Node.js Crypto Module Documentation](https://nodejs.org/api/crypto.html)

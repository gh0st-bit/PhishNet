# PhishNet Enrollment System - Security Documentation

## Overview
PhishNet implements a secure, invitation-based enrollment system similar to KnowBe4's user onboarding flow. This document describes the security measures, architecture, and best practices implemented.

## Security Features

### 1. Token Hashing
- **Implementation**: All invitation tokens are hashed using bcrypt (cost factor 10) before storage
- **Process Flow**:
  1. Admin creates invite → generates random 64-character hex token
  2. Token is hashed using bcrypt before database storage
  3. Original (unhashed) token is sent in invitation email
  4. On acceptance, system verifies token against all hashed tokens in database
- **Benefit**: Even if database is compromised, attackers cannot extract usable invitation links

### 2. Rate Limiting
- **Endpoint**: `/api/enroll/accept` (both GET and POST)
- **Limits**: 5 attempts per IP address per 15-minute window
- **Implementation**: In-memory rate limit tracker with automatic reset
- **Response**: HTTP 429 (Too Many Requests) after limit exceeded
- **Purpose**: Prevents brute-force token guessing attacks

### 3. Single-Use Enforcement
- **Database Column**: `acceptedAt` timestamp
- **Validation**:
  - Checks if `acceptedAt` is not null before processing
  - Returns clear error: "This invite has already been used"
  - Prevents duplicate account creation from same invitation
- **Additional Check**: Only searches unexpired, unaccepted invites when verifying tokens

### 4. Token Expiration
- **Default Expiry**: 7 days from invitation creation
- **Validation**: Server checks `expiresAt` timestamp before processing
- **User Experience**: Clear error message requesting admin to re-invite
- **Database Cleanup**: Expired invites remain in database for audit trail

### 5. Secure Token Generation
- **Method**: `crypto.randomBytes(32).toString('hex')`
- **Entropy**: 256 bits of randomness (64-character hex string)
- **Uniqueness**: Database enforces unique constraint on token column

## Architecture

### Database Schema
```typescript
export const userInvites = pgTable("user_invites", {
  id: serial("id").primaryKey(),
  email: text("email").notNull(),
  organizationId: integer("organization_id").references(() => organizations.id).notNull(),
  invitedByUserId: integer("invited_by_user_id").references(() => users.id),
  token: varchar("token", { length: 128 }).notNull().unique(), // Stores bcrypt hash
  expiresAt: timestamp("expires_at").notNull(),
  acceptedAt: timestamp("accepted_at"), // NULL until accepted
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
```

### Storage Methods
```typescript
// Create invite with hashed token
createUserInvite(invite: InsertUserInvite): Promise<UserInvite>

// Legacy method (returns by exact token match - for admin queries)
getUserInviteByToken(token: string): Promise<UserInvite | undefined>

// Security-enhanced method (verifies against hashed tokens)
findUserInviteByToken(token: string): Promise<UserInvite | undefined>

// List all invites for organization
listUserInvites(organizationId: number): Promise<UserInvite[]>

// Mark invite as accepted
markUserInviteAccepted(id: number): Promise<UserInvite | undefined>
```

### Enrollment Flow

#### Admin Sends Invitation
1. Admin accesses `/enrollment` page
2. Enters employee email(s) (single or bulk)
3. POST `/api/admin/enroll/invite`
   - Generates secure random token
   - Hashes token with bcrypt
   - Stores hashed token in database
   - Sends email with original (unhashed) token in URL
4. Email contains: `http://yourapp.com/api/enroll/accept?token=<ORIGINAL_TOKEN>`

#### Employee Accepts Invitation
1. Employee clicks link in email
2. GET `/api/enroll/accept?token=<ORIGINAL_TOKEN>`
   - Rate limit check (IP-based)
   - Searches unexpired, unaccepted invites
   - Verifies token against bcrypt hashes
   - Returns HTML form with hidden token field
3. Employee fills form (firstName, lastName, password)
4. POST `/api/enroll/accept`
   - Rate limit check
   - Re-verifies token
   - Checks single-use enforcement
   - Checks expiration
   - Creates user account or activates existing
   - Marks invite as accepted
   - Returns success page with login link

#### Login Enforcement
- Non-admin users must have `isActive = true` to log in
- Only accepted invitations set `isActive = true`
- Enforced in Passport LocalStrategy

## Configuration

### Environment Variables
```bash
# Base URL for invitation links (production)
BASE_URL=https://yourapp.com

# Allow insecure cookies for local testing (development only)
ALLOW_INSECURE_COOKIES=true
```

### Rate Limiting Tuning
Edit `server/routes/enrollment.ts`:
```typescript
const MAX_ATTEMPTS = 5; // attempts per window
const ATTEMPT_WINDOW = 15 * 60 * 1000; // 15 minutes in milliseconds
```

### Token Expiry Tuning
Edit invitation creation in `server/routes/enrollment.ts`:
```typescript
const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days
```

## Security Best Practices

### For Administrators
1. **Regular Cleanup**: Periodically review and delete old invitations
2. **Audit Trail**: Monitor `createdAt` and `acceptedAt` timestamps
3. **Email Validation**: Ensure emails are verified before sending invites
4. **Re-invitation**: Don't reuse tokens; generate new invitations for failed attempts

### For Developers
1. **Never Log Tokens**: Exclude tokens from application logs
2. **HTTPS Required**: Always use HTTPS in production (`BASE_URL`)
3. **Session Security**: Ensure session cookies are HttpOnly and Secure
4. **Database Backups**: Encrypt database backups containing hashed tokens

### For Deployment
1. **Set BASE_URL**: Configure production URL for invitation links
2. **Disable ALLOW_INSECURE_COOKIES**: Only enable for local development
3. **Monitor Rate Limits**: Track 429 responses for suspicious activity
4. **Email Deliverability**: Configure SPF/DKIM for invitation emails

## Security Considerations

### Token Lookup Performance
- **Challenge**: Verifying tokens requires checking all unhashed invites
- **Optimization**: Query filters to only unexpired, unaccepted invites
- **Scaling**: For large deployments (>1000 pending invites), consider:
  - Adding an email-based index for faster filtering
  - Implementing periodic cleanup of expired invites
  - Caching recent invitation attempts

### Known Limitations
1. **In-Memory Rate Limiting**: Rate limit resets on server restart
   - **Mitigation**: For production, implement Redis-based rate limiting
2. **Email Enumeration**: Failed token attempts don't reveal if email exists
   - **Current**: Returns generic "Invalid or expired invite" message
3. **Time-Based Attacks**: Response timing could theoretically leak information
   - **Mitigation**: Bcrypt's constant-time comparison helps prevent this

## Compliance & Auditing

### Audit Log Fields
- `createdAt`: When invitation was sent
- `acceptedAt`: When invitation was accepted (or NULL)
- `expiresAt`: Token expiration timestamp
- `invitedByUserId`: Admin who sent invitation

### Recommended Monitoring
1. **Unused Invitations**: Track invites not accepted within 48 hours
2. **Expiration Rate**: Monitor percentage of expired invitations
3. **Rate Limit Violations**: Alert on repeated 429 responses from same IP
4. **Account Activation**: Track time between invitation and acceptance

## Testing

### Manual Testing Checklist
- [ ] Create invitation as admin
- [ ] Verify email received with working link
- [ ] Accept invitation successfully
- [ ] Verify cannot reuse same token
- [ ] Verify expired token rejected
- [ ] Verify rate limiting after 5 attempts
- [ ] Verify login with created account
- [ ] Verify inactive accounts cannot log in

### Security Testing
```bash
# Test rate limiting (should fail after 5 attempts)
for i in {1..10}; do
  curl -X POST http://localhost:5000/api/enroll/accept \
    -H "Content-Type: application/json" \
    -d '{"token":"invalid","firstName":"Test","lastName":"User","password":"password123"}'
done

# Test token validation
curl http://localhost:5000/api/enroll/accept?token=VALID_TOKEN_HERE

# Test single-use enforcement (run twice with same valid token)
curl -X POST http://localhost:5000/api/enroll/accept \
  -H "Content-Type: application/json" \
  -d '{"token":"VALID_TOKEN","firstName":"Test","lastName":"User","password":"Test123!@#"}'
```

## Migration Notes

### Upgrading from Pre-Security Version
If upgrading from a version without token hashing:

1. **Existing Invites**: Old unhashed tokens will not work
2. **Action Required**: Regenerate all pending invitations
3. **Database Migration**: No schema changes needed
4. **User Impact**: Employees with pending invites will need new invitations

### Backward Compatibility
The system maintains backward compatibility for admin queries:
- `getUserInviteByToken()`: Direct lookup (for admin display)
- `findUserInviteByToken()`: Secure verification (for acceptance)

## Support & Troubleshooting

### Common Issues

**Issue**: "Invalid or expired invite" error  
**Cause**: Token may have expired or already been used  
**Solution**: Admin should resend invitation

**Issue**: "Too many attempts" error  
**Cause**: Rate limit exceeded  
**Solution**: Wait 15 minutes or contact admin

**Issue**: Invitation email not received  
**Cause**: SMTP configuration or spam filtering  
**Solution**: Check spam folder; verify SMTP settings

**Issue**: Cannot log in after accepting  
**Cause**: `isActive` flag not set correctly  
**Solution**: Admin should manually activate user or resend invitation

## Change Log

### Version 2.0 (Current)
- ✅ Implemented bcrypt token hashing
- ✅ Added IP-based rate limiting (5 attempts/15min)
- ✅ Enhanced single-use validation
- ✅ Improved token lookup with filtering
- ✅ Added security documentation

### Version 1.0 (Legacy)
- Basic invitation system
- Plaintext token storage
- No rate limiting
- Basic expiration checking

---

**Last Updated**: November 20, 2025  
**Maintained By**: PhishNet Security Team  
**Contact**: security@phishnet.com

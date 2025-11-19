-- Add encryption key column to organizations for per-tenant secrets management
ALTER TABLE organizations 
ADD COLUMN IF NOT EXISTS encryption_key TEXT;

COMMENT ON COLUMN organizations.encryption_key IS 'Per-organization encryption key for securing sensitive data (SMTP passwords, API keys, SSO secrets)';

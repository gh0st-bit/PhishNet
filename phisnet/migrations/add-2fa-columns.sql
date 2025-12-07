-- Add 2FA columns to users table
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS two_factor_enabled BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS two_factor_secret TEXT,
ADD COLUMN IF NOT EXISTS two_factor_backup_codes TEXT[],
ADD COLUMN IF NOT EXISTS two_factor_verified_at TIMESTAMP;

-- Add 2FA enforcement to organizations table
ALTER TABLE organizations
ADD COLUMN IF NOT EXISTS two_factor_required BOOLEAN DEFAULT FALSE;

-- Create index for faster 2FA lookups
CREATE INDEX IF NOT EXISTS idx_users_two_factor_enabled ON users(two_factor_enabled) WHERE two_factor_enabled = TRUE;

-- Add data retention policy column to organizations
ALTER TABLE organizations
  ADD COLUMN IF NOT EXISTS data_retention_days INTEGER NOT NULL DEFAULT 365;

COMMENT ON COLUMN organizations.data_retention_days IS 'Number of days to retain audit logs, notifications, and submitted data (per organization).';

-- Migration: Update threat_intelligence.indicator column to allow longer values
-- Date: 2025-09-27

-- Update the indicator column to allow unlimited length
ALTER TABLE threat_intelligence 
ALTER COLUMN indicator TYPE TEXT;

-- Add comment to document the change
COMMENT ON COLUMN threat_intelligence.indicator IS 'Threat indicator (URL, domain, IP, hash) - unlimited length';
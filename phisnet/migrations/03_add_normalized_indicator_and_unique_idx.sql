-- Add normalized_indicator column and unique index for deduplication
ALTER TABLE threat_intelligence
ADD COLUMN IF NOT EXISTS normalized_indicator TEXT;

-- Backfill normalized_indicator for existing rows
UPDATE threat_intelligence ti
SET normalized_indicator = LOWER(
  COALESCE(
    NULLIF(ti.indicator, ''),
    NULLIF(ti.url, ''),
    NULLIF(ti.domain, '')
  )
)
WHERE ti.normalized_indicator IS NULL;

-- Create a partial unique index on normalized_indicator to avoid duplicates
-- We use a WHERE clause to exclude NULLs so rows without an indicator can coexist
CREATE UNIQUE INDEX IF NOT EXISTS ux_threat_intel_normalized_indicator
ON threat_intelligence (normalized_indicator)
WHERE normalized_indicator IS NOT NULL;

-- Optional performance helpers
CREATE INDEX IF NOT EXISTS ix_threat_intel_first_seen ON threat_intelligence (first_seen DESC);
CREATE INDEX IF NOT EXISTS ix_threat_intel_is_active ON threat_intelligence (is_active);
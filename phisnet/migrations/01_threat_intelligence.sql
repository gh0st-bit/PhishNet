-- Create threat intelligence tables for PhishNet
-- This migration adds threat intelligence capabilities with real-time feed ingestion

-- Threat Intelligence table
CREATE TABLE IF NOT EXISTS threat_intelligence (
  id SERIAL PRIMARY KEY,
  
  -- Core threat data
  url TEXT,
  domain VARCHAR(255),
  indicator VARCHAR(500),
  indicator_type VARCHAR(50), -- 'url', 'domain', 'ip', 'hash'
  
  -- Classification
  threat_type VARCHAR(100), -- 'phishing', 'malware', 'spam', 'c2'
  malware_family VARCHAR(100),
  campaign_name VARCHAR(200),
  
  -- Metadata
  source VARCHAR(100) NOT NULL, -- 'urlhaus', 'openphish', etc.
  confidence INTEGER DEFAULT 0, -- 0-100
  is_active BOOLEAN DEFAULT TRUE,
  
  -- Timestamps
  first_seen TIMESTAMP NOT NULL,
  last_seen TIMESTAMP,
  expires_at TIMESTAMP,
  
  -- Additional data
  tags JSONB DEFAULT '[]'::jsonb,
  description TEXT,
  raw_data JSONB,
  
  -- PhishNet specific
  used_in_simulations BOOLEAN DEFAULT FALSE,
  organization_id INTEGER REFERENCES organizations(id) ON DELETE CASCADE,
  
  created_at TIMESTAMP DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMP DEFAULT NOW() NOT NULL
);

-- Threat Statistics table for dashboard analytics
CREATE TABLE IF NOT EXISTS threat_statistics (
  id SERIAL PRIMARY KEY,
  date TIMESTAMP NOT NULL,
  source VARCHAR(100) NOT NULL,
  threat_type VARCHAR(100) NOT NULL,
  count INTEGER DEFAULT 0,
  organization_id INTEGER REFERENCES organizations(id) ON DELETE CASCADE,
  created_at TIMESTAMP DEFAULT NOW() NOT NULL
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_threat_intel_source ON threat_intelligence(source);
CREATE INDEX IF NOT EXISTS idx_threat_intel_type ON threat_intelligence(threat_type);
CREATE INDEX IF NOT EXISTS idx_threat_intel_active ON threat_intelligence(is_active);
CREATE INDEX IF NOT EXISTS idx_threat_intel_first_seen ON threat_intelligence(first_seen);
CREATE INDEX IF NOT EXISTS idx_threat_intel_domain ON threat_intelligence(domain);
CREATE INDEX IF NOT EXISTS idx_threat_intel_url ON threat_intelligence(url);
CREATE INDEX IF NOT EXISTS idx_threat_intel_confidence ON threat_intelligence(confidence);

-- Index for statistics
CREATE INDEX IF NOT EXISTS idx_threat_stats_date ON threat_statistics(date);
CREATE INDEX IF NOT EXISTS idx_threat_stats_source ON threat_statistics(source);
CREATE INDEX IF NOT EXISTS idx_threat_stats_type ON threat_statistics(threat_type);

-- Add comments for documentation
COMMENT ON TABLE threat_intelligence IS 'Stores threat intelligence data from multiple feeds';
COMMENT ON TABLE threat_statistics IS 'Stores aggregated threat statistics for analytics';

-- Create a function to update the updated_at timestamp
CREATE OR REPLACE FUNCTION update_threat_intelligence_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create trigger for automatic timestamp updates
DROP TRIGGER IF EXISTS update_threat_intelligence_updated_at ON threat_intelligence;
CREATE TRIGGER update_threat_intelligence_updated_at
    BEFORE UPDATE ON threat_intelligence
    FOR EACH ROW
    EXECUTE FUNCTION update_threat_intelligence_updated_at();

-- Output completion message
DO $$
BEGIN
    RAISE NOTICE 'Threat intelligence tables created successfully!';
    RAISE NOTICE 'Tables: threat_intelligence, threat_statistics';
    RAISE NOTICE 'Indexes and triggers created for optimal performance';
    RAISE NOTICE 'Ready for threat intelligence feed ingestion';
END $$;
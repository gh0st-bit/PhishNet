-- Reconnaissance Integration Migration
-- Adds tables for reconnaissance, domain discovery, and AI-enhanced features

-- Reconnaissance domains table
CREATE TABLE IF NOT EXISTS reconnaissance_domains (
    id SERIAL PRIMARY KEY,
    campaign_id INTEGER REFERENCES campaigns(id) ON DELETE CASCADE,
    domain VARCHAR(255) NOT NULL,
    email_formats TEXT[], -- Array of detected email format patterns
    mx_records TEXT[], -- Array of MX records
    txt_records TEXT[], -- Array of TXT records
    subdomains TEXT[], -- Array of discovered subdomains
    discovery_status VARCHAR(50) DEFAULT 'pending', -- pending, completed, failed
    discovered_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Discovered contacts table
CREATE TABLE IF NOT EXISTS discovered_contacts (
    id SERIAL PRIMARY KEY,
    domain_id INTEGER REFERENCES reconnaissance_domains(id) ON DELETE CASCADE,
    email VARCHAR(255),
    first_name VARCHAR(100),
    last_name VARCHAR(100),
    full_name VARCHAR(255),
    title VARCHAR(200),
    company VARCHAR(200),
    linkedin_url TEXT,
    source VARCHAR(50) NOT NULL, -- apollo, rocketreach, manual, osint
    confidence DECIMAL(3,2) DEFAULT 0.5, -- 0.0 to 1.0
    verification_status VARCHAR(50) DEFAULT 'unverified', -- verified, invalid, unverified
    last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- AI-generated profiles table
CREATE TABLE IF NOT EXISTS ai_profiles (
    id SERIAL PRIMARY KEY,
    contact_id INTEGER REFERENCES discovered_contacts(id) ON DELETE CASCADE,
    summary TEXT,
    interests TEXT[], -- Array of interests
    work_style TEXT,
    vulnerabilities TEXT[], -- Array of potential vulnerabilities
    recommended_approach TEXT,
    profile_data JSONB, -- Full AI response for flexibility
    generated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    model_used VARCHAR(50) DEFAULT 'gemini-pro'
);

-- AI-generated pretexts table
CREATE TABLE IF NOT EXISTS ai_pretexts (
    id SERIAL PRIMARY KEY,
    profile_id INTEGER REFERENCES ai_profiles(id) ON DELETE CASCADE,
    campaign_type VARCHAR(50) NOT NULL,
    urgency_level VARCHAR(20) DEFAULT 'medium',
    pretext_type VARCHAR(50) NOT NULL,
    subject VARCHAR(255) NOT NULL,
    email_body TEXT NOT NULL,
    call_to_action TEXT,
    urgency_indicators TEXT[],
    personalization_elements TEXT[],
    pretext_data JSONB, -- Full AI response
    generated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    model_used VARCHAR(50) DEFAULT 'gemini-pro',
    approved BOOLEAN DEFAULT FALSE,
    used_in_campaign BOOLEAN DEFAULT FALSE
);

-- Scraped content table for source data
CREATE TABLE IF NOT EXISTS scraped_content (
    id SERIAL PRIMARY KEY,
    url TEXT NOT NULL,
    title VARCHAR(500),
    content TEXT,
    markdown_content TEXT,
    metadata JSONB,
    extracted_emails TEXT[],
    extracted_phones TEXT[],
    social_links TEXT[],
    word_count INTEGER DEFAULT 0,
    scraped_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Link scraped content to contacts for enrichment
CREATE TABLE IF NOT EXISTS contact_sources (
    id SERIAL PRIMARY KEY,
    contact_id INTEGER REFERENCES discovered_contacts(id) ON DELETE CASCADE,
    scraped_content_id INTEGER REFERENCES scraped_content(id) ON DELETE CASCADE,
    relevance_score DECIMAL(3,2) DEFAULT 0.5,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Reconnaissance jobs for tracking async operations
CREATE TABLE IF NOT EXISTS reconnaissance_jobs (
    id SERIAL PRIMARY KEY,
    campaign_id INTEGER REFERENCES campaigns(id) ON DELETE CASCADE,
    job_type VARCHAR(50) NOT NULL, -- domain_discovery, contact_search, profile_generation, etc.
    status VARCHAR(50) DEFAULT 'pending', -- pending, running, completed, failed
    target_data JSONB, -- Store job parameters
    result_data JSONB, -- Store job results
    progress INTEGER DEFAULT 0, -- 0-100
    error_message TEXT,
    started_at TIMESTAMP,
    completed_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for better performance
CREATE INDEX IF NOT EXISTS idx_reconnaissance_domains_campaign ON reconnaissance_domains(campaign_id);
CREATE INDEX IF NOT EXISTS idx_discovered_contacts_domain ON discovered_contacts(domain_id);
CREATE INDEX IF NOT EXISTS idx_discovered_contacts_email ON discovered_contacts(email);
CREATE INDEX IF NOT EXISTS idx_ai_profiles_contact ON ai_profiles(contact_id);
CREATE INDEX IF NOT EXISTS idx_ai_pretexts_profile ON ai_pretexts(profile_id);
CREATE INDEX IF NOT EXISTS idx_scraped_content_url ON scraped_content(url);
CREATE INDEX IF NOT EXISTS idx_reconnaissance_jobs_campaign ON reconnaissance_jobs(campaign_id);
CREATE INDEX IF NOT EXISTS idx_reconnaissance_jobs_status ON reconnaissance_jobs(status);

-- Add reconnaissance settings to campaigns table
ALTER TABLE campaigns 
ADD COLUMN IF NOT EXISTS reconnaissance_enabled BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS auto_profile_generation BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS ai_pretext_generation BOOLEAN DEFAULT FALSE;

-- Update campaigns table to track reconnaissance progress
ALTER TABLE campaigns 
ADD COLUMN IF NOT EXISTS reconnaissance_status VARCHAR(50) DEFAULT 'not_started', -- not_started, in_progress, completed
ADD COLUMN IF NOT EXISTS domains_discovered INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS contacts_found INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS profiles_generated INTEGER DEFAULT 0;

-- Add trigger to update timestamp on reconnaissance_domains
CREATE OR REPLACE FUNCTION update_reconnaissance_domains_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_reconnaissance_domains_updated_at ON reconnaissance_domains;
CREATE TRIGGER trigger_update_reconnaissance_domains_updated_at
    BEFORE UPDATE ON reconnaissance_domains
    FOR EACH ROW
    EXECUTE FUNCTION update_reconnaissance_domains_updated_at();

-- Insert some sample reconnaissance job types for reference
INSERT INTO reconnaissance_jobs (campaign_id, job_type, status, target_data, created_at) 
VALUES (1, 'example_domain_discovery', 'completed', '{"domain": "example.com"}', CURRENT_TIMESTAMP)
ON CONFLICT DO NOTHING;

-- Grant necessary permissions (adjust user as needed)
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO postgres;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO postgres;
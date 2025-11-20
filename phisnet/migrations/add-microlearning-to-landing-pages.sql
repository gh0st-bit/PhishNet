-- Add microlearning fields to landing_pages table
ALTER TABLE landing_pages
ADD COLUMN IF NOT EXISTS enable_microlearning BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS learning_title TEXT,
ADD COLUMN IF NOT EXISTS learning_content TEXT,
ADD COLUMN IF NOT EXISTS learning_tips JSONB DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS remediation_links JSONB DEFAULT '[]'::jsonb;

-- Add comment to explain the feature
COMMENT ON COLUMN landing_pages.enable_microlearning IS 'Enable just-in-time microlearning on this landing page';
COMMENT ON COLUMN landing_pages.learning_title IS 'Title of the learning content shown after submission';
COMMENT ON COLUMN landing_pages.learning_content IS 'Educational content explaining what the user did wrong';
COMMENT ON COLUMN landing_pages.learning_tips IS 'Array of tip strings for identifying phishing attempts';
COMMENT ON COLUMN landing_pages.remediation_links IS 'Array of {title, url} objects for additional training resources';

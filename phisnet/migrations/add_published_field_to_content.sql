-- Migration: Add published field to content tables for content publishing control
-- This allows admins to create content as drafts and publish them to employees

-- Add published field to quizzes
ALTER TABLE quizzes 
ADD COLUMN IF NOT EXISTS published BOOLEAN DEFAULT false NOT NULL;

-- Add published field to badges
ALTER TABLE badges 
ADD COLUMN IF NOT EXISTS published BOOLEAN DEFAULT false NOT NULL;

-- Add published field to articles
ALTER TABLE articles 
ADD COLUMN IF NOT EXISTS published BOOLEAN DEFAULT false NOT NULL;

-- Add published field to flashcard_decks
ALTER TABLE flashcard_decks 
ADD COLUMN IF NOT EXISTS published BOOLEAN DEFAULT false NOT NULL;

-- Create indexes for better query performance on published content
CREATE INDEX IF NOT EXISTS idx_quizzes_published ON quizzes(published, organization_id);
CREATE INDEX IF NOT EXISTS idx_badges_published ON badges(published);
CREATE INDEX IF NOT EXISTS idx_articles_published ON articles(published, organization_id);
CREATE INDEX IF NOT EXISTS idx_flashcard_decks_published ON flashcard_decks(published, organization_id);

-- Add comment explaining the purpose
COMMENT ON COLUMN quizzes.published IS 'Controls whether quiz is visible to employees';
COMMENT ON COLUMN badges.published IS 'Controls whether badge is visible and earnable by employees';
COMMENT ON COLUMN articles.published IS 'Controls whether article is visible to employees';
COMMENT ON COLUMN flashcard_decks.published IS 'Controls whether flashcard deck is visible to employees';

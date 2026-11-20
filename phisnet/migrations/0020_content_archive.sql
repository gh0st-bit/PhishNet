ALTER TABLE training_modules ADD COLUMN IF NOT EXISTS archived_at timestamptz;
ALTER TABLE articles ADD COLUMN IF NOT EXISTS archived_at timestamptz;
ALTER TABLE quizzes ADD COLUMN IF NOT EXISTS archived_at timestamptz;
ALTER TABLE flashcard_decks ADD COLUMN IF NOT EXISTS archived_at timestamptz;
ALTER TABLE email_templates ADD COLUMN IF NOT EXISTS archived_at timestamptz;
ALTER TABLE landing_pages ADD COLUMN IF NOT EXISTS archived_at timestamptz;

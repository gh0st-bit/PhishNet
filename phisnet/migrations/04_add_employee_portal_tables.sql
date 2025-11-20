-- ========================================
-- EMPLOYEE PORTAL DATABASE MIGRATION
-- Created: November 19, 2025
-- Purpose: Add all tables needed for employee-facing portal
-- ========================================

-- Training modules table
CREATE TABLE IF NOT EXISTS training_modules (
  id SERIAL PRIMARY KEY,
  organization_id INTEGER NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  category VARCHAR(100) NOT NULL,
  difficulty VARCHAR(50) NOT NULL DEFAULT 'beginner',
  duration_minutes INTEGER NOT NULL,
  video_url TEXT,
  thumbnail_url TEXT,
  transcript TEXT,
  tags JSONB DEFAULT '[]'::jsonb,
  is_required BOOLEAN NOT NULL DEFAULT false,
  passing_score INTEGER DEFAULT 80,
  order_index INTEGER DEFAULT 0,
  created_by INTEGER NOT NULL REFERENCES users(id),
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_training_modules_org ON training_modules(organization_id);
CREATE INDEX idx_training_modules_category ON training_modules(category);
CREATE INDEX idx_training_modules_difficulty ON training_modules(difficulty);

-- Training progress tracking
CREATE TABLE IF NOT EXISTS training_progress (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  module_id INTEGER NOT NULL REFERENCES training_modules(id) ON DELETE CASCADE,
  status VARCHAR(50) NOT NULL DEFAULT 'not_started',
  progress_percentage INTEGER NOT NULL DEFAULT 0,
  video_timestamp INTEGER DEFAULT 0,
  completed_at TIMESTAMP,
  assigned_at TIMESTAMP NOT NULL DEFAULT NOW(),
  due_date TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, module_id)
);

CREATE INDEX idx_training_progress_user ON training_progress(user_id);
CREATE INDEX idx_training_progress_module ON training_progress(module_id);
CREATE INDEX idx_training_progress_status ON training_progress(status);

-- Quizzes/assessments
CREATE TABLE IF NOT EXISTS quizzes (
  id SERIAL PRIMARY KEY,
  organization_id INTEGER NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  module_id INTEGER REFERENCES training_modules(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  passing_score INTEGER NOT NULL DEFAULT 80,
  time_limit INTEGER,
  allow_retakes BOOLEAN NOT NULL DEFAULT true,
  max_attempts INTEGER DEFAULT 3,
  randomize_questions BOOLEAN NOT NULL DEFAULT false,
  show_correct_answers BOOLEAN NOT NULL DEFAULT true,
  created_by INTEGER NOT NULL REFERENCES users(id),
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_quizzes_org ON quizzes(organization_id);
CREATE INDEX idx_quizzes_module ON quizzes(module_id);

-- Quiz questions
CREATE TABLE IF NOT EXISTS quiz_questions (
  id SERIAL PRIMARY KEY,
  quiz_id INTEGER NOT NULL REFERENCES quizzes(id) ON DELETE CASCADE,
  question_type VARCHAR(50) NOT NULL,
  question_text TEXT NOT NULL,
  question_image TEXT,
  options JSONB DEFAULT '[]'::jsonb,
  correct_answer JSONB NOT NULL,
  explanation TEXT,
  points INTEGER NOT NULL DEFAULT 1,
  order_index INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_quiz_questions_quiz ON quiz_questions(quiz_id);

-- Quiz attempts
CREATE TABLE IF NOT EXISTS quiz_attempts (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  quiz_id INTEGER NOT NULL REFERENCES quizzes(id) ON DELETE CASCADE,
  attempt_number INTEGER NOT NULL,
  score INTEGER,
  total_questions INTEGER NOT NULL,
  correct_answers INTEGER,
  answers JSONB DEFAULT '{}'::jsonb,
  passed BOOLEAN NOT NULL DEFAULT false,
  started_at TIMESTAMP NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMP,
  time_spent INTEGER
);

CREATE INDEX idx_quiz_attempts_user ON quiz_attempts(user_id);
CREATE INDEX idx_quiz_attempts_quiz ON quiz_attempts(quiz_id);

-- Certificates
CREATE TABLE IF NOT EXISTS certificates (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  module_id INTEGER REFERENCES training_modules(id) ON DELETE CASCADE,
  quiz_id INTEGER REFERENCES quizzes(id) ON DELETE CASCADE,
  certificate_type VARCHAR(100) NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  verification_code VARCHAR(50) NOT NULL UNIQUE,
  issued_at TIMESTAMP NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMP,
  pdf_url TEXT
);

CREATE INDEX idx_certificates_user ON certificates(user_id);
CREATE INDEX idx_certificates_verification ON certificates(verification_code);

-- User points (gamification)
CREATE TABLE IF NOT EXISTS user_points (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  total_points INTEGER NOT NULL DEFAULT 0,
  current_streak INTEGER NOT NULL DEFAULT 0,
  longest_streak INTEGER NOT NULL DEFAULT 0,
  last_activity_date TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_user_points_user ON user_points(user_id);
CREATE INDEX idx_user_points_total ON user_points(total_points DESC);

-- Badges
CREATE TABLE IF NOT EXISTS badges (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  icon_url TEXT,
  category VARCHAR(100) NOT NULL,
  criteria JSONB NOT NULL,
  points_awarded INTEGER NOT NULL DEFAULT 0,
  rarity VARCHAR(50) NOT NULL DEFAULT 'common',
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_badges_category ON badges(category);
CREATE INDEX idx_badges_rarity ON badges(rarity);

-- User badges (many-to-many)
CREATE TABLE IF NOT EXISTS user_badges (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  badge_id INTEGER NOT NULL REFERENCES badges(id) ON DELETE CASCADE,
  earned_at TIMESTAMP NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, badge_id)
);

CREATE INDEX idx_user_badges_user ON user_badges(user_id);
CREATE INDEX idx_user_badges_badge ON user_badges(badge_id);

-- Articles/resources
CREATE TABLE IF NOT EXISTS articles (
  id SERIAL PRIMARY KEY,
  organization_id INTEGER NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  excerpt TEXT,
  category VARCHAR(100) NOT NULL,
  tags JSONB DEFAULT '[]'::jsonb,
  thumbnail_url TEXT,
  author INTEGER REFERENCES users(id),
  read_time_minutes INTEGER,
  published_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_articles_org ON articles(organization_id);
CREATE INDEX idx_articles_category ON articles(category);
CREATE INDEX idx_articles_published ON articles(published_at DESC);

-- Flashcard decks
CREATE TABLE IF NOT EXISTS flashcard_decks (
  id SERIAL PRIMARY KEY,
  organization_id INTEGER NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  category VARCHAR(100) NOT NULL,
  created_by INTEGER NOT NULL REFERENCES users(id),
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_flashcard_decks_org ON flashcard_decks(organization_id);
CREATE INDEX idx_flashcard_decks_category ON flashcard_decks(category);

-- Flashcards
CREATE TABLE IF NOT EXISTS flashcards (
  id SERIAL PRIMARY KEY,
  deck_id INTEGER NOT NULL REFERENCES flashcard_decks(id) ON DELETE CASCADE,
  front_content TEXT NOT NULL,
  back_content TEXT NOT NULL,
  order_index INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX idx_flashcards_deck ON flashcards(deck_id);

-- Insert seed badges
INSERT INTO badges (name, description, icon_url, category, criteria, points_awarded, rarity) VALUES
  ('First Steps', 'Complete your first training module', '/badges/first-steps.svg', 'milestone', '{"type": "training_complete", "count": 1}'::jsonb, 10, 'common'),
  ('Quiz Master', 'Score 100% on any quiz', '/badges/quiz-master.svg', 'mastery', '{"type": "perfect_quiz", "count": 1}'::jsonb, 25, 'rare'),
  ('Phishing Defender', 'Complete all phishing training modules', '/badges/phishing-defender.svg', 'mastery', '{"type": "category_complete", "category": "phishing"}'::jsonb, 50, 'epic'),
  ('Week Warrior', '7-day learning streak', '/badges/week-warrior.svg', 'streak', '{"type": "streak", "days": 7}'::jsonb, 30, 'rare'),
  ('Security Champion', 'Earn 1000 total points', '/badges/security-champion.svg', 'milestone', '{"type": "total_points", "amount": 1000}'::jsonb, 100, 'epic'),
  ('Eagle Eye', 'Report 5 phishing attempts correctly', '/badges/eagle-eye.svg', 'special', '{"type": "phishing_reports", "count": 5}'::jsonb, 40, 'rare'),
  ('Knowledge Seeker', 'Read 10 articles', '/badges/knowledge-seeker.svg', 'milestone', '{"type": "articles_read", "count": 10}'::jsonb, 20, 'common'),
  ('Certificate Collector', 'Earn 3 certificates', '/badges/certificate-collector.svg', 'milestone', '{"type": "certificates_earned", "count": 3}'::jsonb, 35, 'rare'),
  ('Perfect Month', '30-day learning streak', '/badges/perfect-month.svg', 'streak', '{"type": "streak", "days": 30}'::jsonb, 150, 'legendary'),
  ('Training Elite', 'Complete all required training with perfect scores', '/badges/training-elite.svg', 'mastery', '{"type": "perfect_required_training"}'::jsonb, 200, 'legendary')
ON CONFLICT DO NOTHING;

COMMENT ON TABLE training_modules IS 'Training videos, courses, and microlearning content';
COMMENT ON TABLE training_progress IS 'Tracks user progress through training modules';
COMMENT ON TABLE quizzes IS 'Assessments and knowledge checks';
COMMENT ON TABLE quiz_questions IS 'Individual questions within quizzes';
COMMENT ON TABLE quiz_attempts IS 'User attempts at taking quizzes';
COMMENT ON TABLE certificates IS 'Certificates earned by users';
COMMENT ON TABLE user_points IS 'Gamification points and streaks';
COMMENT ON TABLE badges IS 'Achievement badges that users can earn';
COMMENT ON TABLE user_badges IS 'Badges earned by specific users';
COMMENT ON TABLE articles IS 'Educational articles and resources';
COMMENT ON TABLE flashcard_decks IS 'Collections of flashcards';
COMMENT ON TABLE flashcards IS 'Individual flashcards for learning';

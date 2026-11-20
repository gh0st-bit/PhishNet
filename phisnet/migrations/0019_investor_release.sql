ALTER TABLE badges ADD COLUMN IF NOT EXISTS archived_at timestamptz;
ALTER TABLE user_badges ADD COLUMN IF NOT EXISTS award_snapshot jsonb;
UPDATE user_badges ub SET award_snapshot=jsonb_build_object('name',b.name,'description',b.description,'iconUrl',b.icon_url,'rarity',b.rarity)
FROM badges b WHERE b.id=ub.badge_id AND ub.award_snapshot IS NULL;
-- Retain every existing award; serialize new awards in the service to prevent duplicates.
CREATE INDEX IF NOT EXISTS user_badges_user_badge_lookup ON user_badges(user_id,badge_id);

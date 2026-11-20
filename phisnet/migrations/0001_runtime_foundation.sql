CREATE TABLE IF NOT EXISTS "session" (
  sid varchar PRIMARY KEY, sess json NOT NULL, expire timestamp(6) NOT NULL
);
CREATE INDEX IF NOT EXISTS session_expire_idx ON "session" (expire);
INSERT INTO roles (name, description, permissions)
VALUES ('Admin', 'Platform administrator', '["all"]'),
       ('Manager', 'Campaign manager', '["campaigns","reports"]'),
       ('User', 'Employee', '[]'),
       ('OrgAdmin', 'Organization administrator', '["campaigns","reports","users"]')
ON CONFLICT (name) DO NOTHING;
CREATE INDEX IF NOT EXISTS campaigns_org_status_idx ON campaigns (organization_id, status);
CREATE INDEX IF NOT EXISTS campaign_results_lookup_idx ON campaign_results (organization_id, campaign_id, target_id);
CREATE INDEX IF NOT EXISTS credential_captures_org_date_idx ON credential_captures (organization_id, submitted_at DESC);
CREATE INDEX IF NOT EXISTS targets_org_group_idx ON targets (organization_id, group_id);

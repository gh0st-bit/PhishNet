ALTER TABLE organizations ADD COLUMN preferences jsonb NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE organizations ADD COLUMN capture_retention_days integer NOT NULL DEFAULT 7 CHECK(capture_retention_days BETWEEN 1 AND 30);
CREATE TABLE rate_limit_counters (
 bucket text NOT NULL, key_hash text NOT NULL, hits integer NOT NULL DEFAULT 1,
 reset_at timestamptz NOT NULL, PRIMARY KEY(bucket,key_hash)
);
CREATE INDEX rate_limit_expiry_idx ON rate_limit_counters(reset_at);

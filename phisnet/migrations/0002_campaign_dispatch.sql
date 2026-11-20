CREATE TABLE IF NOT EXISTS campaign_dispatch (
  id serial PRIMARY KEY,
  campaign_id integer NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
  target_id integer NOT NULL REFERENCES targets(id) ON DELETE RESTRICT,
  organization_id integer NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  state text NOT NULL DEFAULT 'queued' CHECK (state IN ('queued','sending','accepted','failed','ambiguous','cancelled')),
  snapshot jsonb NOT NULL,
  attempts integer NOT NULL DEFAULT 0,
  available_at timestamptz NOT NULL DEFAULT now(),
  locked_at timestamptz,
  message_id text,
  error_code text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (campaign_id, target_id)
);
CREATE INDEX IF NOT EXISTS campaign_dispatch_due_idx ON campaign_dispatch (available_at, id) WHERE state='queued';
CREATE INDEX IF NOT EXISTS campaign_dispatch_org_idx ON campaign_dispatch (organization_id, campaign_id, state);

ALTER TABLE groups ADD COLUMN filter_rules jsonb;
ALTER TABLE campaigns ADD COLUMN recurrence_days integer CHECK(recurrence_days BETWEEN 1 AND 365);
ALTER TABLE campaigns ADD COLUMN recurrence_until timestamptz;
ALTER TABLE campaigns ADD COLUMN recurrence_parent_id integer REFERENCES campaigns(id) ON DELETE SET NULL;
ALTER TABLE campaigns ADD COLUMN next_run_at timestamptz;
ALTER TABLE campaigns ADD COLUMN launched_at timestamptz;
ALTER TABLE campaigns ADD COLUMN training_module_id integer REFERENCES training_modules(id) ON DELETE RESTRICT;
ALTER TABLE campaigns ADD COLUMN password_training_module_id integer REFERENCES training_modules(id) ON DELETE RESTRICT;
ALTER TABLE campaigns ADD COLUMN training_due_days integer NOT NULL DEFAULT 7 CHECK(training_due_days BETWEEN 1 AND 365);
ALTER TABLE campaigns ADD COLUMN template_pool jsonb NOT NULL DEFAULT '[]';
ALTER TABLE campaigns ADD COLUMN send_timezone text NOT NULL DEFAULT 'UTC';
ALTER TABLE campaigns ADD COLUMN send_window_start integer CHECK(send_window_start BETWEEN 0 AND 1439);
ALTER TABLE campaigns ADD COLUMN send_window_end integer CHECK(send_window_end BETWEEN 0 AND 1439);
CREATE UNIQUE INDEX campaign_occurrence_uq ON campaigns(recurrence_parent_id,scheduled_at) WHERE recurrence_parent_id IS NOT NULL;
CREATE UNIQUE INDEX training_progress_user_module_uq ON training_progress(user_id,module_id);

CREATE TABLE training_assignments (
  id serial PRIMARY KEY,
  organization_id integer NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id integer NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  module_id integer NOT NULL REFERENCES training_modules(id) ON DELETE CASCADE,
  campaign_id integer REFERENCES campaigns(id) ON DELETE SET NULL,
  reason text NOT NULL,
  due_at timestamptz NOT NULL,
  last_reminded_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id,module_id,campaign_id)
);
CREATE TABLE remediation_jobs (
  id serial PRIMARY KEY,
  organization_id integer NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  campaign_id integer NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
  target_id integer NOT NULL REFERENCES targets(id) ON DELETE CASCADE,
  reason text NOT NULL CHECK(reason IN ('clicked','submitted','weak_password')),
  state text NOT NULL DEFAULT 'queued' CHECK(state IN ('queued','processing','completed','failed')),
  attempts integer NOT NULL DEFAULT 0,
  available_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(campaign_id,target_id,reason)
);
CREATE INDEX remediation_jobs_due_idx ON remediation_jobs(available_at,id) WHERE state='queued';
CREATE INDEX training_assignments_due_idx ON training_assignments(due_at,organization_id);

-- Grants and policies are repeated for new tenant tables within this migration.
GRANT SELECT,INSERT,UPDATE,DELETE ON training_assignments,remediation_jobs TO phishnet_tenant;
GRANT USAGE,SELECT ON SEQUENCE training_assignments_id_seq,remediation_jobs_id_seq TO phishnet_tenant;
ALTER TABLE training_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE remediation_jobs ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON training_assignments TO phishnet_tenant USING(organization_id=NULLIF(current_setting('app.organization_id',true),'')::integer) WITH CHECK(organization_id=NULLIF(current_setting('app.organization_id',true),'')::integer);
CREATE POLICY tenant_isolation ON remediation_jobs TO phishnet_tenant USING(organization_id=NULLIF(current_setting('app.organization_id',true),'')::integer) WITH CHECK(organization_id=NULLIF(current_setting('app.organization_id',true),'')::integer);

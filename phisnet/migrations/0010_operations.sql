CREATE TABLE report_runs (
 id bigserial PRIMARY KEY, schedule_id integer NOT NULL REFERENCES report_schedules(id) ON DELETE CASCADE,
 organization_id integer NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
 scheduled_for timestamptz NOT NULL, snapshot jsonb NOT NULL,
 state text NOT NULL DEFAULT 'queued' CHECK(state IN ('queued','generating','sending','accepted','failed','ambiguous')),
 attempts integer NOT NULL DEFAULT 0, available_at timestamptz NOT NULL DEFAULT now(),
 lease_until timestamptz, error_code text, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(schedule_id,scheduled_for)
);
CREATE INDEX report_runs_claim_idx ON report_runs(available_at,id) WHERE state='queued';
CREATE TABLE report_exports (
 id uuid PRIMARY KEY, organization_id integer NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
 owner_user_id integer NOT NULL REFERENCES users(id) ON DELETE CASCADE, object_key text NOT NULL UNIQUE,
 filename text NOT NULL, mime_type text NOT NULL, expires_at timestamptz NOT NULL DEFAULT now()+interval '1 day',
 created_at timestamptz NOT NULL DEFAULT now(),
 FOREIGN KEY(owner_user_id,organization_id) REFERENCES users(id,organization_id) ON DELETE CASCADE
);
CREATE TABLE worker_heartbeats (id uuid PRIMARY KEY, started_at timestamptz NOT NULL DEFAULT now(), last_seen_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE saml_request_cache (id text PRIMARY KEY, value text NOT NULL, expires_at timestamptz NOT NULL);
DO $$ DECLARE t text; BEGIN
 FOREACH t IN ARRAY ARRAY['report_runs','report_exports'] LOOP
 EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY',t);
 EXECUTE format('CREATE POLICY tenant_isolation ON %I TO phishnet_tenant USING(organization_id=NULLIF(current_setting(''app.organization_id'',true),'''')::integer) WITH CHECK(organization_id=NULLIF(current_setting(''app.organization_id'',true),'''')::integer)',t);
 EXECUTE format('GRANT SELECT,INSERT,UPDATE,DELETE ON %I TO phishnet_tenant',t);
 END LOOP;
END $$;
GRANT USAGE,SELECT ON SEQUENCE report_runs_id_seq TO phishnet_tenant;

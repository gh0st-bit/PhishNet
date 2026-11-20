CREATE TABLE organization_secret_keys (
 id uuid PRIMARY KEY,organization_id integer NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
 key_material text NOT NULL,active boolean NOT NULL DEFAULT true,created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX organization_secret_keys_active ON organization_secret_keys(organization_id) WHERE active;
CREATE TABLE secret_rotation_jobs (
 id bigserial PRIMARY KEY,organization_id integer NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,key_id uuid NOT NULL REFERENCES organization_secret_keys(id),
 state text NOT NULL DEFAULT 'queued' CHECK(state IN ('queued','completed','failed')),processed integer NOT NULL DEFAULT 0,
 last_error text,created_at timestamptz NOT NULL DEFAULT now(),completed_at timestamptz
);
DO $$ DECLARE t text; BEGIN
 FOREACH t IN ARRAY ARRAY['organization_secret_keys','secret_rotation_jobs'] LOOP
  EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY',t);
  EXECUTE format('CREATE POLICY tenant_isolation ON %I TO phishnet_tenant USING(organization_id=nullif(current_setting(''app.organization_id'',true),'''')::integer) WITH CHECK(organization_id=nullif(current_setting(''app.organization_id'',true),'''')::integer)',t);
  EXECUTE format('GRANT SELECT,INSERT,UPDATE ON %I TO phishnet_tenant',t);
 END LOOP;
END $$;
GRANT USAGE,SELECT ON secret_rotation_jobs_id_seq TO phishnet_tenant;

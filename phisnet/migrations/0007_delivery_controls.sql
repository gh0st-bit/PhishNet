ALTER TABLE smtp_profiles ADD COLUMN delivery_mode text NOT NULL DEFAULT 'tenant_smtp' CHECK(delivery_mode IN ('tenant_smtp','managed_sendgrid'));
ALTER TABLE campaign_dispatch ADD COLUMN provider_state text NOT NULL DEFAULT 'unknown';
CREATE TABLE organization_delivery_limits (
  organization_id integer PRIMARY KEY REFERENCES organizations(id) ON DELETE CASCADE,
  per_minute integer NOT NULL DEFAULT 100 CHECK(per_minute BETWEEN 1 AND 10000),
  max_concurrent integer NOT NULL DEFAULT 2 CHECK(max_concurrent BETWEEN 1 AND 20),
  next_allowed_at timestamptz NOT NULL DEFAULT now(),last_claimed_at timestamptz
);
CREATE TABLE verified_domains (
  id serial PRIMARY KEY,organization_id integer NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  domain text NOT NULL,challenge text NOT NULL,verified_at timestamptz,created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(organization_id,domain)
);
CREATE TABLE delivery_suppressions (
  id serial PRIMARY KEY,organization_id integer NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  email text NOT NULL,reason text NOT NULL,created_at timestamptz NOT NULL DEFAULT now(),UNIQUE(organization_id,email)
);
CREATE TABLE delivery_webhook_events (
  event_id text PRIMARY KEY,organization_id integer NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  campaign_id integer NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,target_id integer NOT NULL REFERENCES targets(id) ON DELETE CASCADE,
  disposition text NOT NULL,occurred_at timestamptz NOT NULL,created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE campaign_events (
  id bigserial PRIMARY KEY,organization_id integer NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  campaign_id integer NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,target_id integer NOT NULL REFERENCES targets(id) ON DELETE CASCADE,
  event_type text NOT NULL,suspected_automated boolean NOT NULL DEFAULT false,created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX campaign_events_timeline_idx ON campaign_events(organization_id,campaign_id,created_at DESC);
CREATE INDEX targets_dynamic_department_idx ON targets(organization_id,lower(department));
CREATE INDEX targets_dynamic_domain_idx ON targets(organization_id,lower(split_part(email,'@',2)));
DO $body$ DECLARE item text; BEGIN
  FOREACH item IN ARRAY ARRAY['organization_delivery_limits','verified_domains','delivery_suppressions','delivery_webhook_events','campaign_events'] LOOP
    EXECUTE format('GRANT SELECT,INSERT,UPDATE,DELETE ON %I TO phishnet_tenant',item);
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY',item);
    EXECUTE format('CREATE POLICY tenant_isolation ON %I TO phishnet_tenant USING(organization_id=NULLIF(current_setting(''app.organization_id'',true),'''')::integer) WITH CHECK(organization_id=NULLIF(current_setting(''app.organization_id'',true),'''')::integer)',item);
  END LOOP;
  GRANT USAGE,SELECT ON ALL SEQUENCES IN SCHEMA public TO phishnet_tenant;
END $body$;

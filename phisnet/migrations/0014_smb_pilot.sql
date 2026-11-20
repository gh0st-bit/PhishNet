CREATE UNIQUE INDEX IF NOT EXISTS users_tenant_identity_uq ON users(id,organization_id);
CREATE TABLE teams (
 id serial PRIMARY KEY, organization_id integer NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
 name text NOT NULL CHECK(length(name) BETWEEN 1 AND 100), created_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(id,organization_id), UNIQUE(organization_id,name)
);
CREATE TABLE team_members (
 team_id integer NOT NULL, user_id integer NOT NULL, organization_id integer NOT NULL,
 PRIMARY KEY(team_id,user_id),
 FOREIGN KEY(team_id,organization_id) REFERENCES teams(id,organization_id) ON DELETE CASCADE,
 FOREIGN KEY(user_id,organization_id) REFERENCES users(id,organization_id) ON DELETE CASCADE
);
CREATE TABLE team_managers (
 team_id integer NOT NULL, user_id integer NOT NULL, organization_id integer NOT NULL,
 PRIMARY KEY(team_id,user_id),
 FOREIGN KEY(team_id,organization_id) REFERENCES teams(id,organization_id) ON DELETE CASCADE,
 FOREIGN KEY(user_id,organization_id) REFERENCES users(id,organization_id) ON DELETE CASCADE
);
ALTER TABLE targets ADD COLUMN employee_id integer;
ALTER TABLE targets ADD CONSTRAINT targets_employee_tenant_fk FOREIGN KEY(employee_id,organization_id) REFERENCES users(id,organization_id);
UPDATE targets t SET employee_id=u.id FROM users u WHERE u.organization_id=t.organization_id AND lower(u.email)=lower(t.email)
 AND (SELECT count(*) FROM users u2 WHERE u2.organization_id=t.organization_id AND lower(u2.email)=lower(t.email))=1;
CREATE INDEX targets_employee_idx ON targets(organization_id,employee_id);
CREATE FUNCTION pilot_link_employee() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF NEW.employee_id IS NULL THEN
  SELECT min(id) INTO NEW.employee_id FROM users WHERE organization_id=NEW.organization_id AND lower(email)=lower(NEW.email) HAVING count(*)=1;
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER targets_link_employee BEFORE INSERT OR UPDATE OF email ON targets FOR EACH ROW EXECUTE FUNCTION pilot_link_employee();

CREATE TABLE points_events (
 id bigserial PRIMARY KEY,organization_id integer NOT NULL,user_id integer NOT NULL,
 event_key text NOT NULL,reason text NOT NULL,points integer NOT NULL,
 occurred_at timestamptz NOT NULL DEFAULT now(),historical_balance boolean NOT NULL DEFAULT false,
 FOREIGN KEY(user_id,organization_id) REFERENCES users(id,organization_id) ON DELETE CASCADE,
 UNIQUE(user_id,event_key)
);
INSERT INTO points_events(organization_id,user_id,event_key,reason,points,historical_balance)
 SELECT u.organization_id,p.user_id,'opening-balance','Historical balance; earning dates not recorded',p.total_points,true FROM user_points p JOIN users u ON u.id=p.user_id;
CREATE INDEX points_events_history_idx ON points_events(user_id,occurred_at) WHERE NOT historical_balance;

ALTER TABLE campaigns ADD COLUMN dataset text NOT NULL DEFAULT 'customer' CHECK(dataset IN ('customer','demo'));
UPDATE campaigns SET dataset='demo' WHERE name LIKE 'QA %' OR name LIKE 'Audit %';
CREATE TABLE onboarding_imports (
 id bigserial PRIMARY KEY,organization_id integer NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
 created_by integer NOT NULL,rows jsonb NOT NULL,created_at timestamptz NOT NULL DEFAULT now(),
 FOREIGN KEY(created_by,organization_id) REFERENCES users(id,organization_id)
);
CREATE TABLE campaign_content_snapshots (
 campaign_id integer PRIMARY KEY,organization_id integer NOT NULL,content jsonb NOT NULL,created_at timestamptz NOT NULL DEFAULT now(),
 FOREIGN KEY(campaign_id,organization_id) REFERENCES campaigns(id,organization_id) ON DELETE CASCADE
);
CREATE TABLE pending_learning (
 id bigserial PRIMARY KEY,organization_id integer NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
 campaign_id integer NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,target_id integer NOT NULL REFERENCES targets(id) ON DELETE CASCADE,
 module_id integer NOT NULL REFERENCES training_modules(id) ON DELETE CASCADE,email text NOT NULL,reason text NOT NULL,due_days integer NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now(),resolved_at timestamptz, UNIQUE(campaign_id,target_id,module_id,reason)
);
CREATE TABLE smtp_oauth_connections (
 profile_id integer PRIMARY KEY,organization_id integer NOT NULL,tenant_id uuid NOT NULL,client_id uuid NOT NULL,
 client_secret text NOT NULL,enabled boolean NOT NULL DEFAULT false,updated_at timestamptz NOT NULL DEFAULT now(),
 FOREIGN KEY(profile_id,organization_id) REFERENCES smtp_profiles(id,organization_id) ON DELETE CASCADE
);
CREATE TABLE reported_messages (
 id bigserial PRIMARY KEY,organization_id integer NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
 reporter_id integer NOT NULL,message_key text NOT NULL CHECK(length(message_key)<=500),subject text NOT NULL DEFAULT '',
 campaign_id integer REFERENCES campaigns(id) ON DELETE SET NULL,target_id integer REFERENCES targets(id) ON DELETE SET NULL,
 status text NOT NULL CHECK(status IN ('matched','unmatched')),created_at timestamptz NOT NULL DEFAULT now(),
 FOREIGN KEY(reporter_id,organization_id) REFERENCES users(id,organization_id), UNIQUE(organization_id,reporter_id,message_key)
);
DO $$ DECLARE t text; BEGIN
 FOREACH t IN ARRAY ARRAY['teams','team_members','team_managers','points_events','onboarding_imports','campaign_content_snapshots','pending_learning','smtp_oauth_connections','reported_messages'] LOOP
  EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY',t);
  EXECUTE format('CREATE POLICY tenant_isolation ON %I TO phishnet_tenant USING (organization_id=nullif(current_setting(''app.organization_id'',true),'''')::integer) WITH CHECK (organization_id=nullif(current_setting(''app.organization_id'',true),'''')::integer)',t);
  EXECUTE format('GRANT SELECT,INSERT,UPDATE,DELETE ON %I TO phishnet_tenant',t);
 END LOOP;
END $$;
GRANT USAGE,SELECT ON ALL SEQUENCES IN SCHEMA public TO phishnet_tenant;

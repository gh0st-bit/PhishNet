CREATE TABLE learning_paths (
 id serial PRIMARY KEY,organization_id integer NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
 name text NOT NULL,steps jsonb NOT NULL,created_at timestamptz NOT NULL DEFAULT now(),UNIQUE(id,organization_id)
);
CREATE TABLE learning_path_assignments (
 id serial PRIMARY KEY,organization_id integer NOT NULL,user_id integer NOT NULL,path_id integer NOT NULL,
 content_snapshot jsonb NOT NULL,due_at timestamptz NOT NULL,created_at timestamptz NOT NULL DEFAULT now(),completed_at timestamptz,last_reminded_at timestamptz,
 UNIQUE(path_id,user_id),UNIQUE(id,organization_id),
 FOREIGN KEY(user_id,organization_id) REFERENCES users(id,organization_id) ON DELETE CASCADE,
 FOREIGN KEY(path_id,organization_id) REFERENCES learning_paths(id,organization_id) ON DELETE CASCADE
);
CREATE TABLE learning_path_steps (
 assignment_id integer NOT NULL,organization_id integer NOT NULL,ordinal integer NOT NULL CHECK(ordinal>=0),
 completed_at timestamptz NOT NULL DEFAULT now(),evidence jsonb NOT NULL DEFAULT '{}',PRIMARY KEY(assignment_id,ordinal),
 FOREIGN KEY(assignment_id,organization_id) REFERENCES learning_path_assignments(id,organization_id) ON DELETE CASCADE
);
CREATE TABLE learning_path_attempts (
 id serial PRIMARY KEY,assignment_id integer NOT NULL,organization_id integer NOT NULL,ordinal integer NOT NULL,score integer NOT NULL,created_at timestamptz NOT NULL DEFAULT now(),
 FOREIGN KEY(assignment_id,organization_id) REFERENCES learning_path_assignments(id,organization_id) ON DELETE CASCADE
);
DO $$ DECLARE t text; BEGIN
 FOREACH t IN ARRAY ARRAY['learning_paths','learning_path_assignments','learning_path_steps','learning_path_attempts'] LOOP
  EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY',t);
  EXECUTE format('CREATE POLICY tenant_isolation ON %I TO phishnet_tenant USING(organization_id=nullif(current_setting(''app.organization_id'',true),'''')::integer) WITH CHECK(organization_id=nullif(current_setting(''app.organization_id'',true),'''')::integer)',t);
  EXECUTE format('GRANT SELECT,INSERT,UPDATE,DELETE ON %I TO phishnet_tenant',t);
 END LOOP;
END $$;
GRANT USAGE,SELECT ON ALL SEQUENCES IN SCHEMA public TO phishnet_tenant;

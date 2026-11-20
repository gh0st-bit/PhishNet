DO $body$
DECLARE item record;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='phishnet_tenant') THEN
    CREATE ROLE phishnet_tenant NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOBYPASSRLS;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname='phishnet_tenant' AND (rolsuper OR rolbypassrls)) THEN
    RAISE EXCEPTION 'phishnet_tenant must not bypass row security';
  END IF;
  GRANT USAGE ON SCHEMA public TO phishnet_tenant;
  GRANT SELECT,INSERT,UPDATE,DELETE ON ALL TABLES IN SCHEMA public TO phishnet_tenant;
  GRANT USAGE,SELECT ON ALL SEQUENCES IN SCHEMA public TO phishnet_tenant;
  REVOKE ALL ON session FROM phishnet_tenant;
  IF to_regclass('public.runtime_migrations') IS NOT NULL THEN REVOKE ALL ON runtime_migrations FROM phishnet_tenant; END IF;
  GRANT SELECT ON roles,badges TO phishnet_tenant;
  REVOKE INSERT,UPDATE,DELETE ON roles,badges FROM phishnet_tenant;
  FOR item IN SELECT table_name FROM information_schema.columns
    WHERE table_schema='public' AND column_name='organization_id'
  LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY',item.table_name);
    EXECUTE format('CREATE POLICY tenant_isolation ON %I TO phishnet_tenant USING (organization_id = NULLIF(current_setting(''app.organization_id'',true),'''')::integer) WITH CHECK (organization_id = NULLIF(current_setting(''app.organization_id'',true),'''')::integer)',item.table_name);
  END LOOP;
  ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;
  CREATE POLICY tenant_isolation ON organizations TO phishnet_tenant
    USING (id=NULLIF(current_setting('app.organization_id',true),'')::integer)
    WITH CHECK (id=NULLIF(current_setting('app.organization_id',true),'')::integer);
END $body$;

-- Tables whose tenant identity is inherited from a parent.
DO $body$
DECLARE item record;
BEGIN
  FOR item IN SELECT * FROM (VALUES
    ('user_roles','user_id','users'),('training_progress','user_id','users'),
    ('quiz_attempts','user_id','users'),('certificates','user_id','users'),
    ('user_points','user_id','users'),('user_badges','user_id','users'),
    ('quiz_questions','quiz_id','quizzes'),('flashcards','deck_id','flashcard_decks')
  ) AS parents(child,column_name,parent)
  LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY',item.child);
    EXECUTE format('CREATE POLICY tenant_isolation ON %I TO phishnet_tenant USING (EXISTS(SELECT 1 FROM %I p WHERE p.id=%I.%I)) WITH CHECK(EXISTS(SELECT 1 FROM %I p WHERE p.id=%I.%I))',item.child,item.parent,item.child,item.column_name,item.parent,item.child,item.column_name);
  END LOOP;
END $body$;

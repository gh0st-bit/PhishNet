CREATE UNIQUE INDEX IF NOT EXISTS training_modules_tenant_identity_uq ON training_modules(id,organization_id);
ALTER TABLE pending_learning ADD CONSTRAINT pending_campaign_tenant_fk FOREIGN KEY(campaign_id,organization_id) REFERENCES campaigns(id,organization_id) ON DELETE CASCADE;
ALTER TABLE pending_learning ADD CONSTRAINT pending_target_tenant_fk FOREIGN KEY(target_id,organization_id) REFERENCES targets(id,organization_id) ON DELETE CASCADE;
ALTER TABLE pending_learning ADD CONSTRAINT pending_module_tenant_fk FOREIGN KEY(module_id,organization_id) REFERENCES training_modules(id,organization_id) ON DELETE CASCADE;
ALTER TABLE reported_messages ADD CONSTRAINT reported_campaign_tenant_fk FOREIGN KEY(campaign_id,organization_id) REFERENCES campaigns(id,organization_id) ON DELETE CASCADE;
ALTER TABLE reported_messages ADD CONSTRAINT reported_target_tenant_fk FOREIGN KEY(target_id,organization_id) REFERENCES targets(id,organization_id) ON DELETE CASCADE;
ALTER TABLE training_progress ADD COLUMN content_snapshot jsonb;
UPDATE training_progress p SET content_snapshot=jsonb_build_object('module',to_jsonb(m),'capturedAt',now(),'legacyBaseline',true) FROM training_modules m WHERE m.id=p.module_id;
CREATE FUNCTION snapshot_training_progress() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF NEW.content_snapshot IS NULL THEN
  SELECT jsonb_build_object('module',to_jsonb(m),'capturedAt',now(),'legacyBaseline',false) INTO NEW.content_snapshot FROM training_modules m WHERE m.id=NEW.module_id;
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER training_progress_snapshot BEFORE INSERT ON training_progress FOR EACH ROW EXECUTE FUNCTION snapshot_training_progress();
CREATE TABLE content_versions (
 id bigserial PRIMARY KEY,organization_id integer NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
 entity_type text NOT NULL,entity_id integer NOT NULL,version integer NOT NULL,snapshot jsonb NOT NULL,
 recorded_at timestamptz NOT NULL DEFAULT now(),UNIQUE(entity_type,entity_id,version)
);
ALTER TABLE content_versions ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON content_versions TO phishnet_tenant USING(organization_id=nullif(current_setting('app.organization_id',true),'')::integer) WITH CHECK(organization_id=nullif(current_setting('app.organization_id',true),'')::integer);
GRANT SELECT,INSERT ON content_versions TO phishnet_tenant;
GRANT USAGE,SELECT ON content_versions_id_seq TO phishnet_tenant;
CREATE FUNCTION record_content_version() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE row_data jsonb; next_version integer;
BEGIN
 IF TG_OP='UPDATE' AND (to_jsonb(NEW)-'updated_at')=(to_jsonb(OLD)-'updated_at') THEN RETURN NEW; END IF;
 row_data=to_jsonb(NEW);
 PERFORM pg_advisory_xact_lock(hashtext(TG_TABLE_NAME||':'||(row_data->>'id')));
 SELECT COALESCE(max(version),0)+1 INTO next_version FROM content_versions WHERE entity_type=TG_TABLE_NAME AND entity_id=(row_data->>'id')::integer;
 INSERT INTO content_versions(organization_id,entity_type,entity_id,version,snapshot) VALUES((row_data->>'organization_id')::integer,TG_TABLE_NAME,(row_data->>'id')::integer,next_version,row_data);
 RETURN NEW;
END $$;
DO $$ DECLARE t text; BEGIN
 FOREACH t IN ARRAY ARRAY['training_modules','articles','quizzes','flashcard_decks','email_templates','landing_pages'] LOOP
  EXECUTE format('INSERT INTO content_versions(organization_id,entity_type,entity_id,version,snapshot) SELECT organization_id,%L,id,1,to_jsonb(x) FROM %I x',t,t);
  EXECUTE format('CREATE TRIGGER content_version AFTER INSERT OR UPDATE ON %I FOR EACH ROW EXECUTE FUNCTION record_content_version()',t);
 END LOOP;
END $$;

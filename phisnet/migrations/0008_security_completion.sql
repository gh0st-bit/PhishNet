DO $body$ DECLARE item record; BEGIN
  FOR item IN SELECT * FROM (VALUES
    ('reconnaissance_domains','campaign_id','campaigns'),
    ('discovered_contacts','domain_id','reconnaissance_domains'),
    ('ai_profiles','contact_id','discovered_contacts'),('ai_pretexts','profile_id','ai_profiles'),
    ('scraped_content','domain_id','reconnaissance_domains'),('reconnaissance_jobs','campaign_id','campaigns'),
    ('notification_preferences','user_id','users'),('password_reset_tokens','user_id','users')
  ) AS parents(child,column_name,parent) LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY',item.child);
    EXECUTE format('CREATE POLICY tenant_isolation ON %I TO phishnet_tenant USING(EXISTS(SELECT 1 FROM %I p WHERE p.id=%I.%I)) WITH CHECK(EXISTS(SELECT 1 FROM %I p WHERE p.id=%I.%I))',item.child,item.parent,item.child,item.column_name,item.parent,item.child,item.column_name);
  END LOOP;
END $body$;
CREATE UNIQUE INDEX users_tenant_identity_uq ON users(id,organization_id);
CREATE UNIQUE INDEX training_modules_tenant_identity_uq ON training_modules(id,organization_id);
ALTER TABLE training_assignments ADD CONSTRAINT assignment_user_tenant_fk FOREIGN KEY(user_id,organization_id) REFERENCES users(id,organization_id) ON DELETE CASCADE;
ALTER TABLE training_assignments ADD CONSTRAINT assignment_module_tenant_fk FOREIGN KEY(module_id,organization_id) REFERENCES training_modules(id,organization_id) ON DELETE CASCADE;
ALTER TABLE campaigns ADD CONSTRAINT campaign_training_tenant_fk FOREIGN KEY(training_module_id,organization_id) REFERENCES training_modules(id,organization_id);
ALTER TABLE campaigns ADD CONSTRAINT campaign_password_training_tenant_fk FOREIGN KEY(password_training_module_id,organization_id) REFERENCES training_modules(id,organization_id);
INSERT INTO organization_delivery_limits(organization_id) SELECT id FROM organizations ON CONFLICT DO NOTHING;

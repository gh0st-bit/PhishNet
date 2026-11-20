-- Deliberately fail instead of deleting/merging inconsistent historical records.
CREATE UNIQUE INDEX IF NOT EXISTS campaign_results_recipient_uq ON campaign_results(campaign_id,target_id);
CREATE UNIQUE INDEX IF NOT EXISTS groups_tenant_identity_uq ON groups(id,organization_id);
CREATE UNIQUE INDEX IF NOT EXISTS targets_tenant_identity_uq ON targets(id,organization_id);
CREATE UNIQUE INDEX IF NOT EXISTS smtp_profiles_tenant_identity_uq ON smtp_profiles(id,organization_id);
CREATE UNIQUE INDEX IF NOT EXISTS email_templates_tenant_identity_uq ON email_templates(id,organization_id);
CREATE UNIQUE INDEX IF NOT EXISTS landing_pages_tenant_identity_uq ON landing_pages(id,organization_id);
CREATE UNIQUE INDEX IF NOT EXISTS campaigns_tenant_identity_uq ON campaigns(id,organization_id);
ALTER TABLE targets ADD CONSTRAINT targets_group_tenant_fk FOREIGN KEY(group_id,organization_id) REFERENCES groups(id,organization_id);
ALTER TABLE campaigns ADD CONSTRAINT campaigns_group_tenant_fk FOREIGN KEY(target_group_id,organization_id) REFERENCES groups(id,organization_id);
ALTER TABLE campaigns ADD CONSTRAINT campaigns_smtp_tenant_fk FOREIGN KEY(smtp_profile_id,organization_id) REFERENCES smtp_profiles(id,organization_id);
ALTER TABLE campaigns ADD CONSTRAINT campaigns_template_tenant_fk FOREIGN KEY(email_template_id,organization_id) REFERENCES email_templates(id,organization_id);
ALTER TABLE campaigns ADD CONSTRAINT campaigns_landing_tenant_fk FOREIGN KEY(landing_page_id,organization_id) REFERENCES landing_pages(id,organization_id);
ALTER TABLE campaign_results ADD CONSTRAINT results_campaign_tenant_fk FOREIGN KEY(campaign_id,organization_id) REFERENCES campaigns(id,organization_id) ON DELETE CASCADE;
ALTER TABLE campaign_results ADD CONSTRAINT results_target_tenant_fk FOREIGN KEY(target_id,organization_id) REFERENCES targets(id,organization_id) ON DELETE CASCADE;
ALTER TABLE campaign_dispatch ADD CONSTRAINT dispatch_campaign_tenant_fk FOREIGN KEY(campaign_id,organization_id) REFERENCES campaigns(id,organization_id) ON DELETE CASCADE;
ALTER TABLE campaign_dispatch ADD CONSTRAINT dispatch_target_tenant_fk FOREIGN KEY(target_id,organization_id) REFERENCES targets(id,organization_id);
ALTER TABLE credential_captures ADD CONSTRAINT captures_campaign_tenant_fk FOREIGN KEY(campaign_id,organization_id) REFERENCES campaigns(id,organization_id) ON DELETE CASCADE;
ALTER TABLE credential_captures ADD CONSTRAINT captures_target_tenant_fk FOREIGN KEY(target_id,organization_id) REFERENCES targets(id,organization_id) ON DELETE CASCADE;

ALTER TABLE campaign_results ADD COLUMN IF NOT EXISTS reported boolean NOT NULL DEFAULT false;
ALTER TABLE campaign_results ADD COLUMN IF NOT EXISTS reported_at timestamptz;
CREATE TABLE simulation_mailbox (
 id bigserial PRIMARY KEY,
 organization_id integer NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
 campaign_id integer NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
 target_id integer NOT NULL REFERENCES targets(id) ON DELETE CASCADE,
 recipient_email text NOT NULL, sender_email text NOT NULL, subject text NOT NULL,
 html_content text NOT NULL, message_id text NOT NULL UNIQUE,
 received_at timestamptz NOT NULL DEFAULT now(), opened_at timestamptz,
 FOREIGN KEY(campaign_id,organization_id) REFERENCES campaigns(id,organization_id) ON DELETE CASCADE,
 FOREIGN KEY(target_id,organization_id) REFERENCES targets(id,organization_id) ON DELETE CASCADE
);
CREATE INDEX simulation_mailbox_recipient_idx ON simulation_mailbox(organization_id,recipient_email,id DESC);
ALTER TABLE simulation_mailbox ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON simulation_mailbox TO phishnet_tenant
 USING(organization_id=NULLIF(current_setting('app.organization_id',true),'')::integer)
 WITH CHECK(organization_id=NULLIF(current_setting('app.organization_id',true),'')::integer);
GRANT SELECT,INSERT,UPDATE,DELETE ON simulation_mailbox TO phishnet_tenant;
GRANT USAGE,SELECT ON SEQUENCE simulation_mailbox_id_seq TO phishnet_tenant;

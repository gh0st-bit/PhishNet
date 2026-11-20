CREATE TABLE private_assets (
  id uuid PRIMARY KEY,organization_id integer NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  owner_user_id integer NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  object_key text NOT NULL UNIQUE,mime_type text NOT NULL,byte_length integer NOT NULL CHECK(byte_length>0),
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE private_assets ADD CONSTRAINT assets_owner_tenant_fk FOREIGN KEY(owner_user_id,organization_id) REFERENCES users(id,organization_id) ON DELETE CASCADE;
ALTER TABLE private_assets ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON private_assets TO phishnet_tenant USING(organization_id=NULLIF(current_setting('app.organization_id',true),'')::integer) WITH CHECK(organization_id=NULLIF(current_setting('app.organization_id',true),'')::integer);
GRANT SELECT,INSERT,UPDATE,DELETE ON private_assets TO phishnet_tenant;

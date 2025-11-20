-- Add SSO configuration table
CREATE TABLE IF NOT EXISTS sso_config (
  id SERIAL PRIMARY KEY,
  organization_id INTEGER NOT NULL UNIQUE REFERENCES organizations(id) ON DELETE CASCADE,
  enabled BOOLEAN NOT NULL DEFAULT FALSE,
  provider TEXT NOT NULL, -- 'saml' or 'oidc'
  entity_id TEXT, -- SAML Entity ID
  sso_url TEXT, -- SAML SSO URL or OIDC authorization endpoint
  certificate TEXT, -- SAML x509 certificate
  issuer TEXT, -- OIDC issuer
  client_id TEXT, -- OIDC client ID
  client_secret TEXT, -- OIDC client secret
  callback_url TEXT, -- OIDC callback URL
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE sso_config IS 'SSO configuration per organization (SAML/OIDC)';
COMMENT ON COLUMN sso_config.provider IS 'SSO provider type: saml or oidc';
COMMENT ON COLUMN sso_config.enabled IS 'Whether SSO is enabled for this organization';

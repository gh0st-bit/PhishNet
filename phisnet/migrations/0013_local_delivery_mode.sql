ALTER TABLE smtp_profiles DROP CONSTRAINT IF EXISTS smtp_profiles_delivery_mode_check;
ALTER TABLE smtp_profiles ADD CONSTRAINT smtp_profiles_delivery_mode_check CHECK(delivery_mode IN ('tenant_smtp','managed_sendgrid','local_inbox'));

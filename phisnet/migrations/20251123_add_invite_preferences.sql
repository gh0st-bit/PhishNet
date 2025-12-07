-- Migration: add inviteDashboard & inviteEmail preference flags
ALTER TABLE notification_preferences
  ADD COLUMN IF NOT EXISTS invite_dashboard boolean DEFAULT true,
  ADD COLUMN IF NOT EXISTS invite_email boolean DEFAULT true;

-- Backfill existing rows to ensure non-null values (in case defaults not applied retroactively)
UPDATE notification_preferences SET invite_dashboard = COALESCE(invite_dashboard, true);
UPDATE notification_preferences SET invite_email = COALESCE(invite_email, true);

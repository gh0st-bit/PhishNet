-- Create report_schedules table
CREATE TABLE IF NOT EXISTS report_schedules (
  id SERIAL PRIMARY KEY,
  organization_id INTEGER NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  type VARCHAR(50) NOT NULL CHECK (type IN ('executive', 'detailed', 'compliance')),
  cadence VARCHAR(20) NOT NULL CHECK (cadence IN ('daily', 'weekly', 'monthly')),
  time_of_day VARCHAR(5) NOT NULL,
  timezone VARCHAR(50) NOT NULL DEFAULT 'UTC',
  recipients TEXT NOT NULL,
  enabled BOOLEAN NOT NULL DEFAULT true,
  last_run_at TIMESTAMP,
  next_run_at TIMESTAMP NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Create index on organization_id for faster queries
CREATE INDEX IF NOT EXISTS idx_report_schedules_organization_id ON report_schedules(organization_id);

-- Create index on next_run_at for scheduler queries
CREATE INDEX IF NOT EXISTS idx_report_schedules_next_run ON report_schedules(next_run_at) WHERE enabled = true;

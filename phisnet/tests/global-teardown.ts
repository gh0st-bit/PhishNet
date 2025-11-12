// Jest global teardown to close resources and prevent open handle leaks

import { pool } from '../server/db';
import { reportingScheduler } from '../server/services/reporting-scheduler';
import { stopCampaignScheduler } from '../server/services/campaign-scheduler';

export default async function globalTeardown() {
  try {
    // Attempt to stop any running schedulers
    try {
      reportingScheduler.stop();
    } catch {
      // ignore if not started
    }
    try {
      stopCampaignScheduler();
    } catch {
      // ignore if not started
    }

    // Close PostgreSQL pool if open
    if ((pool as any)?.end) {
      await pool.end();
    }
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('[global-teardown] Error during teardown:', err);
  }
}

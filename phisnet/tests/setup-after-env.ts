// Jest setup-after-env: register global teardown actions
// Polyfill TextEncoder/TextDecoder for pg's webcrypto utils under jsdom
import { TextEncoder, TextDecoder } from 'util';

// Ensure globals exist before any DB/client imports
(globalThis as any).TextEncoder = (globalThis as any).TextEncoder || TextEncoder;
(globalThis as any).TextDecoder = (globalThis as any).TextDecoder || TextDecoder;

// After all test suites finish in this worker
afterAll(async () => {
  try {
    // Dynamically import to avoid early module init before polyfills
    try {
      const { reportingScheduler } = await import('../server/services/reporting-scheduler');
      reportingScheduler.stop();
    } catch {}

    try {
      const { stopCampaignScheduler } = await import('../server/services/campaign-scheduler');
      stopCampaignScheduler();
    } catch {}

    try {
      const { storage } = await import('../server/storage');
      storage.stopSessionStore();
    } catch {}

    try {
      const { pool } = await import('../server/db');
      if ((pool as any)?.end) {
        await pool.end();
      }
    } catch {}
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('[setup-after-env] teardown error:', err);
  }
});

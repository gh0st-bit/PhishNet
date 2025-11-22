import { db, pool } from "../db";
import { campaigns } from "@shared/schema";
import { and, lte, isNotNull, inArray, eq } from "drizzle-orm";
import { sendCampaignEmails } from "./email-service";

let schedulerStarted = false;
let intervalHandle: NodeJS.Timeout | null = null;

export function startCampaignScheduler(intervalMs: number = 60_000) {
  const enabled = (process.env.CAMPAIGN_SCHEDULER_ENABLED || 'true').toLowerCase() === 'true';
  if (!enabled) {
    console.log('[Scheduler] Campaign scheduler disabled via CAMPAIGN_SCHEDULER_ENABLED');
    return;
  }
  if (schedulerStarted) return;

  // Pre-flight DB connectivity test to avoid endless auth spam
  pool.query('SELECT 1').then(() => {
    schedulerStarted = true;
    console.log(`[Scheduler] Campaign scheduler started (every ${intervalMs / 1000}s)`);

    let consecutiveFailures = 0;
    const maxFailures = Number.parseInt(process.env.CAMPAIGN_SCHEDULER_MAX_FAILURES || '5', 10);
    const backoffBaseMs = 5_000; // starting backoff

    const tick = async () => {
      const start = Date.now();
      try {
        const now = new Date();
        const due = await db.select().from(campaigns).where(
          and(
            isNotNull(campaigns.scheduledAt),
            lte(campaigns.scheduledAt, now),
            inArray(campaigns.status, ['Scheduled', 'Draft'])
          )
        );

        if (due.length > 0) {
          console.log(`[Scheduler] Found ${due.length} due campaign(s)`);
        }

        for (const c of due) {
          try {
            await db.update(campaigns)
              .set({ status: 'Active', updatedAt: new Date() })
              .where(eq(campaigns.id, c.id));

            console.log(`[Scheduler] Launching campaign ${c.id} (org ${c.organizationId})`);
            const result = await sendCampaignEmails(c.id, c.organizationId);
            console.log(`[Scheduler] Campaign ${c.id} completed:`, result);
          } catch (e) {
            console.error(`[Scheduler] Error processing campaign ${c.id}:`, e);
          }
        }

        consecutiveFailures = 0; // reset on success
      } catch (e: any) {
        consecutiveFailures++;
        const authCode = e?.code;
        if (authCode === '28P01') {
          console.error('[Scheduler] Tick auth error (28P01 - invalid password). Verify DB_USER/DB_PASSWORD env values.');
        } else if (e?.code === 'ECONNRESET') {
          console.error('[Scheduler] Tick connection reset - network or server restart.');
        } else {
          console.error('[Scheduler] Tick error:', e);
        }

        if (consecutiveFailures >= maxFailures) {
          console.error(`[Scheduler] Stopping after ${consecutiveFailures} consecutive failures.`);
          stopCampaignScheduler();
          return;
        }

        // Apply backoff before next tick
        const backoffMs = Math.min(backoffBaseMs * consecutiveFailures, 60_000);
        console.log(`[Scheduler] Backing off for ${backoffMs}ms (failure ${consecutiveFailures}/${maxFailures})`);
        setTimeout(() => {
          if (schedulerStarted) tick();
        }, backoffMs);
        return; // skip normal interval scheduling when backing off
      }

      const duration = Date.now() - start;
      // Schedule next tick normally
      if (schedulerStarted) {
        intervalHandle = setTimeout(tick, intervalMs);
      }
    };

    // Kick off first tick
    tick();
  }).catch(err => {
    if (err?.code === '28P01') {
      console.error('[Scheduler] Failed initial DB auth (28P01). Scheduler not started.');
    } else {
      console.error('[Scheduler] Failed initial DB connectivity. Scheduler not started:', err);
    }
  });
}

export function stopCampaignScheduler() {
  if (intervalHandle) {
    clearTimeout(intervalHandle);
    intervalHandle = null;
  }
  schedulerStarted = false;
  console.log('[Scheduler] Campaign scheduler stopped');
}

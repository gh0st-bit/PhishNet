import { db } from "../db";
import { campaigns } from "@shared/schema";
import { and, lte, isNotNull, inArray, eq } from "drizzle-orm";
import { sendCampaignEmails } from "./email-service";

let schedulerStarted = false;
let intervalHandle: NodeJS.Timeout | null = null;

export function startCampaignScheduler(intervalMs: number = 60_000) {
  if (schedulerStarted) return;
  schedulerStarted = true;
  console.log(`[Scheduler] Campaign scheduler started (every ${intervalMs / 1000}s)`);

  intervalHandle = setInterval(async () => {
    try {
      const now = new Date();
      // Pick campaigns that are scheduled and due now or in the past.
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
          // Mark as Active to prevent duplicate processing
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
    } catch (e) {
      console.error('[Scheduler] Tick error:', e);
    }
  }, intervalMs);
}

export function stopCampaignScheduler() {
  if (intervalHandle) {
    clearInterval(intervalHandle);
    intervalHandle = null;
  }
  schedulerStarted = false;
  console.log('[Scheduler] Campaign scheduler stopped');
}

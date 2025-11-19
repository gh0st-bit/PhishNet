import { DataRetentionService } from './data-retention.service';

class DataRetentionScheduler {
  private intervalId: NodeJS.Timeout | null = null;
  private running = false;
  private lastRunAt: Date | null = null;
  private lastSummary: any = null;

  start(intervalHours: number = 24) {
    if (this.running) return;
    this.running = true;
    const intervalMs = Math.max(1, intervalHours) * 60 * 60 * 1000;
    console.log(`[Retention] Scheduler started (every ${intervalHours}h)`);

    const tick = async () => {
      try {
        this.lastSummary = await DataRetentionService.runCleanup(false);
        this.lastRunAt = new Date();
        console.log(`[Retention] Cleanup completed at ${this.lastRunAt.toISOString()}`);
      } catch (err) {
        console.error('[Retention] Cleanup error:', err);
      }
    };

    // Run once immediately, then on interval
    tick();
    this.intervalId = setInterval(tick, intervalMs);
  }

  stop() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    this.running = false;
    console.log('[Retention] Scheduler stopped');
  }

  status() {
    return {
      running: this.running,
      lastRunAt: this.lastRunAt?.toISOString() || null,
      lastSummary: this.lastSummary,
    };
  }

  async runNow() {
    this.lastSummary = await DataRetentionService.runCleanup(false);
    this.lastRunAt = new Date();
    return this.lastSummary;
  }
}

export const dataRetentionScheduler = new DataRetentionScheduler();

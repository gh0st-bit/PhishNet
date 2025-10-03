import { ThreatIntelligenceService } from './threat-intelligence.service';

export class ThreatFeedScheduler {
  private threatService: ThreatIntelligenceService;
  private intervalId: NodeJS.Timeout | null = null;
  private isRunning = false;

  constructor() {
    this.threatService = new ThreatIntelligenceService();
  }

  /**
   * Start the scheduler to run threat feed ingestion periodically
   */
  start(intervalHours: number = 2): void {
    if (this.isRunning) {
      console.log('🔄 Threat feed scheduler already running');
      return;
    }

    console.log(`🚀 Starting threat feed scheduler (every ${intervalHours} hours)`);
    
    // Run immediately on start
    this.runIngestion();

    // Schedule periodic runs
    this.intervalId = setInterval(
      () => this.runIngestion(),
      intervalHours * 60 * 60 * 1000
    );

    this.isRunning = true;
  }

  /**
   * Stop the scheduler
   */
  stop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    this.isRunning = false;
    console.log('🛑 Threat feed scheduler stopped');
  }

  /**
   * Run ingestion manually
   */
  async runIngestion(): Promise<void> {
    try {
      console.log('⏰ Scheduled threat feed ingestion started');
      await this.threatService.ingestAllFeeds();
    } catch (error) {
      console.error('💥 Scheduled threat feed ingestion failed:', error);
    }
  }

  /**
   * Get scheduler status
   */
  getStatus(): { running: boolean; nextRun?: Date } {
    return {
      running: this.isRunning,
      nextRun: this.intervalId ? new Date(Date.now() + 2 * 60 * 60 * 1000) : undefined
    };
  }
}

// Export singleton instance
export const threatFeedScheduler = new ThreatFeedScheduler();
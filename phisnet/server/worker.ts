import { deletePrivateObject } from './services/object-store';
import {processSecretRotation} from './services/versioned-secrets';
import { DataRetentionService } from './services/data-retention.service';
import { reportingScheduler } from './services/reporting-scheduler';
import { randomUUID } from 'node:crypto';
import { createRecurringOccurrences } from './services/campaign-automation';
import { processRemediation,remindTraining,resolvePendingLearning } from './services/training-automation';
import 'dotenv/config';
import { pool } from './db';
import { storage } from './storage';
import { dispatchOne, recoverDispatchLeases, enqueueCampaign } from './services/campaign-dispatch';

const workerId=randomUUID();
let stopping = false;
process.on('SIGINT', () => { stopping = true; });
process.on('SIGTERM', () => { stopping = true; });
async function run() {
  let lastRetention = 0,lastGeneralRetention=0;
  while (!stopping) {
    await pool.query('INSERT INTO worker_heartbeats(id) VALUES($1) ON CONFLICT(id) DO UPDATE SET last_seen_at=now()',[workerId]);
    if(process.env.WORKER_DELIVERY_PAUSED==='true'){await new Promise(resolve=>setTimeout(resolve,1000));continue;}
    if(Date.now()-lastGeneralRetention>86400000){await DataRetentionService.runCleanup();lastGeneralRetention=Date.now();}
    if (Date.now() - lastRetention > 60000) {
      const days = Number(process.env.CAPTURE_RETENTION_DAYS || 7);
      if (!Number.isInteger(days) || days < 1) throw new Error('Invalid CAPTURE_RETENTION_DAYS');
      await pool.query("UPDATE credential_captures c SET password='' FROM organizations o WHERE c.organization_id=o.id AND password<>'' AND submitted_at<now()-(least(o.capture_retention_days,$1) * interval '1 day')",[days]);
      await pool.query("UPDATE campaign_results c SET submitted_data=submitted_data-'encryptedPassword' FROM organizations o WHERE c.organization_id=o.id AND submitted_data ? 'encryptedPassword' AND submitted_at<now()-(least(o.capture_retention_days,$1) * interval '1 day')",[days]);
      await remindTraining();
      await resolvePendingLearning();

      await pool.query('DELETE FROM saml_request_cache WHERE expires_at<now()');
      await pool.query('DELETE FROM rate_limit_counters WHERE reset_at<now()');
      const expired=(await pool.query('SELECT id,object_key FROM report_exports WHERE expires_at<now() LIMIT 100')).rows;
      for(const file of expired){await deletePrivateObject(file.object_key);await pool.query('DELETE FROM report_exports WHERE id=$1',[file.id]);}
      await pool.query("DELETE FROM worker_heartbeats WHERE last_seen_at<now()-interval '1 day'");
      lastRetention=Date.now();
    }
    await pool.query("UPDATE campaign_dispatch d SET state='cancelled',updated_at=now() FROM campaigns c WHERE d.campaign_id=c.id AND d.state='queued' AND (c.status='Cancelled' OR c.end_date<=now())");
    await recoverDispatchLeases();
    await createRecurringOccurrences();
    await processRemediation();
    await processSecretRotation();
    await reportingScheduler.checkAndRunDueReports();
    const { rows } = await pool.query("SELECT id,organization_id FROM campaigns WHERE status='Scheduled' AND scheduled_at<=now() LIMIT 20");
    for (const campaign of rows) {
      try { await enqueueCampaign(campaign.id, campaign.organization_id, true); }
      catch (error: any) { if (error.status !== 409) console.error('Scheduled launch failed', { id: campaign.id }); }
    }
    // Completion refers to the observation window, not SMTP acceptance.
    await pool.query(`UPDATE campaigns c SET status='Completed',updated_at=now() WHERE status='Active' AND end_date<=now()
      AND NOT EXISTS(SELECT 1 FROM campaign_dispatch d WHERE d.campaign_id=c.id AND d.state IN ('queued','sending','ambiguous'))`);
    const concurrency=Number(process.env.WORKER_CONCURRENCY || 4);
    if(!Number.isInteger(concurrency)||concurrency<1||concurrency>20)throw new Error('WORKER_CONCURRENCY must be between 1 and 20');
    const dispatched=await Promise.all(Array.from({length:concurrency},()=>dispatchOne()));
    const worked=dispatched.some(Boolean);
    await new Promise(resolve => setTimeout(resolve, worked ? Number(process.env.DISPATCH_INTERVAL_MS || 250) : 1000));
  }
}
run().catch(error => { console.error('Worker failed', error.code || error.message); process.exitCode = 1; })
  .finally(async () => { storage.stopSessionStore(); await pool.query('DELETE FROM worker_heartbeats WHERE id=$1',[workerId]); await pool.end(); });

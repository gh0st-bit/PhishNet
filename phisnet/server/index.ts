import { observeRequests,registerOperations } from './observability';
import { reliableRoutes } from './http';
import { sendgridWebhook } from './services/delivery-webhook';
import express from 'express';
import { readConfig } from './config';
import { localNetworkOnly } from './services/local-lab';
import { requestSecurity } from './middleware/request-security';
import { registerRoutes } from './routes';
import { setupVite, serveStatic, log } from './vite';
import { pool,validateDatabaseRoles } from './db';
import { storage } from './storage';
import { initRealtime } from './services/realtime';
import { startCampaignScheduler, stopCampaignScheduler } from './services/campaign-scheduler';
import { threatFeedScheduler } from './services/threat-intelligence/threat-feed-scheduler';
import { dataRetentionScheduler } from './services/data-retention-scheduler';
import { reportingScheduler } from './services/reporting-scheduler';

const config = readConfig();
const app = reliableRoutes(express());
app.use(localNetworkOnly);
app.use(observeRequests);
app.use(requestSecurity(config.origins, config.production));
if (config.production) app.use('/api/debug', (_req, res) => res.status(404).json({ message: 'API endpoint not found' }));
app.post('/api/webhooks/sendgrid',express.raw({type:'application/json',limit:'512kb'}),sendgridWebhook);
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));


async function main() {
  await pool.query('SELECT 1');
  await validateDatabaseRoles(config.production);
  const server = await registerRoutes(app);
  registerOperations(app);
  app.use('/api', (_req, res) => res.status(404).json({ message: 'API endpoint not found' }));
  const io = initRealtime(server, app.get('sessionMiddleware'), config.origins);
  if (app.get('env') === 'development') await setupVite(app, server);
  else serveStatic(app);
  app.use((err: any, _req: express.Request, res: express.Response, next: express.NextFunction) => {
    if (res.headersSent) return next(err);
    const status = err.name==='ZodError'?400:Number(err.status || err.statusCode) || 500;
    console.error('Request failed', { status, name: err.name });
    res.status(status).json({ message: status >= 500 ? 'Internal server error' : err.name==='ZodError'?'Invalid request fields':err.message });
  });
  server.listen(config.port, config.host, () => {
    log(`Server running at http://${config.host}:${config.port}`);
    if (process.env.CAMPAIGN_SCHEDULER_ENABLED === 'true') startCampaignScheduler();
    if (process.env.THREAT_FEED_ENABLED === 'true') threatFeedScheduler.start(Number(process.env.THREAT_FEED_INTERVAL_HOURS || 2));
    if (process.env.DATA_RETENTION_ENABLED === 'true') dataRetentionScheduler.start(Number(process.env.DATA_RETENTION_INTERVAL_HOURS || 24));
  });
  let closing = false;
  const shutdown = () => {
    if (closing) return;
    closing = true;
    stopCampaignScheduler();
    threatFeedScheduler.stop();
    dataRetentionScheduler.stop();
    reportingScheduler.stop();
    storage.stopSessionStore();
    const timeout = setTimeout(() => process.exit(1), 15000).unref();
    io.close();
    server.close(() => { void pool.end().finally(() => { clearTimeout(timeout); process.exit(0); }); });
  };
  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);
}
main().catch(error => { console.error('Startup failed', error.message); process.exit(1); });

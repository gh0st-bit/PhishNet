import 'dotenv/config';

export function readConfig(env: NodeJS.ProcessEnv = process.env) {
  const port = Number(env.PORT || 5000);
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('PORT must be between 1 and 65535');
  if (!env.DATABASE_URL || !env.SESSION_SECRET) throw new Error('DATABASE_URL and SESSION_SECRET are required');
  const production = env.NODE_ENV === 'production';
  if(production&&!env.CONTROL_DATABASE_URL)throw new Error('Production requires a separate CONTROL_DATABASE_URL');
  if (production && (env.SESSION_SECRET.length < 32 || /change|phishnet-secret|your-/i.test(env.SESSION_SECRET))) {
    throw new Error('Production requires a strong SESSION_SECRET of at least 32 characters');
  }
  const key = Buffer.from(env.MASTER_ENCRYPTION_KEY || '', 'base64');
  if (production && key.length !== 32) throw new Error('MASTER_ENCRYPTION_KEY must encode exactly 32 bytes');
  const publicUrl = new URL(env.APP_BASE_URL || `http://localhost:${port}`);
  if (production && publicUrl.protocol !== 'https:') throw new Error('APP_BASE_URL must use HTTPS in production');
  return { port, host: env.HOST || '127.0.0.1', production, publicUrl: publicUrl.origin,
    origins: new Set([publicUrl.origin, ...(env.CORS_ORIGINS || (production ? '' : 'http://localhost:5173')).split(',').map(s => s.trim()).filter(Boolean)]) };
}

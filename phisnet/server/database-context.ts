import { AsyncLocalStorage } from 'node:async_hooks';
import type { RequestHandler } from 'express';

export interface DatabaseScope { organizationId: number; userId: number; system?: boolean }
export const databaseScope = new AsyncLocalStorage<DatabaseScope>();
export function withTenant<T>(organizationId: number, userId: number, work: () => T): T {
  if (!Number.isSafeInteger(organizationId) || organizationId <= 0) throw new Error('Valid tenant context required');
  return databaseScope.run({ organizationId, userId }, work);
}

// These entrypoints establish identity or validate signed public simulation links.
// They must perform their own token/signature verification before accessing data.
const controlEntrypoint = /^(?:\/api\/(?:login(?:\/2fa)?|register|logout|forgot-password|reset-password(?:\/[^/]+)?|verify-email|resend-verification|enroll\/accept|auth\/saml(?:\/.*)?|sso\/check\/[^/]+)|\/[ocl]\/.*)$/;
export const requestDatabaseScope: RequestHandler = (req, _res, next) => {
  const user = req.user;
  databaseScope.run({ organizationId: user?.organizationId || 0, userId: user?.id || 0,
    system: Boolean(user?.isAdmin) || controlEntrypoint.test(req.path) }, next);
};

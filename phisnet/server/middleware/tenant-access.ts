import type { RequestHandler } from 'express';
import { appRole } from '@shared/access-control';

const managed = /^\/(users|roles|dashboard|campaigns|groups|targets|smtp-profiles|email-templates|templates|landing-pages|reports|report-schedules|audit|reconnaissance|secrets|sso|data-retention|delivery|admin|threat-intelligence)(\/|$)/;
export const tenantAccess: RequestHandler = (req, res, next) => {
  if (!managed.test(req.path)) return next();
  // Public domain-based SSO discovery remains available before login.
  if (req.method === 'GET' && /^\/sso\/check\/[^/]+$/.test(req.path)) return next();
  if (!req.user) return res.status(401).json({ message: 'Authentication required' });
  const role = appRole(req.user);
  if (role === 'Admin') return next();
  if (role === 'OrgAdmin' && !/^\/(audit|secrets|sso|data-retention|threat-intelligence)(\/|$)/.test(req.path)) return next();
  return res.status(403).json({ message: 'Your role does not permit this action' });
};

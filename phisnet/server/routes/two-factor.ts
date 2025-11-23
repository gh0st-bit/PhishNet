import type { Express, Request, Response } from 'express';
import speakeasy from 'speakeasy';
import { isAuthenticated } from '../auth';
import { authLimiter } from '../middleware/rate-limit';
import { storage } from '../storage';
import { TwoFactorService } from '../services/two-factor.service';
import { SecretsService } from '../services/secrets.service';
import { AuditService } from '../services/audit.service';

/**
 * 2FA (TOTP) routes: setup, verify, disable, status, backup codes regeneration.
 */
export function registerTwoFactorRoutes(app: Express) {

  // Begin setup: generate secret + QR (stored temporarily in session until verified)
  app.post('/api/user/2fa/setup', isAuthenticated, async (req: Request, res: Response) => {
    try {
      if (!req.user) return res.status(401).json({ message: 'Not authenticated' });
      const user = await storage.getUser(req.user.id);
      if (!user) return res.status(404).json({ message: 'User not found' });
      if ((user as any).twoFactorEnabled) return res.status(400).json({ message: '2FA already enabled' });

      const secret = TwoFactorService.generateSecret(user.email);
      const qr = await TwoFactorService.generateQRCode(secret.base32, user.email);
      // Store raw secret temporarily in session for verification step
      (req.session as any).pendingTwoFactorSecret = secret.base32;
      (req.session as any).pendingTwoFactorUserId = user.id;

      await AuditService.log({
        context: { userId: user.id, organizationId: user.organizationId, ip: req.ip, userAgent: req.get('user-agent') },
        action: '2fa.setup.initiated', resource: 'user', metadata: { email: user.email }
      }).catch(()=>{});

      res.json({ qrCode: qr, manualEntryKey: secret.base32 });
    } catch (e) {
      console.error('2FA setup error', e);
      res.status(500).json({ message: 'Failed to start 2FA setup' });
    }
  });

  // Verify setup & enable 2FA
  app.post('/api/user/2fa/verify-setup', isAuthenticated, authLimiter, async (req: Request, res: Response) => {
    try {
      const { token } = req.body as { token?: string };
      if (!req.user) return res.status(401).json({ message: 'Not authenticated' });
      if (!token || !/^\d{6}$/.test(token)) return res.status(400).json({ message: 'Invalid token format' });
      const sessionSecret = (req.session as any).pendingTwoFactorSecret;
      const pendingUserId = (req.session as any).pendingTwoFactorUserId;
      if (!sessionSecret || pendingUserId !== req.user.id) return res.status(400).json({ message: 'No pending setup' });

      const expected = speakeasy.totp({ secret: sessionSecret, encoding: 'base32' });
      const valid = TwoFactorService.verifyToken(sessionSecret, token);
      if (!valid) {
        console.warn(`2FA setup verification failed: provided=${token} expected=${expected}`);
      }
      if (!valid) return res.status(400).json({ message: 'Invalid verification code' });

      const user = await storage.getUser(req.user.id);
      if (!user) return res.status(404).json({ message: 'User not found' });

      // Ensure org has encryption key before encrypting
      await SecretsService.ensureOrgKey(user.organizationId);

      // Encrypt secret per organization
      const encrypted = await SecretsService.encrypt(user.organizationId, sessionSecret);
      const backupCodesPlain = TwoFactorService.generateBackupCodes();
      const backupCodesHashed = await Promise.all(backupCodesPlain.map(c => TwoFactorService.hashBackupCode(c)));

      try {
        await storage.updateUser(user.id, {
          twoFactorEnabled: true,
          twoFactorSecret: encrypted,
          twoFactorBackupCodes: backupCodesHashed as any,
          twoFactorVerifiedAt: new Date()
        } as any);
      } catch (dbErr) {
        console.error('2FA enable DB error', dbErr);
        return res.status(500).json({ message: 'Server error saving 2FA data' });
      }

      delete (req.session as any).pendingTwoFactorSecret;
      delete (req.session as any).pendingTwoFactorUserId;

      await AuditService.log({
        context: { userId: user.id, organizationId: user.organizationId, ip: req.ip, userAgent: req.get('user-agent') },
        action: '2fa.enabled', resource: 'user', metadata: { email: user.email }
      }).catch(()=>{});

      res.json({ message: '2FA enabled', backupCodes: backupCodesPlain });
    } catch (e) {
      console.error('2FA verify error', e);
      res.status(500).json({ message: 'Failed to enable 2FA' });
    }
  });

  // Status (include remaining backup codes count)
  app.get('/api/user/2fa/status', isAuthenticated, async (req: Request, res: Response) => {
    if (!req.user) return res.status(401).json({ message: 'Not authenticated' });
    const user = await storage.getUser(req.user.id);
    if (!user) return res.status(404).json({ message: 'User not found' });
    const codes: string[] = (user as any).twoFactorBackupCodes || [];
    res.json({ enabled: (user as any).twoFactorEnabled === true, remainingCodes: codes.length });
  });

  // Regenerate backup codes
  app.post('/api/user/2fa/backup-codes', isAuthenticated, authLimiter, async (req: Request, res: Response) => {
    try {
      if (!req.user) return res.status(401).json({ message: 'Not authenticated' });
      const user = await storage.getUser(req.user.id);
      if (!user) return res.status(404).json({ message: 'User not found' });
      if (!(user as any).twoFactorEnabled) return res.status(400).json({ message: '2FA not enabled' });
      const codesPlain = TwoFactorService.generateBackupCodes();
      const codesHashed = await Promise.all(codesPlain.map(c => TwoFactorService.hashBackupCode(c)));
      await storage.updateUser(user.id, { twoFactorBackupCodes: codesHashed as any } as any);
      res.json({ backupCodes: codesPlain });
    } catch (e) {
      console.error('Backup codes regen error', e);
      res.status(500).json({ message: 'Failed to regenerate backup codes' });
    }
  });

  // Disable 2FA (requires password confirmation)
  app.post('/api/user/2fa/disable', isAuthenticated, authLimiter, async (req: Request, res: Response) => {
    try {
      const { password } = req.body as { password?: string };
      if (!req.user) return res.status(401).json({ message: 'Not authenticated' });
      const user = await storage.getUser(req.user.id);
      if (!user) return res.status(404).json({ message: 'User not found' });
      if (!(user as any).twoFactorEnabled) return res.status(400).json({ message: '2FA not enabled' });
      if (!password) return res.status(400).json({ message: 'Password required' });

      // Reuse password comparison from auth (local import to avoid circular) - dynamic import
      const { comparePasswords } = await import('../auth');
      const ok = await comparePasswords(password, (user as any).password);
      if (!ok) return res.status(401).json({ message: 'Invalid password' });

      await storage.updateUser(user.id, {
        twoFactorEnabled: false,
        twoFactorSecret: null,
        twoFactorBackupCodes: [] as any,
        twoFactorVerifiedAt: null
      } as any);

      await AuditService.log({
        context: { userId: user.id, organizationId: user.organizationId, ip: req.ip, userAgent: req.get('user-agent') },
        action: '2fa.disabled', resource: 'user', metadata: { email: user.email }
      }).catch(()=>{});

      res.json({ message: '2FA disabled' });
    } catch (e) {
      console.error('Disable 2FA error', e);
      res.status(500).json({ message: 'Failed to disable 2FA' });
    }
  });

  // Admin reset a user's 2FA (lost device scenario)
  app.post('/api/admin/2fa/reset/:userId', isAuthenticated, async (req: Request, res: Response) => {
    try {
      const requester = req.user;
      if (!requester?.isAdmin) return res.status(403).json({ message: 'Admin access required' });
      const targetId = Number(req.params.userId);
      if (!Number.isInteger(targetId)) return res.status(400).json({ message: 'Invalid user id' });
      const target = await storage.getUser(targetId);
      if (!target || target.organizationId !== requester.organizationId) {
        return res.status(404).json({ message: 'User not found' });
      }
      await storage.updateUser(target.id, {
        twoFactorEnabled: false,
        twoFactorSecret: null,
        twoFactorBackupCodes: [] as any,
        twoFactorVerifiedAt: null
      } as any);
      await AuditService.log({
        context: { userId: requester.id, organizationId: requester.organizationId, ip: req.ip, userAgent: req.get('user-agent') },
        action: '2fa.admin.reset', resource: 'user', metadata: { targetUserId: target.id, email: (target as any).email }
      }).catch(()=>{});
      res.json({ message: 'User 2FA reset. They must reconfigure 2FA on next login.' });
    } catch (e) {
      console.error('Admin 2FA reset error', e);
      res.status(500).json({ message: 'Failed to reset user 2FA' });
    }
  });
}

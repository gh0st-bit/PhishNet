import React, { useEffect, useState } from 'react';
import { apiRequest } from '@/lib/queryClient';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { Loader2, RefreshCw, AlertTriangle, KeyRound, Trash2 } from 'lucide-react';
import { InputOTP, InputOTPGroup, InputOTPSlot } from '@/components/ui/input-otp';

/**
 * TwoFactorSettingsSection
 * Shows current 2FA status, remaining backup codes, threshold warning (<3),
 * and allows regenerate / disable actions.
 */
export const TwoFactorSettingsSection: React.FC = () => {
  const { toast } = useToast();
  const [enabled, setEnabled] = useState<boolean | null>(null);
  const [remainingCodes, setRemainingCodes] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [regenCodes, setRegenCodes] = useState<string[] | null>(null);
  const [disablePassword, setDisablePassword] = useState('');
  const [disableLoading, setDisableLoading] = useState(false);
  const [verifyToken, setVerifyToken] = useState('');
  const [verifying, setVerifying] = useState(false);
  const [pendingSetup, setPendingSetup] = useState(false);

  async function fetchStatus() {
    try {
      const res = await apiRequest('GET', '/api/user/2fa/status');
      if (!res.ok) return;
      const data = await res.json();
      setEnabled(data.enabled);
      setRemainingCodes(typeof data.remainingCodes === 'number' ? data.remainingCodes : null);
    } catch { /* ignore */ }
  }

  useEffect(() => { fetchStatus(); }, []);

  async function regenerateBackupCodes() {
    setLoading(true);
    try {
      const res = await apiRequest('POST', '/api/user/2fa/backup-codes');
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Failed');
      setRegenCodes(data.backupCodes || []);
      toast({ title: 'Backup Codes Regenerated', description: 'Store them securely now.' });
      fetchStatus();
    } catch (e: any) {
      toast({ title: 'Error', description: e.message || 'Could not regenerate', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  }

  async function disable2FA() {
    if (!disablePassword) {
      toast({ title: 'Password Required', description: 'Enter your password to disable 2FA', variant: 'destructive' });
      return;
    }
    setDisableLoading(true);
    try {
      const res = await apiRequest('POST', '/api/user/2fa/disable', { password: disablePassword });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Failed');
      toast({ title: '2FA Disabled', description: 'You can re-enable it anytime.' });
      setDisablePassword('');
      setRegenCodes(null);
      fetchStatus();
    } catch (e: any) {
      toast({ title: 'Disable Failed', description: e.message || 'Invalid password', variant: 'destructive' });
    } finally {
      setDisableLoading(false);
    }
  }

  // Optional: verify token directly post-enforcement setup (if design wants quick inline verify)
  async function inlineVerify() {
    if (verifyToken.length !== 6) return;
    setVerifying(true);
    try {
      const res = await apiRequest('POST', '/api/user/2fa/verify-setup', { token: verifyToken });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Verification failed');
      toast({ title: '2FA Enabled', description: 'Backup codes generated.' });
      setRegenCodes(data.backupCodes || []);
      setPendingSetup(false);
      setVerifyToken('');
      fetchStatus();
    } catch {
      toast({ title: 'Invalid Code', description: 'Try again.', variant: 'destructive' });
    } finally {
      setVerifying(false);
    }
  }

  if (enabled === null) {
    return null;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between">
        <div>
          <div className="font-medium flex items-center gap-2">Backup Codes {enabled && <span className="text-xs px-2 py-0.5 rounded-full border bg-green-500/10 text-green-600 border-green-500/40">Enabled</span>}</div>
        </div>
      </div>

      {enabled && (
        <>
          <div className="flex flex-wrap items-center gap-4">
            <div className="text-sm">Remaining Backup Codes: <span className="font-mono">{remainingCodes}</span></div>
            {remainingCodes !== null && remainingCodes < 3 && (
              <div className="flex items-center text-amber-700 bg-amber-500/10 px-2 py-1 rounded text-xs"><AlertTriangle className="h-3 w-3 mr-1" /> Low codes — regenerate soon.</div>
            )}
            <Button size="sm" variant="outline" disabled={loading} onClick={regenerateBackupCodes}>
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4 mr-1" />} Regenerate Codes
            </Button>
          </div>
          {regenCodes && regenCodes.length > 0 && (
            <div className="space-y-2">
              <div className="text-xs font-medium">New Backup Codes (store now, shown once):</div>
              <div className="grid grid-cols-2 gap-2 p-3 bg-muted rounded font-mono text-xs">
                {regenCodes.map(code => <div key={code}>{code}</div>)}
              </div>
              <Button size="sm" variant="outline" onClick={() => navigator.clipboard.writeText(regenCodes.join('\n'))}><KeyRound className="h-4 w-4 mr-1" /> Copy Codes</Button>
            </div>
          )}
          <div className="space-y-2 pt-2 border-t">
            <div className="text-xs font-medium">Disable 2FA</div>
            <div className="flex flex-wrap gap-2 items-center">
              <Input type="password" placeholder="Password" value={disablePassword} onChange={e => setDisablePassword(e.target.value)} className="w-48" />
              <Button size="sm" variant="destructive" disabled={disableLoading || !disablePassword} onClick={disable2FA}>
                {disableLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4 mr-1" />} Disable
              </Button>
            </div>
          </div>
        </>
      )}

      {!enabled && null}

      {pendingSetup && (
        <div className="space-y-3">
          <div className="text-xs font-medium">Enter 6-digit code to finish enabling:</div>
          <div className="flex flex-col items-center gap-3">
            <InputOTP maxLength={6} value={verifyToken} onChange={setVerifyToken}>
              <InputOTPGroup>
                <InputOTPSlot index={0} />
                <InputOTPSlot index={1} />
                <InputOTPSlot index={2} />
                <InputOTPSlot index={3} />
                <InputOTPSlot index={4} />
                <InputOTPSlot index={5} />
              </InputOTPGroup>
            </InputOTP>
            <Button size="sm" disabled={verifyToken.length !== 6 || verifying} onClick={inlineVerify}>{verifying ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Verify'}</Button>
          </div>
        </div>
      )}
    </div>
  );
};

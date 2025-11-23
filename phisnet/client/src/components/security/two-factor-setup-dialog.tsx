import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { InputOTP, InputOTPGroup, InputOTPSlot } from '@/components/ui/input-otp';
import { Loader2, Copy } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/queryClient';

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onComplete?: () => void;
}

export const TwoFactorSetupDialog: React.FC<Props> = ({ open, onOpenChange, onComplete }) => {
  const [step, setStep] = useState<'intro' | 'qr' | 'verify' | 'backup'>('intro');
  const [qrCode, setQrCode] = useState('');
  const [manualKey, setManualKey] = useState('');
  const [token, setToken] = useState('');
  const [backupCodes, setBackupCodes] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    if (!open) {
      // reset state when closed
      setStep('intro');
      setQrCode('');
      setManualKey('');
      setToken('');
      setBackupCodes([]);
    }
  }, [open]);

  async function beginSetup() {
    setLoading(true);
    try {
      const res = await apiRequest('POST', '/api/user/2fa/setup');
      if (!res.ok) throw new Error('Setup failed');
      const data = await res.json();
      setQrCode(data.qrCode);
      setManualKey(data.manualEntryKey);
      setStep('verify');
    } catch (e) {
      toast({ title: 'Error', description: 'Failed to start setup', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  }

  async function verifySetup() {
    if (token.length !== 6) return;
    setLoading(true);
    try {
      const res = await apiRequest('POST', '/api/user/2fa/verify-setup', { token });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Verification failed');
      setBackupCodes(data.backupCodes || []);
      setStep('backup');
      toast({ title: '2FA Enabled', description: 'Backup codes generated.' });
    } catch (e: any) {
      toast({ title: 'Invalid code', description: 'Please try again.', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  }

  function complete() {
    onOpenChange(false);
    onComplete?.();
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        {step === 'intro' && (
          <div className="space-y-6">
            <DialogHeader>
              <DialogTitle>Enable Two-Factor Authentication</DialogTitle>
              <DialogDescription>Protect your account with a one-time code required at login.</DialogDescription>
            </DialogHeader>
            <ul className="text-sm list-disc pl-5 space-y-1 text-muted-foreground">
              <li>Install an authenticator app (Google Authenticator, Authy, Microsoft Authenticator).</li>
              <li>You will scan a QR code and enter the 6-digit code it shows.</li>
              <li>Store backup codes safely – they are shown only once.</li>
            </ul>
            <Button className="w-full" onClick={beginSetup} disabled={loading}>{loading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Start Setup'}</Button>
          </div>
        )}
        {step === 'verify' && (
          <div className="space-y-6">
            <DialogHeader>
              <DialogTitle>Scan & Verify</DialogTitle>
              <DialogDescription>Scan the QR code or enter the manual key, then input the 6‑digit code.</DialogDescription>
            </DialogHeader>
            {qrCode && <div className="flex justify-center"><img src={qrCode} alt="QR Code" className="w-48 h-48" /></div>}
            <div className="text-xs text-center">
              Manual key: <code className="bg-muted px-2 py-1 rounded font-mono">{manualKey}</code>
            </div>
            <div className="flex flex-col items-center gap-4">
              <InputOTP maxLength={6} value={token} onChange={setToken}>
                <InputOTPGroup>
                  <InputOTPSlot index={0} />
                  <InputOTPSlot index={1} />
                  <InputOTPSlot index={2} />
                  <InputOTPSlot index={3} />
                  <InputOTPSlot index={4} />
                  <InputOTPSlot index={5} />
                </InputOTPGroup>
              </InputOTP>
              <Button className="w-full" disabled={token.length !== 6 || loading} onClick={verifySetup}>{loading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Verify & Continue'}</Button>
            </div>
          </div>
        )}
        {step === 'backup' && (
          <div className="space-y-6">
            <DialogHeader>
              <DialogTitle>Save Backup Codes</DialogTitle>
              <DialogDescription>Each code works once if you lose access to your authenticator.</DialogDescription>
            </DialogHeader>
            <div className="grid grid-cols-2 gap-2 p-4 bg-muted rounded font-mono text-sm">
              {backupCodes.map(c => <div key={c}>{c}</div>)}
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => navigator.clipboard.writeText(backupCodes.join('\n'))}>
                <Copy className="h-4 w-4 mr-1" /> Copy
              </Button>
              <Button className="flex-1" onClick={complete}>Finish</Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

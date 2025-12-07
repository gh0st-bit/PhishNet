import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { InputOTP, InputOTPGroup, InputOTPSlot } from '@/components/ui/input-otp';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { Loader2 } from 'lucide-react';

interface Props {
  open: boolean;
  onSuccess: (user: any) => void;
  onClose: () => void;
}

export const TwoFactorVerificationDialog: React.FC<Props> = ({ open, onSuccess, onClose }) => {
  const [token, setToken] = useState('');
  const [backupCode, setBackupCode] = useState('');
  const [useBackup, setUseBackup] = useState(false);
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  async function submit() {
    if (!useBackup && token.length !== 6) return;
    if (useBackup && backupCode.trim().length < 8) return;
    setLoading(true);
    try {
      const body: any = useBackup ? { backupCode: backupCode.trim() } : { token };
      const res = await apiRequest('POST', '/api/login/2fa', body);
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Verification failed');
      
      // Update the user cache with the returned user data
      queryClient.setQueryData(['/api/user'], data);
      
      toast({ title: '2FA Verified', description: 'Login complete.' });
      onSuccess(data);
    } catch (e: any) {
      toast({ title: 'Invalid code', description: e.message || 'Try again.', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Two-Factor Verification</DialogTitle>
          <DialogDescription>
            {useBackup ? 'Enter a backup code. Each code can be used once.' : 'Enter the 6‑digit code from your authenticator app.'}
          </DialogDescription>
        </DialogHeader>
        {!useBackup && (
          <div className="space-y-4">
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
            <Button className="w-full" disabled={token.length !== 6 || loading} onClick={submit}>
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Verify'}
            </Button>
            <Button variant="ghost" type="button" className="w-full text-xs" onClick={() => { setUseBackup(true); setToken(''); }}>Use a backup code</Button>
          </div>
        )}
        {useBackup && (
          <div className="space-y-4">
            <input
              className="w-full border rounded px-3 py-2 text-sm bg-background"
              placeholder="XXXX-XXXX"
              value={backupCode}
              onChange={(e) => setBackupCode(e.target.value.toUpperCase())}
            />
            <Button className="w-full" disabled={backupCode.trim().length < 8 || loading} onClick={submit}>
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Verify with Backup Code'}
            </Button>
            <Button variant="ghost" type="button" className="w-full text-xs" onClick={() => { setUseBackup(false); setBackupCode(''); }}>Use app code instead</Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

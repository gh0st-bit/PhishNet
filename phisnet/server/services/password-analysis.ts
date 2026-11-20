import { createHash } from 'node:crypto';

const common = new Set(['password','password1','password123','123456','12345678','123456789','qwerty','letmein','admin','welcome']);
export async function analyzePassword(password: string) {
  const result = { version: 1, length: password.length, common: common.has(password.toLowerCase()),
    short: password.length < 12, breached: null as boolean | null, checkedAt: new Date().toISOString() };
  if (process.env.PWNED_PASSWORDS_ENABLED !== 'true') return result;
  const hash = createHash('sha1').update(password,'utf8').digest('hex').toUpperCase();
  try {
    const response = await fetch(`https://api.pwnedpasswords.com/range/${hash.slice(0,5)}`, {
      headers: { 'Add-Padding':'true','User-Agent':'PhishNet-Password-Analysis' }, signal: AbortSignal.timeout(3000),
    });
    if (!response.ok) return result;
    const lines = (await response.text()).split(/\r?\n/);
    result.breached = lines.some(line => {
      const [suffix, count] = line.split(':');
      return suffix === hash.slice(5) && Number(count) > 0;
    });
  } catch { /* Unavailable is unknown, never a clean result. */ }
  return result;
}

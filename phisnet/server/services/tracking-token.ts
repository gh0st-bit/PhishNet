import { createHmac, timingSafeEqual } from 'node:crypto';

export function trackingToken(campaignId: number, targetId: number): string {
  if (!process.env.SESSION_SECRET) throw new Error('SESSION_SECRET is required');
  return createHmac('sha256', process.env.SESSION_SECRET).update(`tracking:v1:${campaignId}:${targetId}`).digest('base64url');
}
export function validTrackingToken(value: unknown, campaignId: number, targetId: number): boolean {
  if (typeof value !== 'string' || !Number.isSafeInteger(campaignId) || !Number.isSafeInteger(targetId)) return false;
  const expected = Buffer.from(trackingToken(campaignId, targetId));
  const actual = Buffer.from(value);
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

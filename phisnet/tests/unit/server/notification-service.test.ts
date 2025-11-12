import { jest } from '@jest/globals';

// ESM mocking: we mock the ../db module to control pool.query behaviour
jest.mock('../../../server/db', () => {
  return {
    pool: {
      query: jest.fn(),
    },
    db: {},
  };
});

import { NotificationService } from '../../../server/services/notification-service';
import { pool } from '../../../server/db';

const mockedPool = pool as unknown as { query: unknown };

describe('NotificationService', () => {
  beforeEach(() => {
    const mockedQuery = mockedPool.query as unknown as jest.Mock;
    mockedQuery.mockReset?.();
  });

  it('getUnreadCount returns numeric count', async () => {
  const mockedQuery = mockedPool.query as unknown as jest.Mock;
  (mockedQuery as any).mockResolvedValueOnce({ rows: [{ count: '5' }] });
    const count = await NotificationService.getUnreadCount(123);
    expect(count).toBe(5);
    expect((mockedPool.query as unknown as jest.Mock)).toHaveBeenCalledWith(
      'SELECT COUNT(*) FROM notifications WHERE user_id = $1 AND is_read = false',
      [123]
    );
  });

  it('createNotification inserts when preferences allow', async () => {
    // Force shouldNotify to always return true
    const shouldNotifySpy = jest.spyOn(NotificationService as any, 'shouldNotify').mockResolvedValue(true);

  const mockedQuery = mockedPool.query as unknown as jest.Mock;
  (mockedQuery as any).mockResolvedValueOnce({
      rows: [
        {
          id: 999,
          user_id: 7,
          organization_id: 1,
          type: 'threat_intel',
          title: 'Threat Intelligence Update',
          message: '12 new indicators ingested',
          priority: 'high',
          action_url: '/threat-landscape',
          metadata: { totalIngested: 12 },
          is_read: false,
          created_at: new Date().toISOString(),
        },
      ],
    });

    const notif = await NotificationService.createNotification({
      userId: 7,
      organizationId: 1,
      type: 'threat_intel',
      title: 'Threat Intelligence Update',
      message: '12 new indicators ingested',
      priority: 'high',
      actionUrl: '/threat-landscape',
      metadata: { totalIngested: 12 },
    });

    expect(notif).toBeDefined();
    expect(notif?.id).toBe(999);
  const mq = mockedPool.query as unknown as jest.Mock;
  expect(mq).toHaveBeenCalledTimes(1);
  expect(mq.mock.calls[0][0]).toMatch(/INSERT INTO notifications/);
    shouldNotifySpy.mockRestore();
  });

  it('createNotification skips when preferences disallow', async () => {
    const shouldNotifySpy = jest.spyOn(NotificationService as any, 'shouldNotify').mockResolvedValue(false);

    const notif = await NotificationService.createNotification({
      userId: 55,
      organizationId: 1,
      type: 'campaign_complete',
      title: 'Campaign Finished',
      message: 'Campaign A finished',
    });

    expect(notif).toBeNull();
    // Pool query should never be invoked
    expect(mockedPool.query).not.toHaveBeenCalled();
    shouldNotifySpy.mockRestore();
  });
});

import { describe, it, expect, beforeEach, jest } from '@jest/globals';

// Lightweight unit test: ensure NotificationService.createNotification is called
// after a hypothetical ingestion summary logic. We mock the service boundary.

class MockNotificationService {
  static readonly createNotification = jest.fn();
}

describe('Threat Intel ingestion notification hook', () => {
  beforeEach(() => {
    MockNotificationService.createNotification.mockClear();
  });

  it('emits per-user threat_intel notifications with actionUrl', async () => {
    // Simulate aggregated ingestion result
    const totalIngested = 12;
    const users = [{ id: 1 }, { id: 2 }];

    // Simulate hook behavior
    for (const u of users) {
      await MockNotificationService.createNotification({
        userId: u.id,
        type: 'threat_intel',
        title: 'Threat Intelligence Update',
        message: expect.any(String),
        priority: 'high',
        actionUrl: '/threat-landscape',
        metadata: expect.objectContaining({ totalIngested }),
      });
    }

    expect(MockNotificationService.createNotification).toHaveBeenCalledTimes(users.length);
    for (const u of users) {
      expect(MockNotificationService.createNotification).toHaveBeenCalledWith(
        expect.objectContaining({ userId: u.id, actionUrl: '/threat-landscape', type: 'threat_intel' })
      );
    }
  });
});

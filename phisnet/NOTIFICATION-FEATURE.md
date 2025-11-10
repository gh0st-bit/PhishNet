# Threat Intelligence Notification Feature

## Overview

The Threat Intelligence (TI) Notification feature connects the PhishNet dashboard notification bell with live threat intelligence feed updates. When new threat data is ingested, users receive per-user notifications with direct links to the threat landscape analysis page.

## Architecture

### Backend Components

1. **Threat Intelligence Service** (`server/services/threat-intelligence/threat-intelligence.service.ts`)
   - Ingests threat data from multiple sources (AlienVault OTX, AbuseIPDB, URLhaus)
   - Post-ingestion hook creates per-user notifications
   - Automatically assigns priority based on volume:
     - High: 100+ indicators
     - Medium: 50-99 indicators  
     - Low: < 50 indicators

2. **Notification Service** (`server/services/notification-service.ts`)
   - `createNotification()`: Creates individual user notifications
   - `getUserNotifications()`: Fetches user's notification list
   - `getUnreadCount()`: Returns count of unread notifications
   - `markAsRead()`: Marks notification as read
   - `markAllAsRead()`: Bulk mark all as read
   - `deleteNotification()`: Removes notification
   - Respects user preferences via `shouldNotify()`

3. **API Routes** (`server/routes.ts`)
   - `GET /api/notifications`: List user notifications (camelCase normalized)
   - `GET /api/notifications/unread-count`: Get unread count
   - `PUT /api/notifications/:id/read`: Mark single as read
   - `PUT /api/notifications/mark-all-read`: Mark all as read
   - `DELETE /api/notifications/:id`: Delete notification
   - `GET /api/notifications/preferences`: Get user preferences
   - `PUT /api/notifications/preferences`: Update preferences

### Frontend Components

1. **Notification Bell** (`client/src/components/notifications/notification-bell.tsx`)
   - Red unread badge showing count
   - Icon mapping for notification types (threat_intel → AlertTriangle)
   - Popover panel listing recent notifications
   - Click-through navigation via `actionUrl`
   - Delete button per notification
   - Keyboard accessible (semantic button)
   - Polling via React Query (30s interval)

2. **Notifications Page** (`client/src/pages/notifications-page.tsx`)
   - Full list of notifications with priority dots
   - "Mark All as Read" action
   - Individual delete actions
   - "New" badge for unread items
   - Metadata display for threat_intel type
   - Direct navigation to `/threat-landscape` on click
   - Polling via React Query

3. **Routing** (`client/src/App.tsx`)
   - Protected route: `/notifications` → `NotificationsPage`

## Data Flow

```
1. GitHub Actions (hourly) → Trigger TI Ingestion
2. TI Service → Fetch from providers → Aggregate indicators
3. TI Service → Insert into `threat_intelligence` table
4. TI Service → Call NotificationService.createNotification() for each user
5. Notification stored in `notifications` table with:
   - type: 'threat_intel'
   - priority: 'low' | 'medium' | 'high'
   - actionUrl: '/threat-landscape'
   - metadata: { perProviderCounts, totalIngested }
6. Frontend polls `/api/notifications/unread-count` every 30s
7. Unread count appears in red badge on bell icon
8. User clicks bell → sees popover list
9. User clicks "View all" → navigates to `/notifications` page
10. User clicks notification → navigates to `/threat-landscape`
```

## Notification Schema

```typescript
{
  id: number;
  userId: number;
  organizationId: number;
  type: 'threat_intel' | 'campaign_complete' | ...;
  title: string;
  message: string;
  priority: 'low' | 'medium' | 'high';
  actionUrl: string; // e.g., '/threat-landscape'
  metadata: {
    perProviderCounts?: {
      alienvault?: number;
      abuseipdb?: number;
      urlhaus?: number;
    };
    totalIngested?: number;
  };
  isRead: boolean;
  createdAt: Date;
}
```

## User Preferences

Users can control which notification types they receive via `notification_preferences` table:
- `campaignAlerts`: Campaign-related notifications
- `securityAlerts`: Security and login events
- `systemUpdates`: System maintenance notifications
- `weeklyReports`: Weekly/monthly reports

The `shouldNotify()` method checks preferences before creating notifications.

## Testing

### Unit Tests
- **NotificationService** (`tests/unit/server/notification-service.test.ts`)
  - Tests `getUnreadCount()`, `createNotification()`, preference filtering
  - Mocks `pool.query` to isolate database logic

- **Threat Intel Notification** (`tests/server/threat-intel-notification.test.ts`)
  - Verifies notification emission pattern
  - Confirms payload structure

### E2E Tests
- **Notifications Page** (`tests/e2e/notifications.spec.ts`)
  - Smoke test for `/notifications` route
  - Skips gracefully if unauthenticated

### Test Teardown
- **Setup After Env** (`tests/setup-after-env.ts`)
  - Polyfills `TextEncoder`/`TextDecoder` for pg library under jsdom
  - Stops reporting and campaign schedulers
  - Closes session store cleanup interval
  - Closes PostgreSQL connection pool
  - Eliminates "open handle" warnings

## Configuration

No additional configuration required. Feature works out-of-box with:
- PostgreSQL database (notifications table)
- Existing user authentication
- Threat intelligence ingestion workflow

## Future Enhancements

- **Real-time Notifications**: WebSocket support for instant delivery
- **Notification Filtering**: Filter by type, priority, date range
- **Bulk Actions**: Select multiple notifications for batch operations
- **Email Digest**: Optional email summary of notifications
- **Mobile Push**: Native mobile app push notifications
- **Notification Grouping**: Collapse similar notifications
- **User Preferences UI**: Frontend for managing notification settings

## Related Files

### Backend
- `server/services/threat-intelligence/threat-intelligence.service.ts`
- `server/services/notification-service.ts`
- `server/routes.ts`
- `server/db.ts` (pool management)
- `server/storage.ts` (session store)

### Frontend
- `client/src/components/notifications/notification-bell.tsx`
- `client/src/pages/notifications-page.tsx`
- `client/src/App.tsx`

### Tests
- `tests/unit/server/notification-service.test.ts`
- `tests/server/threat-intel-notification.test.ts`
- `tests/e2e/notifications.spec.ts`
- `tests/setup-after-env.ts`

### Configuration
- `jest.config.js`
- `tsconfig.json`

### Documentation
- `README.md` (Features section)
- `README-DEPLOYMENT.md` (Threat Intelligence & Notifications)
- `tests/README.md` (Test suite guide)
- `NOTIFICATION-FEATURE.md` (this document)

## Maintenance Notes

### Database Cleanup
Consider periodic cleanup of old read notifications:

```sql
DELETE FROM notifications 
WHERE is_read = true 
  AND read_at < NOW() - INTERVAL '30 days';
```

### Monitoring
Track notification creation rate and delivery:

```sql
-- Daily notification stats
SELECT 
  DATE(created_at) as date,
  type,
  COUNT(*) as total,
  SUM(CASE WHEN is_read THEN 1 ELSE 0 END) as read_count
FROM notifications
WHERE created_at > NOW() - INTERVAL '7 days'
GROUP BY DATE(created_at), type
ORDER BY date DESC;
```

### Performance
- Notification queries use indexes on `user_id` and `is_read`
- Consider pagination for users with high notification counts
- Archive old notifications to maintain query performance

## Support

For issues or questions:
- Check test suite: `npm test`
- Review logs: `logs/app.log`
- Inspect database: `SELECT * FROM notifications WHERE user_id = ?`
- Monitor ingestion: Check GitHub Actions workflow runs

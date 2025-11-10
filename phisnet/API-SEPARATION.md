# API Separation & Modular Architecture

## Overview

This document describes the modular API architecture implemented to improve code maintainability, testability, and organization. The monolithic `server/routes.ts` file (2600+ lines) has been partially refactored into separate, domain-specific route modules.

## Architecture

### Directory Structure

```
phisnet/server/
├── routes.ts                    # Main registration (legacy + new routes)
└── routes/                      # Modular route files
    ├── index.ts                 # Central registration & exports
    ├── health.ts                # Health check & session endpoints
    ├── dashboard.ts             # Dashboard stats & metrics
    ├── notifications.ts         # Notification CRUD & preferences
    └── threat-intelligence.ts   # Threat intelligence endpoints
```

### Modular Routes

#### 1. Health Routes (`routes/health.ts`)
- **Purpose**: System health and session management
- **Endpoints**:
  - `GET /api/status` - Health check
  - `POST /api/session-ping` - Session refresh

#### 2. Dashboard Routes (`routes/dashboard.ts`)
- **Purpose**: Dashboard data aggregation
- **Endpoints**:
  - `GET /api/dashboard/stats` - Campaign, user, and group counts
  - `GET /api/dashboard/metrics` - Phishing campaign metrics
  - `GET /api/dashboard/phishing-metrics` - Alias for metrics
  - `GET /api/dashboard/risk-users` - High-risk users
  - `GET /api/dashboard/threats` - Recent threat indicators

#### 3. Notification Routes (`routes/notifications.ts`)
- **Purpose**: User notification management
- **Endpoints**:
  - `GET /api/notifications` - List user notifications (paginated)
  - `GET /api/notifications/unread-count` - Get unread count
  - `PUT /api/notifications/:id/read` - Mark as read
  - `PUT /api/notifications/mark-all-read` - Mark all as read
  - `DELETE /api/notifications/:id` - Delete notification
  - `GET /api/notifications/preferences` - Get preferences
  - `PUT /api/notifications/preferences` - Update preferences
  - `POST /api/notifications` - Create notifications (admin)

#### 4. Threat Intelligence Routes (`routes/threat-intelligence.ts`)
- **Purpose**: Threat intelligence feed management
- **Endpoints**:
  - `GET /api/threat-intelligence/analysis` - Threat analysis
  - `GET /api/threat-intelligence/threats` - Recent threats
  - `GET /api/threat-intelligence/search` - Search threats
  - `POST /api/threat-intelligence/ingest` - Trigger ingestion (admin)
  - `GET /api/threat-intelligence/scheduler/status` - Scheduler status (admin)
  - `POST /api/threat-intelligence/scheduler/:action` - Start/stop scheduler (admin)
  - `POST /api/threat-intelligence/ingest-now` - Manual ingestion (admin)

## Migration Strategy

### Phase 1: Modular Route Creation ✅
- Created separate route files for high-priority domains
- Implemented registration functions in `routes/index.ts`
- Added import and registration call in main `routes.ts`

### Phase 2: Parallel Operation (Current)
- **Both old and new routes are active**
- No breaking changes to existing API
- New modular routes handle requests
- Legacy routes remain as fallback during transition

### Phase 3: Route Migration (Future)
- Gradually migrate remaining routes:
  - Groups & Targets
  - SMTP Profiles
  - Email Templates
  - Landing Pages
  - Campaigns
  - Users
  - Reports
  - Tracking (public endpoints)
- Test each migration thoroughly
- Remove duplicate legacy routes after verification

### Phase 4: Cleanup (Future)
- Remove all legacy route implementations
- Update tests to use modular structure
- Finalize documentation

## Benefits

### 1. **Improved Maintainability**
- Smaller, focused files (50-150 lines vs 2600+ lines)
- Domain-specific modules are easier to understand
- Changes to one domain don't affect others

### 2. **Better Testability**
- Each route module can be tested independently
- Easier to mock dependencies
- Reduced test coupling

### 3. **Enhanced Collaboration**
- Multiple developers can work on different route modules
- Reduced merge conflicts
- Clearer code ownership

### 4. **Easier Debugging**
- Stack traces point to specific route files
- Faster to locate issues
- Better error isolation

### 5. **Scalability**
- Easy to add new route modules
- Can split large modules further if needed
- Supports microservice extraction in future

## Usage

### Registering New Routes

Create a new route file in `server/routes/`:

```typescript
import type { Express } from 'express';
import { isAuthenticated } from '../auth';

export function registerMyRoutes(app: Express) {
  app.get('/api/my-endpoint', isAuthenticated, async (req, res) => {
    // Implementation
  });
}
```

Add to `routes/index.ts`:

```typescript
import { registerMyRoutes } from './my-routes';

export function registerModularRoutes(app: Express) {
  // ... existing routes
  registerMyRoutes(app);
}

export { registerMyRoutes } from './my-routes';
```

### Testing Modular Routes

```typescript
import { registerMyRoutes } from './routes/my-routes';
import request from 'supertest';
import express from 'express';

describe('My Routes', () => {
  let app: Express;

  beforeEach(() => {
    app = express();
    registerMyRoutes(app);
  });

  it('should handle my endpoint', async () => {
    const response = await request(app).get('/api/my-endpoint');
    expect(response.status).toBe(200);
  });
});
```

## Best Practices

1. **Keep routes focused**: Each module should handle a single domain
2. **Use consistent naming**: `register<Domain>Routes` for registration functions
3. **Export registration functions**: Allow both bulk and individual registration
4. **Include type guards**: Use `assertUser` helper for authenticated routes
5. **Handle errors properly**: Log errors with `console.error` before sending response
6. **Document endpoints**: Add comments for each route's purpose
7. **Follow middleware patterns**: Use common middleware (isAuthenticated, hasOrganization, isAdmin)

## Remaining Work

### High Priority
- [ ] Migrate campaign routes (CRUD operations)
- [ ] Migrate user routes (profile, users management)
- [ ] Migrate group & target routes

### Medium Priority
- [ ] Migrate SMTP profile routes
- [ ] Migrate email template routes
- [ ] Migrate landing page routes
- [ ] Migrate report routes

### Low Priority
- [ ] Migrate public tracking routes (/track, /o/:id, /c/:id, /l/:id)
- [ ] Migrate debug/error routes
- [ ] Migrate role routes

### Cleanup
- [ ] Remove duplicate legacy routes after verification
- [ ] Update integration tests
- [ ] Add route-specific unit tests
- [ ] Create API documentation (Swagger/OpenAPI)

## Testing Verification

After each migration phase, verify:

1. **Unit tests pass**: `npm test`
2. **Integration tests pass**: All API endpoints respond correctly
3. **No duplicate routes**: Check for route conflicts
4. **Performance**: No significant regression
5. **Error handling**: All edge cases covered

## Related Documentation

- [NOTIFICATION-FEATURE.md](./NOTIFICATION-FEATURE.md) - Notification system documentation
- [tests/README.md](./tests/README.md) - Testing guide
- [README-DEPLOYMENT.md](./README-DEPLOYMENT.md) - Deployment guide

## Changelog

### 2024-01-XX - Initial Modular Architecture
- Created `server/routes/` directory structure
- Implemented health, dashboard, notifications, and threat intelligence modules
- Added central registration in `routes/index.ts`
- Integrated modular routes into main `routes.ts`
- Documented migration strategy and best practices

---

**Status**: ✅ Phase 1 & 2 complete | 🚧 Phase 3 in progress | ⏳ Phase 4 pending

import type { Express } from 'express';
import { isAuthenticated, isAdmin } from '../auth';
import { NotificationService } from '../services/notification-service';

function assertUser(user: Express.User | undefined): asserts user is Express.User {
  if (!user) {
    throw new Error('User not authenticated');
  }
}

export function registerNotificationRoutes(app: Express) {
  // Get user notifications
  app.get("/api/notifications", isAuthenticated, async (req, res) => {
    try {
      assertUser(req.user);
      const page = Number.parseInt(req.query.page as string, 10) || 1;
      const limit = Number.parseInt(req.query.limit as string, 10) || 20;
      const offset = (page - 1) * limit;
      
      const rows = await NotificationService.getUserNotifications(
        req.user.id, 
        limit, 
        offset
      );

      // Normalize to camelCase for client
      const notifications = (rows || []).map((n: any) => ({
        id: n.id,
        userId: n.user_id,
        organizationId: n.organization_id,
        type: n.type,
        title: n.title,
        message: n.message,
        priority: n.priority,
        isRead: n.is_read,
        readAt: n.read_at,
        actionUrl: n.action_url,
        createdAt: n.created_at,
        metadata: n.metadata,
      }));

      const unreadCount = await NotificationService.getUnreadCount(req.user.id);

      res.json({
        notifications,
        unreadCount,
        pagination: {
          page,
          limit,
          hasMore: notifications.length === limit
        }
      });
    } catch (error) {
      console.error("Error fetching notifications:", error);
      res.status(500).json({ message: "Error fetching notifications" });
    }
  });

  // Get unread count
  app.get("/api/notifications/unread-count", isAuthenticated, async (req, res) => {
    try {
      assertUser(req.user);
      const count = await NotificationService.getUnreadCount(req.user.id);
      res.json({ count });
    } catch (error) {
      console.error("Error fetching unread count:", error);
      res.status(500).json({ message: "Error fetching unread count" });
    }
  });

  // Mark notification as read
  app.put("/api/notifications/:id/read", isAuthenticated, async (req, res) => {
    try {
      assertUser(req.user);
      const notificationId = Number.parseInt(req.params.id, 10);
      await NotificationService.markAsRead(notificationId, req.user.id);
      res.json({ success: true });
    } catch (error) {
      console.error("Error marking notification as read:", error);
      res.status(500).json({ message: "Error marking notification as read" });
    }
  });

  // Mark all notifications as read
  app.put("/api/notifications/mark-all-read", isAuthenticated, async (req, res) => {
    try {
      assertUser(req.user);
      const notifications = await NotificationService.markAllAsRead(req.user.id);
      res.json({ updated: notifications.length });
    } catch (error) {
      console.error("Error marking all notifications as read:", error);
      res.status(500).json({ message: "Error marking all notifications as read" });
    }
  });

  // Delete notification
  app.delete("/api/notifications/:id", isAuthenticated, async (req, res) => {
    try {
      assertUser(req.user);
      const notificationId = Number.parseInt(req.params.id, 10);
      await NotificationService.deleteNotification(notificationId, req.user.id);
      res.json({ message: "Notification deleted successfully" });
    } catch (error) {
      console.error("Error deleting notification:", error);
      res.status(500).json({ message: "Error deleting notification" });
    }
  });

  // Get notification preferences
  app.get("/api/notifications/preferences", isAuthenticated, async (req, res) => {
    try {
      assertUser(req.user);
      const preferences = await NotificationService.getPreferences(req.user.id);
      res.json(preferences);
    } catch (error) {
      console.error("Error fetching notification preferences:", error);
      res.status(500).json({ message: "Error fetching notification preferences" });
    }
  });

  // Update notification preferences
  app.put("/api/notifications/preferences", isAuthenticated, async (req, res) => {
    try {
      assertUser(req.user);
      const preferences = await NotificationService.updatePreferences(req.user.id, req.body);
      res.json(preferences);
    } catch (error) {
      console.error("Error updating notification preferences:", error);
      res.status(500).json({ message: "Error updating notification preferences" });
    }
  });

  // Admin: Create notifications
  app.post("/api/notifications", isAuthenticated, isAdmin, async (req, res) => {
    try {
      assertUser(req.user);
      const { type, title, message, priority, actionUrl, userIds, broadcast } = req.body;
      
      if (broadcast) {
        // Send to all users in organization
        const notifications = await NotificationService.createOrganizationNotification({
          organizationId: req.user.organizationId,
          type,
          title,
          message,
          priority,
          actionUrl
        });
        res.json({ message: "Broadcast notification sent", count: notifications.length });
      } else if (userIds && userIds.length > 0) {
        // Send to specific users
        const notifications: any[] = [];
        for (const userId of userIds as number[]) {
          const notification = await NotificationService.createNotification({
            userId,
            organizationId: req.user.organizationId,
            type,
            title,
            message,
            priority,
            actionUrl
          });
          notifications.push(notification);
        }
        res.json({ message: "Notifications sent", count: notifications.length });
      } else {
        res.status(400).json({ message: "Must specify userIds or set broadcast to true" });
      }
    } catch (error) {
      console.error("Error creating notifications:", error);
      res.status(500).json({ message: "Error creating notifications" });
    }
  });
}

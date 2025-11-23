// Create: phisnet/server/services/notification-service.ts
import { db, pool } from '../db';
import { notificationsSchema, notificationPreferencesSchema } from '@shared/schema';
import { eq, and, desc, count } from 'drizzle-orm';

export class NotificationService {
  static async getUserNotifications(userId: number, limit: number = 20, offset: number = 0) {
    try {
      const result = await pool.query(
        `SELECT * FROM notifications 
         WHERE user_id = $1 
         ORDER BY created_at DESC 
         LIMIT $2 OFFSET $3`,
        [userId, limit, offset]
      );
      
      return result.rows;
    } catch (error) {
      console.error("Error fetching user notifications:", error);
      throw error;
    }
  }
  
  static async getUnreadCount(userId: number): Promise<number> {
    try {
      const result = await pool.query(
        'SELECT COUNT(*) FROM notifications WHERE user_id = $1 AND is_read = false',
        [userId]
      );
      
      return parseInt(result.rows[0].count) || 0;
    } catch (error) {
      console.error("Error getting unread count:", error);
      return 0;
    }
  }
  
  static async markAsRead(notificationId: number, userId: number) {
    try {
      await pool.query(
        'UPDATE notifications SET is_read = true, read_at = NOW() WHERE id = $1 AND user_id = $2',
        [notificationId, userId]
      );
    } catch (error) {
      console.error("Error marking notification as read:", error);
      throw error;
    }
  }
  
  static async markAllAsRead(userId: number) {
    try {
      const result = await pool.query(
        'UPDATE notifications SET is_read = true, read_at = NOW() WHERE user_id = $1 AND is_read = false RETURNING *',
        [userId]
      );
      
      return result.rows;
    } catch (error) {
      console.error("Error marking all notifications as read:", error);
      throw error;
    }
  }
  
  static async createNotification(notification: any) {
    try {
      // Check if the user has enabled this type of notification
      if (notification.userId) {
        const shouldNotify = await this.shouldNotify(notification.userId, notification.type);
        if (!shouldNotify) {
          console.log(`Notification of type ${notification.type} skipped based on user preferences`);
          return null;
        }
      }
      
      const result = await pool.query(
        `INSERT INTO notifications (user_id, organization_id, type, title, message, priority, action_url, metadata)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
        [
          notification.userId,
          notification.organizationId,
          notification.type,
          notification.title,
          notification.message,
          notification.priority || 'medium',
          notification.actionUrl,
          JSON.stringify(notification.metadata || {})
        ]
      );
      
      return result.rows[0];
    } catch (error) {
      console.error("Error creating notification:", error);
      throw error;
    }
  }
  
  static async createOrganizationNotification(notification: any) {
    // Create notification for all users in organization
    try {
      const usersResult = await pool.query(
        'SELECT id FROM users WHERE organization_id = $1',
        [notification.organizationId]
      );
      
      const notifications = [];
      for (const user of usersResult.rows) {
        // Check if the user has enabled this type of notification
        const shouldNotify = await this.shouldNotify(user.id, notification.type);
        if (!shouldNotify) {
          console.log(`Organization notification of type ${notification.type} skipped for user ${user.id} based on preferences`);
          continue;
        }
        
        const notif = await this.createNotification({
          ...notification,
          userId: user.id
        });
        
        if (notif) {
          notifications.push(notif);
        }
      }
      
      return notifications;
    } catch (error) {
      console.error("Error creating organization notification:", error);
      throw error;
    }
  }
  
  static async updatePreferences(userId: number, preferences: any) {
    try {
      const result = await pool.query(
        `INSERT INTO notification_preferences (user_id, email_notifications, push_notifications, campaign_alerts, security_alerts, system_updates, weekly_reports, invite_dashboard, invite_email)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
         ON CONFLICT (user_id) 
         DO UPDATE SET 
           email_notifications = $2,
           push_notifications = $3,
           campaign_alerts = $4,
           security_alerts = $5,
           system_updates = $6,
           weekly_reports = $7,
           invite_dashboard = $8,
           invite_email = $9,
           updated_at = NOW()
         RETURNING *`,
        [
          userId,
          preferences.emailNotifications !== undefined ? preferences.emailNotifications : true,
          preferences.pushNotifications !== undefined ? preferences.pushNotifications : true,
          preferences.campaignAlerts !== undefined ? preferences.campaignAlerts : true,
          preferences.securityAlerts !== undefined ? preferences.securityAlerts : true,
          preferences.systemUpdates !== undefined ? preferences.systemUpdates : true,
          preferences.weeklyReports !== undefined ? preferences.weeklyReports : true,
          preferences.inviteDashboard !== undefined ? preferences.inviteDashboard : true,
          preferences.inviteEmail !== undefined ? preferences.inviteEmail : true
        ]
      );
      
      return result.rows[0];
    } catch (error) {
      console.error("Error updating notification preferences:", error);
      throw error;
    }
  }
  
  static async getPreferences(userId: number) {
    try {
      const result = await pool.query(
        'SELECT * FROM notification_preferences WHERE user_id = $1',
        [userId]
      );
      
      if (result.rows.length === 0) {
        // Return default preferences
        return {
          emailNotifications: true,
          pushNotifications: true,
          campaignAlerts: true,
          securityAlerts: true,
          systemUpdates: true,
          weeklyReports: true,
          inviteDashboard: true,
          inviteEmail: true
        };
      }
      
      return result.rows[0];
    } catch (error) {
      console.error("Error getting notification preferences:", error);
      throw error;
    }
  }

  static async deleteNotification(notificationId: number, userId: number) {
    try {
      await pool.query(
        'DELETE FROM notifications WHERE id = $1 AND user_id = $2',
        [notificationId, userId]
      );
    } catch (error) {
      console.error("Error deleting notification:", error);
      throw error;
    }
  }
  
  static async shouldNotify(userId: number, notificationType: string): Promise<boolean> {
    try {
      const preferences = await this.getPreferences(userId);
      
      // Map notification type to corresponding preference setting
      switch (notificationType) {
        case 'campaign_complete':
        case 'campaign_created':
        case 'email_opened':
        case 'link_clicked':
        case 'form_submitted':
          return preferences.campaignAlerts;
          
        case 'security_alert':
        case 'login_attempt':
        case 'password_changed':
          return preferences.securityAlerts;
          
        case 'system_update':
        case 'maintenance':
          return preferences.systemUpdates;
          
        case 'weekly_report':
        case 'monthly_report':
          return preferences.weeklyReports;

        case 'invite_accepted':
          return preferences.inviteDashboard !== false; // default true
          
        default:
          return true; // Default to showing notifications
      }
    } catch (error) {
      console.error("Error checking notification preferences:", error);
      return true; // Default to showing notifications on error
    }
  }
}
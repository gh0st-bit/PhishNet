// Notifications listing page
import AppLayout from "@/components/layout/app-layout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { formatDistanceToNow } from "date-fns";
import { Trash2, Check, RefreshCw, AlertTriangle, Shield, BrainCircuit } from "lucide-react";
import { cn } from "@/lib/utils";

interface Notification {
  id: number;
  type: string;
  title: string;
  message: string;
  isRead: boolean;
  priority: string;
  actionUrl?: string;
  createdAt: string;
  metadata?: Record<string, any>;
}

function getPriorityColor(priority: string) {
  switch (priority) {
    case 'urgent': return 'bg-red-500';
    case 'high': return 'bg-orange-500';
    case 'medium': return 'bg-blue-500';
    case 'low': return 'bg-gray-500';
    default: return 'bg-blue-500';
  }
}

function getTypeIcon(type: string) {
  switch (type) {
    case 'security': return <Shield className="h-4 w-4 text-blue-500" />;
    case 'threat_intel': return <AlertTriangle className="h-4 w-4 text-red-500" />;
    default: return <BrainCircuit className="h-4 w-4 text-muted-foreground" />;
  }
}

export default function NotificationsPage() {
  const queryClient = useQueryClient();
  const limit = 50;

  const { data: notificationData, isLoading, refetch } = useQuery({
    queryKey: ['/api/notifications', limit],
    queryFn: async () => {
      const res = await fetch(`/api/notifications?limit=${limit}`);
      if (!res.ok) throw new Error('Failed to fetch notifications');
      return res.json();
    },
    refetchInterval: 60000,
  });

  const markAllAsReadMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch('/api/notifications/mark-all-read', { method: 'PUT' });
      if (!res.ok) throw new Error('Failed to mark all as read');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/notifications'] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (notificationId: number) => {
      const res = await fetch(`/api/notifications/${notificationId}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed to delete notification');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/notifications'] });
    },
  });

  const notifications: Notification[] = notificationData?.notifications || [];
  const unreadCount = notificationData?.unreadCount || 0;

  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Notifications</h1>
            <p className="text-muted-foreground">Review all recent activity and threat intelligence alerts.</p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isLoading}>
              <RefreshCw className={cn("h-4 w-4", isLoading && "animate-spin")} />
            </Button>
            {unreadCount > 0 && (
              <Button size="sm" onClick={() => markAllAsReadMutation.mutate()} disabled={markAllAsReadMutation.isPending}>
                <Check className="h-4 w-4 mr-2" /> Mark All Read
              </Button>
            )}
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Recent Notifications ({notifications.length})</CardTitle>
          </CardHeader>
          <CardContent>
            {notifications.length === 0 ? (
              <p className="text-center text-muted-foreground py-12">No notifications available.</p>
            ) : (
              <div className="divide-y">
                {notifications.map(n => (
                  <div key={n.id} className={cn("py-4 px-2 flex gap-3 items-start", !n.isRead && "bg-blue-50 dark:bg-blue-950/20")}>                    
                    <div className="flex-shrink-0 mt-2">
                      <div className={cn("w-2 h-2 rounded-full", getPriorityColor(n.priority))}></div>
                    </div>
                    <button
                      type="button"
                      className="flex-1 text-left"
                      onClick={() => {
                        if (n.actionUrl) {
                          globalThis.location.href = n.actionUrl;
                        }
                      }}
                    >
                      <div className="flex items-center gap-2">
                        <span className="flex items-center justify-center">{getTypeIcon(n.type)}</span>
                        <span className={cn("text-sm font-medium", !n.isRead && "font-semibold")}>{n.title}</span>
                        {!n.isRead && <Badge variant="outline" className="ml-1">New</Badge>}
                      </div>
                      <p className="text-sm text-muted-foreground mt-1 line-clamp-2">{n.message}</p>
                      <p className="text-xs text-muted-foreground mt-2">{formatDistanceToNow(new Date(n.createdAt), { addSuffix: true })}</p>
                      {n.type === 'threat_intel' && n.metadata?.totalIngested && (
                        <p className="text-xs mt-1 text-red-600 dark:text-red-400">Total new threats ingested: {n.metadata.totalIngested}</p>
                      )}
                    </button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => deleteMutation.mutate(n.id)}
                      className="flex-shrink-0"
                      aria-label="Delete notification"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}

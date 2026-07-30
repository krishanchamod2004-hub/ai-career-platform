'use client';

import { Bell, CheckCheck } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { useMarkNotificationRead, useNotifications, useUnreadCount } from '@/hooks/use-account';
import { notificationsApi } from '@/services/account-api';
import { useQueryClient } from '@tanstack/react-query';
import { formatRelativeTime, humanizeEnum } from '@/lib/format';

export default function NotificationsPage() {
  const queryClient = useQueryClient();
  const { data, isLoading } = useNotifications();
  const { data: unread } = useUnreadCount();
  const markRead = useMarkNotificationRead();

  const handleMarkAll = async () => {
    await notificationsApi.markAllRead();
    void queryClient.invalidateQueries({ queryKey: ['notifications'] });
  };

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
            <Bell className="h-6 w-6 text-primary" aria-hidden="true" />
            Notifications
          </h2>
          <p className="text-muted-foreground">
            Job matches, alert digests, and application reminders.
          </p>
        </div>
        <Button variant="outline" onClick={handleMarkAll} disabled={!unread?.unread}>
          <CheckCheck className="mr-1 h-4 w-4" aria-hidden="true" />
          Mark all read
        </Button>
      </header>

      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, index) => (
            <Skeleton key={index} className="h-20" />
          ))}
        </div>
      ) : (data?.items.length ?? 0) === 0 ? (
        <div className="rounded-lg border border-dashed p-10 text-center">
          <p className="font-medium">No notifications yet</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Create a job alert and the worker will notify you when matches are ingested.
          </p>
        </div>
      ) : (
        <ul className="space-y-3">
          {data?.items.map((notification) => (
            <li key={notification.id}>
              <Card className={notification.readAt ? 'glass-card' : 'glass-card border-primary/40'}>
                <CardContent className="flex items-start justify-between gap-4 p-4">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="font-medium">{notification.title}</h3>
                      <Badge variant="outline">{humanizeEnum(notification.type)}</Badge>
                      {notification.readAt ? null : <Badge>New</Badge>}
                    </div>
                    <p className="mt-1 whitespace-pre-line text-sm text-muted-foreground">
                      {notification.body}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {formatRelativeTime(notification.createdAt)}
                    </p>
                  </div>
                  {notification.readAt ? null : (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => markRead.mutate(notification.id)}
                    >
                      Mark read
                    </Button>
                  )}
                </CardContent>
              </Card>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  Bell, BellRing, CheckCircle, AlertCircle, Info, Clock, 
  Gavel, ArrowRightLeft, Shield, FileText, X
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { api } from '@/lib/api';
import { toast } from '@/lib/appToast';

interface Notification {
  id: string;
  type: 'info' | 'success' | 'warning' | 'error';
  title: string;
  message: string;
  timestamp: string;
  read: boolean;
  actionUrl?: string;
  category: 'transaction' | 'dispute' | 'verification' | 'system';
}

const fallbackNotifications: Notification[] = [];

export const NotificationCenter = () => {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState<Notification[]>(fallbackNotifications);
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    if (user && isOpen) {
      api.getNotifications()
        .then((res) => {
          if (res.success && Array.isArray(res.notifications)) {
            setNotifications(res.notifications.map((n: { id: string; type?: string; title?: string; message?: string; createdAt?: string; read?: boolean; category?: string }) => ({
              id: n.id,
              type: (n.type as Notification['type']) ?? 'info',
              title: n.title ?? '',
              message: n.message ?? '',
              timestamp: n.createdAt ?? new Date().toISOString(),
              read: n.read ?? false,
              category: (n.category as Notification['category']) ?? 'system'
            })));
          }
        })
        .catch(() => {
          toast.error('Could not load notifications');
        });
    }
  }, [user?.id, isOpen]);

  const unreadCount = notifications.filter(n => !n.read).length;

  const getNotificationIcon = (type: string, category: string) => {
    if (category === 'transaction') return <ArrowRightLeft className="w-4 h-4" />;
    if (category === 'dispute') return <Gavel className="w-4 h-4" />;
    if (category === 'verification') return <Shield className="w-4 h-4" />;
    if (category === 'system') return <FileText className="w-4 h-4" />;
    
    switch (type) {
      case 'success': return <CheckCircle className="w-4 h-4 text-green-600" />;
      case 'warning': return <AlertCircle className="w-4 h-4 text-orange-600" />;
      case 'error': return <AlertCircle className="w-4 h-4 text-red-600" />;
      default: return <Info className="w-4 h-4 text-blue-600" />;
    }
  };

  const getNotificationColor = (type: string) => {
    switch (type) {
      case 'success': return 'border-l-green-500 bg-green-50';
      case 'warning': return 'border-l-orange-500 bg-orange-50';
      case 'error': return 'border-l-red-500 bg-red-50';
      default: return 'border-l-blue-500 bg-blue-50';
    }
  };

  const markAsRead = (id: string) => {
    api.markNotificationRead(id).catch(() => {});
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n));
  };

  const markAllAsRead = () => {
    notifications.filter(n => !n.read).forEach(n => api.markNotificationRead(n.id).catch(() => {}));
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
  };

  const deleteNotification = (id: string) => {
    setNotifications(notifications.filter(n => n.id !== id));
  };

  const formatTimestamp = (timestamp: string) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffInHours = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60));
    
    if (diffInHours < 1) return 'Just now';
    if (diffInHours < 24) return `${diffInHours}h ago`;
    if (diffInHours < 48) return 'Yesterday';
    return date.toLocaleDateString();
  };

  if (!user) return null;

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="sm" className="relative">
          {unreadCount > 0 ? (
            <BellRing className="h-5 w-5" />
          ) : (
            <Bell className="h-5 w-5" />
          )}
          {unreadCount > 0 && (
            <Badge className="absolute -top-2 -right-2 h-5 w-5 p-0 flex items-center justify-center text-xs bg-red-500 hover:bg-red-600">
              {unreadCount > 9 ? '9+' : unreadCount}
            </Badge>
          )}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md max-h-[80vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Bell className="w-5 h-5" />
              Notifications
            </div>
            {unreadCount > 0 && (
              <Button variant="ghost" size="sm" onClick={markAllAsRead}>
                Mark all read
              </Button>
            )}
          </DialogTitle>
          <DialogDescription>
            Stay updated with your land registry activities
          </DialogDescription>
        </DialogHeader>
        
        <ScrollArea className="max-h-96">
          <div className="space-y-3">
            {notifications.length === 0 ? (
              <div className="text-center py-8">
                <Bell className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                <p className="text-sm text-muted-foreground">No notifications yet</p>
              </div>
            ) : (
              notifications.map((notification) => (
                <div
                  key={notification.id}
                  className={`p-3 rounded-lg border-l-4 ${getNotificationColor(notification.type)} ${
                    !notification.read ? 'bg-opacity-100' : 'bg-opacity-50'
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex items-start gap-3 flex-1">
                      <div className="mt-0.5">
                        {getNotificationIcon(notification.type, notification.category)}
                      </div>
                      <div className="flex-1 space-y-1">
                        <div className="flex items-center gap-2">
                          <h4 className="text-sm font-medium">{notification.title}</h4>
                          {!notification.read && (
                            <div className="w-2 h-2 bg-blue-600 rounded-full"></div>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground">
                          {notification.message}
                        </p>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <Clock className="w-3 h-3" />
                          {formatTimestamp(notification.timestamp)}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      {!notification.read && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => markAsRead(notification.id)}
                          className="h-6 w-6 p-0"
                        >
                          <CheckCircle className="w-3 h-3" />
                        </Button>
                      )}
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => deleteNotification(notification.id)}
                        className="h-6 w-6 p-0"
                      >
                        <X className="w-3 h-3" />
                      </Button>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
};
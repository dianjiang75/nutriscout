"use client";

import { useEffect, useState, useCallback } from "react";
import { Bell, Utensils, RefreshCw, Clock, Mail } from "lucide-react";

interface Notification {
  id: string;
  type: string;
  title: string;
  body: string;
  read: boolean;
  created_at: string;
}

const TYPE_ICONS: Record<string, typeof Utensils> = {
  new_dish_match: Utensils,
  favorite_updated: RefreshCw,
  wait_time_drop: Clock,
  weekly_digest: Mail,
};

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

export function NotificationBell() {
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);

  const fetchNotifications = useCallback(async () => {
    try {
      const res = await fetch("/api/notifications?limit=10");
      if (res.ok) {
        const json = await res.json();
        if (json.success) {
          setNotifications(json.data.notifications);
          setUnreadCount(json.data.unread_count);
        }
      }
    } catch {
      // Silently fail — bell just won't show updates
    }
  }, []);

  // Poll every 60s — initial fetch deferred to first interval tick or bell click
  useEffect(() => {
    let mounted = true;
    const doFetch = async () => {
      if (!mounted) return;
      try {
        const res = await fetch("/api/notifications?limit=10");
        if (res.ok && mounted) {
          const json = await res.json();
          if (json.success) {
            setNotifications(json.data.notifications);
            setUnreadCount(json.data.unread_count);
          }
        }
      } catch {}
    };
    doFetch();
    const interval = setInterval(doFetch, 60000);
    return () => { mounted = false; clearInterval(interval); };
  }, []);

  const markAllRead = async () => {
    try {
      await fetch("/api/notifications", { method: "POST" });
      setUnreadCount(0);
      setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    } catch {}
  };

  return (
    <div className="relative">
      {/* Bell button */}
      <button
        onClick={() => {
          setOpen(!open);
          if (!open) fetchNotifications();
        }}
        className="relative p-2 rounded-lg hover:bg-accent transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center"
        aria-label={`Notifications${unreadCount > 0 ? ` (${unreadCount} unread)` : ""}`}
      >
        <Bell className="w-5 h-5" />
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center px-1">
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown */}
      {open && (
        <>
          {/* Backdrop */}
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />

          {/* Panel */}
          <div className="absolute right-0 top-full mt-2 w-80 max-h-96 overflow-y-auto rounded-xl border border-border/40 bg-background shadow-xl z-50">
            <div className="sticky top-0 bg-background border-b border-border/40 px-4 py-3 flex items-center justify-between">
              <h3 className="text-sm font-semibold">Notifications</h3>
              {unreadCount > 0 && (
                <button
                  onClick={markAllRead}
                  className="text-xs text-primary hover:underline"
                >
                  Mark all read
                </button>
              )}
            </div>

            {notifications.length === 0 ? (
              <div className="px-4 py-8 text-center text-sm text-muted-foreground">
                No notifications yet
              </div>
            ) : (
              <div>
                {notifications.map((n) => {
                  const Icon = TYPE_ICONS[n.type] || Bell;
                  return (
                    <div
                      key={n.id}
                      className={`px-4 py-3 border-b border-border/20 last:border-0 ${
                        !n.read ? "bg-primary/5" : ""
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        <Icon className="w-4 h-4 mt-0.5 text-muted-foreground shrink-0" />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium">{n.title}</p>
                          <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
                            {n.body}
                          </p>
                          <p className="text-[10px] text-muted-foreground/70 mt-1">
                            {timeAgo(n.created_at)}
                          </p>
                        </div>
                        {!n.read && (
                          <div className="w-2 h-2 rounded-full bg-primary shrink-0 mt-1.5" />
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}

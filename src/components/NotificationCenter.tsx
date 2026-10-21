import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Bell, CalendarPlus, CreditCard, Info, Sparkles, ArrowRight } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";

export type NotificationType = "registration" | "payment" | "system";

export interface AppNotification {
  id: string;
  type: NotificationType;
  title: string;
  message?: string;
  time: number; // epoch ms
  read: boolean;
}

interface NotificationContextValue {
  notify: (n: Omit<AppNotification, "id" | "time" | "read">) => void;
  notifications: AppNotification[];
  markAllRead: () => void;
  clearAll: () => void;
  unreadCount: number;
}

const NotificationContext = createContext<NotificationContextValue | undefined>(undefined);

const STORAGE_KEY = "eventra-notifications";
const MAX_NOTIFICATIONS = 20;

const typeIcon = {
  registration: CalendarPlus,
  payment: CreditCard,
  system: Info,
};

const typeTint = {
  registration: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400",
  payment: "bg-blue-500/15 text-blue-600 dark:text-blue-400",
  system: "bg-violet-500/15 text-violet-600 dark:text-violet-400",
};

function timeAgo(ts: number) {
  const s = Math.floor((Date.now() - ts) / 1000);
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

export function NotificationProvider({ children }: { children: React.ReactNode }) {
  const [notifications, setNotifications] = useState<AppNotification[]>(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(notifications.slice(0, MAX_NOTIFICATIONS)));
    } catch {
      /* storage unavailable */
    }
  }, [notifications]);

  const notify = useCallback((n: Omit<AppNotification, "id" | "time" | "read">) => {
    setNotifications((prev) =>
      [
        {
          ...n,
          id: `ntf-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
          time: Date.now(),
          read: false,
        },
        ...prev,
      ].slice(0, MAX_NOTIFICATIONS)
    );
  }, []);

  const markAllRead = useCallback(() => {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
  }, []);

  const clearAll = useCallback(() => setNotifications([]), []);

  const value = useMemo(
    () => ({
      notify,
      notifications,
      markAllRead,
      clearAll,
      unreadCount: notifications.filter((n) => !n.read).length,
    }),
    [notify, notifications, markAllRead, clearAll]
  );

  return <NotificationContext.Provider value={value}>{children}</NotificationContext.Provider>;
}

export function useNotifications() {
  const ctx = useContext(NotificationContext);
  if (!ctx) throw new Error("useNotifications must be used within NotificationProvider");
  return ctx;
}

/** Animated bell + popover panel. Mount inside NotificationProvider. */
export function NotificationBell() {
  const { notifications, markAllRead, clearAll, unreadCount } = useNotifications();
  const [open, setOpen] = useState(false);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          className="relative flex h-9 w-9 items-center justify-center rounded-lg border border-border/60 bg-card text-muted-foreground transition-all hover:bg-accent hover:text-accent-foreground hover:shadow-md active:scale-95"
          aria-label={`Notifications${unreadCount ? ` (${unreadCount} unread)` : ""}`}
        >
          <Bell className="h-4 w-4" />
          {unreadCount > 0 && (
            <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-bold text-destructive-foreground animate-scale-in">
              {unreadCount > 9 ? "9+" : unreadCount}
            </span>
          )}
        </button>
      </PopoverTrigger>

      <PopoverContent align="end" className="w-80 p-0">
        <div className="flex items-center justify-between border-b border-border/60 px-4 py-3">
          <p className="text-sm font-semibold">Notifications</p>
          <div className="flex items-center gap-2 text-xs">
            {notifications.length > 0 && (
              <>
                <button className="text-muted-foreground transition-colors hover:text-foreground" onClick={markAllRead}>
                  Mark all read
                </button>
                <span className="text-border">•</span>
                <button className="text-muted-foreground transition-colors hover:text-foreground" onClick={clearAll}>
                  Clear
                </button>
              </>
            )}
          </div>
        </div>

        {notifications.length === 0 ? (
          <div className="flex flex-col items-center gap-2 px-4 py-10 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted">
              <Sparkles className="h-5 w-5 text-muted-foreground" />
            </div>
            <p className="text-sm font-medium">You're all caught up</p>
            <p className="text-xs text-muted-foreground">Registrations and payments will show up here.</p>
          </div>            ) : (
          <ScrollArea className="h-80">
            <div className="divide-y divide-border/60">
              {notifications.map((n) => {
                const Icon = typeIcon[n.type];
                return (
                  <div
                    key={n.id}
                    className={cn(
                      "flex gap-3 px-4 py-3 transition-colors hover:bg-accent/40",
                      !n.read && "bg-primary/[0.04]"
                    )}
                  >
                    <div className={cn("mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg", typeTint[n.type])}>
                      <Icon className="h-4 w-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{n.title}</p>
                      {n.message && <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">{n.message}</p>}
                      <p className="mt-1 text-[11px] text-muted-foreground/70">{timeAgo(n.time)}</p>
                    </div>
                    {!n.read && <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-primary" />}
                  </div>
                );
              })}
            </div>
          </ScrollArea>
        )}
        <Link
          to="/notifications"
          className="flex items-center justify-center gap-1.5 border-t border-border/60 py-2.5 text-xs font-semibold text-primary transition-colors hover:bg-accent"
          onClick={() => setOpen(false)}
        >
          Open notification center <ArrowRight className="h-3 w-3" />
        </Link>
      </PopoverContent>
    </Popover>
  );
}

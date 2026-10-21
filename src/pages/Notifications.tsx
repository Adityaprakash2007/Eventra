import Layout from "@/components/Layout";
import PageTransition from "@/components/PageTransition";
import { usePageTitle } from "@/hooks/usePageTitle";
import EmptyState from "@/components/EmptyState";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  fetchNotifications, markAllNotificationsRead, markNotificationRead,
  deleteNotification, clearNotifications, type ServerNotification,
} from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Bell, CalendarPlus, CreditCard, Info, Sparkles, Ticket, Clock, Megaphone,
  Users, Trash2, CheckCheck, Loader2,
} from "lucide-react";
import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

const TYPE_META: Record<string, { icon: React.ElementType; tint: string; label: string }> = {
  registration: { icon: CalendarPlus, tint: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400", label: "Registration" },
  ticket: { icon: Ticket, tint: "bg-indigo-500/15 text-indigo-600 dark:text-indigo-400", label: "Ticket" },
  reminder: { icon: Clock, tint: "bg-amber-500/15 text-amber-600 dark:text-amber-400", label: "Reminder" },
  update: { icon: Megaphone, tint: "bg-blue-500/15 text-blue-600 dark:text-blue-400", label: "Event update" },
  waitlist: { icon: Users, tint: "bg-violet-500/15 text-violet-600 dark:text-violet-400", label: "Waitlist" },
  payment: { icon: CreditCard, tint: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400", label: "Payment" },
  system: { icon: Info, tint: "bg-slate-500/15 text-slate-600 dark:text-slate-400", label: "System" },
};

function timeAgo(iso: string) {
  const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  if (s < 604800) return `${Math.floor(s / 86400)}d ago`;
  return new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}

type Filter = "all" | "unread" | "registration" | "ticket" | "reminder" | "update" | "waitlist" | "payment";

export default function Notifications() {
  usePageTitle("Notifications");
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { isLoggedIn } = useAuth();
  const [filter, setFilter] = useState<Filter>("all");

  const { data: items = [], isLoading } = useQuery({
    queryKey: ["notifications"],
    queryFn: () => fetchNotifications(),
    enabled: isLoggedIn,
    refetchInterval: 30_000,
  });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["notifications"] });

  const markAllMut = useMutation({
    mutationFn: markAllNotificationsRead,
    onSuccess: () => { toast.success("All caught up"); invalidate(); },
  });
  const markOneMut = useMutation({
    mutationFn: (id: number) => markNotificationRead(id),
    onSuccess: invalidate,
  });
  const deleteMut = useMutation({
    mutationFn: (id: number) => deleteNotification(id),
    onSuccess: invalidate,
  });
  const clearMut = useMutation({
    mutationFn: clearNotifications,
    onSuccess: () => { toast.success("Notification history cleared"); invalidate(); },
  });

  const filtered = useMemo(() => {
    if (filter === "all") return items;
    if (filter === "unread") return items.filter((n) => !n.read);
    return items.filter((n) => n.type === filter);
  }, [items, filter]);

  const unreadCount = items.filter((n) => !n.read).length;

  if (!isLoggedIn) {
    return (
      <Layout>
        <PageTransition>
          <EmptyState
            icon="search"
            title="Sign in to see your notifications"
            description="Registration confirmations, tickets, reminders and waitlist updates land here."
            actionLabel="Sign in"
            onAction={() => navigate("/login?next=/notifications")}
          />
        </PageTransition>
      </Layout>
    );
  }

  return (
    <Layout>
      <PageTransition>
        <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="flex items-center gap-2.5 text-3xl font-extrabold tracking-tight">
              <Bell className="h-7 w-7 text-primary" /> Notifications
              {unreadCount > 0 && (
                <Badge className="animate-scale-in">{unreadCount} unread</Badge>
              )}
            </h1>
            <p className="mt-1 text-muted-foreground">Registration confirmations, tickets, reminders and updates.</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" className="gap-1.5" disabled={unreadCount === 0 || markAllMut.isPending} onClick={() => markAllMut.mutate()}>
              {markAllMut.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCheck className="h-3.5 w-3.5" />}
              Mark all read
            </Button>
            <Button variant="outline" size="sm" className="gap-1.5 text-destructive hover:text-destructive" disabled={items.length === 0 || clearMut.isPending} onClick={() => clearMut.mutate()}>
              <Trash2 className="h-3.5 w-3.5" /> Clear all
            </Button>
          </div>
        </div>

        <Tabs value={filter} onValueChange={(v) => setFilter(v as Filter)} className="mb-4">
          <TabsList className="flex-wrap">
            <TabsTrigger value="all">All ({items.length})</TabsTrigger>
            <TabsTrigger value="unread">Unread ({unreadCount})</TabsTrigger>
            <TabsTrigger value="registration">Registrations</TabsTrigger>
            <TabsTrigger value="ticket">Tickets</TabsTrigger>
            <TabsTrigger value="reminder">Reminders</TabsTrigger>
            <TabsTrigger value="update">Updates</TabsTrigger>
            <TabsTrigger value="waitlist">Waitlist</TabsTrigger>
          </TabsList>
        </Tabs>

        {isLoading ? (
          <div className="space-y-2">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="h-20 animate-pulse rounded-xl bg-muted/60" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <EmptyState
            icon="search"
            title={filter === "unread" ? "You're all caught up" : "No notifications here yet"}
            description="Register for an event and updates will start appearing in this feed."
            actionLabel="Browse events"
            onAction={() => navigate("/events")}
          />
        ) : (
          <div className="space-y-2">
            {filtered.map((n: ServerNotification) => {
              const meta = TYPE_META[n.type] ?? TYPE_META.system;
              const Icon = meta.icon;
              return (
                <Card
                  key={n.id}
                  className={cn(
                    "group border-border/60 shadow-[var(--shadow-card)] transition-all hover:border-primary/30",
                    !n.read && "border-l-2 border-l-primary bg-primary/[0.03]"
                  )}
                >
                  <CardContent className="flex items-start gap-3.5 p-4">
                    <div className={cn("flex h-9 w-9 shrink-0 items-center justify-center rounded-lg", meta.tint)}>
                      <Icon className="h-4 w-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <p className="truncate text-sm font-semibold">{n.title}</p>
                        {!n.read && <span className="h-2 w-2 shrink-0 rounded-full bg-primary" />}
                      </div>
                      {n.message && <p className="mt-0.5 text-sm text-muted-foreground">{n.message}</p>}
                      <div className="mt-1.5 flex items-center gap-2 text-xs text-muted-foreground">
                        <Badge variant="outline" className="h-5 px-1.5 text-[10px] uppercase tracking-wide">{meta.label}</Badge>
                        <span>{n.time ? timeAgo(n.time) : ""}</span>
                      </div>
                    </div>
                    <div className="flex shrink-0 items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                      {!n.read && (
                        <Button size="sm" variant="ghost" className="h-8 w-8 p-0" title="Mark read" onClick={() => markOneMut.mutate(n.id)}>
                          <CheckCheck className="h-4 w-4" />
                        </Button>
                      )}
                      <Button size="sm" variant="ghost" className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive" title="Delete" onClick={() => deleteMut.mutate(n.id)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}

        {items.length === 0 && !isLoading && (
          <p className="mt-6 flex items-center justify-center gap-1.5 text-xs text-muted-foreground">
            <Sparkles className="h-3.5 w-3.5" /> In-app notifications are synced with your account across devices.
          </p>
        )}
      </PageTransition>
    </Layout>
  );
}

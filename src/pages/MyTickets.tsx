import Layout from "@/components/Layout";
import PageTransition from "@/components/PageTransition";
import { usePageTitle } from "@/hooks/usePageTitle";
import EmptyState from "@/components/EmptyState";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  fetchMyTickets, fetchTicketQr, fetchPayments, fetchMyWaitlist,
  cancelRegistration, leaveWaitlist, type TicketShape, type Payment, type WaitlistEntry,
} from "@/lib/api";
import { downloadTicketPdf } from "@/lib/tickets";
import { useAuth } from "@/contexts/AuthContext";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Ticket, QrCode, Download, Search, CalendarDays, MapPin, Loader2, ArrowUpDown,
  Wallet, History, Hourglass, XCircle, Mail, Printer, PartyPopper, Clock,
} from "lucide-react";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

function TicketCard({ ticket, onShowQr, onCancel }: {
  ticket: TicketShape;
  onShowQr: (t: TicketShape) => void;
  onCancel?: (t: TicketShape) => void;
}) {
  const [downloading, setDownloading] = useState(false);
  const navigate = useNavigate();

  const download = async () => {
    setDownloading(true);
    try {
      await downloadTicketPdf(ticket);
      toast.success("Ticket PDF downloaded");
    } catch {
      toast.error("Could not generate the PDF");
    } finally {
      setDownloading(false);
    }
  };

  const checkedIn = !!ticket.checkedInAt;

  return (
    <Card className="overflow-hidden border-border/60 shadow-[var(--shadow-card)] transition-all hover:shadow-elegant">
      <div className="flex flex-col sm:flex-row">
        <div className="relative flex shrink-0 items-center justify-center bg-gradient-primary p-6 sm:w-40">
          <div className="text-center text-primary-foreground">
            <Ticket className="mx-auto h-8 w-8 opacity-80" />
            <p className="mt-2 text-2xl font-extrabold tracking-tight">
              {ticket.ticketType === "VIP" ? "VIP" : "REG"}
            </p>
            <p className="text-[10px] uppercase tracking-widest opacity-80">{ticket.status}</p>
          </div>
          <div className="pointer-events-none absolute right-0 top-0 h-full w-px bg-border sm:bg-transparent" />
        </div>

        <CardContent className="flex-1 p-5">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <h3 className="text-base font-bold">{ticket.event?.title ?? "Event"}</h3>
              <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
                <span className="flex items-center gap-1">
                  <CalendarDays className="h-3.5 w-3.5" />
                  {ticket.event?.startDate ? new Date(ticket.event.startDate).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }) : "—"}
                </span>
                {ticket.event?.venue && (
                  <span className="flex items-center gap-1 truncate">
                    <MapPin className="h-3.5 w-3.5 shrink-0" />
                    {ticket.event.venue}
                  </span>
                )}
              </div>
            </div>
            {checkedIn ? (
              <Badge className="border-0 bg-emerald-500/15 text-emerald-600 dark:text-emerald-400" variant="outline">✓ Checked in</Badge>
            ) : ticket.status === "Confirmed" ? (
              <Badge className="border-0 bg-emerald-500/15 text-emerald-600 dark:text-emerald-400" variant="outline">Confirmed</Badge>
            ) : (
              <Badge variant="outline" className="border-amber-500/40 bg-amber-500/10 text-amber-600 dark:text-amber-400">{ticket.status}</Badge>
            )}
          </div>

          <Separator className="my-4" />

          <div className="flex flex-wrap items-center justify-between gap-3">
            <code className="rounded-md bg-muted px-2.5 py-1 font-mono text-[11px] font-semibold tracking-wide">
              {ticket.ticketCode || "—"}
            </code>
            <div className="flex flex-wrap gap-2">
              <Button size="sm" variant="outline" onClick={() => onShowQr(ticket)} className="gap-1.5">
                <QrCode className="h-3.5 w-3.5" /> View QR
              </Button>
              <Button size="sm" variant="outline" onClick={download} disabled={downloading} className="gap-1.5">
                {downloading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />} PDF
              </Button>
              {checkedIn ? null : (
                <Button size="sm" variant="ghost" onClick={() => window.print()} className="gap-1.5">
                  <Printer className="h-3.5 w-3.5" /> Print
                </Button>
              )}
              {onCancel && (
                <Button size="sm" variant="ghost" className="gap-1.5 text-destructive hover:text-destructive" onClick={() => onCancel(ticket)}>
                  <XCircle className="h-3.5 w-3.5" /> Cancel
                </Button>
              )}
            </div>
          </div>
        </CardContent>
      </div>
    </Card>
  );
}

function QrDialog({ ticket, onClose }: { ticket: TicketShape | null; onClose: () => void }) {
  const { data } = useQuery({
    queryKey: ["ticketQr", ticket?.registrationId],
    queryFn: () => fetchTicketQr(ticket!.registrationId),
    enabled: !!ticket,
  });

  return (
    <Dialog open={!!ticket} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-sm">
        {ticket && (
          <>
            <DialogHeader>
              <DialogTitle>{ticket.event?.title}</DialogTitle>
              <DialogDescription>Show this QR code at the entrance — screenshots are accepted.</DialogDescription>
            </DialogHeader>
            <div className="flex flex-col items-center gap-4 py-2">
              {data?.qr ? (
                <img src={data.qr} alt="Ticket QR code" className="h-56 w-56 rounded-xl border border-border bg-white p-2" />
              ) : (
                <div className="flex h-56 w-56 items-center justify-center rounded-xl border border-dashed border-border">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              )}
              <code className="rounded-md bg-muted px-3 py-1.5 font-mono text-xs font-bold tracking-wider">{ticket.ticketCode}</code>
              <div className="grid w-full grid-cols-2 gap-2 text-xs">
                <div className="rounded-lg bg-accent/40 p-2.5">
                  <p className="text-muted-foreground">Attendee</p>
                  <p className="truncate font-semibold">{ticket.user?.name}</p>
                </div>
                <div className="rounded-lg bg-accent/40 p-2.5">
                  <p className="text-muted-foreground">Type</p>
                  <p className="font-semibold">{ticket.ticketType}</p>
                </div>
              </div>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

export default function MyTickets() {
  usePageTitle("My Tickets");
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { user, isLoggedIn } = useAuth();

  const { data, isLoading } = useQuery({
    queryKey: ["myTickets"],
    queryFn: fetchMyTickets,
    enabled: isLoggedIn,
  });

  const { data: payments = [] } = useQuery({
    queryKey: ["payments"],
    queryFn: fetchPayments,
    enabled: isLoggedIn,
  });

  const { data: waitlist = [] } = useQuery({
    queryKey: ["myWaitlist"],
    queryFn: fetchMyWaitlist,
    enabled: isLoggedIn,
  });

  const [qrTicket, setQrTicket] = useState<TicketShape | null>(null);
  const [query, setQuery] = useState("");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const [tab, setTab] = useState("upcoming");

  const cancelMut = useMutation({
    mutationFn: (t: TicketShape) => cancelRegistration(t.registrationId),
    onSuccess: () => {
      toast.success("Registration cancelled — the seat has been released.");
      void qc.invalidateQueries({ queryKey: ["myTickets"] });
      void qc.invalidateQueries({ queryKey: ["events"] });
    },
    onError: (e: unknown) => toast.error(e instanceof Error ? e.message : "Cancellation failed"),
  });

  const leaveWlMut = useMutation({
    mutationFn: (id: number) => leaveWaitlist(id),
    onSuccess: () => {
      toast.success("Removed from waitlist");
      void qc.invalidateQueries({ queryKey: ["myWaitlist"] });
    },
  });

  const confirmCancel = (t: TicketShape) => {
    if (window.confirm(`Cancel your registration for "${t.event?.title}"? This frees the seat for others.`)) {
      cancelMut.mutate(t);
    }
  };

  const filterTickets = (list: TicketShape[]) => {
    const q = query.trim().toLowerCase();
    const sorted = [...list].sort((a, b) => {
      const da = a.event?.startDate ?? "";
      const db = b.event?.startDate ?? "";
      return sortDir === "asc" ? da.localeCompare(db) : db.localeCompare(da);
    });
    if (!q) return sorted;
    return sorted.filter(
      (t) =>
        (t.event?.title ?? "").toLowerCase().includes(q) ||
        (t.event?.venue ?? "").toLowerCase().includes(q) ||
        (t.ticketCode ?? "").toLowerCase().includes(q)
    );
  };

  if (!isLoggedIn) {
    return (
      <Layout>
        <PageTransition>
          <EmptyState
            icon="ticket"
            title="Sign in to see your tickets"
            description="Your tickets, payment history and waitlist live here once you're signed in."
            actionLabel="Sign in"
            onAction={() => navigate("/login?next=/tickets")}
          />
        </PageTransition>
      </Layout>
    );
  }

  const upcoming = filterTickets(data?.upcoming ?? []);
  const past = filterTickets(data?.past ?? []);
  const activeWaitlist = waitlist.filter((w) => w.status === "waiting");
  const totalPaid = payments.filter((p) => p.status === "Paid").reduce((s, p) => s + Number(p.amount), 0);

  return (
    <Layout>
      <PageTransition>
        <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-3xl font-extrabold tracking-tight">
              My <span className="gradient-text">Tickets</span>
            </h1>
            <p className="mt-1 text-muted-foreground">Your registrations, QR tickets and payment history.</p>
          </div>
          <Badge variant="secondary" className="gap-1.5 text-xs">
            <Wallet className="h-3.5 w-3.5" /> ₹{totalPaid.toLocaleString("en-IN")} paid
          </Badge>
        </div>

        {/* Waitlist strip */}
        {activeWaitlist.length > 0 && (
          <Card className="mb-6 border-amber-500/30 bg-amber-500/[0.06]">
            <CardContent className="flex flex-wrap items-center gap-3 p-4">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-amber-500/15">
                <Hourglass className="h-4 w-4 text-amber-600 dark:text-amber-400" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold">On {activeWaitlist.length} waitlist{activeWaitlist.length > 1 ? "s" : ""}</p>
                <p className="truncate text-xs text-muted-foreground">
                  {activeWaitlist.map((w) => `${w.event?.title ?? "Event"} (#${w.position ?? "?"})`).join(" · ")}
                </p>
              </div>
              {activeWaitlist.slice(0, 2).map((w) => (
                <Button key={w.id} size="sm" variant="outline" onClick={() => leaveWlMut.mutate(w.id)}>
                  Leave
                </Button>
              ))}
            </CardContent>
          </Card>
        )}

        {/* Search + sort */}
        <div className="mb-5 flex flex-wrap items-center gap-3">
          <div className="relative w-full max-w-xs">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search tickets, events, codes…" className="pl-9" />
          </div>
          <Button variant="outline" size="sm" onClick={() => setSortDir((d) => (d === "asc" ? "desc" : "asc"))} className="gap-1.5">
            <ArrowUpDown className="h-3.5 w-3.5" />
            {sortDir === "asc" ? "Soonest first" : "Latest first"}
          </Button>
        </div>

        <Tabs value={tab} onValueChange={setTab}>
          <TabsList className="mb-4">
            <TabsTrigger value="upcoming" className="gap-2">
              Upcoming
              <Badge variant="secondary" className="ml-1 h-5 min-w-5 rounded-full px-1.5 text-[10px] font-bold">{upcoming.length}</Badge>
            </TabsTrigger>
            <TabsTrigger value="past" className="gap-2">
              Past
              <Badge variant="secondary" className="ml-1 h-5 min-w-5 rounded-full px-1.5 text-[10px] font-bold">{past.length}</Badge>
            </TabsTrigger>
            <TabsTrigger value="payments" className="gap-2">
              <History className="h-3.5 w-3.5" /> Payments
            </TabsTrigger>
          </TabsList>

          <TabsContent value="upcoming" className="space-y-4">
            {isLoading ? (
              <div className="space-y-3">
                {[0, 1].map((i) => <div key={i} className="h-36 animate-pulse rounded-xl bg-muted/60" />)}
              </div>
            ) : upcoming.length === 0 ? (
              <EmptyState
                icon="ticket"
                title="No upcoming tickets"
                description="Register for an event and your QR ticket will appear here."
                actionLabel="Browse events"
                onAction={() => navigate("/events")}
              />
            ) : (
              upcoming.map((t) => <TicketCard key={t.registrationId} ticket={t} onShowQr={setQrTicket} onCancel={confirmCancel} />)
            )}
          </TabsContent>

          <TabsContent value="past" className="space-y-4">
            {past.length === 0 ? (
              <EmptyState icon="calendar" title="No past events yet" description="Tickets from events you attended will be archived here." />
            ) : (
              past.map((t) => <TicketCard key={t.registrationId} ticket={t} onShowQr={setQrTicket} />)
            )}
          </TabsContent>

          <TabsContent value="payments">
            <Card className="border-border/60 shadow-[var(--shadow-card)]">
              <CardContent className="p-0">
                {payments.length === 0 ? (
                  <div className="flex flex-col items-center gap-2 px-4 py-12 text-center">
                    <Wallet className="h-8 w-8 text-muted-foreground" />
                    <p className="text-sm font-medium">No payments yet</p>
                  </div>
                ) : (
                  <div className="divide-y divide-border/60">
                    {payments.map((p: Payment) => (
                      <div key={p.id} className="flex items-center justify-between gap-3 px-5 py-3.5">
                        <div className="flex items-center gap-3">
                          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-500/10">
                            <Wallet className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                          </div>
                          <div>
                            <p className="text-sm font-semibold">₹{Number(p.amount).toLocaleString("en-IN")}</p>
                            <p className="text-xs text-muted-foreground">via {p.method}</p>
                          </div>
                        </div>
                        <Badge variant={p.status === "Paid" ? "secondary" : "outline"} className={cn(
                          p.status === "Paid" ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400" : "border-amber-500/40 bg-amber-500/10 text-amber-600 dark:text-amber-400"
                        )}>
                          {p.status}
                        </Badge>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        <QrDialog ticket={qrTicket} onClose={() => setQrTicket(null)} />
      </PageTransition>
    </Layout>
  );
}

import Layout from "@/components/Layout";
import PageTransition from "@/components/PageTransition";
import { usePageTitle } from "@/hooks/usePageTitle";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { fetchEvents, checkinTicket, fetchAttendanceStats } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import { useQrScanner } from "@/hooks/useQrScanner";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  QrCode, ScanLine, Loader2, CheckCircle2, XCircle, AlertTriangle,
  Users, UserCheck, ClipboardCheck, Keyboard, RefreshCw,
} from "lucide-react";
import { useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

type ScanOutcome = {
  kind: "success" | "duplicate" | "invalid" | "error";
  message: string;
  attendee?: string;
  detail?: string;
};

export default function Scanner() {
  usePageTitle("Ticket Scanner");
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { user, isLoggedIn, isAdmin } = useAuth();

  const { data: events = [] } = useQuery({
    queryKey: ["events"],
    queryFn: () => fetchEvents(),
    enabled: isLoggedIn,
  });

  const [eventId, setEventId] = useState<string>("");
  const [manualCode, setManualCode] = useState("");
  const [outcome, setOutcome] = useState<ScanOutcome | null>(null);
  const [busy, setBusy] = useState(false);
  const [cameraOn, setCameraOn] = useState(false);
  const lastCode = useRef<string | null>(null);

  const selectedEvent = events.find((e) => String(e.id) === eventId);
  const isOrganizer = isAdmin || (selectedEvent && user && selectedEvent.organizerId === user.id);

  const { data: stats, refetch: refetchStats } = useQuery({
    queryKey: ["attendanceStats", eventId],
    queryFn: () => fetchAttendanceStats(eventId!),
    enabled: !!eventId,
  });

  const doCheckin = async (raw: string) => {
    const code = raw.trim().toUpperCase();
    if (!code || busy) return;
    if (code === lastCode.current) return; // debounce the same frame
    lastCode.current = code;
    setBusy(true);
    try {
      const result = await checkinTicket(code);
      if (result.valid && !result.duplicate) {
        setOutcome({
          kind: "success",
          message: "Entry granted 🎉",
          attendee: result.attendee?.name,
          detail: `${result.attendee?.ticketType ?? "Regular"} ticket · ${new Date(result.checkedInAt!).toLocaleTimeString("en-IN")}`,
        });
        toast.success(`${result.attendee?.name} checked in`);
      } else if (result.duplicate) {
        setOutcome({
          kind: "duplicate",
          message: "Already checked in",
          attendee: result.attendee?.name,
          detail: result.error,
        });
        toast.warning("Duplicate entry blocked");
      } else {
        setOutcome({ kind: "invalid", message: "Ticket not valid", detail: result.error });
        toast.error(result.error || "Invalid ticket");
      }
      void refetchStats();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Check-in failed";
      setOutcome({ kind: /recogn/i.test(msg) ? "invalid" : "error", message: "Check-in failed", detail: msg });
      toast.error(msg);
    } finally {
      setBusy(false);
      setTimeout(() => {
        lastCode.current = null; // allow rescanning after the cooldown
      }, 2500);
    }
  };

  const { error: camError, scanning } = useQrScanner({
    enabled: cameraOn && !!eventId,
    onResult: (text) => void doCheckin(text),
  });

  return (
    <Layout>
      <PageTransition>
        <div className="mx-auto max-w-3xl">
          <div className="mb-6">
            <h1 className="text-3xl font-extrabold tracking-tight">
              Ticket <span className="gradient-text">Scanner</span>
            </h1>
            <p className="mt-1 text-muted-foreground">Scan attendee QR codes at the gate — duplicate entries are blocked automatically.</p>
          </div>

          {/* Event picker */}
          <Card className="mb-5 border-border/60 shadow-[var(--shadow-card)]">
            <CardContent className="p-5">
              <Label className="mb-1.5 block text-sm">Scanning for event</Label>
              <Select value={eventId} onValueChange={(v) => { setEventId(v); setOutcome(null); }}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Choose your event…" />
                </SelectTrigger>
                <SelectContent className="max-h-72">
                  {events.map((e) => (
                    <SelectItem key={e.id} value={String(e.id)}>
                      {e.title} — {new Date(e.date).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {!eventId && (
                <p className="mt-2 text-xs text-muted-foreground">
                  Select the event you're gatekeeping. Only the event's organizer or an admin can check people in.
                </p>
              )}
            </CardContent>
          </Card>

          {eventId && (
            <div className="grid gap-5 md:grid-cols-[1fr_280px]">
              {/* Scanner panel */}
              <div className="space-y-5">
                <Card className="overflow-hidden border-border/60 shadow-elegant">
                  <div className="relative bg-slate-950">
                    {/* Camera viewport */}
                    <div className="relative mx-auto aspect-square w-full max-w-sm overflow-hidden">
                      <div
                        className={cn(
                          "absolute inset-4 rounded-2xl border-2 transition-colors",
                          outcome?.kind === "success" ? "border-emerald-400" : outcome?.kind === "invalid" || outcome?.kind === "error" ? "border-red-400" : "border-white/30"
                        )}
                      />
                      {/* scan line sweep */}
                      {cameraOn && !outcome && (
                        <div className="pointer-events-none absolute inset-4 overflow-hidden rounded-2xl">
                          <div className="scan-line absolute left-2 right-2 h-0.5 bg-emerald-400/90 shadow-[0_0_12px_rgba(52,211,153,0.8)]" />
                        </div>
                      )}
                      <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 p-6 text-center">
                        {!cameraOn ? (
                          <>
                            <QrCode className="h-12 w-12 text-white/40" />
                            <p className="text-sm text-white/70">Camera is off. Start scanning to read attendee QR codes.</p>
                            <Button onClick={() => setCameraOn(true)} className="gap-2">
                              <ScanLine className="h-4 w-4" /> Start camera
                            </Button>
                          </>
                        ) : (
                          <>
                            <ScanLine className={cn("h-10 w-10", scanning ? "text-emerald-400" : "text-white/40")} />
                            <p className="text-sm text-white/70">{scanning ? "Point the camera at a ticket QR code…" : "Starting camera…"}</p>
                            <Button variant="outline" size="sm" onClick={() => setCameraOn(false)} className="gap-1.5 border-white/20 bg-white/10 text-white hover:bg-white/20">
                              Stop camera
                            </Button>
                          </>
                        )}
                      </div>
                    </div>

                    {camError && (
                      <div className="border-t border-amber-500/30 bg-amber-500/10 px-4 py-3 text-center">
                        <p className="flex items-center justify-center gap-2 text-xs font-medium text-amber-600 dark:text-amber-400">
                          <AlertTriangle className="h-3.5 w-3.5" /> {camError}
                        </p>
                      </div>
                    )}
                  </div>

                  {/* Outcome banner */}
                  {outcome && (
                    <div
                      className={cn(
                        "flex items-start gap-3 border-t px-5 py-4",
                        outcome.kind === "success" && "border-emerald-500/30 bg-emerald-500/10",
                        outcome.kind === "duplicate" && "border-amber-500/30 bg-amber-500/10",
                        (outcome.kind === "invalid" || outcome.kind === "error") && "border-red-500/30 bg-red-500/10"
                      )}
                    >
                      {outcome.kind === "success" ? (
                        <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600 dark:text-emerald-400" />
                      ) : outcome.kind === "duplicate" ? (
                        <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-600 dark:text-amber-400" />
                      ) : (
                        <XCircle className="mt-0.5 h-5 w-5 shrink-0 text-destructive" />
                      )}
                      <div className="min-w-0">
                        <p className="text-sm font-bold">{outcome.message}</p>
                        {outcome.attendee && <p className="text-sm font-medium">{outcome.attendee}</p>}
                        {outcome.detail && <p className="text-xs text-muted-foreground">{outcome.detail}</p>}
                      </div>
                    </div>
                  )}
                </Card>

                {/* Manual fallback */}
                <Card className="border-border/60 shadow-[var(--shadow-card)]">
                  <CardContent className="p-5">
                    <p className="mb-3 flex items-center gap-2 text-sm font-semibold">
                      <Keyboard className="h-4 w-4 text-primary" /> Manual entry
                    </p>
                    <form
                      onSubmit={(e) => {
                        e.preventDefault();
                        void doCheckin(manualCode);
                        setManualCode("");
                      }}
                      className="flex gap-2"
                    >
                      <Input
                        value={manualCode}
                        onChange={(e) => setManualCode(e.target.value)}
                        placeholder="EVTR-XXXXXXXXXXXX-XX"
                        className="font-mono text-xs uppercase"
                      />
                      <Button type="submit" disabled={busy || !manualCode.trim()} className="gap-1.5">
                        {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                        Verify
                      </Button>
                    </form>
                    <p className="mt-2 text-xs text-muted-foreground">
                      Use when a phone screen can't be scanned — type the code under the QR.
                    </p>
                  </CardContent>
                </Card>
              </div>

              {/* Live attendance stats */}
              <div className="space-y-5">
                <Card className="border-border/60 shadow-elegant">
                  <CardContent className="space-y-4 p-5">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-semibold">Live attendance</p>
                      <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => void refetchStats()} aria-label="Refresh stats">
                        <RefreshCw className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                    {stats ? (
                      <>
                        <div className="grid grid-cols-2 gap-3">
                          <div className="rounded-xl bg-emerald-500/10 p-3 text-center">
                            <UserCheck className="mx-auto h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                            <p className="mt-1 text-2xl font-extrabold">{stats.checkedIn}</p>
                            <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Checked in</p>
                          </div>
                          <div className="rounded-xl bg-muted p-3 text-center">
                            <Users className="mx-auto h-4 w-4 text-muted-foreground" />
                            <p className="mt-1 text-2xl font-extrabold">{stats.totalConfirmed}</p>
                            <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Confirmed</p>
                          </div>
                        </div>
                        <div>
                          <div className="mb-1.5 flex items-center justify-between text-xs">
                            <span className="text-muted-foreground">Attendance rate</span>
                            <span className="font-bold">{stats.attendanceRate}%</span>
                          </div>
                          <div className="h-2 overflow-hidden rounded-full bg-muted">
                            <div className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-teal-400 transition-all" style={{ width: `${stats.attendanceRate}%` }} />
                          </div>
                        </div>
                        <div className="flex items-center justify-between rounded-xl bg-accent/40 px-3 py-2 text-xs">
                          <span className="text-muted-foreground">Pending at gate</span>
                          <span className="font-bold">{stats.pending}</span>
                        </div>
                        <div className="flex items-center justify-between rounded-xl bg-accent/40 px-3 py-2 text-xs">
                          <span className="text-muted-foreground">VIP tickets</span>
                          <span className="font-bold">{stats.vipTickets}</span>
                        </div>
                      </>
                    ) : (
                      <div className="flex justify-center py-6">
                        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                      </div>
                    )}
                  </CardContent>
                </Card>

                <Card className="border-border/60 shadow-[var(--shadow-card)]">
                  <CardContent className="p-5 text-xs leading-relaxed text-muted-foreground">
                    <p className="mb-1.5 flex items-center gap-1.5 font-semibold text-foreground">
                      <ClipboardCheck className="h-3.5 w-3.5 text-primary" /> How it works
                    </p>
                    Each ticket carries a unique <code className="rounded bg-muted px-1 font-mono">EVTR-…</code> code.
                    First scan marks the attendee present; any re-scan is rejected as a duplicate. Attendance stats
                    update instantly and are also visible in the <button className="font-medium text-primary underline-offset-2 hover:underline" onClick={() => navigate("/organizer")}>organizer dashboard</button>.
                  </CardContent>
                </Card>
              </div>
            </div>
          )}
        </div>
      </PageTransition>
    </Layout>
  );
}

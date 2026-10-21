import Layout from "@/components/Layout";
import PageTransition from "@/components/PageTransition";
import { usePageTitle } from "@/hooks/usePageTitle";
import { TableSkeleton } from "@/components/Skeletons";
import EmptyState from "@/components/EmptyState";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  fetchEvents, fetchUsers, fetchRegistrations, fetchPayments,
  createEvent, updateEvent, deleteEvent, type Event,
} from "@/lib/api";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Pencil, Plus, Trash2, Download, Search, X } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { fetchStates, fetchCities } from "@/lib/location";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

/* ── helpers ─────────────────────────────────────────────── */

const errMsg = (e: unknown) => (e instanceof Error ? e.message : "Something went wrong");

function downloadCsv(filename: string, rows: (string | number)[][]) {
  const csv = rows
    .map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(","))
    .join("\n");
  const blob = new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
  toast.success(`${filename} downloaded`);
}

function SearchBox({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder: string }) {
  return (
    <div className="relative w-full max-w-xs">
      <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="h-9 w-full rounded-lg border border-input bg-card pl-9 pr-8 text-sm outline-none transition-all placeholder:text-muted-foreground focus:border-primary focus:ring-2 focus:ring-primary/20"
      />
      {value && (
        <button onClick={() => onChange("")} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground" aria-label="Clear">
          <X className="h-3.5 w-3.5" />
        </button>
      )}
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    Paid: "border-emerald-500/40 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
    Completed: "border-emerald-500/40 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
    Confirmed: "border-emerald-500/40 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
    Pending: "border-amber-500/40 bg-amber-500/10 text-amber-600 dark:text-amber-400",
  };
  return (
    <Badge variant="outline" className={cn("font-medium", map[status] ?? "border-border text-muted-foreground")}>
      {status}
    </Badge>
  );
}

/* ── page ────────────────────────────────────────────────── */

export default function Admin() {
  usePageTitle("Admin");
  const qc = useQueryClient();
  const { data: events = [], isLoading: eventsLoading } = useQuery({ queryKey: ["events"], queryFn: () => fetchEvents() });
  const { data: users = [], isLoading: usersLoading } = useQuery({ queryKey: ["users"], queryFn: fetchUsers });
  const { data: registrations = [], isLoading: regsLoading } = useQuery({ queryKey: ["registrations"], queryFn: fetchRegistrations });
  const { data: payments = [], isLoading: paysLoading } = useQuery({ queryKey: ["payments"], queryFn: fetchPayments });

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Event | null>(null);
  const [form, setForm] = useState<Omit<Event, "id">>({ title: "", venue: "", date: "", seats: 100, price: 0, state: "", city: "" });

  // Location dropdown data for the event form (cached API + local fallback)
  const { data: states = [] } = useQuery({ queryKey: ["states"], queryFn: fetchStates, staleTime: Infinity });
  const { data: cities = [] } = useQuery({
    queryKey: ["cities", form.state],
    queryFn: () => fetchCities(form.state),
    enabled: open && !!form.state,
    staleTime: Infinity,
  });

  // per-table search
  const [userQuery, setUserQuery] = useState("");
  const [eventQuery, setEventQuery] = useState("");
  const [regQuery, setRegQuery] = useState("");
  const [payQuery, setPayQuery] = useState("");

  // bulk selection (events tab)
  const [selectedIds, setSelectedIds] = useState<number[]>([]);

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["events"] });
    qc.invalidateQueries({ queryKey: ["stats"] });
  };

  const addMut = useMutation({ mutationFn: (d: Omit<Event, "id">) => createEvent(d), onSuccess: () => { invalidate(); toast.success("Event added"); setOpen(false); }, onError: (e: unknown) => toast.error(errMsg(e)) });
  const updMut = useMutation({ mutationFn: ({ id, ...d }: Event) => updateEvent(id, d), onSuccess: () => { invalidate(); toast.success("Event updated"); setOpen(false); }, onError: (e: unknown) => toast.error(errMsg(e)) });
  const delMut = useMutation({ mutationFn: (id: number) => deleteEvent(id), onSuccess: () => { invalidate(); toast.success("Event deleted"); }, onError: (e: unknown) => toast.error(errMsg(e)) });
  const delManyMut = useMutation({
    mutationFn: async (ids: number[]) => { await Promise.all(ids.map((id) => deleteEvent(id))); },
    onSuccess: () => { invalidate(); setSelectedIds([]); toast.success("Selected events deleted"); },
    onError: (e: unknown) => toast.error(errMsg(e)),
  });

  const openNew = () => { setEditing(null); setForm({ title: "", venue: "", date: "", seats: 100, price: 0, state: "", city: "" }); setOpen(true); };
  const openEdit = (e: Event) => { setEditing(e); setForm({ title: e.title, venue: e.venue, date: e.date, seats: e.seats, price: e.price, state: e.state ?? "", city: e.city ?? "" }); setOpen(true); };

  const save = () => {
    if (!form.title.trim() || !form.venue.trim() || !form.date) { toast.error("Fill all fields"); return; }
    if (editing) { updMut.mutate({ id: editing.id, ...form }); } else { addMut.mutate(form); }
  };

  /* filtered lists */
  const q = (s: string) => s.trim().toLowerCase();
  const filteredUsers = users.filter((u) => !userQuery || u.name.toLowerCase().includes(q(userQuery)) || u.email.toLowerCase().includes(q(userQuery)));
  const filteredEvents = events.filter((e) => !eventQuery || e.title.toLowerCase().includes(q(eventQuery)) || e.venue.toLowerCase().includes(q(eventQuery)));
  const filteredRegs = registrations.filter((r) => !regQuery || r.user.toLowerCase().includes(q(regQuery)) || (r.event?.title ?? "").toLowerCase().includes(q(regQuery)));
  const filteredPays = payments.filter((p) => !payQuery || p.user.toLowerCase().includes(q(payQuery)) || p.status.toLowerCase().includes(q(payQuery)));

  const tabTrigger = (value: string, label: string, count: number | string) => (
    <TabsTrigger value={value} className="gap-2">
      {label}
      <Badge variant="secondary" className="ml-1 h-5 min-w-5 rounded-full px-1.5 text-[10px] font-bold">
        {count}
      </Badge>
    </TabsTrigger>
  );

  return (
    <Layout>
      <PageTransition>
        <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-3xl font-extrabold tracking-tight">
              Admin <span className="gradient-text">Panel</span>
            </h1>
            <p className="mt-1 text-muted-foreground">Manage users, events, registrations, and payments.</p>
          </div>
        </div>

        <Tabs defaultValue="events">
          <TabsList className="mb-4">
            {tabTrigger("events", "Events", events.length)}
            {tabTrigger("users", "Users", users.length)}
            {tabTrigger("registrations", "Registrations", registrations.length)}
            {tabTrigger("payments", "Payments", payments.length)}
          </TabsList>

          {/* ── Events ─────────────────────────────────────── */}
          <TabsContent value="events">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
              <SearchBox value={eventQuery} onChange={setEventQuery} placeholder="Search events…" />
              <div className="flex items-center gap-2">
                {selectedIds.length > 0 && (
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={() => delManyMut.mutate(selectedIds)}
                    disabled={delManyMut.isPending}
                  >
                    <Trash2 className="mr-1.5 h-3.5 w-3.5" />
                    Delete ({selectedIds.length})
                  </Button>
                )}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    downloadCsv("events.csv", [
                      ["ID", "Title", "Venue", "Date", "Seats", "Price"],
                      ...filteredEvents.map((e) => [e.id, e.title, e.venue, e.date, e.seats, e.price]),
                    ])
                  }
                >
                  <Download className="mr-1.5 h-3.5 w-3.5" /> Export CSV
                </Button>
                <Button size="sm" onClick={openNew}>
                  <Plus className="mr-1.5 h-3.5 w-3.5" /> Add Event
                </Button>
              </div>
            </div>
            <Card className="border-border/60 shadow-[var(--shadow-card)]">
              <CardContent className="p-0">
                {eventsLoading ? (
                  <TableSkeleton rows={5} />
                ) : filteredEvents.length === 0 ? (
                  <EmptyState icon={events.length ? "search" : "calendar"} title={events.length ? "No events match your search" : "No events yet"} />
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-10">
                          <Checkbox
                            checked={filteredEvents.length > 0 && selectedIds.length === filteredEvents.length}
                            onCheckedChange={(checked) =>
                              setSelectedIds(checked ? filteredEvents.map((e) => e.id) : [])
                            }
                            aria-label="Select all events"
                          />
                        </TableHead>
                        <TableHead>Title</TableHead>
                        <TableHead>Venue</TableHead>
                        <TableHead>Date</TableHead>
                        <TableHead>Seats</TableHead>
                        <TableHead>Price</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredEvents.map((e) => (
                        <TableRow key={e.id} className="transition-colors hover:bg-accent/40">
                          <TableCell>
                            <Checkbox
                              checked={selectedIds.includes(e.id)}
                              onCheckedChange={(checked) =>
                                setSelectedIds((prev) => (checked ? [...prev, e.id] : prev.filter((id) => id !== e.id)))
                              }
                              aria-label={`Select ${e.title}`}
                            />
                          </TableCell>
                          <TableCell className="font-medium">{e.title}</TableCell>
                          <TableCell className="text-muted-foreground">{e.venue}</TableCell>
                          <TableCell>{e.date}</TableCell>
                          <TableCell>{e.seats}</TableCell>
                          <TableCell>₹{e.price}</TableCell>
                          <TableCell className="text-right">
                            <Button size="icon" variant="ghost" onClick={() => openEdit(e)}>
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button size="icon" variant="ghost" onClick={() => delMut.mutate(e.id)}>
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* ── Users ──────────────────────────────────────── */}
          <TabsContent value="users">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
              <SearchBox value={userQuery} onChange={setUserQuery} placeholder="Search users…" />
              <Button
                variant="outline"
                size="sm"
                onClick={() =>
                  downloadCsv("users.csv", [
                    ["ID", "Name", "Email", "Joined"],
                    ...filteredUsers.map((u) => [u.id, u.name, u.email, u.joined]),
                  ])
                }
              >
                <Download className="mr-1.5 h-3.5 w-3.5" /> Export CSV
              </Button>
            </div>
            <Card className="border-border/60 shadow-[var(--shadow-card)]">
              <CardContent className="p-0">
                {usersLoading ? (
                  <TableSkeleton rows={5} />
                ) : filteredUsers.length === 0 ? (
                  <EmptyState icon={users.length ? "search" : "calendar"} title={users.length ? "No users match your search" : "No users yet"} />
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Name</TableHead>
                        <TableHead>Email</TableHead>
                        <TableHead>Joined</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredUsers.map((u) => (
                        <TableRow key={u.id} className="transition-colors hover:bg-accent/40">
                          <TableCell>
                            <div className="flex items-center gap-2.5">
                              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-primary text-[10px] font-bold text-primary-foreground">
                                {u.name.split(" ").map((p) => p[0]?.toUpperCase()).slice(0, 2).join("")}
                              </div>
                              <span className="font-medium">{u.name}</span>
                            </div>
                          </TableCell>
                          <TableCell className="text-muted-foreground">{u.email}</TableCell>
                          <TableCell>{u.joined}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* ── Registrations ──────────────────────────────── */}
          <TabsContent value="registrations">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
              <SearchBox value={regQuery} onChange={setRegQuery} placeholder="Search registrations…" />
              <Button
                variant="outline"
                size="sm"
                onClick={() =>
                  downloadCsv("registrations.csv", [
                    ["ID", "User", "Event", "Ticket", "Status"],
                    ...filteredRegs.map((r) => [r.id, r.user, r.event?.title ?? "", r.ticket, r.status]),
                  ])
                }
              >
                <Download className="mr-1.5 h-3.5 w-3.5" /> Export CSV
              </Button>
            </div>
            <Card className="border-border/60 shadow-[var(--shadow-card)]">
              <CardContent className="p-0">
                {regsLoading ? (
                  <TableSkeleton rows={5} />
                ) : filteredRegs.length === 0 ? (
                  <EmptyState icon={registrations.length ? "search" : "calendar"} title={registrations.length ? "No registrations match your search" : "No registrations yet"} />
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>User</TableHead>
                        <TableHead>Event</TableHead>
                        <TableHead>Ticket</TableHead>
                        <TableHead>Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredRegs.map((r) => (
                        <TableRow key={r.id} className="transition-colors hover:bg-accent/40">
                          <TableCell className="font-medium">{r.user}</TableCell>
                          <TableCell className="text-muted-foreground">{r.event?.title ?? events.find((e) => e.id === r.eventId)?.title ?? "—"}</TableCell>
                          <TableCell>
                            <Badge variant={r.ticket === "VIP" ? "default" : "secondary"}>{r.ticket}</Badge>
                          </TableCell>
                          <TableCell>
                            <StatusBadge status={r.status} />
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* ── Payments ───────────────────────────────────── */}
          <TabsContent value="payments">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
              <SearchBox value={payQuery} onChange={setPayQuery} placeholder="Search payments…" />
              <Button
                variant="outline"
                size="sm"
                onClick={() =>
                  downloadCsv("payments.csv", [
                    ["ID", "User", "Amount", "Method", "Status"],
                    ...filteredPays.map((p) => [p.id, p.user, p.amount, p.method, p.status]),
                  ])
                }
              >
                <Download className="mr-1.5 h-3.5 w-3.5" /> Export CSV
              </Button>
            </div>
            <Card className="border-border/60 shadow-[var(--shadow-card)]">
              <CardContent className="p-0">
                {paysLoading ? (
                  <TableSkeleton rows={5} />
                ) : filteredPays.length === 0 ? (
                  <EmptyState icon={payments.length ? "search" : "calendar"} title={payments.length ? "No payments match your search" : "No payments yet"} />
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>User</TableHead>
                        <TableHead>Amount</TableHead>
                        <TableHead>Method</TableHead>
                        <TableHead>Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredPays.map((p) => (
                        <TableRow key={p.id} className="transition-colors hover:bg-accent/40">
                          <TableCell className="font-medium">{p.user}</TableCell>
                          <TableCell>₹{Number(p.amount).toLocaleString("en-IN")}</TableCell>
                          <TableCell className="text-muted-foreground">{p.method}</TableCell>
                          <TableCell>
                            <StatusBadge status={p.status} />
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        <Dialog open={open} onOpenChange={setOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editing ? "Update Event" : "Add Event"}</DialogTitle>
            </DialogHeader>
            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label>Title</Label>
                <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} maxLength={100} />
              </div>
              <div className="space-y-1.5">
                <Label>Venue</Label>
                <Input value={form.venue} onChange={(e) => setForm({ ...form, venue: e.target.value })} maxLength={120} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>State</Label>
                  <Select
                    value={form.state}
                    onValueChange={(v) => setForm({ ...form, state: v, city: "" })}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Select state" />
                    </SelectTrigger>
                    <SelectContent className="max-h-72">
                      {states.map((s) => (
                        <SelectItem key={s} value={s}>{s}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>City</Label>
                  <Select
                    value={form.city}
                    onValueChange={(v) => setForm({ ...form, city: v })}
                    disabled={!form.state}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder={form.state ? "Select city" : "Select a state first"} />
                    </SelectTrigger>
                    <SelectContent className="max-h-72">
                      {cities.map((c) => (
                        <SelectItem key={c} value={c}>{c}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Date</Label>
                  <Input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} />
                </div>
                <div className="space-y-1.5">
                  <Label>Seats</Label>
                  <Input type="number" min={1} value={form.seats} onChange={(e) => setForm({ ...form, seats: +e.target.value })} />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label>Price (₹)</Label>
                <Input type="number" min={0} value={form.price} onChange={(e) => setForm({ ...form, price: +e.target.value })} />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
              <Button onClick={save} disabled={addMut.isPending || updMut.isPending}>
                {editing ? "Update" : "Create"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </PageTransition>
    </Layout>
  );
}

import Layout from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  fetchEvents, fetchUsers, fetchRegistrations, fetchPayments,
  createEvent, updateEvent, deleteEvent, type Event,
} from "@/lib/api";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Pencil, Plus, Trash2, Loader2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

export default function Admin() {
  const qc = useQueryClient();
  const { data: events = [], isLoading: eventsLoading } = useQuery({ queryKey: ["events"], queryFn: fetchEvents });
  const { data: users = [], isLoading: usersLoading } = useQuery({ queryKey: ["users"], queryFn: fetchUsers });
  const { data: registrations = [], isLoading: regsLoading } = useQuery({ queryKey: ["registrations"], queryFn: fetchRegistrations });
  const { data: payments = [], isLoading: paysLoading } = useQuery({ queryKey: ["payments"], queryFn: fetchPayments });

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Event | null>(null);
  const [form, setForm] = useState<Omit<Event, "id">>({ title: "", venue: "", date: "", seats: 100, price: 0 });

  const invalidate = () => { qc.invalidateQueries({ queryKey: ["events"] }); qc.invalidateQueries({ queryKey: ["stats"] }); };

  const addMut = useMutation({ mutationFn: (d: Omit<Event, "id">) => createEvent(d), onSuccess: () => { invalidate(); toast.success("Event added"); setOpen(false); }, onError: (e: any) => toast.error(e.message) });
  const updMut = useMutation({ mutationFn: ({ id, ...d }: Event) => updateEvent(id, d), onSuccess: () => { invalidate(); toast.success("Event updated"); setOpen(false); }, onError: (e: any) => toast.error(e.message) });
  const delMut = useMutation({ mutationFn: (id: number) => deleteEvent(id), onSuccess: () => { invalidate(); toast.success("Event deleted"); }, onError: (e: any) => toast.error(e.message) });

  const openNew = () => { setEditing(null); setForm({ title: "", venue: "", date: "", seats: 100, price: 0 }); setOpen(true); };
  const openEdit = (e: Event) => { setEditing(e); setForm({ title: e.title, venue: e.venue, date: e.date, seats: e.seats, price: e.price }); setOpen(true); };

  const save = () => {
    if (!form.title.trim() || !form.venue.trim() || !form.date) { toast.error("Fill all fields"); return; }
    if (editing) { updMut.mutate({ id: editing.id, ...form }); } else { addMut.mutate(form); }
  };

  const Spinner = () => <div className="flex justify-center py-10"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;

  return (
    <Layout>
      <div className="mb-6">
        <h1 className="text-3xl font-bold tracking-tight">Admin Panel</h1>
        <p className="text-muted-foreground mt-1">Manage users, events, registrations, and payments.</p>
      </div>

      <Tabs defaultValue="events">
        <TabsList>
          <TabsTrigger value="users">Users</TabsTrigger>
          <TabsTrigger value="events">Events</TabsTrigger>
          <TabsTrigger value="registrations">Registrations</TabsTrigger>
          <TabsTrigger value="payments">Payments</TabsTrigger>
        </TabsList>

        <TabsContent value="users">
          <Card className="border-border/60 shadow-[var(--shadow-card)]"><CardContent className="p-0">
            {usersLoading ? <Spinner /> : (
              <Table><TableHeader><TableRow><TableHead>Name</TableHead><TableHead>Email</TableHead><TableHead>Joined</TableHead></TableRow></TableHeader>
                <TableBody>{users.map(u => (
                  <TableRow key={u.id}><TableCell className="font-medium">{u.name}</TableCell><TableCell className="text-muted-foreground">{u.email}</TableCell><TableCell>{u.joined}</TableCell></TableRow>
                ))}</TableBody></Table>
            )}
          </CardContent></Card>
        </TabsContent>

        <TabsContent value="events">
          <div className="mb-3 flex justify-end"><Button onClick={openNew}><Plus className="h-4 w-4 mr-1" />Add Event</Button></div>
          <Card className="border-border/60 shadow-[var(--shadow-card)]"><CardContent className="p-0">
            {eventsLoading ? <Spinner /> : (
              <Table><TableHeader><TableRow><TableHead>Title</TableHead><TableHead>Venue</TableHead><TableHead>Date</TableHead><TableHead>Seats</TableHead><TableHead>Price</TableHead><TableHead className="text-right">Actions</TableHead></TableRow></TableHeader>
                <TableBody>{events.map(e => (
                  <TableRow key={e.id}>
                    <TableCell className="font-medium">{e.title}</TableCell><TableCell className="text-muted-foreground">{e.venue}</TableCell><TableCell>{e.date}</TableCell><TableCell>{e.seats}</TableCell><TableCell>₹{e.price}</TableCell>
                    <TableCell className="text-right">
                      <Button size="icon" variant="ghost" onClick={() => openEdit(e)}><Pencil className="h-4 w-4" /></Button>
                      <Button size="icon" variant="ghost" onClick={() => delMut.mutate(e.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                    </TableCell>
                  </TableRow>
                ))}</TableBody></Table>
            )}
          </CardContent></Card>
        </TabsContent>

        <TabsContent value="registrations">
          <Card className="border-border/60 shadow-[var(--shadow-card)]"><CardContent className="p-0">
            {regsLoading ? <Spinner /> : (
              <Table><TableHeader><TableRow><TableHead>User</TableHead><TableHead>Event</TableHead><TableHead>Ticket</TableHead><TableHead>Status</TableHead></TableRow></TableHeader>
                <TableBody>{registrations.map(r => (
                  <TableRow key={r.id}>
                    <TableCell className="font-medium">{r.user}</TableCell>
                    <TableCell className="text-muted-foreground">{r.event?.title ?? events.find(e => e.id === r.eventId)?.title ?? "—"}</TableCell>
                    <TableCell><Badge variant={r.ticket === "VIP" ? "default" : "secondary"}>{r.ticket}</Badge></TableCell>
                    <TableCell><Badge variant={r.status === "Confirmed" ? "default" : "outline"} className={r.status === "Confirmed" ? "bg-success text-success-foreground hover:bg-success" : ""}>{r.status}</Badge></TableCell>
                  </TableRow>
                ))}</TableBody></Table>
            )}
          </CardContent></Card>
        </TabsContent>

        <TabsContent value="payments">
          <Card className="border-border/60 shadow-[var(--shadow-card)]"><CardContent className="p-0">
            {paysLoading ? <Spinner /> : (
              <Table><TableHeader><TableRow><TableHead>User</TableHead><TableHead>Amount</TableHead><TableHead>Method</TableHead><TableHead>Status</TableHead></TableRow></TableHeader>
                <TableBody>{payments.map(p => (
                  <TableRow key={p.id}>
                    <TableCell className="font-medium">{p.user}</TableCell><TableCell>₹{Number(p.amount).toLocaleString()}</TableCell><TableCell className="text-muted-foreground">{p.method}</TableCell>
                    <TableCell><Badge className={p.status === "Paid" ? "bg-success text-success-foreground hover:bg-success" : ""} variant={p.status === "Paid" ? "default" : "outline"}>{p.status}</Badge></TableCell>
                  </TableRow>
                ))}</TableBody></Table>
            )}
          </CardContent></Card>
        </TabsContent>
      </Tabs>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editing ? "Update Event" : "Add Event"}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5"><Label>Title</Label><Input value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} maxLength={100} /></div>
            <div className="space-y-1.5"><Label>Venue</Label><Input value={form.venue} onChange={e => setForm({ ...form, venue: e.target.value })} maxLength={120} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5"><Label>Date</Label><Input type="date" value={form.date} onChange={e => setForm({ ...form, date: e.target.value })} /></div>
              <div className="space-y-1.5"><Label>Seats</Label><Input type="number" min={1} value={form.seats} onChange={e => setForm({ ...form, seats: +e.target.value })} /></div>
            </div>
            <div className="space-y-1.5"><Label>Price (₹)</Label><Input type="number" min={0} value={form.price} onChange={e => setForm({ ...form, price: +e.target.value })} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={save} disabled={addMut.isPending || updMut.isPending}>
              {(addMut.isPending || updMut.isPending) && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {editing ? "Update" : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Layout>
  );
}

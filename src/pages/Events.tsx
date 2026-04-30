import Layout from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { fetchEvents, type Event } from "@/lib/api";
import { useQuery } from "@tanstack/react-query";
import { CalendarDays, MapPin, Users, Loader2 } from "lucide-react";
import { useState } from "react";
import { useNavigate } from "react-router-dom";

export default function Events() {
  const navigate = useNavigate();
  const { data: events = [], isLoading } = useQuery({ queryKey: ["events"], queryFn: fetchEvents });
  const [selected, setSelected] = useState<Event | null>(null);

  return (
    <Layout>
      <div className="mb-8 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Upcoming Events</h1>
          <p className="text-muted-foreground mt-1">Discover and register for events happening near you.</p>
        </div>
        <Badge variant="secondary" className="text-xs">{events.length} events</Badge>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {events.map(e => (
            <Card key={e.id} className="group overflow-hidden border-border/60 shadow-[var(--shadow-card)] transition-all hover:-translate-y-0.5 hover:shadow-elegant">
              <div className="h-32 bg-gradient-primary relative">
                <div className="absolute inset-0 bg-black/10" />
                <Badge className="absolute top-3 right-3 bg-card text-foreground hover:bg-card">
                  ₹{e.price === 0 ? "Free" : e.price}
                </Badge>
              </div>
              <CardContent className="p-5">
                <h3 className="font-semibold text-lg leading-tight">{e.title}</h3>
                <div className="mt-3 space-y-1.5 text-sm text-muted-foreground">
                  <div className="flex items-center gap-2"><MapPin className="h-4 w-4" />{e.venue}</div>
                  <div className="flex items-center gap-2"><CalendarDays className="h-4 w-4" />{new Date(e.date).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}</div>
                  <div className="flex items-center gap-2"><Users className="h-4 w-4" />{e.seats} seats available</div>
                </div>
                <div className="mt-5 flex gap-2">
                  <Button className="flex-1" onClick={() => navigate(`/register?event=${e.id}`)}>Register</Button>
                  <Button variant="outline" className="flex-1" onClick={() => setSelected(e)}>View Details</Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={!!selected} onOpenChange={(o) => !o && setSelected(null)}>
        <DialogContent>
          {selected && (
            <>
              <DialogHeader>
                <DialogTitle>{selected.title}</DialogTitle>
                <DialogDescription>Full event information</DialogDescription>
              </DialogHeader>
              <div className="space-y-3 text-sm">
                <div className="flex items-center gap-2 text-muted-foreground"><MapPin className="h-4 w-4" />{selected.venue}</div>
                <div className="flex items-center gap-2 text-muted-foreground"><CalendarDays className="h-4 w-4" />{new Date(selected.date).toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}</div>
                <div className="flex items-center gap-2 text-muted-foreground"><Users className="h-4 w-4" />{selected.seats} seats remaining</div>
                <p className="pt-2 text-foreground/80">Join us for an unforgettable experience. Network with industry leaders, enjoy curated content, and take home memorable moments.</p>
                <div className="flex items-center justify-between pt-3 border-t">
                  <span className="text-muted-foreground">Ticket starts at</span>
                  <span className="text-lg font-bold">₹{selected.price === 0 ? "Free" : selected.price}</span>
                </div>
              </div>
              <Button className="w-full" onClick={() => navigate(`/register?event=${selected.id}`)}>Register Now</Button>
            </>
          )}
        </DialogContent>
      </Dialog>
    </Layout>
  );
}

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

// Map event category / title keywords → image
const categoryImages: Record<string, string> = {
  Technical: "/events/technical.png",
  Entertainment: "/events/entertainment.png",
  Cultural: "/events/cultural.png",
  General: "/events/general.png",
};

function getEventImage(event: Event): string {
  // Check title keywords first for specific matches
  const t = event.title.toLowerCase();
  if (t.includes("hack")) return "/events/hackathon.png";
  if (t.includes("drama") || t.includes("theater") || t.includes("theatre") || t.includes("play")) return "/events/drama.png";
  if (t.includes("dance")) return "/events/cultural.png";
  if (t.includes("music") || t.includes("concert")) return "/events/entertainment.png";
  if (t.includes("tech") || t.includes("code") || t.includes("ai") || t.includes("symposium")) return "/events/technical.png";
  // Fallback to category
  if (event.category && categoryImages[event.category]) {
    return categoryImages[event.category];
  }
  return "/events/general.png";
}

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
              <div className="h-40 relative overflow-hidden">
                <img
                  src={getEventImage(e)}
                  alt={e.title}
                  className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/20 to-transparent" />
                <Badge className="absolute top-3 right-3 bg-card text-foreground hover:bg-card shadow-md">
                  ₹{e.price === 0 ? "Free" : e.price}
                </Badge>
                {e.category && (
                  <Badge variant="secondary" className="absolute top-3 left-3 bg-black/50 text-white border-0 backdrop-blur-sm text-[10px]">
                    {e.category}
                  </Badge>
                )}
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
        <DialogContent className="sm:max-w-lg">
          {selected && (
            <>
              <div className="rounded-lg overflow-hidden -mx-2 -mt-2 mb-2">
                <img
                  src={getEventImage(selected)}
                  alt={selected.title}
                  className="w-full h-48 object-cover"
                />
              </div>
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

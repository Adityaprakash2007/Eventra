import Layout from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { fetchEvents, createRegistration } from "@/lib/api";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import { z } from "zod";
import { Loader2 } from "lucide-react";

const schema = z.object({
  name: z.string().trim().min(2, "Name too short").max(100),
  eventId: z.string().min(1, "Please select an event"),
  ticket: z.enum(["VIP", "Regular"]),
});

export default function Register() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const { data: events = [], isLoading } = useQuery({ queryKey: ["events"], queryFn: fetchEvents });
  const [name, setName] = useState("");
  const [eventId, setEventId] = useState(params.get("event") ?? "");
  const [ticket, setTicket] = useState<"VIP" | "Regular">("Regular");
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const result = schema.safeParse({ name, eventId, ticket });
    if (!result.success) {
      toast.error(result.error.issues[0].message);
      return;
    }

    setSubmitting(true);
    try {
      const reg = await createRegistration({ user: name, eventId: Number(eventId), ticket });
      toast.success("Registration created. Proceed to payment.");
      navigate(`/payment?event=${eventId}&ticket=${ticket}&name=${encodeURIComponent(name)}&regId=${reg.id}`);
    } catch (err: any) {
      toast.error(err.message || "Registration failed");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Layout>
      <div className="max-w-xl mx-auto">
        <div className="mb-6">
          <h1 className="text-3xl font-bold tracking-tight">Register for an Event</h1>
          <p className="text-muted-foreground mt-1">Fill in your details to reserve your spot.</p>
        </div>

        <Card className="border-border/60 shadow-[var(--shadow-card)]">
          <CardHeader>
            <CardTitle>Attendee details</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex justify-center py-10">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-5">
                <div className="space-y-2">
                  <Label htmlFor="name">User Name</Label>
                  <Input id="name" placeholder="Jane Doe" value={name} onChange={(e) => setName(e.target.value)} maxLength={100} />
                </div>

                <div className="space-y-2">
                  <Label>Select Event</Label>
                  <Select value={eventId} onValueChange={setEventId}>
                    <SelectTrigger><SelectValue placeholder="Choose an event" /></SelectTrigger>
                    <SelectContent>
                      {events.map(e => (
                        <SelectItem key={e.id} value={String(e.id)}>{e.title}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Ticket Type</Label>
                  <RadioGroup value={ticket} onValueChange={(v) => setTicket(v as "VIP" | "Regular")} className="grid grid-cols-2 gap-3">
                    {(["Regular", "VIP"] as const).map(t => (
                      <label key={t} htmlFor={t} className={`flex items-center gap-3 rounded-lg border p-4 cursor-pointer transition-colors ${ticket === t ? "border-primary bg-accent" : "border-border hover:bg-muted/50"}`}>
                        <RadioGroupItem value={t} id={t} />
                        <div>
                          <p className="font-medium">{t}</p>
                          <p className="text-xs text-muted-foreground">{t === "VIP" ? "Premium access" : "Standard entry"}</p>
                        </div>
                      </label>
                    ))}
                  </RadioGroup>
                </div>

                <Button type="submit" className="w-full" size="lg" disabled={submitting}>
                  {submitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  Submit Registration
                </Button>
              </form>
            )}
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
}

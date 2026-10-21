import Layout from "@/components/Layout";
import PageTransition from "@/components/PageTransition";
import { usePageTitle } from "@/hooks/usePageTitle";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { fetchEvents, createRegistration } from "@/lib/api";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import { z } from "zod";
import { Loader2, Check, Sparkles, Users, ArrowLeft, ArrowRight, PartyPopper } from "lucide-react";
import { cn } from "@/lib/utils";

const schema = z.object({
  name: z.string().trim().min(2, "Name too short").max(100),
  eventId: z.string().min(1, "Please select an event"),
  ticket: z.enum(["VIP", "Regular"]),
});

const steps = [
  { title: "Your Details", description: "Who's attending" },
  { title: "Ticket Type", description: "Pick your pass" },
  { title: "Confirm", description: "Review & continue" },
];

export default function Register() {
  usePageTitle("Register");
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const { data: events = [], isLoading } = useQuery({ queryKey: ["events"], queryFn: () => fetchEvents() });
  const [name, setName] = useState("");
  const [eventId, setEventId] = useState(params.get("event") ?? "");
  const [ticket, setTicket] = useState<"VIP" | "Regular">("Regular");
  const [step, setStep] = useState(0);
  const [submitting, setSubmitting] = useState(false);

  const selectedEvent = events.find((e) => String(e.id) === eventId);
  const basePrice = selectedEvent?.price ?? 0;
  const price = ticket === "VIP" ? basePrice * 2 : basePrice;
  const totalTaken = selectedEvent ? Math.max(0, selectedEvent.seats - 20) : 0;
  const capacity = selectedEvent ? totalTaken + selectedEvent.seats : 0;
  const fillPct = capacity > 0 ? Math.round((totalTaken / capacity) * 100) : 0;

  const detailsValid = name.trim().length >= 2 && eventId !== "";

  const next = () => {
    if (step === 0 && !detailsValid) {
      toast.error("Please enter your name and select an event.");
      return;
    }
    setStep((s) => Math.min(s + 1, 2));
  };

  const handleSubmit = async () => {
    const result = schema.safeParse({ name, eventId, ticket });
    if (!result.success) {
      toast.error(result.error.issues[0].message);
      setStep(0);
      return;
    }

    setSubmitting(true);
    try {
      const reg = await createRegistration({ user: name, eventId: Number(eventId), ticket });
      toast.success("Registration created. Proceed to payment.");
      navigate(`/payment?event=${eventId}&ticket=${ticket}&name=${encodeURIComponent(name)}&regId=${reg.id}`);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Registration failed");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Layout>
      <PageTransition>
        <div className="mx-auto max-w-xl">
          <div className="mb-6 text-center">
            <h1 className="text-3xl font-extrabold tracking-tight">
              Register for an <span className="gradient-text">Event</span>
            </h1>
            <p className="mt-1 text-muted-foreground">Reserve your spot in three quick steps.</p>
          </div>

          {/* ── Stepper ─────────────────────────────────────────── */}
          <div className="mb-8 flex items-center">
            {steps.map((s, i) => (
              <div key={s.title} className={cn("flex items-center", i < steps.length - 1 && "flex-1")}>
                <div className="flex flex-col items-center">
                  <div
                    className={cn(
                      "flex h-9 w-9 items-center justify-center rounded-full border-2 text-sm font-bold transition-all duration-300",
                      i < step
                        ? "border-emerald-500 bg-emerald-500 text-white"
                        : i === step
                          ? "border-primary bg-gradient-primary text-primary-foreground shadow-glow-sm"
                          : "border-border bg-card text-muted-foreground"
                    )}
                  >
                    {i < step ? <Check className="h-4 w-4" /> : i + 1}
                  </div>
                  <p className={cn("mt-1.5 hidden text-xs font-semibold sm:block", i === step ? "text-foreground" : "text-muted-foreground")}>
                    {s.title}
                  </p>
                  <p className="hidden text-[10px] text-muted-foreground sm:block">{s.description}</p>
                </div>
                {i < steps.length - 1 && (
                  <div className="mx-2 mb-0 h-0.5 flex-1 overflow-hidden rounded bg-border sm:mb-6">
                    <div
                      className="h-full rounded bg-gradient-primary transition-all duration-500"
                      style={{ width: i < step ? "100%" : "0%" }}
                    />
                  </div>
                )}
              </div>
            ))}
          </div>

          <Card className="border-border/60 shadow-[var(--shadow-card)]">
            <CardHeader>
              <CardTitle className="text-base">{steps[step].title}</CardTitle>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="flex justify-center py-10">
                  <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
              ) : step === 0 ? (
                /* ── Step 1: details ── */
                <div className="space-y-5">
                  <div className="space-y-2">
                    <Label htmlFor="name">Full Name</Label>
                    <Input
                      id="name"
                      placeholder="Jane Doe"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      maxLength={100}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Select Event</Label>
                    <Select value={eventId} onValueChange={setEventId}>
                      <SelectTrigger>
                        <SelectValue placeholder="Choose an event" />
                      </SelectTrigger>
                      <SelectContent>
                        {events.map((e) => (
                          <SelectItem key={e.id} value={String(e.id)}>
                            {e.title}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  {selectedEvent && (
                    <div className="rounded-xl border border-border/60 bg-accent/30 p-4">
                      <div className="mb-2 flex items-center justify-between text-xs">
                        <span className="flex items-center gap-1.5 font-medium text-muted-foreground">
                          <Users className="h-3.5 w-3.5" /> Seat availability
                        </span>
                        <span className="font-semibold">{fillPct}% booked</span>
                      </div>
                      <Progress value={fillPct} className="h-2" />
                      <p className="mt-2 text-xs text-muted-foreground">
                        {selectedEvent.seats} seats left · {selectedEvent.venue}
                      </p>
                    </div>
                  )}
                </div>
              ) : step === 1 ? (
                /* ── Step 2: premium ticket selector ── */
                <div className="grid gap-4 sm:grid-cols-2">
                  {(["Regular", "VIP"] as const).map((t) => {
                    const isVip = t === "VIP";
                    const active = ticket === t;
                    const tPrice = isVip ? basePrice * 2 : basePrice;
                    return (
                      <button
                        key={t}
                        type="button"
                        onClick={() => setTicket(t)}
                        className={cn(
                          "relative rounded-xl border-2 p-5 text-left transition-all duration-300",
                          active
                            ? "border-primary bg-accent/60 shadow-glow-sm"
                            : "border-border bg-card hover:border-primary/40 hover:bg-accent/30"
                        )}
                      >
                        {isVip && (
                          <Badge className="absolute -top-2.5 right-4 gap-1 border-0 bg-gradient-primary text-[10px] text-primary-foreground">
                            <Sparkles className="h-3 w-3" /> Most popular
                          </Badge>
                        )}
                        <div className="flex items-center justify-between">
                          <p className="font-bold">{t}</p>
                          <div
                            className={cn(
                              "flex h-5 w-5 items-center justify-center rounded-full border-2 transition-all",
                              active ? "border-primary bg-primary text-primary-foreground" : "border-muted-foreground/40"
                            )}
                          >
                            {active && <Check className="h-3 w-3" />}
                          </div>
                        </div>
                        <p className="mt-1 text-xs text-muted-foreground">{isVip ? "Premium access" : "Standard entry"}</p>
                        <p className="mt-3 text-2xl font-extrabold">
                          ₹{tPrice === 0 ? "Free" : tPrice.toLocaleString("en-IN")}
                        </p>
                        <ul className="mt-3 space-y-1.5 text-xs text-muted-foreground">
                          <li className="flex items-center gap-1.5">
                            <Check className="h-3 w-3 text-emerald-500" /> {isVip ? "Front-row seating" : "General seating"}
                          </li>
                          <li className="flex items-center gap-1.5">
                            <Check className="h-3 w-3 text-emerald-500" /> {isVip ? "Backstage meet & greet" : "Event kit included"}
                          </li>
                          <li className="flex items-center gap-1.5">
                            <Check className="h-3 w-3 text-emerald-500" /> {isVip ? "Complimentary refreshments" : "Digital certificate"}
                          </li>
                        </ul>
                      </button>
                    );
                  })}
                </div>
              ) : (
                /* ── Step 3: review ── */
                <div className="space-y-4">
                  <div className="flex items-start gap-3 rounded-xl border border-emerald-500/30 bg-emerald-500/[0.06] p-4">
                    <PartyPopper className="mt-0.5 h-5 w-5 text-emerald-500" />
                    <p className="text-sm">
                      Almost there, <span className="font-semibold">{name || "friend"}</span>! Review your details and continue
                      to secure payment.
                    </p>
                  </div>
                  <dl className="divide-y divide-border/60 rounded-xl border border-border/60">
                    {[
                      ["Attendee", name],
                      ["Event", selectedEvent?.title ?? "—"],
                      ["Ticket", ticket],
                      ["Venue", selectedEvent?.venue ?? "—"],
                    ].map(([k, v]) => (
                      <div key={k} className="flex items-center justify-between px-4 py-3 text-sm">
                        <dt className="text-muted-foreground">{k}</dt>
                        <dd className="max-w-[60%] truncate font-medium">{v}</dd>
                      </div>
                    ))}
                    <div className="flex items-center justify-between px-4 py-3">
                      <dt className="text-sm text-muted-foreground">Total</dt>
                      <dd className="text-lg font-extrabold gradient-text">₹{price.toLocaleString("en-IN")}</dd>
                    </div>
                  </dl>
                </div>
              )}

              {/* Navigation */}
              <div className="mt-6 flex gap-3">
                {step > 0 && (
                  <Button variant="outline" className="flex-1" onClick={() => setStep((s) => s - 1)} disabled={submitting}>
                    <ArrowLeft className="mr-1.5 h-4 w-4" /> Back
                  </Button>
                )}
                {step < 2 ? (
                  <Button className="flex-1 transition-all hover:shadow-glow-sm" onClick={next}>
                    Continue <ArrowRight className="ml-1.5 h-4 w-4" />
                  </Button>
                ) : (
                  <Button
                    className="flex-1 transition-all hover:shadow-glow-sm"
                    size="lg"
                    onClick={handleSubmit}
                    disabled={submitting}
                  >
                    {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Confirm & Pay ₹{price.toLocaleString("en-IN")}
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </PageTransition>
    </Layout>
  );
}

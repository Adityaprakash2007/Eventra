import Layout from "@/components/Layout";
import PageTransition from "@/components/PageTransition";
import { usePageTitle } from "@/hooks/usePageTitle";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { fetchEvent, createPayment } from "@/lib/api";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  CreditCard,
  Smartphone,
  CheckCircle2,
  Loader2,
  Zap,
  ShieldCheck,
  Ticket,
  Printer,
  MapPin,
  CalendarDays,
} from "lucide-react";
import { motion } from "framer-motion";
import { useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import MockRazorpayModal from "@/components/MockRazorpayModal";
import { useNotifications } from "@/components/NotificationCenter";

export default function Payment() {
  usePageTitle("Payment");
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const { notify } = useNotifications();
  const queryClient = useQueryClient();
  const eventId = params.get("event");
  const ticket = (params.get("ticket") as "VIP" | "Regular") ?? "Regular";
  const name = params.get("name") ?? "Guest";
  const regId = params.get("regId");

  const { data: event, isLoading } = useQuery({
    queryKey: ["event", eventId],
    queryFn: () => fetchEvent(eventId!),
    enabled: !!eventId,
  });

  const baseAmount = event?.price ?? 0;
  const amount = ticket === "VIP" ? baseAmount * 2 : baseAmount;
  const [method, setMethod] = useState<"Razorpay" | "UPI" | "Card">("Razorpay");
  const [upiId, setUpiId] = useState("");
  const [upiError, setUpiError] = useState("");
  const [done, setDone] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [showRazorpayModal, setShowRazorpayModal] = useState(false);
  const [paidVia, setPaidVia] = useState<string>("Razorpay");

  const ALLOWED_UPI = ["gpay", "paytm"];

  const validateUpi = (id: string) => {
    const handle = id.split("@")[1]?.toLowerCase();
    return ALLOWED_UPI.includes(handle);
  };

  const finalizePayment = async (paymentMethod: string) => {
    await createPayment({
      user: name,
      amount,
      method: paymentMethod,
      status: "Paid",
      registrationId: regId ? Number(regId) : undefined,
    });
    setPaidVia(paymentMethod);
    setDone(true);
    // refresh dashboard stats so total revenue / counts reflect this payment
    void queryClient.invalidateQueries({ queryKey: ["stats"] });
    void queryClient.invalidateQueries({ queryKey: ["payments"] });
    void queryClient.invalidateQueries({ queryKey: ["registrations"] });
    notify({
      type: "payment",
      title: "Payment successful",
      message: `₹${amount.toLocaleString("en-IN")} paid via ${paymentMethod} for ${event?.title ?? "your ticket"}.`,
    });
  };

  const handleRazorpaySuccess = async (paymentId: string) => {
    setShowRazorpayModal(false);
    setSubmitting(true);
    try {
      await finalizePayment("Razorpay");
      toast.success(`Payment verified! (ID: ${paymentId})`);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Payment submission failed");
    } finally {
      setSubmitting(false);
    }
  };

  const handlePay = async (e: React.FormEvent) => {
    e.preventDefault();
    if (method === "Razorpay") {
      const redirectUrl = `/razorpay-checkout?event=${eventId || ""}&ticket=${ticket}&name=${encodeURIComponent(name)}&amount=${amount}${regId ? `&regId=${regId}` : ""}`;
      toast.info("Redirecting to Razorpay Secure Gateway...");
      navigate(redirectUrl);
      return;
    }
    if (method === "UPI" && !validateUpi(upiId)) {
      setUpiError("Only @gpay or @paytm UPI IDs are accepted.");
      return;
    }
    setSubmitting(true);
    try {
      await finalizePayment(method);
      toast.success("Payment confirmed!");
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Payment failed");
    } finally {
      setSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <Layout>
        <div className="flex justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <PageTransition>
        <div className="mx-auto max-w-3xl">
          <div className="mb-6 text-center">
            <h1 className="text-3xl font-extrabold tracking-tight">
              Secure <span className="gradient-text">Checkout</span>
            </h1>
            <p className="mt-1 text-muted-foreground">Complete your payment to confirm your ticket.</p>
          </div>

          {done ? (
            /* ── Animated success + printable ticket ─────────────── */
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}>
              <div className="mb-6 flex flex-col items-center text-center">
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ type: "spring", stiffness: 260, damping: 18, delay: 0.15 }}
                  className="relative mb-4 flex h-20 w-20 items-center justify-center rounded-full bg-emerald-500/15"
                >
                  <div className="absolute inset-0 animate-glow-pulse rounded-full" />
                  <CheckCircle2 className="h-11 w-11 text-emerald-500" />
                </motion.div>
                <h2 className="text-2xl font-extrabold">Payment Successful!</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  Your ticket is confirmed via {paidVia}. A confirmation has been sent to your email.
                </p>
              </div>

              {/* Printable ticket card */}
              <Card className="relative mx-auto max-w-md overflow-hidden border-border/60 shadow-elegant">
                <div className="bg-gradient-primary px-6 py-4 text-primary-foreground">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Ticket className="h-5 w-5" />
                      <span className="font-bold tracking-tight">Eventra</span>
                    </div>
                    <span className="text-xs font-medium opacity-90">E-Ticket · {ticket}</span>
                  </div>
                </div>
                <CardContent className="space-y-4 p-6">
                  <div>
                    <p className="text-xs uppercase tracking-wide text-muted-foreground">Event</p>
                    <p className="text-lg font-bold">{event?.title ?? "—"}</p>
                  </div>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <p className="text-xs uppercase tracking-wide text-muted-foreground">Attendee</p>
                      <p className="mt-0.5 font-semibold">{name}</p>
                    </div>
                    <div>
                      <p className="text-xs uppercase tracking-wide text-muted-foreground">Amount paid</p>
                      <p className="mt-0.5 font-semibold text-emerald-600 dark:text-emerald-400">
                        ₹{amount.toLocaleString("en-IN")}
                      </p>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <CalendarDays className="h-4 w-4 text-primary/70" />
                      <span>{event ? new Date(event.date).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }) : "—"}</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <MapPin className="h-4 w-4 text-primary/70" />
                      <span className="truncate">{event?.venue ?? "—"}</span>
                    </div>
                  </div>
                  <Separator />
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span>Reg. ID: {regId ?? "—"}</span>
                    <span>Paid via {paidVia}</span>
                  </div>
                  {/* ticket notch */}
                  <div className="pointer-events-none absolute left-1/2 top-[86px] h-5 w-5 -translate-x-1/2 rounded-full bg-background shadow-inner" />
                </CardContent>
                <div className="border-t border-dashed border-border px-6 py-3 text-center">
                  <p className="font-mono text-[10px] tracking-[0.25em] text-muted-foreground">
                    ◼ ◼ ◼ ◼ {regId?.padStart(4, "0") ?? "0000"} ◼ ◼ ◼ ◼
                  </p>
                </div>
              </Card>

              <div className="mt-6 flex flex-wrap justify-center gap-3">
                <Button variant="outline" onClick={() => window.print()} className="gap-2">
                  <Printer className="h-4 w-4" /> Print ticket
                </Button>
                <Button onClick={() => navigate("/events")} className="gap-2 transition-all hover:shadow-glow-sm">
                  Browse more events
                </Button>
              </div>
            </motion.div>
          ) : (
            <div className="grid gap-5 md:grid-cols-5">
              {/* Order summary */}
              <Card className="h-fit border-border/60 shadow-[var(--shadow-card)] md:col-span-2">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-base">
                    <Ticket className="h-4 w-4 text-primary" /> Order summary
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4 text-sm">
                  <div className="rounded-xl bg-gradient-to-br from-primary/[0.07] to-violet-500/[0.07] p-4">
                    <p className="text-xs uppercase tracking-wide text-muted-foreground">Event</p>
                    <p className="mt-0.5 font-bold">{event?.title ?? "—"}</p>
                    <div className="mt-2 flex items-center gap-3 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <CalendarDays className="h-3.5 w-3.5" />
                        {event ? new Date(event.date).toLocaleDateString("en-IN", { day: "numeric", month: "short" }) : "—"}
                      </span>
                      <span className="flex min-w-0 items-center gap-1">
                        <MapPin className="h-3.5 w-3.5 shrink-0" />
                        <span className="truncate">{event?.venue}</span>
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Attendee</span>
                    <span className="font-medium">{name}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Ticket type</span>
                    <Badge variant={ticket === "VIP" ? "default" : "secondary"}>{ticket}</Badge>
                  </div>
                  <Separator />
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Base price</span>
                    <span>₹{baseAmount.toLocaleString("en-IN")}</span>
                  </div>
                  {ticket === "VIP" && (
                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                      <span>VIP upgrade (×2)</span>
                      <span>included</span>
                    </div>
                  )}
                  <div className="flex items-center justify-between rounded-xl border border-primary/20 bg-primary/[0.05] px-4 py-3">
                    <span className="font-medium">Total</span>
                    <span className="text-xl font-extrabold gradient-text">₹{amount.toLocaleString("en-IN")}</span>
                  </div>
                  <p className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                    <ShieldCheck className="h-3.5 w-3.5 text-emerald-500" /> 256-bit encrypted · PCI-DSS compliant checkout
                  </p>
                </CardContent>
              </Card>

              {/* Payment form */}
              <Card className="border-border/60 shadow-[var(--shadow-card)] md:col-span-3">
                <CardHeader>
                  <CardTitle className="text-base">Payment details</CardTitle>
                </CardHeader>
                <CardContent>
                  <form onSubmit={handlePay} className="space-y-5">
                    <div className="space-y-2">
                      <Label htmlFor="amount">Amount</Label>
                      <Input id="amount" value={`₹${amount.toLocaleString("en-IN")}`} readOnly />
                    </div>
                    <div className="space-y-2">
                      <Label>Payment Gateway / Method</Label>
                      <RadioGroup
                        value={method}
                        onValueChange={(v) => setMethod(v as "Razorpay" | "UPI" | "Card")}
                        className="grid grid-cols-1 gap-2.5"
                      >
                        <label
                          className={`flex items-center justify-between rounded-xl border p-4 cursor-pointer transition-all ${
                            method === "Razorpay"
                              ? "border-blue-600 bg-blue-50/50 ring-1 ring-blue-600 dark:bg-blue-950/20"
                              : "border-border hover:bg-accent/40"
                          }`}
                        >
                          <div className="flex items-center gap-3">
                            <RadioGroupItem value="Razorpay" id="razorpay" />
                            <div className="rounded bg-blue-600 px-2 py-1 text-xs font-extrabold tracking-tighter text-white">
                              <span className="text-sky-300">R</span>ZP
                            </div>
                            <div>
                              <span className="block text-sm font-semibold">Razorpay Checkout</span>
                              <span className="block text-xs text-muted-foreground">UPI, Credit/Debit Cards, Netbanking, Wallets</span>
                            </div>
                          </div>
                          <Badge className="bg-blue-600 text-[10px] text-white hover:bg-blue-600">Fast &amp; Secure</Badge>
                        </label>

                        <div className="grid grid-cols-2 gap-2.5">
                          <label
                            className={`flex items-center gap-3 rounded-xl border p-3.5 cursor-pointer transition-all ${
                              method === "UPI" ? "border-primary bg-accent ring-1 ring-primary" : "border-border hover:bg-accent/40"
                            }`}
                          >
                            <RadioGroupItem value="UPI" id="upi" />
                            <Smartphone className="h-4 w-4" />
                            <span className="text-sm font-medium">Direct UPI</span>
                          </label>
                          <label
                            className={`flex items-center gap-3 rounded-xl border p-3.5 cursor-pointer transition-all ${
                              method === "Card" ? "border-primary bg-accent ring-1 ring-primary" : "border-border hover:bg-accent/40"
                            }`}
                          >
                            <RadioGroupItem value="Card" id="card" />
                            <CreditCard className="h-4 w-4" />
                            <span className="text-sm font-medium">Direct Card</span>
                          </label>
                        </div>
                      </RadioGroup>
                    </div>

                    {method === "Razorpay" ? (
                      <div className="space-y-2 rounded-xl border border-blue-200 bg-blue-50/60 p-4 dark:border-blue-900 dark:bg-blue-950/20">
                        <div className="flex items-center gap-2 text-xs font-semibold text-blue-700 dark:text-blue-400">
                          <Zap className="h-4 w-4 text-blue-600" />
                          <span>Mock Razorpay Gateway Active</span>
                        </div>
                        <p className="text-xs text-muted-foreground">
                          Clicking below will open the interactive Razorpay test payment modal with full support for UPI QR,
                          Cards, Netbanking, and Wallets.
                        </p>
                      </div>
                    ) : method === "UPI" ? (
                      <div className="space-y-2">
                        <Label htmlFor="upi-id">UPI ID</Label>
                        <Input
                          id="upi-id"
                          placeholder="yourname@gpay or yourname@paytm"
                          value={upiId}
                          onChange={(e) => {
                            setUpiId(e.target.value);
                            setUpiError("");
                          }}
                          required
                        />
                        {upiError && <p className="mt-1 text-xs text-destructive">{upiError}</p>}
                        <p className="text-xs text-muted-foreground">Accepted: @gpay, @paytm</p>
                      </div>
                    ) : (
                      <div className="grid gap-3 sm:grid-cols-2">
                        <div className="space-y-2 sm:col-span-2">
                          <Label htmlFor="cn">Card Number</Label>
                          <Input id="cn" placeholder="1234 5678 9012 3456" required maxLength={19} />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="exp">Expiry</Label>
                          <Input id="exp" placeholder="MM/YY" required maxLength={5} />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="cvv">CVV</Label>
                          <Input id="cvv" type="password" placeholder="•••" required maxLength={4} />
                        </div>
                      </div>
                    )}

                    <Button
                      type="submit"
                      size="lg"
                      className={`h-11 w-full text-base font-bold ${method === "Razorpay" ? "bg-blue-600 text-white shadow-md hover:bg-blue-700" : ""}`}
                      disabled={submitting}
                    >
                      {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                      {method === "Razorpay" ? `Pay via Razorpay (₹${amount.toLocaleString("en-IN")})` : "Confirm Payment"}
                    </Button>
                  </form>
                </CardContent>
              </Card>
            </div>
          )}
        </div>

        {/* Razorpay Mock Popup Modal */}
        <MockRazorpayModal
          isOpen={showRazorpayModal}
          onClose={() => setShowRazorpayModal(false)}
          amount={amount}
          eventName={event?.title || "Event Ticket"}
          userName={name}
          ticketType={ticket}
          onSuccess={handleRazorpaySuccess}
        />
      </PageTransition>
    </Layout>
  );
}

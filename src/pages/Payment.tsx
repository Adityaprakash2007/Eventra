import Layout from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { fetchEvent, createPayment } from "@/lib/api";
import { useQuery } from "@tanstack/react-query";
import { CreditCard, Smartphone, CheckCircle2, Loader2, Zap } from "lucide-react";
import { useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import MockRazorpayModal from "@/components/MockRazorpayModal";

export default function Payment() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
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

  const ALLOWED_UPI = ["gpay", "paytm"];

  const validateUpi = (id: string) => {
    const handle = id.split("@")[1]?.toLowerCase();
    return ALLOWED_UPI.includes(handle);
  };

  const handleRazorpaySuccess = async (paymentId: string) => {
    setShowRazorpayModal(false);
    setSubmitting(true);
    try {
      await createPayment({
        user: name,
        amount,
        method: "Razorpay",
        status: "Paid",
        registrationId: regId ? Number(regId) : undefined,
      });
      setDone(true);
      toast.success(`Payment verified! (ID: ${paymentId})`);
      setTimeout(() => navigate("/"), 1800);
    } catch (err: any) {
      toast.error(err.message || "Payment submission failed");
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
    if (method === "UPI") {
      if (!validateUpi(upiId)) {
        setUpiError("Only @gpay or @paytm UPI IDs are accepted.");
        return;
      }
    }
    setSubmitting(true);
    try {
      await createPayment({
        user: name,
        amount,
        method,
        status: "Paid",
        registrationId: regId ? Number(regId) : undefined,
      });
      setDone(true);
      toast.success("Payment confirmed!");
      setTimeout(() => navigate("/"), 1800);
    } catch (err: any) {
      toast.error(err.message || "Payment failed");
    } finally {
      setSubmitting(false);
    }
  };

  if (isLoading) {
    return <Layout><div className="flex justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div></Layout>;
  }

  return (
    <Layout>
      <div className="max-w-3xl mx-auto">
        <div className="mb-6">
          <h1 className="text-3xl font-bold tracking-tight">Checkout</h1>
          <p className="text-muted-foreground mt-1">Complete your payment to confirm your ticket.</p>
        </div>
        <div className="grid gap-5 md:grid-cols-5">
          <Card className="md:col-span-2 border-border/60 shadow-[var(--shadow-card)] h-fit">
            <CardHeader><CardTitle className="text-base">Order summary</CardTitle></CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div><p className="text-muted-foreground text-xs">Event</p><p className="font-medium">{event?.title ?? "—"}</p></div>
              <div><p className="text-muted-foreground text-xs">Attendee</p><p className="font-medium">{name}</p></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Ticket type</span><span className="font-medium">{ticket}</span></div>
              <Separator />
              <div className="flex justify-between text-base"><span className="font-medium">Total</span><span className="font-bold text-primary">₹{amount.toLocaleString()}</span></div>
            </CardContent>
          </Card>
          <Card className="md:col-span-3 border-border/60 shadow-[var(--shadow-card)]">
            <CardHeader><CardTitle className="text-base">Payment details</CardTitle></CardHeader>
            <CardContent>
              {done ? (
                <div className="flex flex-col items-center justify-center py-10 text-center">
                  <CheckCircle2 className="h-14 w-14 text-emerald-500 mb-3" />
                  <p className="text-lg font-semibold">Payment successful</p>
                  <p className="text-muted-foreground text-sm mt-1">Redirecting to dashboard…</p>
                </div>
              ) : (
                <form onSubmit={handlePay} className="space-y-5">
                  <div className="space-y-2"><Label htmlFor="amount">Amount</Label><Input id="amount" value={`₹${amount.toLocaleString()}`} readOnly /></div>
                  <div className="space-y-2">
                    <Label>Payment Gateway / Method</Label>
                    <RadioGroup value={method} onValueChange={(v) => setMethod(v as "Razorpay" | "UPI" | "Card")} className="grid grid-cols-1 gap-2.5">
                      <label className={`flex items-center justify-between rounded-xl border p-4 cursor-pointer transition-all ${method === "Razorpay" ? "border-blue-600 bg-blue-50/50 dark:bg-blue-950/20 ring-1 ring-blue-600" : "border-border hover:bg-accent/40"}`}>
                        <div className="flex items-center gap-3">
                          <RadioGroupItem value="Razorpay" id="razorpay" />
                          <div className="bg-blue-600 text-white font-extrabold text-xs px-2 py-1 rounded tracking-tighter">
                            <span className="text-sky-300">R</span>ZP
                          </div>
                          <div>
                            <span className="font-semibold text-sm block">Razorpay Checkout</span>
                            <span className="text-xs text-muted-foreground block">UPI, Credit/Debit Cards, Netbanking, Wallets</span>
                          </div>
                        </div>
                        <Badge className="bg-blue-600 hover:bg-blue-600 text-white text-[10px]">Fast & Secure</Badge>
                      </label>

                      <div className="grid grid-cols-2 gap-2.5">
                        <label className={`flex items-center gap-3 rounded-xl border p-3.5 cursor-pointer transition-all ${method === "UPI" ? "border-primary bg-accent ring-1 ring-primary" : "border-border hover:bg-accent/40"}`}>
                          <RadioGroupItem value="UPI" id="upi" /><Smartphone className="h-4 w-4" /><span className="font-medium text-sm">Direct UPI</span>
                        </label>
                        <label className={`flex items-center gap-3 rounded-xl border p-3.5 cursor-pointer transition-all ${method === "Card" ? "border-primary bg-accent ring-1 ring-primary" : "border-border hover:bg-accent/40"}`}>
                          <RadioGroupItem value="Card" id="card" /><CreditCard className="h-4 w-4" /><span className="font-medium text-sm">Direct Card</span>
                        </label>
                      </div>
                    </RadioGroup>
                  </div>

                  {method === "Razorpay" ? (
                    <div className="bg-blue-50/60 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-900 p-4 rounded-xl space-y-2">
                      <div className="flex items-center gap-2 text-xs font-semibold text-blue-700 dark:text-blue-400">
                        <Zap className="h-4 w-4 text-blue-600" />
                        <span>Mock Razorpay Gateway Active</span>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Clicking below will open the interactive Razorpay test payment modal with full support for UPI QR, Cards, Netbanking, and Wallets.
                      </p>
                    </div>
                  ) : method === "UPI" ? (
                    <div className="space-y-2">
                      <Label htmlFor="upi-id">UPI ID</Label>
                      <Input
                        id="upi-id"
                        placeholder="yourname@gpay or yourname@paytm"
                        value={upiId}
                        onChange={(e) => { setUpiId(e.target.value); setUpiError(""); }}
                        required
                      />
                      {upiError && (
                        <p className="text-xs text-destructive mt-1">{upiError}</p>
                      )}
                      <p className="text-xs text-muted-foreground">Accepted: @gpay, @paytm</p>
                    </div>
                  ) : (
                    <div className="grid gap-3 sm:grid-cols-2">
                      <div className="space-y-2 sm:col-span-2"><Label htmlFor="cn">Card Number</Label><Input id="cn" placeholder="1234 5678 9012 3456" required maxLength={19} /></div>
                      <div className="space-y-2"><Label htmlFor="exp">Expiry</Label><Input id="exp" placeholder="MM/YY" required maxLength={5} /></div>
                      <div className="space-y-2"><Label htmlFor="cvv">CVV</Label><Input id="cvv" type="password" placeholder="•••" required maxLength={4} /></div>
                    </div>
                  )}

                  <Button type="submit" size="lg" className={`w-full font-bold text-base h-11 ${method === "Razorpay" ? "bg-blue-600 hover:bg-blue-700 text-white shadow-md" : ""}`} disabled={submitting}>
                    {submitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                    {method === "Razorpay" ? `Pay via Razorpay (₹${amount.toLocaleString()})` : "Confirm Payment"}
                  </Button>
                </form>
              )}
            </CardContent>
          </Card>
        </div>
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
    </Layout>
  );
}


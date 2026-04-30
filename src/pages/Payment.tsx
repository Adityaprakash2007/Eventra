import Layout from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Separator } from "@/components/ui/separator";
import { fetchEvent, createPayment } from "@/lib/api";
import { useQuery } from "@tanstack/react-query";
import { CreditCard, Smartphone, CheckCircle2, Loader2 } from "lucide-react";
import { useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { toast } from "sonner";

export default function Payment() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const eventId = params.get("event");
  const ticket = (params.get("ticket") as "VIP" | "Regular") ?? "Regular";
  const name = params.get("name") ?? "Guest";

  const { data: event, isLoading } = useQuery({
    queryKey: ["event", eventId],
    queryFn: () => fetchEvent(eventId!),
    enabled: !!eventId,
  });

  const baseAmount = event?.price ?? 0;
  const amount = ticket === "VIP" ? baseAmount * 2 : baseAmount;
  const [method, setMethod] = useState<"UPI" | "Card">("UPI");
  const [done, setDone] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const handlePay = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await createPayment({ user: name, amount, method, status: "Paid" });
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
              <div className="flex justify-between text-base"><span className="font-medium">Total</span><span className="font-bold">₹{amount.toLocaleString()}</span></div>
            </CardContent>
          </Card>
          <Card className="md:col-span-3 border-border/60 shadow-[var(--shadow-card)]">
            <CardHeader><CardTitle className="text-base">Payment details</CardTitle></CardHeader>
            <CardContent>
              {done ? (
                <div className="flex flex-col items-center justify-center py-10 text-center">
                  <CheckCircle2 className="h-14 w-14 text-success mb-3" />
                  <p className="text-lg font-semibold">Payment successful</p>
                  <p className="text-muted-foreground text-sm mt-1">Redirecting to dashboard…</p>
                </div>
              ) : (
                <form onSubmit={handlePay} className="space-y-5">
                  <div className="space-y-2"><Label htmlFor="amount">Amount</Label><Input id="amount" value={`₹${amount.toLocaleString()}`} readOnly /></div>
                  <div className="space-y-2">
                    <Label>Payment Method</Label>
                    <RadioGroup value={method} onValueChange={(v) => setMethod(v as "UPI" | "Card")} className="grid grid-cols-2 gap-3">
                      <label className={`flex items-center gap-3 rounded-lg border p-4 cursor-pointer ${method === "UPI" ? "border-primary bg-accent" : "border-border"}`}>
                        <RadioGroupItem value="UPI" id="upi" /><Smartphone className="h-4 w-4" /><span className="font-medium text-sm">UPI</span>
                      </label>
                      <label className={`flex items-center gap-3 rounded-lg border p-4 cursor-pointer ${method === "Card" ? "border-primary bg-accent" : "border-border"}`}>
                        <RadioGroupItem value="Card" id="card" /><CreditCard className="h-4 w-4" /><span className="font-medium text-sm">Card</span>
                      </label>
                    </RadioGroup>
                  </div>
                  {method === "UPI" ? (
                    <div className="space-y-2"><Label htmlFor="upi-id">UPI ID</Label><Input id="upi-id" placeholder="name@bank" required /></div>
                  ) : (
                    <div className="grid gap-3 sm:grid-cols-2">
                      <div className="space-y-2 sm:col-span-2"><Label htmlFor="cn">Card Number</Label><Input id="cn" placeholder="1234 5678 9012 3456" required maxLength={19} /></div>
                      <div className="space-y-2"><Label htmlFor="exp">Expiry</Label><Input id="exp" placeholder="MM/YY" required maxLength={5} /></div>
                      <div className="space-y-2"><Label htmlFor="cvv">CVV</Label><Input id="cvv" type="password" placeholder="•••" required maxLength={4} /></div>
                    </div>
                  )}
                  <Button type="submit" size="lg" className="w-full" disabled={submitting}>
                    {submitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}Confirm Payment
                  </Button>
                </form>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </Layout>
  );
}

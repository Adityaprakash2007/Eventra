import React, { useState, useEffect } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  CreditCard,
  Smartphone,
  Building2,
  Wallet,
  ShieldCheck,
  CheckCircle2,
  XCircle,
  Loader2,
  Lock,
  QrCode,
  ArrowLeft,
  Sparkles,
  ExternalLink,
  Clock,
} from "lucide-react";
import { createPayment, fetchEvent } from "@/lib/api";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";

type RazorpayTab = "upi" | "card" | "netbanking" | "wallet";

export default function RazorpayCheckout() {
  const [params] = useSearchParams();
  const navigate = useNavigate();

  const eventId = params.get("event");
  const ticket = (params.get("ticket") as "VIP" | "Regular") ?? "Regular";
  const name = params.get("name") ?? "Guest";
  const regId = params.get("regId");
  const passedAmount = params.get("amount");

  const { data: event } = useQuery({
    queryKey: ["event", eventId],
    queryFn: () => fetchEvent(eventId!),
    enabled: !!eventId,
  });

  const baseAmount = event?.price ?? (passedAmount ? Number(passedAmount) : 0);
  const amount = ticket === "VIP" ? baseAmount * 2 : baseAmount;

  const orderId = `order_${Math.random().toString(36).substring(2, 10)}`;

  const [activeTab, setActiveTab] = useState<RazorpayTab>("upi");
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingStatus, setProcessingStatus] = useState("Securing gateway connection...");
  const [paymentSuccess, setPaymentSuccess] = useState(false);
  const [paymentFailed, setPaymentFailed] = useState(false);
  const [txId, setTxId] = useState("");
  const [timerSeconds, setTimerSeconds] = useState(899); // 14:59 mins

  // Inputs
  const [vpa, setVpa] = useState("user@razorpay");
  const [cardNumber, setCardNumber] = useState("4111 2222 3333 4444");
  const [cardExpiry, setCardExpiry] = useState("12/28");
  const [cardCvv, setCardCvv] = useState("123");
  const [cardName, setCardName] = useState(name || "Customer Name");
  const [selectedBank, setSelectedBank] = useState("HDFC");
  const [selectedWallet, setSelectedWallet] = useState("Paytm");

  // Timer countdown
  useEffect(() => {
    const interval = setInterval(() => {
      setTimerSeconds((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  const formatTimer = (sec: number) => {
    const mins = Math.floor(sec / 60);
    const s = sec % 60;
    return `${mins.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  };

  const popularBanks = [
    { id: "HDFC", name: "HDFC Bank", logo: "🏦" },
    { id: "ICICI", name: "ICICI Bank", logo: "🏛️" },
    { id: "SBI", name: "State Bank of India", logo: "🌐" },
    { id: "AXIS", name: "Axis Bank", logo: "🏢" },
    { id: "KOTAK", name: "Kotak Mahindra", logo: "🏧" },
  ];

  const popularWallets = [
    { id: "Paytm", name: "Paytm Wallet", logo: "📱" },
    { id: "AmazonPay", name: "Amazon Pay", logo: "🛒" },
    { id: "Mobikwik", name: "MobiKwik", logo: "⚡" },
    { id: "PhonePe", name: "PhonePe Wallet", logo: "🟣" },
  ];

  const handleExecutePayment = async (forceFail = false) => {
    setIsProcessing(true);
    setPaymentFailed(false);
    setProcessingStatus("Connecting to Razorpay Payments Network...");

    await new Promise((r) => setTimeout(r, 700));
    setProcessingStatus("Authorizing request with Issuing Bank...");

    await new Promise((r) => setTimeout(r, 900));

    if (forceFail) {
      setIsProcessing(false);
      setPaymentFailed(true);
      toast.error("Razorpay Mock Payment Failed!");
      return;
    }

    setProcessingStatus("Verifying 3D Secure / OTP...");
    await new Promise((r) => setTimeout(r, 700));

    const generatedTxId = `pay_${Math.random().toString(36).substring(2, 11)}${Math.random().toString(36).substring(2, 7)}`;
    setTxId(generatedTxId);

    // Call backend API
    try {
      await createPayment({
        user: name,
        amount,
        method: "Razorpay",
        status: "Paid",
        registrationId: regId ? Number(regId) : undefined,
      });

      setIsProcessing(false);
      setPaymentSuccess(true);
      toast.success("Payment Successful via Razorpay!");

      setTimeout(() => {
        navigate(`/?payment=success&tx=${generatedTxId}&event=${eventId || ""}`);
      }, 2000);
    } catch (err: any) {
      setIsProcessing(false);
      toast.error(err.message || "Failed to record payment in database");
    }
  };

  const handleCancel = () => {
    toast.info("Payment cancelled. Returned to EventFlow Hub.");
    navigate(`/payment?event=${eventId || ""}&ticket=${ticket}&name=${encodeURIComponent(name)}${regId ? `&regId=${regId}` : ""}`);
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-between font-sans selection:bg-blue-600 selection:text-white">
      {/* Top Simulated Hosted URL Bar */}
      <div className="bg-slate-900 border-b border-slate-800 px-4 py-2 flex items-center justify-between text-xs text-slate-400">
        <div className="flex items-center gap-2">
          <div className="flex gap-1.5">
            <div className="w-3 h-3 rounded-full bg-rose-500/80" />
            <div className="w-3 h-3 rounded-full bg-amber-500/80" />
            <div className="w-3 h-3 rounded-full bg-emerald-500/80" />
          </div>
          <div className="bg-slate-950 border border-slate-800 rounded-md px-3 py-1 flex items-center gap-2 text-slate-300 font-mono text-[11px] w-72 md:w-96 overflow-hidden text-ellipsis whitespace-nowrap">
            <Lock className="h-3 w-3 text-emerald-400 shrink-0" />
            <span className="text-emerald-400">https://</span>api.razorpay.com/v1/checkout/hosted/{orderId}
          </div>
        </div>
        <div className="flex items-center gap-3">
          <Badge className="bg-amber-400 text-slate-950 hover:bg-amber-400 font-bold text-[10px] px-2 py-0.5">
            TEST MODE
          </Badge>
          <span className="hidden sm:inline text-slate-500">256-Bit SSL Encrypted</span>
        </div>
      </div>

      {/* Main Hosted Gateway Container */}
      <div className="flex-1 flex items-center justify-center p-4 md:p-8">
        <div className="w-full max-w-4xl bg-white text-slate-900 rounded-2xl shadow-2xl overflow-hidden border border-slate-800 grid grid-cols-1 md:grid-cols-12">
          {/* Left Column - Order & Merchant Info */}
          <div className="md:col-span-5 bg-[#0c2340] text-white p-6 md:p-8 flex flex-col justify-between relative">
            <div>
              {/* Razorpay Brand Header */}
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-2">
                  <div className="bg-blue-600 px-2.5 py-1 rounded-lg flex items-center justify-center font-extrabold tracking-tighter text-white text-sm">
                    <span className="text-sky-300">R</span>ZP
                  </div>
                  <span className="font-bold tracking-tight text-xl">Razorpay</span>
                </div>
                <div className="flex items-center gap-1 text-slate-400 text-xs">
                  <Clock className="h-3.5 w-3.5 text-amber-400" />
                  <span className="font-mono">{formatTimer(timerSeconds)}</span>
                </div>
              </div>

              {/* Merchant Details */}
              <div className="space-y-4 pt-4 border-t border-slate-700/60">
                <div>
                  <p className="text-[11px] uppercase tracking-wider text-slate-400 font-semibold">Paying To</p>
                  <h2 className="text-xl font-bold text-white mt-0.5">EventFlow Hub</h2>
                  <p className="text-xs text-slate-300">Official Ticket Sales Gateway</p>
                </div>

                <div className="bg-slate-800/80 border border-slate-700/80 rounded-xl p-4 space-y-2">
                  <div className="flex justify-between text-xs text-slate-300">
                    <span>Event</span>
                    <span className="font-semibold text-white truncate max-w-[140px]">{event?.title || "Ticket Booking"}</span>
                  </div>
                  <div className="flex justify-between text-xs text-slate-300">
                    <span>Customer</span>
                    <span className="font-semibold text-white">{name}</span>
                  </div>
                  <div className="flex justify-between text-xs text-slate-300">
                    <span>Ticket Pass</span>
                    <span className="font-semibold text-sky-400">{ticket} Ticket</span>
                  </div>
                  <div className="flex justify-between text-xs text-slate-300">
                    <span>Order Reference</span>
                    <span className="font-mono text-[10px] text-slate-400">{orderId}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Total Amount & Cancel Option */}
            <div className="pt-6 border-t border-slate-700/60 mt-6">
              <div className="flex items-baseline justify-between mb-4">
                <span className="text-xs uppercase tracking-wider text-slate-400 font-semibold">Total Payable</span>
                <span className="text-3xl font-black text-sky-400">₹{amount.toLocaleString("en-IN")}</span>
              </div>

              <button
                type="button"
                onClick={handleCancel}
                className="w-full text-center text-xs text-slate-400 hover:text-white flex items-center justify-center gap-1.5 transition-colors py-2"
              >
                <ArrowLeft className="h-3.5 w-3.5" /> Cancel payment and return to merchant
              </button>
            </div>
          </div>

          {/* Right Column - Hosted Checkout Form */}
          <div className="md:col-span-7 bg-white p-6 md:p-8 flex flex-col justify-between">
            {isProcessing ? (
              <div className="my-auto py-12 px-4 flex flex-col items-center justify-center text-center space-y-4">
                <div className="relative flex items-center justify-center">
                  <div className="w-20 h-20 rounded-full border-4 border-blue-100 border-t-blue-600 animate-spin" />
                  <ShieldCheck className="h-9 w-9 text-blue-600 absolute" />
                </div>
                <h3 className="font-bold text-xl text-slate-900">Processing Payment</h3>
                <p className="text-sm text-slate-600 max-w-xs">{processingStatus}</p>
                <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 text-xs text-slate-500 max-w-xs mt-2">
                  🔒 Safe & encrypted session. Do not close or press back button.
                </div>
              </div>
            ) : paymentSuccess ? (
              <div className="my-auto py-10 px-4 flex flex-col items-center justify-center text-center space-y-4">
                <div className="w-20 h-20 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center shadow-lg shadow-emerald-500/20">
                  <CheckCircle2 className="h-12 w-12 animate-bounce" />
                </div>
                <h3 className="font-bold text-2xl text-slate-900">Payment Completed!</h3>
                <p className="text-sm text-slate-600">
                  Razorpay Transaction ID: <br />
                  <code className="bg-slate-100 px-3 py-1 rounded-md font-mono text-xs font-bold text-blue-700 mt-1 inline-block border border-slate-200">
                    {txId}
                  </code>
                </p>
                <p className="text-xs text-emerald-600 font-semibold animate-pulse pt-2">
                  ✓ Redirecting to EventFlow Hub in 2 seconds...
                </p>
              </div>
            ) : paymentFailed ? (
              <div className="my-auto py-10 px-4 flex flex-col items-center justify-center text-center space-y-4">
                <div className="w-20 h-20 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center">
                  <XCircle className="h-12 w-12" />
                </div>
                <h3 className="font-bold text-2xl text-slate-900">Payment Failed</h3>
                <p className="text-sm text-slate-500 max-w-xs">
                  The simulated issuing bank rejected the transaction request.
                </p>
                <div className="flex gap-3 pt-4 w-full max-w-xs">
                  <Button variant="outline" onClick={() => setPaymentFailed(false)} className="flex-1">
                    Try Again
                  </Button>
                  <Button onClick={() => handleExecutePayment(false)} className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-bold">
                    Retry Success
                  </Button>
                </div>
              </div>
            ) : (
              <div className="space-y-6">
                <div className="flex items-center justify-between pb-3 border-b border-slate-200">
                  <h3 className="font-bold text-lg text-slate-900">Select Payment Method</h3>
                  <Badge variant="outline" className="text-xs text-blue-600 border-blue-200 bg-blue-50">
                    Official Razorpay Gateway
                  </Badge>
                </div>

                {/* Tabs Header */}
                <div className="grid grid-cols-4 bg-slate-100 p-1 rounded-xl border border-slate-200">
                  <button
                    type="button"
                    onClick={() => setActiveTab("upi")}
                    className={`py-2 px-1 text-xs font-bold rounded-lg flex flex-col items-center gap-1 transition-all ${
                      activeTab === "upi" ? "bg-white text-blue-600 shadow-sm" : "text-slate-600 hover:text-slate-900"
                    }`}
                  >
                    <Smartphone className="h-4 w-4" />
                    <span>UPI / QR</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveTab("card")}
                    className={`py-2 px-1 text-xs font-bold rounded-lg flex flex-col items-center gap-1 transition-all ${
                      activeTab === "card" ? "bg-white text-blue-600 shadow-sm" : "text-slate-600 hover:text-slate-900"
                    }`}
                  >
                    <CreditCard className="h-4 w-4" />
                    <span>Card</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveTab("netbanking")}
                    className={`py-2 px-1 text-xs font-bold rounded-lg flex flex-col items-center gap-1 transition-all ${
                      activeTab === "netbanking" ? "bg-white text-blue-600 shadow-sm" : "text-slate-600 hover:text-slate-900"
                    }`}
                  >
                    <Building2 className="h-4 w-4" />
                    <span>Netbanking</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveTab("wallet")}
                    className={`py-2 px-1 text-xs font-bold rounded-lg flex flex-col items-center gap-1 transition-all ${
                      activeTab === "wallet" ? "bg-white text-blue-600 shadow-sm" : "text-slate-600 hover:text-slate-900"
                    }`}
                  >
                    <Wallet className="h-4 w-4" />
                    <span>Wallet</span>
                  </button>
                </div>

                {/* Tab Forms */}
                <div className="space-y-4">
                  {activeTab === "upi" && (
                    <div className="space-y-4">
                      <div className="bg-slate-50 border border-slate-200 p-4 rounded-2xl flex items-center gap-4">
                        <div className="bg-white p-2.5 border border-slate-200 rounded-xl shadow-xs flex items-center justify-center shrink-0">
                          <QrCode className="h-16 w-16 text-slate-900" />
                        </div>
                        <div>
                          <h4 className="font-bold text-sm text-slate-900">Scan & Pay via any UPI App</h4>
                          <p className="text-xs text-slate-500 mt-0.5">Google Pay, PhonePe, Paytm, BHIM</p>
                          <span className="inline-block mt-2 text-[10px] font-bold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full">
                            ⚡ Instant Auto Approval
                          </span>
                        </div>
                      </div>

                      <div>
                        <Label className="text-xs text-slate-600 font-medium">Or enter VPA / UPI ID</Label>
                        <Input
                          value={vpa}
                          onChange={(e) => setVpa(e.target.value)}
                          placeholder="username@bank"
                          className="mt-1 text-sm h-10"
                        />
                      </div>
                    </div>
                  )}

                  {activeTab === "card" && (
                    <div className="space-y-3">
                      <div>
                        <Label className="text-xs text-slate-600 font-medium">Card Number</Label>
                        <Input
                          value={cardNumber}
                          onChange={(e) => setCardNumber(e.target.value)}
                          placeholder="4111 2222 3333 4444"
                          className="mt-1 font-mono text-sm h-10"
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <Label className="text-xs text-slate-600 font-medium">Expiry (MM/YY)</Label>
                          <Input
                            value={cardExpiry}
                            onChange={(e) => setCardExpiry(e.target.value)}
                            placeholder="12/28"
                            className="mt-1 font-mono text-sm h-10"
                          />
                        </div>
                        <div>
                          <Label className="text-xs text-slate-600 font-medium">CVV</Label>
                          <Input
                            type="password"
                            maxLength={4}
                            value={cardCvv}
                            onChange={(e) => setCardCvv(e.target.value)}
                            placeholder="•••"
                            className="mt-1 font-mono text-sm h-10"
                          />
                        </div>
                      </div>
                      <div>
                        <Label className="text-xs text-slate-600 font-medium">Cardholder Name</Label>
                        <Input
                          value={cardName}
                          onChange={(e) => setCardName(e.target.value)}
                          placeholder="Name on card"
                          className="mt-1 text-sm h-10"
                        />
                      </div>
                    </div>
                  )}

                  {activeTab === "netbanking" && (
                    <div className="space-y-3">
                      <Label className="text-xs text-slate-600 font-medium">Select Popular Bank</Label>
                      <div className="grid grid-cols-1 gap-2">
                        {popularBanks.map((b) => (
                          <button
                            key={b.id}
                            type="button"
                            onClick={() => setSelectedBank(b.id)}
                            className={`flex items-center justify-between p-3 rounded-xl border text-sm font-semibold transition-all ${
                              selectedBank === b.id
                                ? "border-blue-600 bg-blue-50 text-blue-700"
                                : "border-slate-200 hover:bg-slate-50 text-slate-700"
                            }`}
                          >
                            <span className="flex items-center gap-2.5">
                              <span className="text-lg">{b.logo}</span>
                              {b.name}
                            </span>
                            {selectedBank === b.id && <CheckCircle2 className="h-5 w-5 text-blue-600" />}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {activeTab === "wallet" && (
                    <div className="space-y-3">
                      <Label className="text-xs text-slate-600 font-medium">Select Wallet Provider</Label>
                      <div className="grid grid-cols-2 gap-2.5">
                        {popularWallets.map((w) => (
                          <button
                            key={w.id}
                            type="button"
                            onClick={() => setSelectedWallet(w.id)}
                            className={`flex items-center gap-2.5 p-3 rounded-xl border text-xs font-semibold transition-all ${
                              selectedWallet === w.id
                                ? "border-blue-600 bg-blue-50 text-blue-700"
                                : "border-slate-200 hover:bg-slate-50 text-slate-700"
                            }`}
                          >
                            <span className="text-lg">{w.logo}</span>
                            {w.name}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {/* Primary Payment Action */}
                <Button
                  onClick={() => handleExecutePayment(false)}
                  className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold h-12 text-base shadow-lg shadow-blue-600/30 transition-all rounded-xl mt-2"
                >
                  Pay ₹{amount.toLocaleString("en-IN")} Now
                </Button>

                {/* Simulator Options */}
                <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
                  <span className="flex items-center gap-1 font-semibold text-slate-700">
                    <Sparkles className="h-3.5 w-3.5 text-amber-500" /> Gateway Simulator Controls
                  </span>
                  <button
                    type="button"
                    onClick={() => handleExecutePayment(true)}
                    className="text-rose-600 hover:underline font-bold"
                  >
                    Simulate Failure
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Footer */}
      <footer className="bg-slate-900 border-t border-slate-800 py-3 text-center text-xs text-slate-500">
        Secured by Razorpay Payment Gateway • PCI-DSS Compliant • 256-Bit SSL
      </footer>
    </div>
  );
}

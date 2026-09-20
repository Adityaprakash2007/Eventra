import React, { useState } from "react";
import {
  Dialog,
  DialogContent,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
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
  X,
  Sparkles,
} from "lucide-react";
import { toast } from "sonner";

interface MockRazorpayModalProps {
  isOpen: boolean;
  onClose: () => void;
  amount: number;
  eventName: string;
  userName: string;
  ticketType: string;
  onSuccess: (paymentId: string) => void;
  onFailure?: (error: string) => void;
}

type RazorpayTab = "upi" | "card" | "netbanking" | "wallet";

export default function MockRazorpayModal({
  isOpen,
  onClose,
  amount,
  eventName,
  userName,
  ticketType,
  onSuccess,
  onFailure,
}: MockRazorpayModalProps) {
  const [activeTab, setActiveTab] = useState<RazorpayTab>("upi");
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingStatus, setProcessingStatus] = useState("Securing connection...");
  const [paymentSuccess, setPaymentSuccess] = useState(false);
  const [paymentFailed, setPaymentFailed] = useState(false);
  const [txId, setTxId] = useState("");

  // Form states
  const [vpa, setVpa] = useState("user@razorpay");
  const [cardNumber, setCardNumber] = useState("4111 2222 3333 4444");
  const [cardExpiry, setCardExpiry] = useState("12/28");
  const [cardCvv, setCardCvv] = useState("123");
  const [cardName, setCardName] = useState(userName || "Test User");
  const [selectedBank, setSelectedBank] = useState("HDFC");
  const [selectedWallet, setSelectedWallet] = useState("Paytm");

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

  const executePayment = async (forceFail = false) => {
    setIsProcessing(true);
    setPaymentFailed(false);
    setProcessingStatus("Connecting to Razorpay Servers...");

    await new Promise((r) => setTimeout(r, 600));
    setProcessingStatus("Authorizing transaction with Bank...");

    await new Promise((r) => setTimeout(r, 800));

    if (forceFail) {
      setIsProcessing(false);
      setPaymentFailed(true);
      if (onFailure) onFailure("Payment declined by issuing bank (Mock)");
      toast.error("Razorpay Mock Payment Failed");
      return;
    }

    setProcessingStatus("Verifying 3D Secure / OTP...");
    await new Promise((r) => setTimeout(r, 600));

    const generatedId = `pay_${Math.random().toString(36).substring(2, 11)}${Math.random().toString(36).substring(2, 7)}`;
    setTxId(generatedId);
    setIsProcessing(false);
    setPaymentSuccess(true);

    toast.success("Payment Authorized via Razorpay!");

    setTimeout(() => {
      onSuccess(generatedId);
    }, 1200);
  };

  const handleReset = () => {
    setIsProcessing(false);
    setPaymentSuccess(false);
    setPaymentFailed(false);
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && handleReset()}>
      <DialogContent className="max-w-md p-0 overflow-hidden border-0 shadow-2xl rounded-2xl bg-white text-slate-900 font-sans">
        {/* Header - Razorpay Dark Blue */}
        <div className="bg-[#0c2340] text-white p-5 relative">
          <button
            onClick={handleReset}
            className="absolute top-4 right-4 text-slate-400 hover:text-white transition-colors"
          >
            <X className="h-5 w-5" />
          </button>

          <div className="flex items-center gap-2 mb-3">
            <div className="bg-blue-600 px-2 py-1 rounded flex items-center justify-center font-extrabold tracking-tighter text-white text-xs">
              <span className="text-sky-300">R</span>ZP
            </div>
            <span className="font-bold tracking-tight text-lg">Razorpay</span>
            <Badge className="bg-amber-400 text-slate-900 hover:bg-amber-400 font-semibold text-[10px] ml-auto px-2 py-0.5">
              TEST MODE
            </Badge>
          </div>

          <div className="flex justify-between items-end mt-4 pt-3 border-t border-slate-700/60">
            <div>
              <p className="text-[11px] text-slate-400 uppercase tracking-wider font-medium">Merchant</p>
              <h3 className="font-semibold text-white text-base leading-tight">EventFlow Hub</h3>
              <p className="text-xs text-slate-300 mt-0.5">{eventName} ({ticketType})</p>
            </div>
            <div className="text-right">
              <p className="text-[11px] text-slate-400 uppercase tracking-wider font-medium">Amount</p>
              <p className="text-2xl font-black text-sky-400">₹{amount.toLocaleString("en-IN")}</p>
            </div>
          </div>
        </div>

        {/* Content Area */}
        {isProcessing ? (
          <div className="py-12 px-6 flex flex-col items-center justify-center text-center space-y-4">
            <div className="relative flex items-center justify-center">
              <div className="w-16 h-16 rounded-full border-4 border-blue-100 border-t-blue-600 animate-spin" />
              <ShieldCheck className="h-7 w-7 text-blue-600 absolute" />
            </div>
            <h4 className="font-bold text-lg text-slate-800">Processing Payment</h4>
            <p className="text-sm text-slate-500 max-w-xs">{processingStatus}</p>
            <p className="text-xs text-slate-400 pt-2">Please do not refresh or close this modal</p>
          </div>
        ) : paymentSuccess ? (
          <div className="py-10 px-6 flex flex-col items-center justify-center text-center space-y-3">
            <div className="w-16 h-16 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center">
              <CheckCircle2 className="h-10 w-10 animate-bounce" />
            </div>
            <h4 className="font-bold text-xl text-slate-900">Payment Successful!</h4>
            <p className="text-sm text-slate-600">
              Payment ID: <code className="bg-slate-100 px-2 py-0.5 rounded font-mono text-xs font-semibold text-blue-700">{txId}</code>
            </p>
            <p className="text-xs text-emerald-600 font-medium">Redirecting back to EventFlow...</p>
          </div>
        ) : paymentFailed ? (
          <div className="py-10 px-6 flex flex-col items-center justify-center text-center space-y-3">
            <div className="w-16 h-16 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center">
              <XCircle className="h-10 w-10" />
            </div>
            <h4 className="font-bold text-xl text-slate-900">Payment Failed</h4>
            <p className="text-sm text-slate-500">The mock bank declined this transaction.</p>
            <div className="flex gap-3 pt-4 w-full">
              <Button variant="outline" onClick={() => setPaymentFailed(false)} className="flex-1">
                Try Again
              </Button>
              <Button onClick={() => executePayment(false)} className="flex-1 bg-blue-600 hover:bg-blue-700">
                Retry Success
              </Button>
            </div>
          </div>
        ) : (
          <div>
            {/* Payment Method Selector Tabs */}
            <div className="grid grid-cols-4 bg-slate-100 p-1 border-b border-slate-200">
              <button
                type="button"
                onClick={() => setActiveTab("upi")}
                className={`py-2 px-1 text-xs font-semibold rounded-lg flex flex-col items-center gap-1 transition-all ${
                  activeTab === "upi" ? "bg-white text-blue-600 shadow-sm" : "text-slate-600 hover:text-slate-900"
                }`}
              >
                <Smartphone className="h-4 w-4" />
                <span>UPI / QR</span>
              </button>
              <button
                type="button"
                onClick={() => setActiveTab("card")}
                className={`py-2 px-1 text-xs font-semibold rounded-lg flex flex-col items-center gap-1 transition-all ${
                  activeTab === "card" ? "bg-white text-blue-600 shadow-sm" : "text-slate-600 hover:text-slate-900"
                }`}
              >
                <CreditCard className="h-4 w-4" />
                <span>Card</span>
              </button>
              <button
                type="button"
                onClick={() => setActiveTab("netbanking")}
                className={`py-2 px-1 text-xs font-semibold rounded-lg flex flex-col items-center gap-1 transition-all ${
                  activeTab === "netbanking" ? "bg-white text-blue-600 shadow-sm" : "text-slate-600 hover:text-slate-900"
                }`}
              >
                <Building2 className="h-4 w-4" />
                <span>Netbanking</span>
              </button>
              <button
                type="button"
                onClick={() => setActiveTab("wallet")}
                className={`py-2 px-1 text-xs font-semibold rounded-lg flex flex-col items-center gap-1 transition-all ${
                  activeTab === "wallet" ? "bg-white text-blue-600 shadow-sm" : "text-slate-600 hover:text-slate-900"
                }`}
              >
                <Wallet className="h-4 w-4" />
                <span>Wallet</span>
              </button>
            </div>

            {/* Tab Body */}
            <div className="p-5 space-y-4">
              {activeTab === "upi" && (
                <div className="space-y-4">
                  <div className="bg-slate-50 border border-slate-200 p-3 rounded-xl flex items-center gap-4">
                    <div className="bg-white p-2 border border-slate-200 rounded-lg shadow-xs flex items-center justify-center">
                      <QrCode className="h-14 w-14 text-slate-800" />
                    </div>
                    <div>
                      <h5 className="font-semibold text-xs text-slate-800 uppercase tracking-wide">Scan & Pay via any UPI App</h5>
                      <p className="text-[11px] text-slate-500 mt-0.5">GPay, PhonePe, Paytm, BHIM</p>
                      <Badge variant="outline" className="mt-1 text-[10px] border-emerald-500 text-emerald-600 bg-emerald-50">
                        ⚡ Instant Approval
                      </Badge>
                    </div>
                  </div>

                  <div>
                    <Label className="text-xs text-slate-600">Or enter VPA / UPI ID</Label>
                    <Input
                      value={vpa}
                      onChange={(e) => setVpa(e.target.value)}
                      placeholder="username@bank"
                      className="mt-1 h-9 text-sm"
                    />
                  </div>
                </div>
              )}

              {activeTab === "card" && (
                <div className="space-y-3">
                  <div>
                    <Label className="text-xs text-slate-600">Card Number</Label>
                    <Input
                      value={cardNumber}
                      onChange={(e) => setCardNumber(e.target.value)}
                      placeholder="4111 2222 3333 4444"
                      className="mt-1 h-9 text-sm font-mono"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label className="text-xs text-slate-600">Expiry (MM/YY)</Label>
                      <Input
                        value={cardExpiry}
                        onChange={(e) => setCardExpiry(e.target.value)}
                        placeholder="12/28"
                        className="mt-1 h-9 text-sm font-mono"
                      />
                    </div>
                    <div>
                      <Label className="text-xs text-slate-600">CVV</Label>
                      <Input
                        type="password"
                        maxLength={4}
                        value={cardCvv}
                        onChange={(e) => setCardCvv(e.target.value)}
                        placeholder="•••"
                        className="mt-1 h-9 text-sm font-mono"
                      />
                    </div>
                  </div>
                  <div>
                    <Label className="text-xs text-slate-600">Cardholder Name</Label>
                    <Input
                      value={cardName}
                      onChange={(e) => setCardName(e.target.value)}
                      placeholder="Name on card"
                      className="mt-1 h-9 text-sm"
                    />
                  </div>
                </div>
              )}

              {activeTab === "netbanking" && (
                <div className="space-y-3">
                  <Label className="text-xs text-slate-600">Select Popular Bank</Label>
                  <div className="grid grid-cols-1 gap-2">
                    {popularBanks.map((b) => (
                      <button
                        key={b.id}
                        type="button"
                        onClick={() => setSelectedBank(b.id)}
                        className={`flex items-center justify-between p-2.5 rounded-lg border text-sm font-medium transition-all ${
                          selectedBank === b.id
                            ? "border-blue-600 bg-blue-50/70 text-blue-700"
                            : "border-slate-200 hover:bg-slate-50 text-slate-700"
                        }`}
                      >
                        <span className="flex items-center gap-2">
                          <span className="text-base">{b.logo}</span>
                          {b.name}
                        </span>
                        {selectedBank === b.id && <CheckCircle2 className="h-4 w-4 text-blue-600" />}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {activeTab === "wallet" && (
                <div className="space-y-3">
                  <Label className="text-xs text-slate-600">Select Wallet</Label>
                  <div className="grid grid-cols-2 gap-2">
                    {popularWallets.map((w) => (
                      <button
                        key={w.id}
                        type="button"
                        onClick={() => setSelectedWallet(w.id)}
                        className={`flex items-center gap-2.5 p-3 rounded-lg border text-xs font-medium transition-all ${
                          selectedWallet === w.id
                            ? "border-blue-600 bg-blue-50/70 text-blue-700"
                            : "border-slate-200 hover:bg-slate-50 text-slate-700"
                        }`}
                      >
                        <span className="text-base">{w.logo}</span>
                        {w.name}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Main Pay Button */}
              <Button
                onClick={() => executePayment(false)}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold h-11 text-base shadow-md transition-all rounded-xl"
              >
                Pay ₹{amount.toLocaleString("en-IN")}
              </Button>

              {/* Simulation Helper Actions */}
              <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500">
                <span className="flex items-center gap-1 font-medium text-slate-600">
                  <Sparkles className="h-3 w-3 text-amber-500" /> Razorpay Test Suite
                </span>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => executePayment(true)}
                    className="text-rose-600 hover:underline font-semibold"
                  >
                    Simulate Fail
                  </button>
                </div>
              </div>

              {/* Secure Footer */}
              <div className="flex items-center justify-center gap-1.5 text-slate-400 text-[10px] pt-1">
                <Lock className="h-3 w-3" />
                <span>Secured by 256-Bit Razorpay SSL Encryption</span>
              </div>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

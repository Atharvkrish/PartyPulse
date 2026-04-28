import { useState, useRef } from "react";
import { useLocation } from "wouter";
import { useToast } from "@/hooks/use-toast";
import {
  loginWithEmail,
  registerWithEmail,
  setupRecaptcha,
  sendPhoneOtp,
  verifyPhoneOtp,
} from "@/lib/firebaseAuth";
import { ConfirmationResult } from "firebase/auth";

type Tab = "email" | "phone";
type EmailMode = "login" | "register";

export default function Login() {
  const [tab, setTab] = useState<Tab>("email");
  const [emailMode, setEmailMode] = useState<EmailMode>("login");
  const [loading, setLoading] = useState(false);
  const [phoneStep, setPhoneStep] = useState<"phone" | "otp">("phone");
  const [confirmResult, setConfirmResult] = useState<ConfirmationResult | null>(null);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [phone, setPhone] = useState("");
  const [otp, setOtp] = useState("");

  const recaptchaRef = useRef<HTMLDivElement>(null);
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  async function handleEmailSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      if (emailMode === "login") {
        await loginWithEmail(email, password);
      } else {
        await registerWithEmail(email, password, displayName);
      }
      setLocation("/");
    } catch (err: unknown) {
      toast({ title: "Error", description: (err as Error).message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }

  async function handleSendOtp(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      const appVerifier = setupRecaptcha("recaptcha-container");
      const result = await sendPhoneOtp(phone, appVerifier);
      setConfirmResult(result);
      setPhoneStep("otp");
      toast({ title: "OTP sent", description: "Check your phone for the code." });
    } catch (err: unknown) {
      toast({ title: "Error", description: (err as Error).message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }

  async function handleVerifyOtp(e: React.FormEvent) {
    e.preventDefault();
    if (!confirmResult) return;
    setLoading(true);
    try {
      await verifyPhoneOtp(confirmResult.verificationId, otp);
      setLocation("/");
    } catch (err: unknown) {
      toast({ title: "Invalid OTP", description: (err as Error).message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div id="recaptcha-container" ref={recaptchaRef} />
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <h1 className="text-4xl font-black tracking-tight text-foreground">
            Party<span className="text-primary">Pulse</span>
          </h1>
          <p className="mt-2 text-muted-foreground text-sm">Find your night. Create your moment.</p>
        </div>

        <div className="bg-card border border-border rounded-xl p-6 shadow-xl">
          <div className="flex border border-border rounded-lg overflow-hidden mb-6">
            <button
              data-testid="tab-email"
              onClick={() => setTab("email")}
              className={`flex-1 py-2 text-sm font-medium transition-colors ${tab === "email" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}
            >
              Email
            </button>
            <button
              data-testid="tab-phone"
              onClick={() => setTab("phone")}
              className={`flex-1 py-2 text-sm font-medium transition-colors ${tab === "phone" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}
            >
              Phone
            </button>
          </div>

          {tab === "email" && (
            <form onSubmit={handleEmailSubmit} className="space-y-4">
              {emailMode === "register" && (
                <div>
                  <label className="block text-xs font-medium text-muted-foreground mb-1">Display Name</label>
                  <input
                    data-testid="input-display-name"
                    type="text"
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    required
                    className="w-full bg-input border border-border rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                    placeholder="Your name"
                  />
                </div>
              )}
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1">Email</label>
                <input
                  data-testid="input-email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="w-full bg-input border border-border rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                  placeholder="you@example.com"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1">Password</label>
                <input
                  data-testid="input-password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="w-full bg-input border border-border rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                  placeholder="••••••••"
                />
              </div>
              <button
                data-testid="button-email-submit"
                type="submit"
                disabled={loading}
                className="w-full bg-primary text-primary-foreground rounded-lg py-2.5 font-semibold text-sm hover:opacity-90 transition-opacity disabled:opacity-50"
              >
                {loading ? "..." : emailMode === "login" ? "Sign In" : "Create Account"}
              </button>
              <p className="text-center text-xs text-muted-foreground">
                {emailMode === "login" ? "No account?" : "Already have one?"}{" "}
                <button
                  type="button"
                  onClick={() => setEmailMode(emailMode === "login" ? "register" : "login")}
                  className="text-primary hover:underline"
                >
                  {emailMode === "login" ? "Sign up" : "Sign in"}
                </button>
              </p>
            </form>
          )}

          {tab === "phone" && phoneStep === "phone" && (
            <form onSubmit={handleSendOtp} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1">Phone Number</label>
                <input
                  data-testid="input-phone"
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  required
                  className="w-full bg-input border border-border rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                  placeholder="+1 555 000 0000"
                />
              </div>
              <button
                data-testid="button-send-otp"
                type="submit"
                disabled={loading}
                className="w-full bg-primary text-primary-foreground rounded-lg py-2.5 font-semibold text-sm hover:opacity-90 transition-opacity disabled:opacity-50"
              >
                {loading ? "Sending..." : "Send Code"}
              </button>
            </form>
          )}

          {tab === "phone" && phoneStep === "otp" && (
            <form onSubmit={handleVerifyOtp} className="space-y-4">
              <p className="text-sm text-muted-foreground text-center">Enter the 6-digit code sent to {phone}</p>
              <input
                data-testid="input-otp"
                type="text"
                value={otp}
                onChange={(e) => setOtp(e.target.value)}
                required
                maxLength={6}
                className="w-full bg-input border border-border rounded-lg px-3 py-2 text-sm text-foreground text-center tracking-widest placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                placeholder="000000"
              />
              <button
                data-testid="button-verify-otp"
                type="submit"
                disabled={loading}
                className="w-full bg-primary text-primary-foreground rounded-lg py-2.5 font-semibold text-sm hover:opacity-90 transition-opacity disabled:opacity-50"
              >
                {loading ? "Verifying..." : "Verify Code"}
              </button>
              <button type="button" onClick={() => setPhoneStep("phone")} className="w-full text-xs text-muted-foreground hover:text-foreground">
                Back
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}

import { useState, useRef, useEffect } from "react";
import { useLocation, useSearch } from "wouter";
import { useToast } from "@/hooks/use-toast";
import {
  loginWithEmail,
  registerWithEmail,
  setupRecaptcha,
  sendPhoneOtp,
} from "@/lib/firebaseAuth";
import { RecaptchaVerifier, ConfirmationResult } from "firebase/auth";

type Tab = "email" | "phone";
type EmailMode = "login" | "register";

function friendlyError(err: unknown): string {
  const msg = (err as Error).message ?? String(err);
  if (msg.includes("user-not-found") || msg.includes("invalid-credential"))
    return "No account found with those details. Check your email or sign up.";
  if (msg.includes("wrong-password")) return "Incorrect password.";
  if (msg.includes("email-already-in-use")) return "An account with that email already exists.";
  if (msg.includes("weak-password")) return "Password must be at least 6 characters.";
  if (msg.includes("invalid-phone-number"))
    return "Invalid phone number. Use international format: +353 89 123 4567";
  if (msg.includes("too-many-requests")) return "Too many attempts — please try again later.";
  if (msg.includes("invalid-verification-code")) return "Wrong code. Double-check and try again.";
  if (msg.includes("quota-exceeded")) return "SMS quota exceeded. Try email sign-in instead.";
  return msg;
}

export default function Login() {
  const search = useSearch();
  const defaultMode: EmailMode = search.includes("mode=register") ? "register" : "login";

  const [tab, setTab] = useState<Tab>("email");
  const [emailMode, setEmailMode] = useState<EmailMode>(defaultMode);
  const [loading, setLoading] = useState(false);
  const [phoneStep, setPhoneStep] = useState<"phone" | "otp">("phone");
  const [confirmResult, setConfirmResult] = useState<ConfirmationResult | null>(null);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [phone, setPhone] = useState("");
  const [otp, setOtp] = useState("");

  // Persist the RecaptchaVerifier across retries — creating a new one on the
  // same container element causes Firebase to throw an internal-error.
  const recaptchaVerifierRef = useRef<RecaptchaVerifier | null>(null);

  const [, setLocation] = useLocation();
  const { toast } = useToast();

  // Sync emailMode if URL changes
  useEffect(() => {
    if (search.includes("mode=register")) setEmailMode("register");
  }, [search]);

  function clearRecaptcha() {
    try { recaptchaVerifierRef.current?.clear(); } catch { /* ignore */ }
    recaptchaVerifierRef.current = null;
  }

  async function handleEmailSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      if (emailMode === "login") {
        await loginWithEmail(email, password);
      } else {
        await registerWithEmail(email, password, displayName);
      }
      localStorage.setItem("pp_onboarding_done", "1");
      setLocation("/");
    } catch (err: unknown) {
      toast({ title: "Sign-in failed", description: friendlyError(err), variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }

  async function handleSendOtp(e: React.FormEvent) {
    e.preventDefault();
    // Normalise: if user forgot +, prepend +353 (Ireland) as default
    let normalised = phone.trim();
    if (normalised && !normalised.startsWith("+")) normalised = "+353" + normalised.replace(/^0/, "");

    setLoading(true);
    try {
      // Create verifier once; re-use on retries
      if (!recaptchaVerifierRef.current) {
        recaptchaVerifierRef.current = setupRecaptcha("recaptcha-container");
      }
      const result = await sendPhoneOtp(normalised, recaptchaVerifierRef.current);
      setConfirmResult(result);
      setPhoneStep("otp");
      toast({ title: "Code sent!", description: `Check your messages on ${normalised}` });
    } catch (err: unknown) {
      // On failure clear the verifier so next attempt can create a fresh one
      clearRecaptcha();
      toast({ title: "Failed to send code", description: friendlyError(err), variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }

  async function handleVerifyOtp(e: React.FormEvent) {
    e.preventDefault();
    if (!confirmResult) return;
    setLoading(true);
    try {
      await confirmResult.confirm(otp);
      clearRecaptcha();
      localStorage.setItem("pp_onboarding_done", "1");
      setLocation("/");
    } catch (err: unknown) {
      toast({ title: "Verification failed", description: friendlyError(err), variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }

  function resetPhone() {
    setPhoneStep("phone");
    setOtp("");
    clearRecaptcha();
  }

  const inputCls =
    "w-full bg-input border border-border rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary";

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      {/* Invisible recaptcha container — must always be in the DOM */}
      <div id="recaptcha-container" />

      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <h1 className="text-4xl font-black tracking-tight text-foreground">
            Party<span className="text-primary">Pulse</span>
          </h1>
          <p className="mt-2 text-muted-foreground text-sm">Find your night. Create your moment.</p>
        </div>

        <div className="bg-card border border-border rounded-xl p-6 shadow-xl">
          {/* Tab switcher */}
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
              onClick={() => { setTab("phone"); resetPhone(); }}
              className={`flex-1 py-2 text-sm font-medium transition-colors ${tab === "phone" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}
            >
              Phone
            </button>
          </div>

          {/* ── Email ── */}
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
                    className={inputCls}
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
                  className={inputCls}
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
                  className={inputCls}
                  placeholder="••••••••"
                />
              </div>
              <button
                data-testid="button-email-submit"
                type="submit"
                disabled={loading}
                className="w-full bg-primary text-primary-foreground rounded-lg py-3 font-semibold text-sm hover:opacity-90 transition-opacity disabled:opacity-50"
              >
                {loading ? "Please wait…" : emailMode === "login" ? "Sign In" : "Create Account"}
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

          {/* ── Phone: enter number ── */}
          {tab === "phone" && phoneStep === "phone" && (
            <form onSubmit={handleSendOtp} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1">
                  Phone Number
                </label>
                <input
                  data-testid="input-phone"
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  required
                  className={inputCls}
                  placeholder="+353 89 123 4567"
                />
                <p className="mt-1 text-xs text-muted-foreground">
                  Include country code (e.g. +353 for Ireland, +44 for UK).
                  Irish numbers without + will auto-prefix +353.
                </p>
              </div>
              <button
                data-testid="button-send-otp"
                type="submit"
                disabled={loading}
                className="w-full bg-primary text-primary-foreground rounded-lg py-3 font-semibold text-sm hover:opacity-90 transition-opacity disabled:opacity-50"
              >
                {loading ? "Sending…" : "Send Code"}
              </button>
            </form>
          )}

          {/* ── Phone: enter OTP ── */}
          {tab === "phone" && phoneStep === "otp" && (
            <form onSubmit={handleVerifyOtp} className="space-y-4">
              <p className="text-sm text-muted-foreground text-center">
                Enter the 6-digit code sent to{" "}
                <span className="text-foreground font-medium">{phone}</span>
              </p>
              <input
                data-testid="input-otp"
                type="text"
                inputMode="numeric"
                value={otp}
                onChange={(e) => setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))}
                required
                maxLength={6}
                className={`${inputCls} text-center tracking-[0.5em] text-lg font-bold`}
                placeholder="000000"
                autoFocus
              />
              <button
                data-testid="button-verify-otp"
                type="submit"
                disabled={loading || otp.length < 6}
                className="w-full bg-primary text-primary-foreground rounded-lg py-3 font-semibold text-sm hover:opacity-90 transition-opacity disabled:opacity-50"
              >
                {loading ? "Verifying…" : "Verify Code"}
              </button>
              <button
                type="button"
                onClick={resetPhone}
                className="w-full text-xs text-muted-foreground hover:text-foreground"
              >
                ← Wrong number? Go back
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}

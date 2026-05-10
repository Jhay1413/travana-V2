import { useEffect, useMemo, useState } from "react";
import { useLocation } from "wouter";
import { Plane, Mail, Loader2, CheckCircle2, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import axiosClient from "@/api/client/axios-client";

const COOLDOWN_MS = 60_000;
const cooldownKey = (email: string) => `verify-email-resent-at:${email.toLowerCase()}`;

function readCooldownExpiry(email: string): number {
  if (!email) return 0;
  const raw = localStorage.getItem(cooldownKey(email));
  if (!raw) return 0;
  const sentAt = Number(raw);
  if (!Number.isFinite(sentAt)) return 0;
  return sentAt + COOLDOWN_MS;
}

type ConfirmStatus = "loading" | "success" | "error";

function VerifyEmailConfirm({ token }: { token: string }) {
  const [, setLocation] = useLocation();
  const [status, setStatus] = useState<ConfirmStatus>("loading");
  const [message, setMessage] = useState("");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { data } = await axiosClient.get("/api/v2/onboarding/verify-email", {
          params: { token },
        });
        if (cancelled) return;
        setStatus("success");
        setMessage(data?.message ?? "Your email has been verified. You can now sign in.");
      } catch (err: any) {
        if (cancelled) return;
        setStatus("error");
        setMessage(
          err?.response?.data?.message ?? err?.message ?? "Verification link is invalid or expired.",
        );
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [token]);

  return (
    <div className="min-h-screen bg-black text-white flex items-center justify-center p-6">
      <div className="w-full max-w-md rounded-3xl border border-white/10 bg-white/5 p-8 backdrop-blur-xl">
        <div className="mb-6 flex items-center gap-3">
          <div className="grid h-10 w-10 place-items-center rounded-2xl bg-gradient-to-br from-blue-500 to-purple-600">
            <Plane className="h-5 w-5 text-white" />
          </div>
          <span className="text-lg font-semibold">TravelHub</span>
        </div>

        {status === "loading" && (
          <>
            <div className="mb-6 grid h-14 w-14 place-items-center rounded-2xl bg-blue-500/15 text-blue-400">
              <Loader2 className="h-7 w-7 animate-spin" />
            </div>
            <h1 className="mb-2 text-2xl font-semibold tracking-tight" data-testid="text-verify-confirm-title">
              Verifying your email…
            </h1>
            <p className="mb-6 text-sm text-white/60">Hold tight while we confirm your link.</p>
          </>
        )}

        {status === "success" && (
          <>
            <div className="mb-6 grid h-14 w-14 place-items-center rounded-2xl bg-emerald-500/15 text-emerald-400">
              <CheckCircle2 className="h-7 w-7" />
            </div>
            <h1 className="mb-2 text-2xl font-semibold tracking-tight" data-testid="text-verify-confirm-title">
              Email verified
            </h1>
            <p className="mb-6 text-sm text-white/60">{message}</p>
            <Button
              onClick={() => setLocation("/")}
              className="w-full rounded-xl bg-white text-black hover:bg-white/90 h-11"
              data-testid="button-continue-to-signin"
            >
              Continue to sign in
            </Button>
          </>
        )}

        {status === "error" && (
          <>
            <div className="mb-6 grid h-14 w-14 place-items-center rounded-2xl bg-red-500/15 text-red-400">
              <XCircle className="h-7 w-7" />
            </div>
            <h1 className="mb-2 text-2xl font-semibold tracking-tight" data-testid="text-verify-confirm-title">
              Verification failed
            </h1>
            <p className="mb-6 text-sm text-white/60">{message}</p>
            <Button
              onClick={() => setLocation("/")}
              className="w-full rounded-xl bg-white text-black hover:bg-white/90 h-11"
              data-testid="button-back-to-login"
            >
              Back to sign in
            </Button>
          </>
        )}
      </div>
    </div>
  );
}

export default function VerifyEmailPendingPage() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [resending, setResending] = useState(false);
  const [resentOnce, setResentOnce] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState(0);

  const params = useMemo(() => new URLSearchParams(window.location.search), []);
  const email = params.get("email") ?? "";
  const token = params.get("token") ?? "";

  useEffect(() => {
    if (!email || token) return;
    const tick = () => {
      const expiry = readCooldownExpiry(email);
      const remaining = Math.max(0, expiry - Date.now());
      setSecondsLeft(Math.ceil(remaining / 1000));
      if (remaining > 0) setResentOnce(true);
    };
    tick();
    const id = window.setInterval(tick, 1000);
    return () => window.clearInterval(id);
  }, [email, token]);

  if (token) {
    return <VerifyEmailConfirm token={token} />;
  }

  const handleResend = async () => {
    if (!email) {
      toast({ title: "No email on file", description: "Try logging in again.", variant: "destructive" });
      return;
    }
    if (secondsLeft > 0) return;

    setResending(true);
    try {
      await axiosClient.post("/api/v2/onboarding/resend-verification", { email });
      localStorage.setItem(cooldownKey(email), String(Date.now()));
      setResentOnce(true);
      setSecondsLeft(Math.ceil(COOLDOWN_MS / 1000));
      toast({
        title: "Verification email sent",
        description: `Check ${email} for the verification link.`,
      });
    } catch (err: any) {
      toast({
        title: "Couldn't resend",
        description: err?.message ?? "Something went wrong — try again in a moment.",
        variant: "destructive",
      });
    } finally {
      setResending(false);
    }
  };

  const cooling = secondsLeft > 0;
  const buttonLabel = (() => {
    if (resending) return <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Sending...</>;
    if (cooling) return `Resend again in ${secondsLeft}s`;
    if (resentOnce) return <><CheckCircle2 className="mr-2 h-4 w-4" /> Resend again</>;
    return "Resend verification email";
  })();

  return (
    <div className="min-h-screen bg-black text-white flex items-center justify-center p-6">
      <div className="w-full max-w-md rounded-3xl border border-white/10 bg-white/5 p-8 backdrop-blur-xl">
        <div className="mb-6 flex items-center gap-3">
          <div className="grid h-10 w-10 place-items-center rounded-2xl bg-gradient-to-br from-blue-500 to-purple-600">
            <Plane className="h-5 w-5 text-white" />
          </div>
          <span className="text-lg font-semibold">TravelHub</span>
        </div>

        <div className="mb-6 grid h-14 w-14 place-items-center rounded-2xl bg-blue-500/15 text-blue-400">
          <Mail className="h-7 w-7" />
        </div>

        <h1 className="mb-2 text-2xl font-semibold tracking-tight" data-testid="text-verify-pending-title">
          Verify your email to continue
        </h1>
        <p className="mb-6 text-sm text-white/60">
          {email ? (
            <>We sent a verification link to <span className="font-medium text-white">{email}</span>. Click the link in that email, then come back here to sign in.</>
          ) : (
            <>We sent a verification link to your email. Click the link in that email, then come back here to sign in.</>
          )}
        </p>

        <div className="space-y-3">
          <Button
            onClick={handleResend}
            disabled={resending || !email || cooling}
            className="w-full rounded-xl bg-white text-black hover:bg-white/90 h-11 disabled:opacity-60"
            data-testid="button-resend-verification"
          >
            {buttonLabel}
          </Button>

          <Button
            variant="ghost"
            onClick={() => setLocation("/")}
            className="w-full rounded-xl text-white/70 hover:bg-white/5 hover:text-white h-11"
            data-testid="button-back-to-login"
          >
            Back to sign in
          </Button>
        </div>

        <p className="mt-6 text-xs text-white/40">
          Didn't get an email? Check your spam folder, or try resending. Verification links expire after 24 hours.
        </p>
      </div>
    </div>
  );
}

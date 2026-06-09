import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Mail, Lock, ArrowRight, Loader2, Sparkles, Fingerprint, Eye, EyeOff } from "lucide-react";
import { usePortalLogin, setPortalToken, getPortalToken, usePortalBiometricLogin, portalMagicLogin } from "@/hooks/use-portal-api";
import { useLocation } from "wouter";

function GlassCard({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`backdrop-blur-xl bg-white/[0.08] border border-white/[0.12] rounded-3xl ${className}`}>
      {children}
    </div>
  );
}

function PinInput({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const v = e.target.value.replace(/\D/g, "").slice(0, 4);
    onChange(v);
  };

  return (
    <div className="relative mb-4">
      <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-white/30" />
      <input
        type="password"
        inputMode="numeric"
        maxLength={4}
        value={value}
        onChange={handleChange}
        placeholder="4-digit PIN"
        className="w-full pl-12 pr-4 py-3.5 rounded-2xl bg-white/[0.06] border border-white/[0.1] text-white placeholder:text-white/30 focus:outline-none focus:border-purple-500/50 focus:ring-1 focus:ring-purple-500/30 transition-all tracking-[0.5em] text-center text-lg"
        data-testid="input-pin"
      />
      <div className="flex justify-center gap-2 mt-2">
        {[0, 1, 2, 3].map(i => (
          <div
            key={i}
            className={`w-3 h-3 rounded-full transition-all duration-200 ${
              i < value.length ? "bg-purple-500 scale-110" : "bg-white/10"
            }`}
          />
        ))}
      </div>
    </div>
  );
}

export default function PortalLoginPage() {
  const [email, setEmail] = useState("");
  const [pin, setPin] = useState("");
  const [error, setError] = useState("");
  const [showBiometric, setShowBiometric] = useState(false);
  const [, setLocation] = useLocation();
  const loginMutation = usePortalLogin();
  const biometricLogin = usePortalBiometricLogin();

  // Post-login destination. Only same-origin portal paths are honoured (no
  // open-redirect); anything else falls back to the portal home.
  const getRedirectTarget = () => {
    const next = new URLSearchParams(window.location.search).get("next");
    return next && next.startsWith("/portal") && !next.startsWith("//") ? next : "/portal";
  };

  useEffect(() => {
    if (getPortalToken()) {
      setLocation(getRedirectTarget());
      return;
    }

    const params = new URLSearchParams(window.location.search);

    // Short single-use code from an SMS quote link → exchange for a session.
    const mt = params.get("mt");
    if (mt) {
      portalMagicLogin(mt)
        .then((data) => {
          localStorage.setItem("portal_client_id", data.clientId);
          setLocation(getRedirectTarget());
        })
        .catch((e) =>
          setError(e?.message || "This link has expired. Please ask your agent to resend."),
        );
      return;
    }

    // Legacy: a full token in the URL (kept for any links already sent out).
    const urlToken = params.get("token");
    if (urlToken) {
      setPortalToken(urlToken);
      setLocation(getRedirectTarget());
      return;
    }

    const savedClientId = localStorage.getItem("portal_client_id");
    const savedEmail = localStorage.getItem("portal_email");
    if (savedClientId && savedEmail) {
      setEmail(savedEmail);
      checkBiometric(savedClientId);
    }
  }, [setLocation]);

  const checkBiometric = async (clientId: string) => {
    try {
      const res = await fetch("/api/portal/webauthn/check", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clientId }),
      });
      const data = await res.json();
      if (data.hasBiometric) {
        setShowBiometric(true);
      }
    } catch {}
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !pin || pin.length !== 4) return;
    setError("");

    try {
      const result = await loginMutation.mutateAsync({ email, pin });
      if (result?.token) {
        localStorage.setItem("portal_client_id", result.clientId);
        localStorage.setItem("portal_email", email);

        if (!result.hasBiometric && "credentials" in navigator) {
          try {
            await registerBiometric(result.token, result.clientId);
          } catch {}
        }

        setLocation(getRedirectTarget());
      }
    } catch (err: any) {
      setError(err?.message?.includes("401")
        ? "Incorrect email or PIN"
        : err?.message?.includes("Portal access")
        ? "Portal access not set up. Please contact your travel agent."
        : "Login failed. Please try again.");
    }
  };

  const registerBiometric = async (token: string, clientId: string) => {
    if (!window.PublicKeyCredential) return;

    const available = await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
    if (!available) return;

    try {
      const challenge = new Uint8Array(32);
      crypto.getRandomValues(challenge);

      const credential = await navigator.credentials.create({
        publicKey: {
          challenge,
          rp: { name: "Tinas Travel", id: window.location.hostname },
          user: {
            id: new TextEncoder().encode(clientId),
            name: email,
            displayName: email,
          },
          pubKeyCredParams: [
            { alg: -7, type: "public-key" },
            { alg: -257, type: "public-key" },
          ],
          authenticatorSelection: {
            authenticatorAttachment: "platform",
            userVerification: "required",
          },
          timeout: 60000,
        },
      }) as PublicKeyCredential;

      if (credential) {
        const credId = btoa(String.fromCharCode(...new Uint8Array(credential.rawId)));
        const response = credential.response as AuthenticatorAttestationResponse;
        const pubKey = btoa(String.fromCharCode(...new Uint8Array(response.getPublicKey?.() || new ArrayBuffer(0))));

        await fetch("/api/portal/webauthn/register", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            credentialId: credId,
            publicKey: pubKey || "platform-verified",
            deviceName: navigator.userAgent.includes("iPhone") ? "iPhone" :
                        navigator.userAgent.includes("Android") ? "Android" : "Device",
          }),
        });

        localStorage.setItem("portal_credential_id", credId);
      }
    } catch {}
  };

  const handleBiometricLogin = async () => {
    const savedClientId = localStorage.getItem("portal_client_id");
    const savedCredentialId = localStorage.getItem("portal_credential_id");
    if (!savedClientId || !savedCredentialId) {
      setShowBiometric(false);
      return;
    }

    setError("");
    try {
      const result = await biometricLogin.mutateAsync({
        clientId: savedClientId,
        credentialId: savedCredentialId,
      });
      if (result?.token) {
        setLocation(getRedirectTarget());
      }
    } catch {
      setError("Biometric login failed. Please use your PIN.");
      setShowBiometric(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0a0a0f] flex items-center justify-center px-4">
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-purple-500/10 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl" />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        className="relative z-10 w-full max-w-md"
      >
        <div className="text-center mb-8">
          <div className="w-16 h-16 rounded-3xl bg-gradient-to-br from-purple-500/30 to-blue-500/30 flex items-center justify-center mx-auto mb-4 border border-white/10">
            <Sparkles className="w-8 h-8 text-purple-400" />
          </div>
          <h1 className="text-3xl font-bold text-white mb-2" data-testid="text-portal-title">Client Portal</h1>
          <p className="text-white/50 text-sm">Access your quotes, bookings & deals</p>
        </div>

        <GlassCard className="p-6 md:p-8">
          {showBiometric ? (
            <div className="text-center">
              <p className="text-white/70 text-sm mb-6">Welcome back! Use biometrics to sign in.</p>
              <motion.button
                whileTap={{ scale: 0.95 }}
                onClick={handleBiometricLogin}
                disabled={biometricLogin.isPending}
                className="w-20 h-20 rounded-full bg-gradient-to-br from-purple-500/30 to-blue-500/30 border border-white/20 flex items-center justify-center mx-auto mb-4 hover:from-purple-500/40 hover:to-blue-500/40 transition-all"
                data-testid="button-biometric-login"
              >
                {biometricLogin.isPending ? (
                  <Loader2 className="w-8 h-8 text-purple-400 animate-spin" />
                ) : (
                  <Fingerprint className="w-10 h-10 text-purple-400" />
                )}
              </motion.button>
              <p className="text-white/40 text-xs mb-4">Tap to use Face ID / Fingerprint</p>
              <button
                onClick={() => setShowBiometric(false)}
                className="text-sm text-purple-400 hover:text-purple-300 transition-colors underline underline-offset-4"
                data-testid="button-use-pin"
              >
                Use PIN instead
              </button>
            </div>
          ) : (
            <form onSubmit={handleSubmit}>
              <label className="block text-sm font-medium text-white/70 mb-2" htmlFor="email">
                Email address
              </label>
              <div className="relative mb-4">
                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-white/30" />
                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  className="w-full pl-12 pr-4 py-3.5 rounded-2xl bg-white/[0.06] border border-white/[0.1] text-white placeholder:text-white/30 focus:outline-none focus:border-purple-500/50 focus:ring-1 focus:ring-purple-500/30 transition-all"
                  required
                  data-testid="input-email"
                />
              </div>

              <label className="block text-sm font-medium text-white/70 mb-2">
                4-digit PIN
              </label>
              <PinInput value={pin} onChange={setPin} />

              {error && (
                <motion.p
                  initial={{ opacity: 0, y: -5 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="text-red-400 text-sm text-center mb-4"
                  data-testid="text-error"
                >
                  {error}
                </motion.p>
              )}

              <motion.button
                whileTap={{ scale: 0.98 }}
                type="submit"
                disabled={loginMutation.isPending || !email || pin.length !== 4}
                className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-purple-600 to-blue-600 text-white font-semibold flex items-center justify-center gap-2 disabled:opacity-50 transition-opacity"
                data-testid="button-login"
              >
                {loginMutation.isPending ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <>
                    Sign In
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </motion.button>
            </form>
          )}
        </GlassCard>

        <p className="text-center text-white/30 text-xs mt-6">
          Your travel agent will set up your PIN to access the portal
        </p>
      </motion.div>
    </div>
  );
}

import { useState, useEffect } from "react";
import { usePortalLogin, setPortalToken, getPortalToken, usePortalBiometricLogin, portalMagicLogin, getPortalOrgSlug, hasLocalBiometric, clearLocalBiometric, isPlatformAuthenticatorAvailable, registerPortalBiometric, setPortalOrgSlug } from "@/hooks/use-portal-api";
import { useLocation } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import { normalizeOrgSlug } from "@/lib/portal-org-slug";
import { offerRegistrationAfterPin, showFaceIdOnLogin } from "@/features/portal/lib/face-id-affordance";
import {
  AgencyMark,
  Eyebrow,
  PIN_RESET_CONFIRMATION,
  PinField,
  PortalButton,
  PortalField,
  PortalHero,
  PortalThemeScope,
  portalNextTarget,
  signOutPortal,
  usePortalBrandingValue,
  usePortalPinReset,
  withoutParams,
} from "@/features/portal";

/** The messages the server sends are shown as sent; a failed request with no message gets one plain sentence. */
function loginErrorMessage(err: unknown): string {
  const message = err instanceof Error ? err.message : "";
  if (!message || /^Login error: \d+$/.test(message) || /failed to fetch|networkerror|load failed/i.test(message)) {
    return "Login failed. Please try again.";
  }
  return message;
}

export default function PortalLoginPage() {
  const [email, setEmail] = useState("");
  const [pin, setPin] = useState("");
  const [error, setError] = useState("");
  const [showBiometric, setShowBiometric] = useState(false);
  const [forgotten, setForgotten] = useState(false);
  const [resetDone, setResetDone] = useState(false);
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const loginMutation = usePortalLogin();
  const biometricLogin = usePortalBiometricLogin();
  const pinReset = usePortalPinReset();
  const branding = usePortalBrandingValue();

  // Post-login destination. Only same-origin portal paths are honoured (no
  // open-redirect); anything else falls back to the portal home.
  const getRedirectTarget = () => portalNextTarget(window.location.search);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const mt = params.get("mt");
    const urlToken = params.get("token");

    // Someone is already signed in and this is a plain visit: carry on to where they were going.
    if (getPortalToken() && !mt && !urlToken) {
      setLocation(getRedirectTarget());
      return;
    }

    // Agency slug (?org=) — passed to sign-in so only that agency's clients are candidates.
    // Only a well-formed slug is remembered.
    const orgParam = params.get("org");
    if (orgParam) setPortalOrgSlug(orgParam);

    // A sign-in link (or legacy token) always means "sign in as the person it was made for": whoever
    // was signed in on this device is signed out first, so their account can never receive it.
    // Redeemed codes and tokens are also removed from the address bar before anything else happens.
    if (mt || urlToken) {
      const target = getRedirectTarget();
      window.history.replaceState({}, "", `${window.location.pathname}${withoutParams(window.location.search, ["mt", "token"])}`);
      let cancelled = false;
      (async () => {
        if (getPortalToken()) {
          await signOutPortal();
          queryClient.removeQueries({ queryKey: ["portal"] });
        }
        if (cancelled) return;
        if (mt) {
          try {
            const data = await portalMagicLogin(mt);
            localStorage.setItem("portal_client_id", data.clientId);
            setLocation(target);
          } catch (e) {
            setError(e instanceof Error && e.message ? e.message : "That link has expired or was already used. Ask your agent for a new one, or use Forgotten your PIN?");
          }
          return;
        }
        // Legacy: a full token in the URL (kept for any links already sent out).
        if (urlToken) {
          setPortalToken(urlToken);
          setLocation(target);
        }
      })();
      return () => {
        cancelled = true;
      };
    }

    // Face ID: a device that remembers a set-up shows the button; one that does not shows it quietly when the browser says a
    // built-in biometric exists (a passkey may have carried over when the portal moved to its own address).
    const savedEmail = localStorage.getItem("portal_email");
    if (savedEmail) setEmail(savedEmail);
    const hasMarker = hasLocalBiometric();
    if (hasMarker) setShowBiometric(true);
    else {
      let alive = true;
      void isPlatformAuthenticatorAvailable().then((available) => {
        if (alive && showFaceIdOnLogin({ hasMarker: false, hasWebAuthn: !!window.PublicKeyCredential, platformAuthenticatorAvailable: available })) setShowBiometric(true);
      });
      return () => {
        alive = false;
      };
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [setLocation]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !pin || pin.length !== 4) return;
    setError("");

    try {
      // ?org= on the URL filters sign-in to that agency; with none, the remembered agency is only a tie-breaker.
      const urlOrg = normalizeOrgSlug(new URLSearchParams(window.location.search).get("org")) ?? undefined;
      const result = await loginMutation.mutateAsync({
        email,
        pin,
        org: urlOrg,
        preferOrg: urlOrg ? undefined : getPortalOrgSlug() ?? undefined,
      });
      if (result?.token) {
        localStorage.setItem("portal_client_id", result.clientId);
        localStorage.setItem("portal_email", email);

        // Offer Face ID set-up only right after a PIN sign-in, and only when the server could actually check.
        if (offerRegistrationAfterPin({ hasBiometric: result.hasBiometric, biometricCheckFailed: !!result.biometricCheckFailed, credentialsApi: "credentials" in navigator })) {
          try {
            await registerPortalBiometric();
          } catch {}
        }

        setLocation(getRedirectTarget());
      }
    } catch (err) {
      setError(loginErrorMessage(err));
    }
  };

  const handleBiometricLogin = async () => {
    setError("");
    const hadMarker = hasLocalBiometric();
    try {
      const result = await biometricLogin.mutateAsync();
      if (result?.token) {
        localStorage.setItem("portal_client_id", result.clientId);
        setLocation(getRedirectTarget());
      }
    } catch (err) {
      // A device with no remembered set-up was only trying: a cancelled or failed attempt goes back to the PIN form quietly.
      if (!hadMarker) return;
      // A cancelled prompt keeps the button; a rejected or unusable credential is forgotten.
      if (!(err instanceof DOMException && err.name === "NotAllowedError")) clearLocalBiometric();
      setError("Biometric login failed. Please use your PIN.");
      setShowBiometric(false);
    }
  };

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;
    setError("");
    // Only an agency named in the link narrows the lookup; a remembered one could be stale.
    const org = normalizeOrgSlug(new URLSearchParams(window.location.search).get("org")) ?? undefined;
    try {
      await pinReset.mutateAsync({ email: email.trim(), org });
      setResetDone(true);
    } catch (err) {
      setError(err instanceof Error && err.message ? err.message : "Something went wrong. Please try again.");
    }
  };

  const openForgotten = () => {
    setError("");
    setResetDone(false);
    setForgotten(true);
  };

  const backToSignIn = () => {
    setError("");
    setResetDone(false);
    setForgotten(false);
  };

  return (
    <PortalThemeScope>
      <main className="relative flex min-h-dvh flex-col">
        <PortalHero className="h-[470px] md:h-[520px]">
          <Eyebrow className="text-accent">Your customer hub</Eyebrow>
          <h1 className="portal-serif text-[52px] font-light leading-none tracking-[-0.01em]" data-testid="text-portal-title">
            Welcome
            <br />
            <em className="italic">back.</em>
          </h1>
          <p className="max-w-[290px] text-[15px] leading-[1.7] text-white/[0.78]">Your quotes, your bookings and our latest finds, kept in one quiet place.</p>
        </PortalHero>
        <div className="pointer-events-none absolute inset-x-0 top-0 flex justify-center py-[22px]">
          <AgencyMark branding={branding} tone="dark" />
        </div>

        <section className="mx-auto w-full max-w-md px-7 pb-[72px] pt-14">
          {forgotten ? (
            <div data-testid="pin-reset-panel">
              <h2 className="portal-serif text-[32px] font-light leading-tight text-primary">Forgotten your PIN?</h2>
              <p className="mt-2 text-[15px] leading-relaxed text-muted-foreground">Enter your email and we'll send you a link to sign in and choose a new PIN.</p>
              {resetDone ? (
                <p role="status" className="mt-8 border-t border-border pt-6 text-[15px] leading-relaxed text-foreground" data-testid="text-pin-reset-confirmation">
                  {PIN_RESET_CONFIRMATION}
                </p>
              ) : (
                <form onSubmit={handleReset} noValidate className="mt-8 flex flex-col gap-[30px]">
                  <PortalField
                    id="reset-email"
                    label="Email"
                    type="email"
                    autoComplete="email"
                    placeholder="you@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    data-testid="input-reset-email"
                  />
                  {error && (
                    <p role="alert" className="portal-text-danger text-[13px]" data-testid="text-error">
                      {error}
                    </p>
                  )}
                  <PortalButton type="submit" size="lg" disabled={pinReset.isPending || !email.trim()} className="w-full" data-testid="button-send-reset">
                    {pinReset.isPending ? "Sending" : "Text me a link"}
                  </PortalButton>
                </form>
              )}
              <button
                type="button"
                onClick={backToSignIn}
                className="portal-serif mt-6 min-h-11 text-lg italic text-primary underline decoration-border underline-offset-4"
                data-testid="button-back-to-signin"
              >
                Back to sign in
              </button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-[30px]">
              <PortalField
                id="email"
                label="Email"
                type="email"
                autoComplete="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                data-testid="input-email"
              />
              <PinField id="pin" label="PIN" value={pin} onChange={setPin} autoComplete="current-password" testId="input-pin" toggleTestId="button-toggle-pin" />

              {error && (
                <p role="alert" className="portal-text-danger text-[13px]" data-testid="text-error">
                  {error}
                </p>
              )}

              <PortalButton type="submit" size="lg" disabled={loginMutation.isPending || !email || pin.length !== 4} className="mt-1.5 w-full" data-testid="button-login">
                {loginMutation.isPending ? "Logging in" : "Log in"}
              </PortalButton>
              {/* Existing functionality the design does not show: a text button in the design's link style. */}
              {showBiometric && (
                <PortalButton variant="link" className="-mt-4 self-center" onClick={handleBiometricLogin} disabled={biometricLogin.isPending} data-testid="button-biometric-login">
                  {biometricLogin.isPending ? "Checking" : "Log in with Face ID"}
                </PortalButton>
              )}
              <button
                type="button"
                onClick={openForgotten}
                className="portal-serif min-h-11 self-center text-lg italic text-primary underline decoration-border underline-offset-4"
                data-testid="button-forgot-pin"
              >
                Forgotten your PIN?
              </button>
            </form>
          )}

          <div className="mt-11 flex flex-col items-center gap-4 border-t border-border pt-7 text-center">
            {branding.iconUrl && <img src={branding.iconUrl} alt="" className="block h-auto w-8" />}
            <p className="max-w-[280px] text-sm leading-[1.7] text-muted-foreground">First time here? Use the link in the welcome email from your travel agent to set your PIN.</p>
          </div>
        </section>
      </main>
    </PortalThemeScope>
  );
}

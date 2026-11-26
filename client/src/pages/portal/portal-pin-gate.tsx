import { useState, type ReactNode } from "react";
import { usePortalUser, useChangePortalPin, getPortalToken } from "@/hooks/use-portal-api";
import {
  AgencyMark,
  Eyebrow,
  PinField,
  PortalButton,
  PortalHero,
  PortalThemeScope,
  usePortalBrandingValue,
  withoutParams,
} from "@/features/portal";

/**
 * Wraps the authenticated portal so a client who is still on a system-seeded
 * default PIN must set their own before they can use anything. The quote they
 * arrived for is shown only after the new PIN is saved.
 */
export function PortalPinGate({ children }: { children: ReactNode }) {
  const hasToken = !!getPortalToken();
  const { data: user, isLoading } = usePortalUser();
  const changePin = useChangePortalPin();
  const branding = usePortalBrandingValue();
  const [pin, setPin] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");

  // No session, or profile not yet loaded → let the underlying routes handle it
  // (login page, their own loading states). Only gate once we know the flag.
  if (!hasToken || isLoading || !user?.mustChangePin) {
    return <>{children}</>;
  }

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (pin.length !== 4) return setError("Enter a 4-digit PIN.");
    if (pin === "1234") return setError("Please choose a PIN other than 1234.");
    if (pin !== confirm) return setError("The PINs don't match.");
    try {
      // The mutation stores the reissued token the server returns after a magic-link sign-in.
      await changePin.mutateAsync({ newPin: pin });
      // They have just chosen a PIN: a pending ?change-pin=1 (from a reset link) must not ask again.
      const rest = withoutParams(window.location.search, ["change-pin"]);
      window.history.replaceState({}, "", `${window.location.pathname}${rest}`);
      // On success the user query is invalidated; mustChangePin flips false and
      // this gate falls through to the requested page.
    } catch (err) {
      setError(err instanceof Error && err.message ? err.message : "Couldn't save your PIN. Please try again.");
    }
  };

  return (
    <PortalThemeScope>
      <main className="relative flex min-h-dvh flex-col">
        <PortalHero className="h-[340px]">
          <Eyebrow className="portal-text-amber-soft">One last step</Eyebrow>
          <h1 className="portal-serif text-[44px] font-light leading-none" data-testid="text-set-pin-title">
            Secure your
            <br />
            <em>portal.</em>
          </h1>
        </PortalHero>
        <div className="pointer-events-none absolute inset-x-0 top-0 flex justify-center py-[22px]">
          <AgencyMark branding={branding} tone="dark" />
        </div>

        <section className="mx-auto w-full max-w-md px-7 pb-16 pt-12">
          <p className="mb-8 text-[15px] leading-relaxed text-muted-foreground">Choose a 4-digit PIN to protect your account before you continue.</p>
          <form onSubmit={handleSave} noValidate className="flex flex-col gap-[30px]">
            <PinField id="new-pin" label="New PIN" value={pin} onChange={setPin} autoComplete="new-password" testId="input-new-pin" />
            <PinField id="confirm-pin" label="Confirm PIN" value={confirm} onChange={setConfirm} autoComplete="new-password" testId="input-confirm-pin" />

            {error && (
              <p role="alert" className="portal-text-danger text-[14px]" data-testid="text-set-pin-error">
                {error}
              </p>
            )}

            <PortalButton type="submit" disabled={changePin.isPending || pin.length !== 4 || confirm.length !== 4} className="w-full" data-testid="button-save-pin">
              {changePin.isPending ? "Saving" : "Save PIN"}
            </PortalButton>
          </form>
        </section>
      </main>
    </PortalThemeScope>
  );
}

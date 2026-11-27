import { useEffect, useState, type ReactNode } from "react";
import { useLocation } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import { ChevronRight } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { useChangePortalPin, usePortalUser, usePortalVipStatus } from "@/hooks/use-portal-api";
import {
  Eyebrow,
  FACE_ID_REAUTH_MESSAGE,
  PinField,
  PortalButton,
  PortalDialog,
  PortalSection,
  PortalHero,
  signOutPortal,
  usePortalBrandingValue,
  usePortalFaceId,
  usePortalPush,
  type PortalPushState,
} from "@/features/portal";
import PortalLayout from "./portal-layout";
import PortalSetupWizard, { OPEN_SETUP_WIZARD_EVENT } from "./portal-setup-wizard";

const TIER_LABEL: Record<string, string> = { standard: "Standard", gold: "Gold", elite: "Elite" };

function formatGbp(value: string | undefined): string | null {
  const n = Number(value);
  if (value === undefined || !Number.isFinite(n)) return null;
  return new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP" }).format(n);
}

function Group({ label, children }: { label: string; children: ReactNode }) {
  return (
    <section className="mt-10" aria-label={label}>
      <Eyebrow as="h2" className="mb-3">
        {label}
      </Eyebrow>
      <ul className="border-b border-border">{children}</ul>
    </section>
  );
}

/** One hairline row: serif title, a short description, and an action or value on the right. */
function Row({
  title,
  description,
  aside,
  onClick,
  testId,
}: {
  title: string;
  description?: ReactNode;
  aside?: ReactNode;
  /** When set the whole row is a button (a link-style row). */
  onClick?: () => void;
  testId?: string;
}) {
  const body = (
    <>
      <span className="flex min-w-0 flex-1 flex-col gap-1 text-left [overflow-wrap:anywhere]">
        <span className="portal-serif text-[22px] font-medium leading-tight text-primary">{title}</span>
        {description && <span className="text-[14px] leading-snug text-muted-foreground">{description}</span>}
      </span>
      {aside}
    </>
  );
  return (
    <li className="border-t border-border">
      {onClick ? (
        <button type="button" onClick={onClick} className="flex min-h-[72px] w-full items-center gap-4 py-4" data-testid={testId}>
          {body}
          <ChevronRight className="size-5 shrink-0 text-muted-foreground" strokeWidth={1.5} aria-hidden />
        </button>
      ) : (
        <div className="flex min-h-[72px] items-center gap-4 py-4" data-testid={testId}>
          {body}
        </div>
      )}
    </li>
  );
}

function pushDescription(state: PortalPushState): string {
  switch (state) {
    case "on":
      return "On for this device. We'll let you know when your agent replies.";
    case "denied":
      return "Blocked in your browser settings. Allow notifications for this site there, then come back.";
    case "unsupported":
      return "Open this page in your phone's browser (Safari or Chrome) to turn on notifications.";
    default:
      return "Get a message on this device when your agent replies.";
  }
}

export default function PortalAccountPage() {
  const [location, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const branding = usePortalBrandingValue();
  const { data: user } = usePortalUser();
  const { data: vip } = usePortalVipStatus();
  const push = usePortalPush();
  const faceId = usePortalFaceId();
  const changePin = useChangePortalPin();

  const [pinOpen, setPinOpen] = useState(false);
  const [newPin, setNewPin] = useState("");
  const [confirmPin, setConfirmPin] = useState("");
  const [pinError, setPinError] = useState("");
  const [pinDone, setPinDone] = useState(false);
  const [faceIdNote, setFaceIdNote] = useState<{ kind: "info" | "reauth" | "error"; text: string } | null>(null);

  // The "forgotten your PIN" text lands here with the change-PIN form already open.
  useEffect(() => {
    if (new URLSearchParams(window.location.search).get("change-pin") === "1") setPinOpen(true);
  }, [location]);

  const closePin = (open: boolean) => {
    setPinOpen(open);
    if (!open) {
      // Drop ?change-pin=1 so a reload does not reopen the form.
      if (new URLSearchParams(window.location.search).has("change-pin")) window.history.replaceState({}, "", window.location.pathname);
      setNewPin("");
      setConfirmPin("");
      setPinError("");
    }
  };

  const savePin = async (e: React.FormEvent) => {
    e.preventDefault();
    setPinError("");
    if (newPin.length !== 4) return setPinError("Enter a 4-digit PIN.");
    if (newPin === "1234") return setPinError("Please choose a PIN other than 1234.");
    if (newPin !== confirmPin) return setPinError("The PINs don't match.");
    try {
      await changePin.mutateAsync({ newPin });
      closePin(false);
      setPinDone(true);
    } catch (err) {
      setPinError(err instanceof Error && err.message ? err.message : "Couldn't save your PIN. Please try again.");
    }
  };

  const setUpFaceId = async () => {
    setFaceIdNote(null);
    const result = await faceId.setUp();
    if (result.status === "done") setFaceIdNote({ kind: "info", text: "Face ID is set up on this device." });
    else if (result.status === "reauth") setFaceIdNote({ kind: "reauth", text: FACE_ID_REAUTH_MESSAGE });
    else if (result.status === "cancelled") setFaceIdNote({ kind: "info", text: "Set-up was cancelled. You can try again any time." });
    else if (result.status === "unavailable") setFaceIdNote({ kind: "error", text: "Face ID or fingerprint isn't available on this device." });
    else setFaceIdNote({ kind: "error", text: result.message });
  };

  const removeThisDevice = async () => {
    setFaceIdNote(null);
    try {
      await faceId.remove();
      setFaceIdNote({ kind: "info", text: "Face ID has been removed from this device and your account." });
    } catch (err) {
      setFaceIdNote({ kind: "error", text: err instanceof Error && err.message ? err.message : "We couldn't remove Face ID. Please try again." });
    }
  };

  const removeOtherDevice = async (id: string) => {
    setFaceIdNote(null);
    try {
      await faceId.removeDevice(id);
      setFaceIdNote({ kind: "info", text: "That device can no longer sign in with Face ID." });
    } catch (err) {
      setFaceIdNote({ kind: "error", text: err instanceof Error && err.message ? err.message : "We couldn't remove that device. Please try again." });
    }
  };

  const otherDevices = faceId.devices.filter((d) => d.id !== faceId.thisDeviceId);

  const signOut = async () => {
    await signOutPortal();
    // Nothing from this customer may linger for the next person on a shared device.
    queryClient.removeQueries({ queryKey: ["portal"] });
    setLocation("/portal/login");
  };

  const balance = formatGbp(vip?.walletBalance);
  const tier = vip && vip.vipTier !== "not_enrolled" ? TIER_LABEL[vip.vipTier] : null;
  const rewardsAside = vip ? (
    <span className="text-right leading-tight" data-testid="account-rewards-summary">
      {balance && <span className="portal-serif block text-[20px] text-primary">{balance}</span>}
      {tier && <span className="portal-caps-label block">{tier}</span>}
    </span>
  ) : null;

  const pushToggleable = push.state === "on" || push.state === "off";
  const installed = typeof window !== "undefined" && window.matchMedia("(display-mode: standalone)").matches;
  const faceIdSupported = typeof window !== "undefined" && !!window.PublicKeyCredential;

  return (
    <PortalLayout tone="light">
      <PortalHero className="h-[480px] md:h-[480px]">
        <Eyebrow className="text-accent [overflow-wrap:anywhere]">{user?.email ?? "Your details"}</Eyebrow>
        <h1 className="portal-serif w-full max-w-full text-[50px] font-light leading-none text-white [overflow-wrap:anywhere]">
          {user?.firstName ? `${user.firstName}'s` : "Your"}
          <br />
          <em className="italic">account.</em>
        </h1>
        {branding.name && <p className="max-w-[290px] text-[15px] leading-[1.7] text-white/80">With {branding.name}</p>}
      </PortalHero>

      <PortalSection className="pb-14 pt-10" data-testid="portal-account">

        <Group label="Rewards and interests">
          <Row title="Referrals & rewards" description="Refer a friend and track what you've earned." aside={rewardsAside} onClick={() => setLocation("/portal/referrals")} testId="account-row-referrals" />
          <Row title="Travel interests" description="Tell us what you love so we show you the right deals." onClick={() => setLocation("/portal/tags")} testId="account-row-interests" />
        </Group>

        <Group label="Security">
          <Row
            title="Change PIN"
            description={pinDone ? "Your PIN has been changed." : "Choose a new 4-digit PIN."}
            onClick={() => {
              setPinDone(false);
              setPinOpen(true);
            }}
            testId="account-row-change-pin"
          />
          <Row
            title="Face ID"
            description={
              !faceIdSupported
                ? "Not available on this device."
                : faceId.enabled
                  ? "On for this device. Use it instead of your PIN to sign in."
                  : "Sign in faster with Face ID or your fingerprint."
            }
            aside={
              faceIdSupported ? (
                faceId.enabled ? (
                  <PortalButton variant="outline" size="sm" className="px-4" onClick={removeThisDevice} data-testid="button-face-id-remove">
                    Remove
                  </PortalButton>
                ) : (
                  <PortalButton variant="outline" size="sm" className="px-4" onClick={setUpFaceId} disabled={faceId.pending} data-testid="button-face-id-setup">
                    {faceId.pending ? "Setting up" : "Set up"}
                  </PortalButton>
                )
              ) : null
            }
            testId="account-row-face-id"
          />
        </Group>
        {otherDevices.length > 0 && (
          <ul className="border-b border-border" aria-label="Other devices set up for Face ID" data-testid="face-id-devices">
            {otherDevices.map((d) => (
              <li key={d.id} className="flex min-h-14 items-center justify-between gap-4 border-t border-border py-2 text-[15px]">
                <span>
                  Device set up{" "}
                  {d.createdAt ? new Date(d.createdAt).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }) : "earlier"}
                </span>
                <PortalButton variant="outline" size="sm" className="px-4" onClick={() => removeOtherDevice(d.id)} data-testid={`button-face-id-remove-device-${d.id}`}>
                  Remove
                </PortalButton>
              </li>
            ))}
          </ul>
        )}
        {faceIdNote && (
          <div role="status" className="border-b border-border py-4 text-[15px]" data-testid="face-id-note">
            <p className={faceIdNote.kind === "error" ? "portal-text-danger" : "text-foreground"}>{faceIdNote.text}</p>
            {faceIdNote.kind === "reauth" && (
              <PortalButton variant="link" className="mt-1" onClick={signOut} data-testid="button-face-id-signin-again">
                Sign in again
              </PortalButton>
            )}
          </div>
        )}

        <Group label="This device">
          <Row
            title="Notifications"
            description={pushDescription(push.state)}
            aside={
              <Switch
                checked={push.state === "on"}
                disabled={!pushToggleable}
                onCheckedChange={() => void push.toggle()}
                aria-label="Notifications"
                data-testid="button-toggle-push"
              />
            }
            testId="account-row-notifications"
          />
          <Row
            title="Install app"
            description={installed ? "Already installed on this device." : "Add this portal to your home screen."}
            onClick={installed ? undefined : () => window.dispatchEvent(new Event(OPEN_SETUP_WIZARD_EVENT))}
            testId="account-row-install"
          />
        </Group>

        <div className="mt-10">
          <PortalButton variant="outline" className="w-full" onClick={signOut} data-testid="button-logout">
            Sign out
          </PortalButton>
        </div>
      </PortalSection>

      <PortalDialog open={pinOpen} onOpenChange={closePin} title="Choose a new PIN" description="Your PIN is 4 digits. You'll use it with your email to sign in." testId="dialog-change-pin">
        <form onSubmit={savePin} className="flex flex-col gap-6" noValidate>
          <PinField id="account-new-pin" label="New PIN" value={newPin} onChange={setNewPin} autoComplete="new-password" testId="input-account-new-pin" />
          <PinField id="account-confirm-pin" label="Confirm PIN" value={confirmPin} onChange={setConfirmPin} autoComplete="new-password" testId="input-account-confirm-pin" />
          {pinError && (
            <p role="alert" className="portal-text-danger text-[13px]" data-testid="text-account-pin-error">
              {pinError}
            </p>
          )}
          <PortalButton type="submit" size="lg" className="w-full" disabled={changePin.isPending || newPin.length !== 4 || confirmPin.length !== 4} data-testid="button-account-save-pin">
            {changePin.isPending ? "Saving" : "Save PIN"}
          </PortalButton>
        </form>
      </PortalDialog>

      {/* The existing install wizard, opened by the Install app row (it never opens by itself here). */}
      <PortalSetupWizard manualOnly />
    </PortalLayout>
  );
}

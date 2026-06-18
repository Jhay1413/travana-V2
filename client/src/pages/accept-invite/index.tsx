import { useEffect, useMemo, useState } from "react";
import { useLocation } from "wouter";
import { CheckCircle2, Eye, EyeOff, Loader2, Plane, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { useInviteByToken } from "@/features/invite/api/use-invite-queries";
import { useAcceptInvite } from "@/features/invite/api/use-invite-mutations";

export default function AcceptInvitePage() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  const token = useMemo(() => {
    const params = new URLSearchParams(window.location.search);
    return params.get("token") ?? "";
  }, []);

  const { data: invite, isLoading, error } = useInviteByToken(token);
  const accept = useAcceptInvite();

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [accepted, setAccepted] = useState(false);

  useEffect(() => {
    document.title = invite?.orgName ? `Join ${invite.orgName} · TravelHub` : "Accept invitation · TravelHub";
  }, [invite]);

  const passwordOk = password.length >= 8;
  const formValid = firstName.trim() && lastName.trim() && phoneNumber.trim() && passwordOk;

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formValid) return;
    accept.mutate(
      { token, firstName: firstName.trim(), lastName: lastName.trim(), phoneNumber: phoneNumber.trim(), password },
      {
        onSuccess: () => {
          setAccepted(true);
          toast({ title: "Account created", description: "You can now sign in." });
        },
        onError: (err: any) =>
          toast({
            title: "Couldn't create account",
            description: err?.message ?? "Something went wrong",
            variant: "destructive",
          }),
      },
    );
  };

  return (
    <div className="min-h-screen bg-black text-white flex items-center justify-center p-6">
      <div className="w-full max-w-md rounded-3xl border border-white/10 bg-white/5 p-8 backdrop-blur-xl">
        <div className="mb-6 flex items-center gap-3">
          <div className="grid h-10 w-10 place-items-center rounded-2xl bg-gradient-to-br from-blue-500 to-purple-600">
            <Plane className="h-5 w-5 text-white" />
          </div>
          <span className="text-lg font-semibold">TravelHub</span>
        </div>

        {!token ? (
          <InviteError message="No invitation token in the link." onBack={() => setLocation("/")} />
        ) : isLoading ? (
          <InviteLoading />
        ) : error || !invite ? (
          <InviteError
            message={(error as any)?.message ?? "This invitation link is invalid or has expired."}
            onBack={() => setLocation("/")}
          />
        ) : accepted ? (
          <InviteSuccess onContinue={() => setLocation("/")} />
        ) : (
          <form onSubmit={submit} className="space-y-5" data-testid="form-accept-invite">
            <div>
              <h1 className="text-2xl font-semibold tracking-tight" data-testid="text-accept-title">
                Join {invite.orgName ?? "your team"}
              </h1>
              <p className="mt-1 text-sm text-white/60">
                Setting up the account for{" "}
                <span className="font-medium text-white">{invite.email}</span>.
              </p>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <FormField label="First name" htmlFor="first-name">
                <Input
                  id="first-name"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  required
                  className="bg-white/10 border-white/10 text-white placeholder:text-white/40"
                  data-testid="input-first-name"
                />
              </FormField>
              <FormField label="Last name" htmlFor="last-name">
                <Input
                  id="last-name"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  required
                  className="bg-white/10 border-white/10 text-white placeholder:text-white/40"
                  data-testid="input-last-name"
                />
              </FormField>
            </div>

            <FormField label="Phone number" htmlFor="phone">
              <Input
                id="phone"
                type="tel"
                value={phoneNumber}
                onChange={(e) => setPhoneNumber(e.target.value)}
                required
                placeholder="+44 7700 900123"
                className="bg-white/10 border-white/10 text-white placeholder:text-white/40"
                data-testid="input-phone"
              />
            </FormField>

            <FormField label="Create a password" htmlFor="password" hint="At least 8 characters.">
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="bg-white/10 border-white/10 text-white pr-10 placeholder:text-white/40"
                  data-testid="input-password"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-1 text-white/60 hover:text-white"
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </FormField>

            <Button
              type="submit"
              disabled={!formValid || accept.isPending}
              className="w-full rounded-xl bg-white text-black hover:bg-white/90 h-11 disabled:opacity-60"
              data-testid="button-accept-invite"
            >
              {accept.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {accept.isPending ? "Creating account…" : "Accept invitation"}
            </Button>

            <p className="text-xs text-white/40 text-center">
              By accepting, you agree to TravelHub's terms.
            </p>
          </form>
        )}
      </div>
    </div>
  );
}

function FormField({
  label,
  htmlFor,
  hint,
  children,
}: {
  label: string;
  htmlFor: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={htmlFor} className="text-xs text-white/70">{label}</Label>
      {children}
      {hint && <div className="text-[11px] text-white/40">{hint}</div>}
    </div>
  );
}

function InviteLoading() {
  return (
    <div className="py-12 text-center">
      <Loader2 className="mx-auto mb-3 h-7 w-7 animate-spin text-white/60" />
      <div className="text-sm text-white/60">Checking your invitation…</div>
    </div>
  );
}

function InviteError({ message, onBack }: { message: string; onBack: () => void }) {
  return (
    <div className="text-center">
      <div className="mx-auto mb-4 grid h-14 w-14 place-items-center rounded-2xl bg-red-500/15 text-red-400">
        <XCircle className="h-7 w-7" />
      </div>
      <h1 className="mb-2 text-xl font-semibold tracking-tight">Invitation unavailable</h1>
      <p className="mb-6 text-sm text-white/60">{message}</p>
      <Button onClick={onBack} className="rounded-xl bg-white text-black hover:bg-white/90 h-11 px-6">
        Back to sign in
      </Button>
    </div>
  );
}

function InviteSuccess({ onContinue }: { onContinue: () => void }) {
  return (
    <div className="text-center">
      <div className="mx-auto mb-4 grid h-14 w-14 place-items-center rounded-2xl bg-emerald-500/15 text-emerald-400">
        <CheckCircle2 className="h-7 w-7" />
      </div>
      <h1 className="mb-2 text-xl font-semibold tracking-tight">You're all set</h1>
      <p className="mb-6 text-sm text-white/60">Sign in with your email and the password you just chose.</p>
      <Button
        onClick={onContinue}
        className="w-full rounded-xl bg-white text-black hover:bg-white/90 h-11"
        data-testid="button-continue-to-signin"
      >
        Continue to sign in
      </Button>
    </div>
  );
}

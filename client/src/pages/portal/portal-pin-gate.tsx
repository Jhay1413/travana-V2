import { useState, type ReactNode } from "react";
import { motion } from "framer-motion";
import { Lock, ShieldCheck, Loader2, ArrowRight } from "lucide-react";
import { usePortalUser, useChangePortalPin, getPortalToken } from "@/hooks/use-portal-api";

function PinField({
  label,
  value,
  onChange,
  testId,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  testId: string;
}) {
  return (
    <div className="mb-4">
      <label className="block text-sm font-medium text-white/70 mb-2">{label}</label>
      <div className="relative">
        <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-white/30" />
        <input
          type="password"
          inputMode="numeric"
          maxLength={4}
          value={value}
          onChange={(e) => onChange(e.target.value.replace(/\D/g, "").slice(0, 4))}
          placeholder="4-digit PIN"
          className="w-full pl-12 pr-4 py-3.5 rounded-2xl bg-white/[0.06] border border-white/[0.1] text-white placeholder:text-white/30 focus:outline-none focus:border-purple-500/50 focus:ring-1 focus:ring-purple-500/30 transition-all tracking-[0.5em] text-center text-lg"
          data-testid={testId}
        />
      </div>
    </div>
  );
}

/**
 * Wraps the authenticated portal so a client who is still on a system-seeded
 * default PIN must set their own before they can use anything. The quote they
 * arrived for is shown only after the new PIN is saved.
 */
export function PortalPinGate({ children }: { children: ReactNode }) {
  const hasToken = !!getPortalToken();
  const { data: user, isLoading } = usePortalUser();
  const changePin = useChangePortalPin();
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
      await changePin.mutateAsync({ newPin: pin });
      // On success the user query is invalidated; mustChangePin flips false and
      // this gate falls through to the requested page.
    } catch (err: any) {
      setError(err?.message || "Couldn't save your PIN. Please try again.");
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
        transition={{ duration: 0.5 }}
        className="relative z-10 w-full max-w-md"
      >
        <div className="text-center mb-8">
          <div className="w-16 h-16 rounded-3xl bg-gradient-to-br from-purple-500/30 to-blue-500/30 flex items-center justify-center mx-auto mb-4 border border-white/10">
            <ShieldCheck className="w-8 h-8 text-purple-400" />
          </div>
          <h1 className="text-3xl font-bold text-white mb-2" data-testid="text-set-pin-title">
            Secure your portal
          </h1>
          <p className="text-white/50 text-sm">
            Choose a 4-digit PIN to protect your account before you continue.
          </p>
        </div>

        <div className="backdrop-blur-xl bg-white/[0.08] border border-white/[0.12] rounded-3xl p-6 md:p-8">
          <form onSubmit={handleSave}>
            <PinField label="New PIN" value={pin} onChange={setPin} testId="input-new-pin" />
            <PinField label="Confirm PIN" value={confirm} onChange={setConfirm} testId="input-confirm-pin" />

            {error && (
              <motion.p
                initial={{ opacity: 0, y: -5 }}
                animate={{ opacity: 1, y: 0 }}
                className="text-red-400 text-sm text-center mb-4"
                data-testid="text-set-pin-error"
              >
                {error}
              </motion.p>
            )}

            <motion.button
              whileTap={{ scale: 0.98 }}
              type="submit"
              disabled={changePin.isPending || pin.length !== 4 || confirm.length !== 4}
              className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-purple-600 to-blue-600 text-white font-semibold flex items-center justify-center gap-2 disabled:opacity-50 transition-opacity"
              data-testid="button-save-pin"
            >
              {changePin.isPending ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <>
                  Save PIN
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </motion.button>
          </form>
        </div>
      </motion.div>
    </div>
  );
}

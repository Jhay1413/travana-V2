import { useEffect, useState } from "react";
import { Check, Loader2, Lock, Shield, X } from "lucide-react";

export function PortalPinSection({ clientId }: { clientId: string }) {
  const [hasPin, setHasPin] = useState(false);
  const [loading, setLoading] = useState(true);
  const [pin, setPin] = useState("");
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch(`/api/portal/has-pin/${clientId}`, { credentials: "include" })
      .then((r) => r.json())
      .then((d) => {
        setHasPin(d.hasPin);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [clientId]);

  const handleSetPin = async () => {
    if (pin.length !== 4 || !/^\d{4}$/.test(pin)) return;
    setSaving(true);
    try {
      const res = await fetch("/api/portal/set-pin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ clientId, pin }),
      });
      if (res.ok) {
        setHasPin(true);
        setEditing(false);
        setPin("");
      }
    } catch {}
    setSaving(false);
  };

  const handleRemovePin = async () => {
    setSaving(true);
    try {
      const res = await fetch("/api/portal/remove-pin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ clientId }),
      });
      if (res.ok) {
        setHasPin(false);
      }
    } catch {}
    setSaving(false);
  };

  if (loading) {
    return (
      <div
        className="rounded-2xl border border-black/10 bg-white/70 p-4 flex items-center gap-2"
        data-testid="card-portal-pin"
      >
        <Loader2 className="h-4 w-4 animate-spin text-black/30" />
        <span className="text-sm text-black/50">Loading portal access...</span>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-black/10 bg-white/70 p-4" data-testid="card-portal-pin">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Shield className="h-4 w-4 text-black/60" />
          <h3 className="text-sm font-semibold text-black">Portal Access</h3>
        </div>
        {hasPin && !editing && (
          <span
            className="flex items-center gap-1 text-xs text-emerald-600 bg-emerald-50 px-2 py-1 rounded-full"
            data-testid="badge-pin-active"
          >
            <Check className="h-3 w-3" /> PIN Active
          </span>
        )}
      </div>

      {!hasPin && !editing && (
        <div>
          <p className="text-sm text-black/50 mb-2">
            No portal PIN set. Set a 4-digit PIN to give this client access to the portal.
          </p>
          <button
            onClick={() => setEditing(true)}
            className="px-3 py-1.5 text-xs font-medium rounded-lg bg-black text-white hover:bg-black/80 transition-colors"
            data-testid="button-set-pin"
          >
            Set Portal PIN
          </button>
        </div>
      )}

      {editing && (
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <Lock className="h-4 w-4 text-black/40" />
            <input
              type="text"
              inputMode="numeric"
              maxLength={4}
              value={pin}
              onChange={(e) => setPin(e.target.value.replace(/\D/g, "").slice(0, 4))}
              placeholder="Enter 4-digit PIN"
              className="w-32 px-3 py-1.5 text-sm border border-black/10 rounded-lg bg-white/80 tracking-widest text-center focus:outline-none focus:ring-2 focus:ring-black/20"
              data-testid="input-set-pin"
            />
            <button
              onClick={handleSetPin}
              disabled={pin.length !== 4 || saving}
              className="p-1.5 rounded-lg bg-emerald-500 text-white hover:bg-emerald-600 disabled:opacity-40 transition-colors"
              data-testid="button-confirm-pin"
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
            </button>
            <button
              onClick={() => {
                setEditing(false);
                setPin("");
              }}
              className="p-1.5 rounded-lg bg-black/10 text-black/60 hover:bg-black/20 transition-colors"
              data-testid="button-cancel-pin"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          <p className="text-xs text-black/40">
            The client will use this PIN with their email to log in to the portal.
          </p>
        </div>
      )}

      {hasPin && !editing && (
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-black/60">
              PIN: <span className="tracking-widest">****</span>
            </p>
            <p className="text-xs text-black/40 mt-1">Client can log in with their email + this PIN</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setEditing(true)}
              className="px-3 py-1.5 text-xs font-medium rounded-lg bg-black/10 text-black/70 hover:bg-black/20 transition-colors"
              data-testid="button-change-pin"
            >
              Change
            </button>
            <button
              onClick={handleRemovePin}
              disabled={saving}
              className="px-3 py-1.5 text-xs font-medium rounded-lg bg-red-50 text-red-600 hover:bg-red-100 transition-colors"
              data-testid="button-remove-pin"
            >
              {saving ? <Loader2 className="h-3 w-3 animate-spin" /> : "Remove"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

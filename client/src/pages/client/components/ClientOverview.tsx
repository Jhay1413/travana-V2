import { useState, useEffect } from "react";
import { Mail, Phone, MapPin, Calendar, TrendingUp, Lock, Check, X, Loader2, Shield } from "lucide-react";
import { Card } from "@/components/ui/card";
import { currency } from "../utils/formatters";
import type { Client } from "../utils/types";

interface ClientOverviewProps {
  client: Client;
  clientId?: string;
}

function PortalPinSection({ clientId }: { clientId: string }) {
  const [hasPin, setHasPin] = useState(false);
  const [loading, setLoading] = useState(true);
  const [pin, setPin] = useState("");
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch(`/api/portal/has-pin/${clientId}`, { credentials: "include" })
      .then(r => r.json())
      .then(d => { setHasPin(d.hasPin); setLoading(false); })
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
      <Card className="p-6 border-black/10 bg-white/80 backdrop-blur-xl" data-testid="card-portal-pin">
        <div className="flex items-center gap-2">
          <Loader2 className="h-4 w-4 animate-spin text-black/30" />
          <span className="text-sm text-black/50">Loading portal access...</span>
        </div>
      </Card>
    );
  }

  return (
    <Card className="p-6 border-black/10 bg-white/80 backdrop-blur-xl" data-testid="card-portal-pin">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Shield className="h-4 w-4 text-purple-600" />
          <h3 className="text-sm font-semibold text-black">Portal Access</h3>
        </div>
        {hasPin && !editing && (
          <span className="flex items-center gap-1 text-xs text-emerald-600 bg-emerald-50 px-2 py-1 rounded-full" data-testid="badge-pin-active">
            <Check className="h-3 w-3" /> PIN Active
          </span>
        )}
      </div>

      {!hasPin && !editing && (
        <div className="space-y-3">
          <p className="text-sm text-black/50">No portal PIN set. Set a 4-digit PIN to give this client access to the portal.</p>
          <button
            onClick={() => setEditing(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-purple-600 text-white text-sm font-medium hover:bg-purple-700 transition-colors"
            data-testid="button-set-pin"
          >
            <Lock className="h-3.5 w-3.5" />
            Set Portal PIN
          </button>
        </div>
      )}

      {editing && (
        <div className="space-y-3">
          <div className="flex items-center gap-3">
            <div className="relative flex-1">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-black/30" />
              <input
                type="text"
                inputMode="numeric"
                maxLength={4}
                value={pin}
                onChange={e => setPin(e.target.value.replace(/\D/g, "").slice(0, 4))}
                placeholder="Enter 4-digit PIN"
                className="w-full pl-10 pr-4 py-2 rounded-lg border border-black/10 text-sm tracking-[0.3em] text-center focus:outline-none focus:ring-2 focus:ring-purple-500/30 focus:border-purple-500"
                autoFocus
                data-testid="input-set-pin"
              />
            </div>
            <button
              onClick={handleSetPin}
              disabled={pin.length !== 4 || saving}
              className="p-2 rounded-lg bg-emerald-600 text-white disabled:opacity-40 hover:bg-emerald-700 transition-colors"
              data-testid="button-confirm-pin"
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
            </button>
            <button
              onClick={() => { setEditing(false); setPin(""); }}
              className="p-2 rounded-lg bg-black/5 text-black/50 hover:bg-black/10 transition-colors"
              data-testid="button-cancel-pin"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          <p className="text-xs text-black/40">The client will use this PIN with their email to log in to the portal.</p>
        </div>
      )}

      {hasPin && !editing && (
        <div className="flex items-center gap-3">
          <div className="flex-1">
            <p className="text-sm text-black/60">PIN: <span className="tracking-widest">****</span></p>
            <p className="text-xs text-black/40 mt-1">Client can log in with their email + this PIN</p>
          </div>
          <button
            onClick={() => setEditing(true)}
            className="px-3 py-1.5 rounded-lg text-xs font-medium text-purple-600 bg-purple-50 hover:bg-purple-100 transition-colors"
            data-testid="button-change-pin"
          >
            Change
          </button>
          <button
            onClick={handleRemovePin}
            disabled={saving}
            className="px-3 py-1.5 rounded-lg text-xs font-medium text-red-600 bg-red-50 hover:bg-red-100 transition-colors disabled:opacity-40"
            data-testid="button-remove-pin"
          >
            {saving ? <Loader2 className="h-3 w-3 animate-spin" /> : "Remove"}
          </button>
        </div>
      )}
    </Card>
  );
}

export function ClientOverview({ client, clientId }: ClientOverviewProps) {
  const resolvedId = clientId || (client as any).id || "";

  return (
    <div className="space-y-6">
      {resolvedId && <PortalPinSection clientId={resolvedId} />}

      <Card className="p-6 border-black/10 bg-white/80 backdrop-blur-xl">
        <h3 className="text-sm font-semibold text-black mb-4">Contact Information</h3>
        <div className="space-y-3">
          {client.email && (
            <div className="flex items-center gap-3 text-sm">
              <Mail className="h-4 w-4 text-black/40" />
              <span className="text-black/70">{client.email}</span>
            </div>
          )}
          {client.phone && (
            <div className="flex items-center gap-3 text-sm">
              <Phone className="h-4 w-4 text-black/40" />
              <span className="text-black/70">{client.phone}</span>
            </div>
          )}
          {client.location && (
            <div className="flex items-center gap-3 text-sm">
              <MapPin className="h-4 w-4 text-black/40" />
              <span className="text-black/70">{client.location}</span>
            </div>
          )}
        </div>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="p-4 border-black/10 bg-white/80 backdrop-blur-xl">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-emerald-500/10">
              <TrendingUp className="h-5 w-5 text-emerald-600" />
            </div>
            <div>
              <p className="text-xs text-black/50">Lifetime Value</p>
              <p className="text-lg font-semibold">{currency.format(client.value)}</p>
            </div>
          </div>
        </Card>

        {client.nextTrip && (
          <Card className="p-4 border-black/10 bg-white/80 backdrop-blur-xl">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-blue-500/10">
                <Calendar className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <p className="text-xs text-black/50">Next Trip</p>
                <p className="text-sm font-semibold">{client.nextTrip}</p>
              </div>
            </div>
          </Card>
        )}

        {client.lastTouch && (
          <Card className="p-4 border-black/10 bg-white/80 backdrop-blur-xl">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-purple-500/10">
                <Calendar className="h-5 w-5 text-purple-600" />
              </div>
              <div>
                <p className="text-xs text-black/50">Last Touch</p>
                <p className="text-sm font-semibold">{client.lastTouch}</p>
              </div>
            </div>
          </Card>
        )}
      </div>
    </div>
  );
}

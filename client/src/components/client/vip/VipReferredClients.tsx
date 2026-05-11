import { Calendar, Mail, Phone, UserPlus, Users } from "lucide-react";
import type { VipReferredClient } from "@/api/endpoints/referral.api";
import { formatVipDate } from "./vip-utils";

interface VipReferredClientsProps {
  clients: VipReferredClient[];
}

export function VipReferredClients({ clients }: VipReferredClientsProps) {
  return (
    <div className="rounded-2xl border border-black/10 bg-white/70 p-4" data-testid="vip-referred-clients">
      <div className="mb-3 flex items-center gap-2">
        <UserPlus className="h-4 w-4 text-purple-500" />
        <span className="text-xs font-semibold text-black/80">Clients Referred</span>
        {clients.length > 0 && (
          <span className="ml-auto rounded-full bg-purple-500/10 px-2 py-0.5 text-[11px] font-semibold text-purple-600">
            {clients.length}
          </span>
        )}
      </div>

      {clients.length === 0 ? (
        <div className="rounded-xl border border-dashed border-black/10 bg-white/40 p-6 text-center">
          <Users className="mx-auto mb-2 h-8 w-8 text-black/15" />
          <p className="text-sm text-black/45">No clients referred yet</p>
          <p className="mt-0.5 text-xs text-black/35">Clients referred by this member will appear here</p>
        </div>
      ) : (
        <div className="divide-y divide-black/[0.06]">
          {clients.map((c) => {
            const initials =
              [c.firstName?.[0], c.surename?.[0]].filter(Boolean).join("").toUpperCase() || "?";
            const name = [c.firstName, c.surename].filter(Boolean).join(" ") || "Unknown";
            return (
              <div
                key={c.id}
                className="flex items-center gap-3 py-2.5 first:pt-0 last:pb-0"
                data-testid={`vip-referred-client-${c.id}`}
              >
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-purple-500/10 text-xs font-bold text-purple-600">
                  {initials}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-semibold text-black/85">{name}</div>
                  <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-black/45">
                    {c.email && (
                      <span className="flex items-center gap-1">
                        <Mail className="h-3 w-3" />
                        {c.email}
                      </span>
                    )}
                    {c.phoneNumber && (
                      <span className="flex items-center gap-1">
                        <Phone className="h-3 w-3" />
                        {c.phoneNumber}
                      </span>
                    )}
                  </div>
                </div>
                {c.createdAt && (
                  <div className="shrink-0 text-right text-[10px] text-black/35">
                    <div className="flex items-center gap-1">
                      <Calendar className="h-3 w-3" />
                      Joined {formatVipDate(c.createdAt)}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

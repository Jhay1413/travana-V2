import { Mail, Phone, MapPin, Calendar, TrendingUp } from "lucide-react";
import { Card } from "@/components/ui/card";
import { currency } from "../utils/formatters";
import type { Client } from "../utils/types";

interface ClientOverviewProps {
  client: Client;
}

export function ClientOverview({ client }: ClientOverviewProps) {
  return (
    <div className="space-y-6">
      {/* Contact Information */}
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

      {/* Client Stats */}
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

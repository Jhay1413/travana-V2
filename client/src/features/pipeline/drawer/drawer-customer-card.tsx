import { useLocation } from "wouter";
import { MessageCircle, Phone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { InitialsAvatar } from "@/features/agent-overview/components/dashboard-ui";
import { buildClientInboxHref } from "@/features/conversations";
import { useNeonClient } from "@/hooks/queries";
import type { Transaction } from "@/features/quote/types";
import { getClientPhone } from "@/features/pipeline/lib/pipeline-helpers";
import { OUTLINE_ACTION } from "@/features/pipeline/shared/button-styles";

/** Customer card: avatar, name link to the client page, phone, Call and Chat. */
export function DrawerCustomerCard({ transaction: t, clientName }: { transaction: Transaction; clientName: string }) {
  const [, setLocation] = useLocation();
  const { data: client } = useNeonClient(t.client_id || "");
  const phone = (client?.phoneNumber && client.phoneNumber !== "NULL" ? client.phoneNumber : null) ?? getClientPhone(t);
  const btn = `${OUTLINE_ACTION} h-9 px-3.5`;

  return (
    <div className="flex flex-wrap items-center gap-3 rounded-xl border border-pipeline-card-border px-3.5 py-3">
      <InitialsAvatar name={clientName} className="h-[42px] w-[42px] text-[14px]" />
      <div className="min-w-[160px] flex-1">
        <button
          type="button"
          disabled={!t.client_id}
          onClick={() => t.client_id && setLocation(`/clients/${t.client_id}`)}
          title="Open client page"
          className="text-left text-[15px] font-semibold underline decoration-[#C9D2DF] underline-offset-[3px]"
        >
          {clientName}
        </button>
        <div className="mt-0.5 flex flex-col gap-0.5 text-[12.5px] text-social-muted">
          {phone && <span className="inline-flex items-center gap-1.5"><Phone className="h-[13px] w-[13px]" strokeWidth={2} />{phone}</span>}
        </div>
      </div>
      {phone && (
        <Button asChild variant="outline" className={btn}>
          <a href={`tel:${phone}`}><Phone className="h-4 w-4" />Call</a>
        </Button>
      )}
      <Button type="button" variant="outline" className={btn} onClick={() => setLocation(t.client_id ? buildClientInboxHref(t.client_id) : "/conversations")}>
        <MessageCircle className="h-4 w-4" />Chat
      </Button>
    </div>
  );
}

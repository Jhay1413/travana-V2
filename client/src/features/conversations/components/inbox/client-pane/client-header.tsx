import { Link } from "wouter";
import { ExternalLink, Loader2, Mail, Phone, Plus } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { clientDisplayName } from "@/lib/utils";
import { useUnlinkContact } from "../../../api/use-contact-link";
import type { Conversation } from "../../../types";
import type { NeonClient } from "@/features/client";
import { ChannelAvatar, CopyButton, TagPill } from "../shared";

function memberSince(value: string | null | undefined): string | null {
  if (!value) return null;
  const d = new Date(value);
  if (isNaN(d.getTime())) return null;
  return d.toLocaleDateString("en-GB", { month: "short", year: "numeric" });
}

interface ClientHeaderProps {
  conversation: Conversation;
  client: NeonClient;
  onCreateEnquiry(): void;
  creatingEnquiry?: boolean;
}

export function ClientHeader({ conversation, client, onCreateEnquiry, creatingEnquiry = false }:ClientHeaderProps) {
  const { toast } = useToast();
  const unlinkContact = useUnlinkContact(conversation.contact.id);
  const name = clientDisplayName(client);
  const since = memberSince(client.createdAt);
  const tags = conversation.tags ?? [];

  const unlink = async () => {
    try {
      await unlinkContact.mutateAsync();
      toast({ title: "Unlinked", description: "This contact is no longer linked to a client." });
    } catch (err) {
      toast({ title: "Couldn't unlink", description: (err as Error).message, variant: "destructive" });
    }
  };

  return (
    <>
      <div className="px-5 pb-4 pt-5 text-center">
        <div className="flex justify-center">
          <ChannelAvatar
            name={name}
            avatarUrl={conversation.contact.avatarUrl}
            channel={conversation.channel}
            size={64}
            badge={false}
          />
        </div>
        <h2 className="mt-2.5 text-[18px] font-semibold">
          <Link href={`/clients/${client.id}`} className="hover:underline">
            {name}
          </Link>
        </h2>
        {since && <p className="text-[12px] text-social-muted">Client since {since}</p>}
        {tags.length > 0 && (
          <div className="mt-2 flex flex-wrap justify-center gap-1.5">
            {tags.map((t) => (
              <TagPill key={t.id} tag={t} />
            ))}
          </div>
        )}
      </div>
      {(client.phoneNumber || client.email) && (
        <div className="px-5 pb-4">
          {client.phoneNumber && (
            <div className="flex items-center gap-2.5 py-1.5 text-[13px]">
              <Phone className="h-4 w-4 shrink-0 text-social-muted" />
              <span className="min-w-0 flex-1 truncate">{client.phoneNumber}</span>
              <CopyButton value={client.phoneNumber} label="Copy phone" />
            </div>
          )}
          {client.email && (
            <div className="flex items-center gap-2.5 py-1.5 text-[13px]">
              <Mail className="h-4 w-4 shrink-0 text-social-muted" />
              <span className="min-w-0 flex-1 truncate">{client.email}</span>
              <CopyButton value={client.email} label="Copy email" />
            </div>
          )}
        </div>
      )}
      <div className="flex flex-col gap-2 px-5 pb-4">
        <button
          type="button"
          onClick={onCreateEnquiry}
          disabled={creatingEnquiry}
          className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-[10px] bg-social-orange text-[14px] font-semibold text-[#1F2937] hover:bg-social-orange-text disabled:opacity-60"
        >
          {creatingEnquiry ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
          {creatingEnquiry ? "Drafting…" : "Create enquiry"}
        </button>
        <Link
          href={`/clients/${client.id}`}
          className="inline-flex h-[38px] w-full items-center justify-center gap-1.5 rounded-[10px] border border-social-border bg-card text-[13px] font-semibold"
        >
          Open client page
          <ExternalLink className="h-3.5 w-3.5 text-social-muted" />
        </Link>
        <div className="flex justify-end">
          <button
            type="button"
            onClick={unlink}
            disabled={unlinkContact.isPending}
            title="Unlink this client"
            className="inline-flex items-center gap-1 text-[11px] text-social-muted transition hover:text-red-600 disabled:opacity-50"
            data-testid="client-unlink"
          >
            {unlinkContact.isPending && <Loader2 className="h-3 w-3 animate-spin" />}
            Unlink
          </button>
        </div>
      </div>
    </>
  );
}

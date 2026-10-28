import { useState } from "react";
import { Loader2, RefreshCw, Trash2 } from "lucide-react";
import type { SsChannel } from "@/features/conversations";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { StatusPill } from "@/components/shared/status-pill";
import { OUTLINE_ACTION, PRIMARY_ACTION } from "@/features/pipeline/shared/button-styles";
import { useToast } from "@/hooks/use-toast";
import { useDeleteTemplate, useQuoteTemplateSettings, useSyncTemplates, useWhatsappTemplates } from "../api/use-whatsapp-templates";
import { isSavedQuoteTemplate } from "../lib/quote-template";
import { templateStatus, truncateBody } from "../lib/template-status";
import { apiErrorMessage } from "../lib/whatsapp-channels";
import type { WaTemplate } from "../types";
import { CARD } from "./classes";
import { QuoteTemplateSection } from "./quote-template-section";
import { RequestTemplateDialog } from "./request-template-dialog";

interface WhatsappTemplatesCardProps {
  /** Connected WhatsApp channels; the card is only rendered when there is at least one. */
  channels: SsChannel[];
  canWrite: boolean;
}

const channelName = (c: SsChannel) => c.name || c.phone_number_formatted || c.identifier || c.id;

/** Approved WhatsApp templates for the org's number, plus the template used for quote links. */
export function WhatsappTemplatesCard({ channels, canWrite }: WhatsappTemplatesCardProps) {
  const { toast } = useToast();
  const [pickedId, setPickedId] = useState<string | null>(null);
  const channelId = channels.find((c) => c.id === pickedId)?.id ?? channels[0]?.id ?? null;
  const list = useWhatsappTemplates(channelId);
  const quoteSettings = useQuoteTemplateSettings(canWrite);
  const sync = useSyncTemplates();
  const remove = useDeleteTemplate();
  const [requestOpen, setRequestOpen] = useState(false);
  const [confirm, setConfirm] = useState<WaTemplate | null>(null);

  if (!channelId) return null;
  const templates = list.data?.templates ?? [];

  const runSync = async () => {
    try {
      const r = await sync.mutateAsync(channelId);
      toast({
        title: `Synced: ${r.added} added, ${r.updated} updated, ${r.removed} removed`,
        description: r.errors.length > 0 ? r.errors[0] : undefined,
      });
    } catch (err) {
      toast({ title: "Couldn't sync", description: apiErrorMessage(err), variant: "destructive" });
    }
  };

  const runDelete = async (t: WaTemplate) => {
    try {
      await remove.mutateAsync(t.id);
      toast({ title: "Template deleted" });
    } catch (err) {
      toast({ title: "Couldn't delete", description: apiErrorMessage(err), variant: "destructive" });
    }
  };

  return (
    <section className={CARD} aria-labelledby="int-templates-h" data-testid="integrations-templates-card">
      <div className="flex min-w-0 flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <h2 className="text-[15px] font-semibold xl:text-base" id="int-templates-h">
            WhatsApp templates
          </h2>
          <p className="text-[12px] text-social-muted xl:text-[13px]">
            Approved templates let you message a client after the 24-hour window closes. Meta reviews new templates in 24–48 hours.
          </p>
        </div>
        {canWrite && (
          <div className="flex shrink-0 items-center gap-2">
            <Button type="button" variant="outline" className={OUTLINE_ACTION} disabled={sync.isPending} onClick={() => void runSync()} data-testid="button-sync-templates">
              {sync.isPending ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <RefreshCw className="h-4 w-4" aria-hidden />}
              Sync
            </Button>
            <Button type="button" className={PRIMARY_ACTION} onClick={() => setRequestOpen(true)} data-testid="button-request-template">
              Request a template
            </Button>
          </div>
        )}
      </div>

      {channels.length > 1 && (
        <Select value={channelId} onValueChange={setPickedId}>
          <SelectTrigger className="h-9 max-w-xs text-[13px]" aria-label="WhatsApp number" data-testid="select-template-channel">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {channels.map((c) => (
              <SelectItem key={c.id} value={c.id}>
                {channelName(c)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}

      {list.isLoading ? (
        <div className="flex items-center gap-2 py-6 text-[13px] text-social-muted">
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> Loading templates…
        </div>
      ) : list.isError ? (
        <p className="py-4 text-[13px] text-social-muted" data-testid="templates-error">
          Couldn't load templates. Refresh to try again.
        </p>
      ) : templates.length === 0 ? (
        <div className="py-8 text-center text-[13px] text-social-muted" data-testid="templates-empty">
          No templates yet. Sync to pull templates you already created in Meta, or request a new one.
        </div>
      ) : (
        <ul className="flex flex-col divide-y divide-social-border">
          {templates.map((t) => {
            const status = templateStatus(t.status);
            return (
              <li key={t.id} className="flex min-w-0 items-center gap-3 py-3" data-testid={`template-row-${t.id}`}>
                <div className="min-w-0 flex-1">
                  <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1">
                    <span className="truncate font-mono text-[13px] font-semibold">{t.name}</span>
                    <span className="text-[12px] text-social-muted xl:text-[13px]">
                      {t.language} · {t.category.toLowerCase()}
                    </span>
                  </div>
                  <div className="truncate text-[12px] text-social-muted xl:text-[13px]" title={t.body_text}>
                    {truncateBody(t.body_text)}
                  </div>
                </div>
                <StatusPill tone={status.tone}>{status.label}</StatusPill>
                {canWrite && (
                  <Button
                    type="button"
                    variant="outline"
                    className={OUTLINE_ACTION}
                    aria-label={`Delete ${t.name}`}
                    onClick={() => setConfirm(t)}
                    data-testid={`button-delete-template-${t.id}`}
                  >
                    <Trash2 className="h-4 w-4" aria-hidden />
                  </Button>
                )}
              </li>
            );
          })}
        </ul>
      )}

      {canWrite && !list.isLoading && !list.isError && templates.some((t) => t.status === "APPROVED") && (
        <QuoteTemplateSection channelId={channelId} templates={templates} canWrite={canWrite} channels={channels} />
      )}

      <RequestTemplateDialog open={requestOpen} channelId={channelId} onClose={() => setRequestOpen(false)} />
      <AlertDialog open={confirm !== null} onOpenChange={(o) => !o && setConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {confirm?.name}?</AlertDialogTitle>
            <AlertDialogDescription>
              This removes the template from Meta as well. If it is the quote link template, quote links will go back to being sent from the agent's phone.
              {confirm && isSavedQuoteTemplate(confirm, quoteSettings.data) && (
                <span className="mt-2 block" data-testid="delete-quote-template-warning">
                  This is the template used for quote links. After deleting it, quote links outside the 24-hour window will fall back to sending from your phone until you choose another.
                </span>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              data-testid="button-confirm-delete-template"
              onClick={() => {
                if (confirm) void runDelete(confirm);
              }}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  );
}

import { useState } from "react";
import { FileText, Loader2, Plus, RefreshCw, Trash2 } from "lucide-react";
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
import { StatusPill } from "@/components/shared/status-pill";
import { OUTLINE_ACTION, PRIMARY_ACTION } from "@/features/pipeline/shared/button-styles";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { useDeleteTemplate, useSyncTemplates } from "../api/use-whatsapp-templates";
import { isSavedTemplate } from "../lib/quote-template";
import { templateStatus } from "../lib/template-status";
import { apiErrorMessage } from "../lib/whatsapp-channels";
import type { TemplateSettings, WaTemplate } from "../types";
import { CARD, CARD_OUTLINE, CARD_PRIMARY, ICON_ACTION } from "./classes";
import { RequestTemplateDialog } from "./request-template-dialog";

interface WhatsappTemplatesCardProps {
  channel: SsChannel;
  templates: WaTemplate[];
  loading: boolean;
  error: boolean;
  canWrite: boolean;
  quoteSettings: TemplateSettings | undefined;
  updateSettings: TemplateSettings | undefined;
}

function lastSynced(templates: WaTemplate[]): string | null {
  const latest = templates.map((t) => t.last_synced_at).filter((v): v is string => !!v).sort().at(-1);
  if (!latest) return null;
  return new Date(latest).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
}

function TemplateRow({ template, isQuote, isUpdate, canWrite, onDelete }: { template: WaTemplate; isQuote: boolean; isUpdate: boolean; canWrite: boolean; onDelete: () => void }) {
  const status = templateStatus(template.status);
  return (
    <li className="flex min-w-0 items-start gap-3 py-3 first:pt-0 last:pb-0" data-testid={`template-row-${template.id}`}>
      <div className="min-w-0 flex-1">
        <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
          <span className="truncate text-[13px] font-semibold xl:text-[14px]">{template.name}</span>
          <span className="text-[11px] text-social-muted">
            {template.language} · {template.category.toLowerCase()}
          </span>
          {isQuote && (
            <span className="rounded-md bg-status-posted-bg px-1.5 py-[1px] text-[11px] font-semibold text-status-posted-fg" data-testid="template-quote-tag">
              Quote link
            </span>
          )}
          {isUpdate && (
            <span className="rounded-md bg-status-posted-bg px-1.5 py-[1px] text-[11px] font-semibold text-status-posted-fg" data-testid="template-update-tag">
              Updates
            </span>
          )}
        </div>
        <p className="mt-0.5 line-clamp-2 text-[12px] leading-snug text-social-muted xl:text-[13px]" title={template.body_text}>
          {template.body_text}
        </p>
      </div>
      <StatusPill tone={status.tone} className="mt-0.5">
        {status.label}
      </StatusPill>
      {canWrite && (
        <button type="button" className={cn(ICON_ACTION, "-my-1.5 -mr-2")} aria-label={`Delete ${template.name}`} title="Delete" onClick={onDelete} data-testid={`button-delete-template-${template.id}`}>
          <Trash2 className="h-4 w-4" aria-hidden />
        </button>
      )}
    </li>
  );
}

/** The templates Meta knows for this number: sync them, request a new one, delete one. */
export function WhatsappTemplatesCard({ channel, templates, loading, error, canWrite, quoteSettings, updateSettings }: WhatsappTemplatesCardProps) {
  const { toast } = useToast();
  const sync = useSyncTemplates();
  const remove = useDeleteTemplate();
  const [requestOpen, setRequestOpen] = useState(false);
  const [confirm, setConfirm] = useState<WaTemplate | null>(null);
  const synced = lastSynced(templates);

  const runSync = async () => {
    try {
      const r = await sync.mutateAsync(channel.id);
      toast({
        title: r.added + r.updated + r.removed === 0 ? "Templates are up to date" : `Synced: ${r.added} added, ${r.updated} updated, ${r.removed} removed`,
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

  const syncButton = (
    <Button type="button" variant="outline" className={cn(OUTLINE_ACTION, CARD_OUTLINE)} disabled={sync.isPending} onClick={() => void runSync()} data-testid="button-sync-templates">
      {sync.isPending ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <RefreshCw className="h-4 w-4" aria-hidden />}
      Sync from Meta
    </Button>
  );

  return (
    <section className={cn(CARD, "gap-3")} aria-labelledby="int-templates-h" data-testid="integrations-templates-card">
      <div className="flex min-w-0 flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <h3 className="text-[14px] font-semibold xl:text-[15px]" id="int-templates-h">
            Templates
          </h3>
          <p className="mt-0.5 text-[12px] text-social-muted xl:text-[13px]">
            {synced ? `Last synced ${synced}. ` : ""}Meta reviews a new template in 24–48 hours.
          </p>
        </div>
        {canWrite && (
          <div className="flex shrink-0 items-center gap-2">
            {syncButton}
            <Button type="button" className={cn(PRIMARY_ACTION, CARD_PRIMARY)} onClick={() => setRequestOpen(true)} data-testid="button-request-template">
              <Plus className="h-4 w-4" aria-hidden />
              Request
            </Button>
          </div>
        )}
      </div>

      {loading ? (
        <div className="flex items-center gap-2 py-8 text-[13px] text-social-muted">
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> Loading templates…
        </div>
      ) : error ? (
        <p className="py-6 text-[13px] text-social-muted" data-testid="templates-error">
          Couldn't load templates. Refresh to try again.
        </p>
      ) : templates.length === 0 ? (
        <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-social-border px-4 py-8 text-center" data-testid="templates-empty">
          <span className="grid h-10 w-10 place-items-center rounded-full bg-social-page text-social-muted" aria-hidden>
            <FileText className="h-5 w-5" />
          </span>
          <b className="text-[14px] font-semibold">No templates here yet</b>
          <p className="max-w-sm text-[12px] text-social-muted xl:text-[13px]">
            {canWrite ? "Pull in the templates already approved on this number, or request a new one." : "Nothing has been synced from Meta for this number."}
          </p>
          {canWrite && <div className="mt-1">{syncButton}</div>}
        </div>
      ) : (
        <ul className="flex flex-col divide-y divide-social-border">
          {templates.map((t) => (
            <TemplateRow key={t.id} template={t} isQuote={isSavedTemplate(t, quoteSettings, channel.id)} isUpdate={isSavedTemplate(t, updateSettings, channel.id)} canWrite={canWrite} onDelete={() => setConfirm(t)} />
          ))}
        </ul>
      )}

      <RequestTemplateDialog open={requestOpen} channelId={channel.id} onClose={() => setRequestOpen(false)} />
      <AlertDialog open={confirm !== null} onOpenChange={(o) => !o && setConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {confirm?.name}?</AlertDialogTitle>
            <AlertDialogDescription>
              This removes the template from Meta as well; you would need to request and get it approved again.
              {confirm && isSavedTemplate(confirm, quoteSettings, channel.id) && (
                <span className="mt-2 block font-medium text-foreground" data-testid="delete-quote-template-warning">
                  It is the quote link template. Until you choose another, quote links outside the 24-hour window will be sent from the agent's phone.
                </span>
              )}
              {confirm && isSavedTemplate(confirm, updateSettings, channel.id) && (
                <span className="mt-2 block font-medium text-foreground" data-testid="delete-update-template-warning">
                  It is the General update template. Until you choose another, agents can't message clients whose 24-hour window has closed.
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

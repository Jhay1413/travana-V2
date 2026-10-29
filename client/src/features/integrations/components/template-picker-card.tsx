import { useEffect, useMemo, useState } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PRIMARY_ACTION } from "@/features/pipeline/shared/button-styles";
import type { SsChannel } from "@/features/conversations";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { extractPlaceholders, mappingsComplete, previewSegments, resolveMappings } from "../lib/template-placeholders";
import { isSavedOnOtherChannel } from "../lib/quote-template";
import { apiErrorMessage, channelName } from "../lib/whatsapp-channels";
import type { TemplateKind, TemplateSettings, TemplateVariableMapping, TemplateVariableSource, WaTemplate } from "../types";
import { CARD, CARD_PRIMARY, FIELD } from "./classes";

const NONE = "__none__";
const keyOf = (t: Pick<WaTemplate, "name" | "language">) => `${t.name}::${t.language}`;

const LABEL = "text-[11px] font-semibold uppercase tracking-[.06em] text-social-muted";

export interface TemplatePickerCopy {
  /** Prefix for test ids and the heading id, e.g. "quote-template". */
  idPrefix: string;
  title: string;
  description: string;
  /** Accessible name of the template select. */
  selectLabel: string;
  noneLabel: string;
  /** Start of the "currently uses X on Y" notice when the saved template lives on another number. */
  inUseBy: string;
  savedToast: string;
  clearedToast: string;
}

export interface TemplatePickerSource {
  value: TemplateVariableSource;
  label: string;
}

interface TemplatePickerCardProps {
  kind: TemplateKind;
  sources: TemplatePickerSource[];
  copy: TemplatePickerCopy;
  /** Saves the settings; the card reports the outcome itself. */
  save: { mutateAsync: (input: TemplateSettings) => Promise<unknown>; isPending: boolean };
  /** Extra rule on the mappings of a chosen template; the message blocks saving and is shown inline. */
  extraValidation?: (mappings: Record<string, TemplateVariableMapping>) => string | null;
  channelId: string;
  /** All templates of the channel; only APPROVED ones can be chosen. */
  templates: WaTemplate[];
  templatesLoading: boolean;
  templatesError: boolean;
  /** The org's saved settings of this kind, fetched by the parent for write roles only. */
  settings: TemplateSettings | undefined;
  settingsLoading: boolean;
  /** Connected channels, used to name the number a saved template lives on. */
  channels: SsChannel[];
}

/** WhatsApp-style outgoing bubble showing the template with example values in place of its placeholders. */
function BubblePreview({ template, mappings, testId }: { template: WaTemplate; mappings: Record<string, TemplateVariableMapping>; testId: string }) {
  const segments = previewSegments(template.body_text, mappings);
  return (
    <div className="rounded-xl bg-[#EFEAE2] p-3 dark:bg-[#0B141A]" data-testid={testId} title="Preview with example values">
      <div className="ml-auto w-fit max-w-[92%] whitespace-pre-wrap rounded-xl rounded-tr-[4px] bg-[#D9FDD3] px-3 py-2 text-[13px] leading-snug text-[#111B21] shadow-sm dark:bg-[#005C4B] dark:text-[#E9EDEF]">
        {template.header_text && <div className="mb-1 font-semibold">{template.header_text}</div>}
        {segments.map((s, i) =>
          s.kind === "value" ? (
            <mark key={i} className="rounded-[3px] bg-black/[.08] px-0.5 text-inherit dark:bg-white/15">
              {s.text}
            </mark>
          ) : (
            <span key={i}>{s.text}</span>
          ),
        )}
        {template.footer_text && <div className="mt-1 text-[12px] text-[#667781] dark:text-[#8696A0]">{template.footer_text}</div>}
      </div>
    </div>
  );
}

/** Which approved template is sent when a client's 24-hour window has closed, and what fills its placeholders. Shared by the quote and update cards. */
export function TemplatePickerCard({ kind, sources, copy, save, extraValidation, channelId, templates, templatesLoading, templatesError, settings: saved, settingsLoading, channels }: TemplatePickerCardProps) {
  const { toast } = useToast();
  const prefix = copy.idPrefix;
  const approved = useMemo(() => templates.filter((t) => t.status === "APPROVED"), [templates]);

  const [selected, setSelected] = useState<string>(NONE);
  const [mappings, setMappings] = useState<Record<string, TemplateVariableMapping>>({});
  const [dirty, setDirty] = useState(false);

  const template = approved.find((t) => keyOf(t) === selected) ?? null;
  const placeholders = useMemo(() => (template ? extractPlaceholders(template.body_text) : []), [template]);

  // Load the saved choice once it (or the template list) arrives, unless the user is editing.
  useEffect(() => {
    if (dirty || !saved) return;
    const match =
      saved.templateName && saved.channelId === channelId
        ? approved.find((t) => t.name === saved.templateName && t.language === (saved.templateLanguage ?? t.language))
        : undefined;
    if (match) {
      setSelected(keyOf(match));
      setMappings(resolveMappings(extractPlaceholders(match.body_text), saved.variables, kind));
    } else {
      setSelected(NONE);
      setMappings({});
    }
  }, [saved, approved, channelId, dirty, kind]);

  const choose = (value: string) => {
    const next = approved.find((t) => keyOf(t) === value);
    setSelected(value);
    setMappings(next ? resolveMappings(extractPlaceholders(next.body_text), saved?.variables, kind) : {});
    setDirty(true);
  };

  const setMapping = (p: string, patch: Partial<TemplateVariableMapping>) => {
    setMappings((prev) => ({ ...prev, [p]: { ...prev[p], ...patch } as TemplateVariableMapping }));
    setDirty(true);
  };

  const otherChannel = isSavedOnOtherChannel(saved, channelId);
  const otherChannelLabel = (() => {
    const c = channels.find((x) => x.id === saved?.channelId);
    return c ? channelName(c) : saved?.channelId;
  })();
  // A clear may only be sent from the channel that holds the saved template.
  const clearBlocked = otherChannel && !template;
  const problem = template && extraValidation ? extraValidation(mappings) : null;
  const canSave = dirty && !save.isPending && !clearBlocked && (!template || (mappingsComplete(mappings) && !problem));
  const inUse = !dirty && !!template;
  const noApproved = !templatesLoading && !templatesError && approved.length === 0;

  const submit = async () => {
    const body: TemplateSettings = template
      ? {
          templateName: template.name,
          templateLanguage: template.language,
          channelId,
          variables: Object.fromEntries(
            placeholders.map((p) => [p, mappings[p].source === "custom" ? { source: "custom" as const, text: (mappings[p].text ?? "").trim() } : { source: mappings[p].source }]),
          ),
        }
      : { templateName: null, templateLanguage: null, channelId, variables: {} };
    try {
      await save.mutateAsync(body);
      setDirty(false);
      toast({ title: template ? copy.savedToast : copy.clearedToast });
    } catch (err) {
      toast({ title: "Couldn't save", description: apiErrorMessage(err), variant: "destructive" });
    }
  };

  return (
    <section className={cn(CARD, "gap-4")} aria-labelledby={`int-${prefix}-h`} data-testid={`${prefix}-section`}>
      <div>
        <h3 className="text-[14px] font-semibold xl:text-[15px]" id={`int-${prefix}-h`}>
          {copy.title}
        </h3>
        <p className="mt-0.5 text-[12px] text-social-muted xl:text-[13px]">
          {copy.description}
        </p>
      </div>

      {otherChannel && (
        <p className="rounded-xl bg-stage-inplay-bg px-3 py-2 text-[12px] text-stage-inplay-fg xl:text-[13px]" data-testid={`${prefix}-other-channel`}>
          {copy.inUseBy} <b className="font-semibold">{saved?.templateName}</b> on {otherChannelLabel}. Saving here replaces that.
        </p>
      )}

      <div className="flex flex-col gap-1.5">
        <div className="flex items-center justify-between gap-2">
          <span className={LABEL}>Template</span>
          {inUse && (
            <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-status-scheduled-fg" data-testid={`${prefix}-in-use`}>
              <span className="h-1.5 w-1.5 rounded-full bg-current" aria-hidden />
              In use
            </span>
          )}
        </div>
        <Select value={selected} onValueChange={choose} disabled={settingsLoading || templatesLoading || templatesError || noApproved}>
          <SelectTrigger className={FIELD} aria-label={copy.selectLabel} data-testid={`select-${prefix}`}>
            <SelectValue placeholder="Choose a template" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={NONE}>{copy.noneLabel}</SelectItem>
            {approved.map((t) => (
              <SelectItem key={t.id} value={keyOf(t)}>
                {t.name} · {t.language}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {noApproved && (
          <p className="text-[12px] text-social-muted" data-testid={`${prefix}-no-approved`}>
            Only approved templates can be chosen. Sync from Meta, or request one and wait for approval.
          </p>
        )}
        {templatesError && <p className="text-[12px] text-social-muted">Templates couldn't be loaded, so nothing can be chosen right now.</p>}
      </div>

      {template && (
        <>
          {placeholders.length > 0 && (
            <div className="flex flex-col gap-2">
              <span className={LABEL}>What goes in each placeholder</span>
              <div className="flex flex-col gap-2">
                {placeholders.map((p) => {
                  const m = mappings[p];
                  if (!m) return null;
                  return (
                    <div key={p} className="grid min-w-0 grid-cols-[auto_minmax(0,1fr)] items-center gap-2" data-testid={`mapping-row-${p}`}>
                      <code className="inline-flex h-10 min-w-[52px] items-center justify-center rounded-[10px] bg-social-page px-2 text-[12px] font-semibold text-social-muted">{`{{${p}}}`}</code>
                      <div className="flex min-w-0 flex-wrap gap-2">
                        <Select value={m.source} onValueChange={(v) => setMapping(p, { source: v as TemplateVariableSource })}>
                          <SelectTrigger className={cn(FIELD, "w-[190px] shrink-0")} aria-label={`Source for placeholder ${p}`}>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {sources.map((s) => (
                              <SelectItem key={s.value} value={s.value}>
                                {s.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        {m.source === "custom" && (
                          <Input
                            className={cn(FIELD, "min-w-[160px] flex-1")}
                            placeholder="Text to send"
                            maxLength={200}
                            value={m.text ?? ""}
                            onChange={(e) => setMapping(p, { text: e.target.value })}
                            aria-label={`Fixed text for placeholder ${p}`}
                          />
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
          <div className="flex flex-col gap-1.5">
            <span className={LABEL}>How the client will see it</span>
            <BubblePreview template={template} mappings={mappings} testId={`${prefix}-preview`} />
          </div>
        </>
      )}

      <div className="mt-auto flex flex-wrap items-center gap-3 border-t border-social-border pt-4">
        <Button type="button" className={cn(PRIMARY_ACTION, CARD_PRIMARY)} disabled={!canSave} onClick={() => void submit()} data-testid={`button-save-${prefix}`}>
          {save.isPending && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
          Save
        </Button>
        {dirty && !save.isPending && (
          <span className="text-[12px] text-social-muted" data-testid={`${prefix}-unsaved`}>
            {template && !mappingsComplete(mappings) ? "Fill in every fixed-text placeholder to save." : problem ?? "Unsaved changes"}
          </span>
        )}
      </div>
    </section>
  );
}

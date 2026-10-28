import { useEffect, useMemo, useState } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PRIMARY_ACTION } from "@/features/pipeline/shared/button-styles";
import type { SsChannel } from "@/features/conversations";
import { useToast } from "@/hooks/use-toast";
import { useQuoteTemplateSettings, useSaveQuoteTemplateSettings } from "../api/use-whatsapp-templates";
import { extractPlaceholders, mappingsComplete, renderPreview, resolveMappings } from "../lib/template-placeholders";
import { isSavedOnOtherChannel } from "../lib/quote-template";
import { apiErrorMessage } from "../lib/whatsapp-channels";
import type { QuoteTemplateSettings, QuoteVariableMapping, QuoteVariableSource, WaTemplate } from "../types";

const NONE = "__none__";
const keyOf = (t: Pick<WaTemplate, "name" | "language">) => `${t.name}::${t.language}`;

const SOURCES: { value: QuoteVariableSource; label: string }[] = [
  { value: "client_first_name", label: "Client first name" },
  { value: "agent_name", label: "Agent name" },
  { value: "agency_name", label: "Agency name" },
  { value: "quote_link", label: "Quote link" },
  { value: "custom", label: "Fixed text" },
];

interface QuoteTemplateSectionProps {
  channelId: string;
  /** All templates of the channel; only APPROVED ones can be chosen. */
  templates: WaTemplate[];
  canWrite: boolean;
  /** Connected channels, used to name the number a saved template lives on. */
  channels: SsChannel[];
}

/** Which approved template is sent when a client's 24-hour window has closed, and what fills its placeholders. */
export function QuoteTemplateSection({ channelId, templates, canWrite, channels }: QuoteTemplateSectionProps) {
  const { toast } = useToast();
  const settings = useQuoteTemplateSettings();
  const save = useSaveQuoteTemplateSettings();
  const approved = useMemo(() => templates.filter((t) => t.status === "APPROVED"), [templates]);

  const [selected, setSelected] = useState<string>(NONE);
  const [mappings, setMappings] = useState<Record<string, QuoteVariableMapping>>({});
  const [dirty, setDirty] = useState(false);

  const saved = settings.data;
  const template = approved.find((t) => keyOf(t) === selected) ?? null;
  const placeholders = useMemo(() => (template ? extractPlaceholders(template.body_text) : []), [template]);

  // Load the saved choice once it (or the template list) arrives, unless the user is editing.
  useEffect(() => {
    if (dirty || !saved) return;
    const match = saved.templateName && saved.channelId === channelId
      ? approved.find((t) => t.name === saved.templateName && t.language === (saved.templateLanguage ?? t.language))
      : undefined;
    if (match) {
      setSelected(keyOf(match));
      setMappings(resolveMappings(extractPlaceholders(match.body_text), saved.variables));
    } else {
      setSelected(NONE);
      setMappings({});
    }
  }, [saved, approved, channelId, dirty]);

  const choose = (value: string) => {
    const next = approved.find((t) => keyOf(t) === value);
    setSelected(value);
    setMappings(next ? resolveMappings(extractPlaceholders(next.body_text), saved?.variables) : {});
    setDirty(true);
  };

  const setMapping = (p: string, patch: Partial<QuoteVariableMapping>) => {
    setMappings((prev) => ({ ...prev, [p]: { ...prev[p], ...patch } as QuoteVariableMapping }));
    setDirty(true);
  };

  const otherChannel = isSavedOnOtherChannel(saved, channelId);
  const otherChannelLabel = (() => {
    const c = channels.find((x) => x.id === saved?.channelId);
    return c ? c.name || c.phone_number_formatted || c.identifier || c.id : saved?.channelId;
  })();
  // A clear may only be sent from the channel that holds the saved template.
  const clearBlocked = otherChannel && !template;
  const canSave = dirty && !save.isPending && !clearBlocked && (!template || mappingsComplete(mappings));

  const submit = async () => {
    const body: QuoteTemplateSettings = template
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
      toast({ title: "Saved" });
    } catch (err) {
      toast({ title: "Couldn't save", description: apiErrorMessage(err), variant: "destructive" });
    }
  };

  return (
    <div className="flex min-w-0 flex-col gap-3 border-t border-social-border pt-4" data-testid="quote-template-section">
      <div>
        <h3 className="text-[14px] font-semibold">Quote link template</h3>
        <p className="text-[12px] text-social-muted xl:text-[13px]">
          Used when a client's 24-hour window has closed and an agent sends a quote link.
        </p>
      </div>
      {otherChannel && (
        <p className="text-[12px] text-social-muted xl:text-[13px]" data-testid="quote-template-other-channel">
          Quote links currently use {saved?.templateName} on {otherChannelLabel}. Saving a template here will replace it.
        </p>
      )}
      <Select value={selected} onValueChange={choose} disabled={!canWrite || settings.isLoading}>
        <SelectTrigger className="h-10 max-w-sm text-[13px]" aria-label="Quote link template" data-testid="select-quote-template">
          <SelectValue placeholder="Choose a template" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={NONE}>None (send from your phone)</SelectItem>
          {approved.map((t) => (
            <SelectItem key={t.id} value={keyOf(t)}>
              {t.name} · {t.language}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {template && (
        <>
          {placeholders.length > 0 && (
            <div className="flex flex-col gap-2">
              {placeholders.map((p) => {
                const m = mappings[p];
                if (!m) return null;
                return (
                  <div key={p} className="flex min-w-0 flex-wrap items-center gap-2" data-testid={`mapping-row-${p}`}>
                    <code className="w-10 shrink-0 text-[13px] font-semibold">{`{{${p}}}`}</code>
                    <Select value={m.source} onValueChange={(v) => setMapping(p, { source: v as QuoteVariableSource })} disabled={!canWrite}>
                      <SelectTrigger className="h-9 w-48 text-[13px]" aria-label={`Source for placeholder ${p}`}>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {SOURCES.map((s) => (
                          <SelectItem key={s.value} value={s.value}>
                            {s.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {m.source === "custom" && (
                      <Input
                        className="h-9 min-w-0 flex-1 text-[13px]"
                        placeholder="Text to send"
                        maxLength={200}
                        value={m.text ?? ""}
                        disabled={!canWrite}
                        onChange={(e) => setMapping(p, { text: e.target.value })}
                        aria-label={`Fixed text for placeholder ${p}`}
                      />
                    )}
                  </div>
                );
              })}
            </div>
          )}
          <p className="truncate text-[12px] text-social-muted xl:text-[13px]" title={renderPreview(template.body_text, mappings)} data-testid="quote-template-preview">
            Preview: {renderPreview(template.body_text, mappings)}
          </p>
        </>
      )}
      {canWrite && (
        <div>
          <Button type="button" className={PRIMARY_ACTION} disabled={!canSave} onClick={() => void submit()} data-testid="button-save-quote-template">
            {save.isPending && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
            Save
          </Button>
        </div>
      )}
    </div>
  );
}

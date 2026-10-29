import { useState } from "react";
import type { SsChannel } from "@/features/conversations";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { useQuoteTemplateSettings, useUpdateTemplateSettings, useWhatsappTemplates } from "../api/use-whatsapp-templates";
import { channelName } from "../lib/whatsapp-channels";
import { FIELD, SECTION_SUB, SECTION_TITLE } from "./classes";
import { QuoteTemplateCard } from "./quote-template-card";
import { UpdateTemplateCard } from "./update-template-card";
import { WhatsappTemplatesCard } from "./whatsapp-templates-card";

interface WhatsappSectionProps {
  /** Connected WhatsApp channels; the section is only rendered when there is at least one. */
  channels: SsChannel[];
  canWrite: boolean;
}

/** "WhatsApp templates": the templates on one of the org's numbers, and which one carries quote links. */
export function WhatsappSection({ channels, canWrite }: WhatsappSectionProps) {
  const [pickedId, setPickedId] = useState<string | null>(null);
  const channel = channels.find((c) => c.id === pickedId) ?? channels[0];
  const list = useWhatsappTemplates(channel?.id ?? null);
  const quoteSettings = useQuoteTemplateSettings(canWrite);
  const updateSettings = useUpdateTemplateSettings(canWrite);
  if (!channel) return null;
  const templates = list.data?.templates ?? [];

  return (
    <section className="flex min-w-0 flex-col gap-3" aria-labelledby="int-wa-h" data-testid="integrations-whatsapp">
      <div className="flex min-w-0 flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <h2 className={SECTION_TITLE} id="int-wa-h">
            WhatsApp templates
          </h2>
          <p className={SECTION_SUB}>
            Once a client has been quiet for 24 hours, WhatsApp only lets you message them with a template Meta has approved.
          </p>
        </div>
        {channels.length > 1 && (
          <Select value={channel.id} onValueChange={setPickedId}>
            <SelectTrigger className={cn(FIELD, "h-9 w-auto min-w-[200px] max-w-xs")} aria-label="WhatsApp number" data-testid="select-template-channel">
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
      </div>

      <div className={cn("grid gap-4", canWrite && "xl:grid-cols-[minmax(0,7fr)_minmax(0,5fr)]")}>
        <WhatsappTemplatesCard
          channel={channel}
          templates={templates}
          loading={list.isLoading}
          error={list.isError}
          canWrite={canWrite}
          quoteSettings={quoteSettings.data}
          updateSettings={updateSettings.data}
        />
        {canWrite && (
          <div className="flex min-w-0 flex-col gap-4">
            <QuoteTemplateCard
              key={`quote-${channel.id}`}
              channelId={channel.id}
              templates={templates}
              templatesLoading={list.isLoading}
              templatesError={list.isError}
              settings={quoteSettings.data}
              settingsLoading={quoteSettings.isLoading}
              channels={channels}
            />
            <UpdateTemplateCard
              key={`update-${channel.id}`}
              channelId={channel.id}
              templates={templates}
              templatesLoading={list.isLoading}
              templatesError={list.isError}
              settings={updateSettings.data}
              settingsLoading={updateSettings.isLoading}
              channels={channels}
            />
          </div>
        )}
      </div>
    </section>
  );
}

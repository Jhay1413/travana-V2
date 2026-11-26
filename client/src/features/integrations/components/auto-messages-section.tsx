import { useState } from "react";
import type { SsChannel } from "@/features/conversations";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { useAutoChannel, useCustomerMessagingReadiness, useSaveAutoChannel } from "../api/use-customer-messaging";
import { usePinResetTemplateSettings, useWhatsappTemplates } from "../api/use-whatsapp-templates";
import { apiErrorMessage, channelName } from "../lib/whatsapp-channels";
import type { AutoChannel, AutoMessagePurpose } from "../types";
import { AutoMessageCard } from "./auto-message-card";
import { FIELD, SECTION_SUB, SECTION_TITLE } from "./classes";
import { PinResetTemplateCard } from "./pin-reset-template-card";
import { ReadinessLine } from "./readiness-line";

const PURPOSES: AutoMessagePurpose[] = ["booking_confirmation", "portal_ready", "balance_reminder", "departure_reminder"];

interface AutoMessagesSectionProps {
  /** Connected WhatsApp channels; empty when none is connected (the cards then only show their status). */
  channels: SsChannel[];
}

/** "Automatic messages": how the messages the system sends by itself go out, and which template carries each type on WhatsApp. Managers only. */
export function AutoMessagesSection({ channels }: AutoMessagesSectionProps) {
  const { toast } = useToast();
  const [pickedId, setPickedId] = useState<string | null>(null);
  const channel = channels.find((c) => c.id === pickedId) ?? channels[0] ?? null;
  const setting = useAutoChannel();
  const readiness = useCustomerMessagingReadiness();
  const saveChannel = useSaveAutoChannel();
  const list = useWhatsappTemplates(channel?.id ?? null);
  const pinResetSettings = usePinResetTemplateSettings(true);
  const templates = list.data?.templates ?? [];
  const byPurpose = (p: AutoMessagePurpose | "portal_sign_in") => readiness.data?.purposes.find((x) => x.purpose === p);

  const changeChannel = async (next: string) => {
    try {
      await saveChannel.mutateAsync(next as AutoChannel);
      toast({ title: next === "sms" ? "Automatic messages will go by text" : "Automatic messages will go by WhatsApp" });
    } catch (err) {
      toast({ title: "Couldn't save", description: apiErrorMessage(err), variant: "destructive" });
    }
  };

  return (
    <section className="flex min-w-0 flex-col gap-3" aria-labelledby="int-auto-h" data-testid="integrations-auto-messages">
      <div className="flex min-w-0 flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <h2 className={SECTION_TITLE} id="int-auto-h">
            Automatic messages
          </h2>
          <p className={SECTION_SUB}>
            Messages your customers get without anyone sending them. They all go by one channel. If that channel can't deliver, nothing is sent: it never switches to the other one.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {channels.length > 1 && (
            <Select value={channel?.id ?? ""} onValueChange={setPickedId}>
              <SelectTrigger className={cn(FIELD, "h-9 w-auto min-w-[200px] max-w-xs")} aria-label="WhatsApp number for templates" data-testid="select-auto-template-channel">
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
          <Select value={setting.data?.autoChannel ?? ""} onValueChange={(v) => void changeChannel(v)} disabled={setting.isLoading || saveChannel.isPending}>
            <SelectTrigger className={cn(FIELD, "h-9 w-auto min-w-[200px]")} aria-label="Send automatic messages by" data-testid="select-auto-channel">
              <SelectValue placeholder="Send by" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="whatsapp">Send by WhatsApp</SelectItem>
              <SelectItem value="sms">Send by text message</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        {PURPOSES.map((purpose) => (
          <AutoMessageCard
            key={`${purpose}-${channel?.id ?? "none"}`}
            purpose={purpose}
            readiness={byPurpose(purpose)}
            channelId={channel?.id ?? null}
            templates={templates}
            templatesLoading={list.isLoading}
            templatesError={list.isError}
            channels={channels}
          />
        ))}
        {channel && (
          <PinResetTemplateCard
            key={`pin-reset-${channel.id}`}
            channelId={channel.id}
            templates={templates}
            templatesLoading={list.isLoading}
            templatesError={list.isError}
            settings={pinResetSettings.data}
            settingsLoading={pinResetSettings.isLoading}
            channels={channels}
            statusLine={<ReadinessLine readiness={byPurpose("portal_sign_in")} testId="auto-portal_sign_in" />}
          />
        )}
      </div>
    </section>
  );
}

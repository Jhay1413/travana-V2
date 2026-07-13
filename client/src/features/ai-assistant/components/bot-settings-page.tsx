import { useEffect, useState } from "react";
import { Bot, Loader2 } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { useBotConfig, useDisableBot, useEnableBot, useSetBotMode, useUpdateBotConfig } from "../api/use-bot-config";
import type { BotConfigUpdatePayload, BotMode } from "../types";

type FormState = {
  name: string;
  persona: string;
  preferredResponse: string;
  greeting: string;
  signOff: string;
  language: string;
  handoffInstructions: string;
};

const EMPTY_FORM: FormState = {
  name: "",
  persona: "",
  preferredResponse: "",
  greeting: "",
  signOff: "",
  language: "en-GB",
  handoffInstructions: "",
};

function toFormState(
  config: { name: string | null; persona: string | null; preferredResponse: string | null; greeting: string | null; signOff: string | null; language: string; handoffInstructions: string | null } | null | undefined,
): FormState {
  if (!config) return EMPTY_FORM;
  return {
    name: config.name ?? "",
    persona: config.persona ?? "",
    preferredResponse: config.preferredResponse ?? "",
    greeting: config.greeting ?? "",
    signOff: config.signOff ?? "",
    language: config.language || "en-GB",
    handoffInstructions: config.handoffInstructions ?? "",
  };
}

export function BotSettingsPage() {
  const { toast } = useToast();
  const { data, isLoading } = useBotConfig();
  const updateConfig = useUpdateBotConfig();
  const enableBot = useEnableBot();
  const disableBot = useDisableBot();
  const setBotMode = useSetBotMode();

  const [form, setForm] = useState<FormState>(EMPTY_FORM);

  useEffect(() => {
    setForm(toFormState(data?.config));
  }, [data?.config]);

  const setField = (field: keyof FormState) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setForm((prev) => ({ ...prev, [field]: e.target.value }));
  };

  const handleSave = () => {
    const payload: BotConfigUpdatePayload = {
      name: form.name.trim() || null,
      persona: form.persona.trim() || null,
      preferredResponse: form.preferredResponse.trim() || null,
      greeting: form.greeting.trim() || null,
      signOff: form.signOff.trim() || null,
      language: form.language.trim() || "en-GB",
      handoffInstructions: form.handoffInstructions.trim() || null,
    };
    updateConfig.mutate(payload, {
      onSuccess: () => toast({ title: "Bot settings saved" }),
      onError: (err) => toast({ title: "Couldn't save settings", description: (err as Error).message, variant: "destructive" }),
    });
  };

  const autoReply = data?.autoReply;

  const handleToggleAutoReply = (checked: boolean) => {
    if (checked) {
      enableBot.mutate(undefined, {
        onSuccess: () => toast({ title: "Auto-reply enabled" }),
        onError: (err) => toast({ title: "Couldn't enable auto-reply", description: (err as Error).message, variant: "destructive" }),
      });
    } else {
      disableBot.mutate(undefined, {
        onSuccess: () => toast({ title: "Auto-reply disabled" }),
        onError: (err) => toast({ title: "Couldn't disable auto-reply", description: (err as Error).message, variant: "destructive" }),
      });
    }
  };

  const handleModeChange = (mode: BotMode) => {
    setBotMode.mutate(mode, {
      onSuccess: () => toast({ title: `Mode set to ${mode === "draft" ? "Draft" : "Send"}` }),
      onError: (err) => toast({ title: "Couldn't update mode", description: (err as Error).message, variant: "destructive" }),
    });
  };

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 py-12 text-sm text-black/50 dark:text-white/50">
        <Loader2 className="h-4 w-4 animate-spin" /> Loading bot settings…
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bot className="h-4 w-4" /> Auto-reply
          </CardTitle>
          <CardDescription>Let the AI assistant respond to incoming conversations automatically.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {!autoReply?.provisioned ? (
            <p className="rounded-lg border border-dashed border-black/12 bg-black/[0.02] px-3 py-3 text-sm text-black/50 dark:border-white/12 dark:bg-white/[0.03] dark:text-white/50">
              Provision this org's SendSeven workspace before enabling the bot.
            </p>
          ) : (
            <>
              <div className="flex items-center justify-between gap-4">
                <div>
                  <div className="text-sm font-medium">
                    Status: {autoReply.enabled ? "Enabled" : "Disabled"}
                  </div>
                  <div className="text-xs text-black/50 dark:text-white/50">
                    {autoReply.enabled
                      ? `Currently in ${autoReply.mode === "draft" ? "Draft" : "Send"} mode.`
                      : "The bot will not respond until enabled."}
                  </div>
                </div>
                <Switch
                  checked={autoReply.enabled}
                  disabled={enableBot.isPending || disableBot.isPending}
                  onCheckedChange={handleToggleAutoReply}
                />
              </div>

              {autoReply.enabled && (
                <div className="space-y-1.5">
                  <Label>Mode</Label>
                  <Select value={autoReply.mode} disabled={setBotMode.isPending} onValueChange={(v) => handleModeChange(v as BotMode)}>
                    <SelectTrigger className="max-w-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="draft">Draft — replies are saved for review</SelectItem>
                      <SelectItem value="send">Send — replies are sent automatically</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Bot profile</CardTitle>
          <CardDescription>Configure how the AI assistant identifies itself and responds.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="bot-name">Name</Label>
              <Input id="bot-name" value={form.name} onChange={setField("name")} placeholder="e.g. Ava" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="bot-language">Language</Label>
              <Input id="bot-language" value={form.language} onChange={setField("language")} placeholder="en-GB" />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="bot-persona">Persona</Label>
            <Textarea id="bot-persona" value={form.persona} onChange={setField("persona")} placeholder="Describe the bot's tone and personality" rows={3} />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="bot-preferred-response">Preferred response style</Label>
            <Textarea
              id="bot-preferred-response"
              value={form.preferredResponse}
              onChange={setField("preferredResponse")}
              placeholder="How the bot should structure replies"
              rows={3}
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="bot-greeting">Greeting</Label>
              <Input id="bot-greeting" value={form.greeting} onChange={setField("greeting")} placeholder="Hi there!" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="bot-sign-off">Sign-off</Label>
              <Input id="bot-sign-off" value={form.signOff} onChange={setField("signOff")} placeholder="Best, Ava" />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="bot-handoff">Handoff instructions</Label>
            <Textarea
              id="bot-handoff"
              value={form.handoffInstructions}
              onChange={setField("handoffInstructions")}
              placeholder="When and how the bot should hand off to a human agent"
              rows={3}
            />
          </div>

          <div className="flex justify-end">
            <Button onClick={handleSave} disabled={updateConfig.isPending}>
              {updateConfig.isPending && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />}
              Save
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

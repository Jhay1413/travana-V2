import { useEffect, useState } from "react";
import { Bot, Loader2, Plus, Trash2 } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { useBotConfig, useDisableBot, useEnableBot, useSetBotMode, useUpdateBotConfig } from "../api/use-bot-config";
import type { BotAudience, BotConfig, BotConfigUpdatePayload, BotMode, BotRule } from "../types";

type FormState = {
  name: string;
  persona: string;
  preferredResponse: string;
  greeting: string;
  signOff: string;
  language: string;
  handoffInstructions: string;
  rules: BotRule[];
};

const EMPTY_FORM: FormState = {
  name: "",
  persona: "",
  preferredResponse: "",
  greeting: "",
  signOff: "",
  language: "en-GB",
  handoffInstructions: "",
  rules: [],
};

function toFormState(config: BotConfig | null | undefined): FormState {
  if (!config) return EMPTY_FORM;
  return {
    name: config.name ?? "",
    persona: config.persona ?? "",
    preferredResponse: config.preferredResponse ?? "",
    greeting: config.greeting ?? "",
    signOff: config.signOff ?? "",
    language: config.language || "en-GB",
    handoffInstructions: config.handoffInstructions ?? "",
    rules: config.rules ?? [],
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
      rules: form.rules.filter((rule) => rule.text.trim().length > 0).map((rule) => ({ ...rule, text: rule.text.trim() })),
    };
    updateConfig.mutate(payload, {
      onSuccess: () => toast({ title: "Bot settings saved" }),
      onError: (err) => toast({ title: "Couldn't save settings", description: (err as Error).message, variant: "destructive" }),
    });
  };

  const addRule = () => {
    setForm((prev) => ({ ...prev, rules: [...prev.rules, { text: "", audience: "general", isActive: true }] }));
  };

  const updateRule = (index: number, patch: Partial<BotRule>) => {
    setForm((prev) => ({
      ...prev,
      rules: prev.rules.map((rule, i) => (i === index ? { ...rule, ...patch } : rule)),
    }));
  };

  const removeRule = (index: number) => {
    setForm((prev) => ({ ...prev, rules: prev.rules.filter((_, i) => i !== index) }));
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
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Rules</CardTitle>
          <CardDescription>
            Rules are extra instructions the AI must follow. &ldquo;Used by&rdquo; controls which bot: General = both, Sales = sales
            bot only, Admin = admin bot only.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {form.rules.length === 0 ? (
            <p className="text-sm text-black/50 dark:text-white/50">No rules yet.</p>
          ) : (
            <div className="space-y-3">
              {form.rules.map((rule, index) => (
                <div key={index} className="flex flex-col gap-2 rounded-lg border border-black/10 p-3 sm:flex-row sm:items-center dark:border-white/10">
                  <Input
                    className="flex-1"
                    value={rule.text}
                    onChange={(e) => updateRule(index, { text: e.target.value })}
                    placeholder="e.g. Always confirm the booking reference before discussing a booking"
                  />
                  <div className="flex items-center gap-2">
                    <Select value={rule.audience} onValueChange={(v) => updateRule(index, { audience: v as BotAudience })}>
                      <SelectTrigger className="w-32.5">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="general">General</SelectItem>
                        <SelectItem value="sales">Sales</SelectItem>
                        <SelectItem value="admin">Admin</SelectItem>
                      </SelectContent>
                    </Select>
                    <div className="flex items-center gap-1.5">
                      <Checkbox
                        id={`rule-active-${index}`}
                        checked={rule.isActive !== false}
                        onCheckedChange={(v) => updateRule(index, { isActive: v === true })}
                      />
                      <Label htmlFor={`rule-active-${index}`} className="text-xs text-black/60 dark:text-white/60">
                        Active
                      </Label>
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      className="text-red-600 hover:bg-red-500/10"
                      onClick={() => removeRule(index)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
          <Button variant="outline" onClick={addRule}>
            <Plus className="mr-1 h-3.5 w-3.5" /> Add rule
          </Button>
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={updateConfig.isPending}>
          {updateConfig.isPending && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />}
          Save
        </Button>
      </div>
    </div>
  );
}

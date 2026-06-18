import { useEffect, useMemo, useState } from "react";
import axios from "@/api/client/axios-client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { MessageSquare, Send, Inbox, Cog, AlertTriangle } from "lucide-react";
import {
  SmsTemplatesManager,
  SMS_CATEGORY_LABELS,
} from "@/features/sms/components/sms/templates-manager";
import { useSmsTemplates } from "@/features/sms/api/use-sms-queries";
import type { SmsTemplate } from "@/features/sms/api/sms.api";

type SmsMessage = {
  id: string;
  templateName: string | null;
  clientName: string | null;
  toPhone: string;
  body: string;
  status: "queued" | "sent" | "delivered" | "failed" | "skipped_optout" | "skipped_no_phone";
  providerError: string | null;
  triggeredByName: string | null;
  triggerSource: string | null;
  sentAt: string;
};

type StatusResp = { connected: boolean; fromPhone?: string; error?: string };

function statusBadge(status: SmsMessage["status"]) {
  const map: Record<SmsMessage["status"], { label: string; className: string }> = {
    queued: { label: "Queued", className: "bg-slate-200 text-slate-700" },
    sent: { label: "Sent", className: "bg-emerald-100 text-emerald-700" },
    delivered: { label: "Delivered", className: "bg-emerald-200 text-emerald-800" },
    failed: { label: "Failed", className: "bg-rose-100 text-rose-700" },
    skipped_optout: { label: "Skipped (opt-out)", className: "bg-amber-100 text-amber-800" },
    skipped_no_phone: { label: "Skipped (no phone)", className: "bg-amber-100 text-amber-800" },
  };
  const m = map[status];
  return <Badge className={`${m.className} border-0`}>{m.label}</Badge>;
}

function ConnectionBanner({ status }: { status?: StatusResp }) {
  if (!status) return null;
  if (status.connected) {
    return (
      <div
        className="flex items-center gap-2 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-2 text-sm text-emerald-800"
        data-testid="banner-sms-connected"
      >
        <MessageSquare className="h-4 w-4" />
        Connexa connected{status.fromPhone ? ` — sending as ${status.fromPhone}` : ""}.
      </div>
    );
  }
  return (
    <div
      className="flex items-start gap-2 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-2 text-sm text-amber-900"
      data-testid="banner-sms-disconnected"
    >
      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
      <div>
        <div>Connexa is not connected yet — templates can be edited, but sending is disabled until Connexa credentials are added to project secrets.</div>
        {status.error && (
          <div className="mt-1 text-xs opacity-80">Provider says: {status.error}</div>
        )}
      </div>
    </div>
  );
}

export default function SmsCenterPage() {
  const { toast } = useToast();
  const qc = useQueryClient();

  const statusQ = useQuery<StatusResp>({
    queryKey: ["sms", "status"],
    queryFn: async () => {
      const r = (await axios.get("/sms/status")).data;
      return r?.data ?? r;
    },
    refetchOnWindowFocus: false,
  });

  return (
    <div className="space-y-6 p-6" data-testid="page-sms-center">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight" data-testid="text-sms-center-title">
            Texts
          </h1>
          <p className="text-sm text-muted-foreground">
            Send SMS to clients and manage your text templates and triggers.
          </p>
        </div>
      </div>

      <ConnectionBanner status={statusQ.data} />

      <Tabs defaultValue="compose" className="w-full">
        <TabsList>
          <TabsTrigger value="compose" data-testid="tab-sms-compose">
            <Send className="mr-2 h-4 w-4" /> Compose
          </TabsTrigger>
          <TabsTrigger value="templates" data-testid="tab-sms-templates">
            <Cog className="mr-2 h-4 w-4" /> Templates
          </TabsTrigger>
          <TabsTrigger value="log" data-testid="tab-sms-log">
            <Inbox className="mr-2 h-4 w-4" /> Sent log
          </TabsTrigger>
        </TabsList>

        <TabsContent value="compose" className="mt-4">
          <ComposeTab canSend={!!statusQ.data?.connected} />
        </TabsContent>

        <TabsContent value="templates" className="mt-4">
          <SmsTemplatesManager />
        </TabsContent>

        <TabsContent value="log" className="mt-4">
          <LogTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}

/* -------------------------- Compose tab -------------------------- */
type RecipientMode = "all_optin" | "vip_tier" | "badge" | "client";

function ComposeTab({ canSend }: { canSend: boolean }) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const templatesQ = useSmsTemplates();
  const templates: SmsTemplate[] = templatesQ.data ?? [];
  const clientsQ = useQuery<any[]>({
    queryKey: ["clients", "neon-list"],
    queryFn: async () => (await axios.get("/neon-clients?limit=200")).data,
  });

  const [templateId, setTemplateId] = useState<string>("");
  const [bodyOverride, setBodyOverride] = useState<string>("");
  const [mode, setMode] = useState<RecipientMode>("all_optin");
  const [vipTier, setVipTier] = useState<"standard" | "gold" | "elite">("gold");
  const [badge, setBadge] = useState<string>("Referral");
  const [clientId, setClientId] = useState<string>("");

  useEffect(() => {
    const t = templates.find((x) => x.id === templateId);
    if (t) setBodyOverride(t.body);
  }, [templateId, templates]);

  const buildRecipients = () => {
    const r: any = { mode };
    if (mode === "vip_tier") r.vipTier = vipTier;
    if (mode === "badge") r.badge = badge;
    if (mode === "client") r.clientId = clientId;
    return r;
  };

  const previewQ = useQuery<{ total: number; eligible: number; skippedOptOut: number; skippedNoPhone: number; confirmRequired: boolean; maxAllowed: number }>({
    queryKey: ["sms", "preview-recipients", mode, vipTier, badge, clientId],
    enabled: mode !== "client" || !!clientId,
    queryFn: async () => {
      const r = (await axios.post("/sms/preview-recipients", { recipients: buildRecipients() })).data;
      return r?.data ?? r;
    },
  });

  const doSend = async (confirmBulk: boolean) => {
    const payload = {
      templateId: templateId || undefined,
      bodyOverride: bodyOverride || undefined,
      recipients: buildRecipients(),
      triggerSource: "manual",
      confirmBulk,
    };
    return (await axios.post("/sms/send", payload)).data;
  };

  const sendM = useMutation({
    mutationFn: () => doSend(false),
    onSuccess: (data: any) => {
      toast({
        title: "Send complete",
        description: `Sent ${data.sent}, skipped ${data.skipped}, failed ${data.failed} of ${data.total}`,
      });
      qc.invalidateQueries({ queryKey: ["sms", "messages"] });
    },
    onError: (e: any) =>
      toast({ title: "Send failed", description: e?.response?.data?.message ?? e.message, variant: "destructive" }),
  });

  const confirmedSendM = useMutation({
    mutationFn: () => doSend(true),
    onSuccess: (data: any) => {
      toast({
        title: "Bulk send complete",
        description: `Sent ${data.sent}, skipped ${data.skipped}, failed ${data.failed} of ${data.total}`,
      });
      qc.invalidateQueries({ queryKey: ["sms", "messages"] });
      setBulkConfirmOpen(false);
    },
    onError: (e: any) =>
      toast({ title: "Send failed", description: e?.response?.data?.message ?? e.message, variant: "destructive" }),
  });

  const [bulkConfirmOpen, setBulkConfirmOpen] = useState(false);
  const handleSendClick = () => {
    if (previewQ.data?.confirmRequired) {
      setBulkConfirmOpen(true);
    } else {
      sendM.mutate();
    }
  };

  const previewBody = useMemo(() => {
    return bodyOverride
      .replace(/\{\{?\s*first_name\s*\}?\}/gi, "John")
      .replace(/\{\{?\s*last_name\s*\}?\}/gi, "Smith")
      .replace(/\{\{?\s*destination\s*\}?\}/gi, "Tenerife")
      .replace(/\{\{?\s*departure_date\s*\}?\}/gi, "12 Jul 2026")
      .replace(/\{\{?\s*balance_due\s*\}?\}/gi, "£1,250.00")
      .replace(/\{\{?\s*balance_due_date\s*\}?\}/gi, "01 Jun 2026")
      .replace(/\{\{?\s*hays_ref\s*\}?\}/gi, "HT-12345")
      .replace(/\{\{?\s*supplier_ref\s*\}?\}/gi, "SUP-987")
      .replace(/\{\{?\s*portal_link\s*\}?\}/gi, "https://app/portal/login")
      .replace(/\{\{?\s*portal_credentials\s*\}?\}/gi, "your email john@example.com and PIN 1234")
      .replace(/\{\{?\s*portal_email\s*\}?\}/gi, "john@example.com")
      .replace(/\{\{?\s*portal_pin\s*\}?\}/gi, "1234")
      .replace(/\{\{?\s*agent_name\s*\}?\}/gi, "Tina")
      .replace(/\{\{?\s*company_name\s*\}?\}/gi, "Tina's Travel");
  }, [bodyOverride]);

  return (
    <div className="grid gap-4 lg:grid-cols-3">
      <div className="space-y-4 lg:col-span-2">
        <Card>
          <CardHeader>
            <CardTitle>Pick a template</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-2">
              <Label>Template</Label>
              <Select value={templateId} onValueChange={setTemplateId}>
                <SelectTrigger data-testid="select-compose-template">
                  <SelectValue placeholder="Choose a template..." />
                </SelectTrigger>
                <SelectContent>
                  {templates.map((t) => (
                    <SelectItem key={t.id} value={t.id}>
                      {t.name} <span className="text-muted-foreground">— {SMS_CATEGORY_LABELS[t.category]}</span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label>Message body (placeholders allowed)</Label>
              <Textarea
                rows={5}
                value={bodyOverride}
                onChange={(e) => setBodyOverride(e.target.value)}
                data-testid="textarea-compose-body"
              />
              <div className="text-xs text-muted-foreground">
                {bodyOverride.length}/1600 chars · approx {Math.ceil(bodyOverride.length / 160)} SMS segment(s)
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Recipients</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid gap-2">
              <Label>Send to</Label>
              <Select value={mode} onValueChange={(v) => setMode(v as RecipientMode)}>
                <SelectTrigger data-testid="select-recipient-mode"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all_optin">All opted-in clients</SelectItem>
                  <SelectItem value="vip_tier">VIP tier</SelectItem>
                  <SelectItem value="badge">By badge (Referral, etc.)</SelectItem>
                  <SelectItem value="client">A single client</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {mode === "vip_tier" && (
              <div className="grid gap-2">
                <Label>VIP tier</Label>
                <Select value={vipTier} onValueChange={(v) => setVipTier(v as any)}>
                  <SelectTrigger data-testid="select-vip-tier"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="standard">Standard</SelectItem>
                    <SelectItem value="gold">Gold</SelectItem>
                    <SelectItem value="elite">Elite</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}
            {mode === "badge" && (
              <div className="grid gap-2">
                <Label>Badge</Label>
                <Input value={badge} onChange={(e) => setBadge(e.target.value)} data-testid="input-badge" />
              </div>
            )}
            {mode === "client" && (
              <div className="grid gap-2">
                <Label>Client</Label>
                <Select value={clientId} onValueChange={setClientId}>
                  <SelectTrigger data-testid="select-client"><SelectValue placeholder="Pick a client..." /></SelectTrigger>
                  <SelectContent className="max-h-72">
                    {clientsQ.data?.map((c: any) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.firstName} {c.surename} — {c.phoneNumber}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="space-y-4">
        <Card>
          <CardHeader>
            <CardTitle>Preview</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="rounded-3xl border bg-muted/30 p-4 text-sm">
              <div className="mb-2 text-xs text-muted-foreground">Sample with John Smith → Tenerife</div>
              <div className="whitespace-pre-wrap" data-testid="text-preview-body">{previewBody || "—"}</div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Recipient preview</CardTitle>
          </CardHeader>
          <CardContent className="text-xs space-y-1">
            {previewQ.isLoading ? (
              <div className="text-muted-foreground">Counting...</div>
            ) : previewQ.data ? (
              <>
                <div data-testid="text-preview-eligible">
                  <span className="font-semibold">{previewQ.data.eligible}</span> will receive this text
                </div>
                <div className="text-muted-foreground">
                  Total matched: {previewQ.data.total} · Skipped opt-out: {previewQ.data.skippedOptOut} · No phone: {previewQ.data.skippedNoPhone}
                </div>
                {previewQ.data.confirmRequired && (
                  <div className="text-amber-600 font-medium">Bulk send — confirmation required.</div>
                )}
              </>
            ) : mode === "client" && !clientId ? (
              <div className="text-muted-foreground">Pick a client to count.</div>
            ) : null}
          </CardContent>
        </Card>

        <Button
          className="w-full"
          size="lg"
          onClick={handleSendClick}
          disabled={sendM.isPending || confirmedSendM.isPending || !canSend || !bodyOverride || (mode === "client" && !clientId)}
          data-testid="button-send-sms"
        >
          <Send className="mr-2 h-4 w-4" />
          {sendM.isPending || confirmedSendM.isPending ? "Sending..." : canSend ? "Send now" : "Connect Connexa to send"}
        </Button>
      </div>

      <Dialog open={bulkConfirmOpen} onOpenChange={setBulkConfirmOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirm bulk text send</DialogTitle>
            <DialogDescription>
              You are about to send a text to{" "}
              <span className="font-semibold">{previewQ.data?.eligible ?? 0}</span> opted-in recipients.
              This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <div className="rounded-2xl border bg-muted/30 p-3 text-sm whitespace-pre-wrap" data-testid="text-bulk-confirm-preview">
            {previewBody}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setBulkConfirmOpen(false)} data-testid="button-bulk-cancel">
              Cancel
            </Button>
            <Button
              onClick={() => confirmedSendM.mutate()}
              disabled={confirmedSendM.isPending}
              data-testid="button-bulk-confirm"
            >
              {confirmedSendM.isPending ? "Sending..." : `Yes, send to ${previewQ.data?.eligible ?? 0}`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

/* -------------------------- Log tab -------------------------- */
function LogTab() {
  const messagesQ = useQuery<SmsMessage[]>({
    queryKey: ["sms", "messages"],
    queryFn: async () => {
      const r = (await axios.get("/sms/messages?limit=300")).data;
      const arr = r?.data ?? r;
      return Array.isArray(arr) ? arr : [];
    },
  });
  const messages: SmsMessage[] = Array.isArray(messagesQ.data) ? messagesQ.data : [];

  return (
    <Card>
      <CardHeader>
        <CardTitle>Recent sends</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-xs uppercase text-muted-foreground">
                <th className="px-2 py-2">When</th>
                <th className="px-2 py-2">Template</th>
                <th className="px-2 py-2">Client</th>
                <th className="px-2 py-2">Phone</th>
                <th className="px-2 py-2">Status</th>
                <th className="px-2 py-2">Source</th>
                <th className="px-2 py-2">By</th>
              </tr>
            </thead>
            <tbody>
              {messages.length === 0 && (
                <tr><td colSpan={7} className="py-8 text-center text-muted-foreground">No texts sent yet.</td></tr>
              )}
              {messages.map((m) => (
                <tr key={m.id} className="border-b last:border-b-0" data-testid={`row-sms-${m.id}`}>
                  <td className="px-2 py-2 text-xs text-muted-foreground">{new Date(m.sentAt).toLocaleString()}</td>
                  <td className="px-2 py-2">{m.templateName ?? "—"}</td>
                  <td className="px-2 py-2">{m.clientName ?? "—"}</td>
                  <td className="px-2 py-2 font-mono text-xs">{m.toPhone}</td>
                  <td className="px-2 py-2">{statusBadge(m.status)}</td>
                  <td className="px-2 py-2 text-xs">{m.triggerSource ?? "—"}</td>
                  <td className="px-2 py-2 text-xs">{m.triggeredByName ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}

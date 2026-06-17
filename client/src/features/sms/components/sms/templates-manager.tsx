import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle,
} from "@/components/ui/sheet";
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
import { useToast } from "@/hooks/use-toast";
import { Plus, Pencil, Trash2, MessageSquare, Loader2, FileText, Zap } from "lucide-react";
import { useSmsTemplates } from "@/hooks/queries/use-sms-queries";
import {
  useCreateSmsTemplate,
  useUpdateSmsTemplate,
  useDeleteSmsTemplate,
} from "@/hooks/mutations/use-sms-mutations";
import type { SmsTemplate, SmsTemplateInput } from "@/features/sms/api/sms.api";

export type { SmsTemplate } from "@/features/sms/api/sms.api";

export const SMS_CATEGORY_LABELS: Record<SmsTemplate["category"], string> = {
  weekly_deals: "Weekly Deals",
  balance_due: "Balance Due",
  booking_confirmation: "Booking Confirmation",
  tickets_ready: "Tickets Ready",
  portal_login: "Portal Login",
  quote_link: "Quote Link",
  custom: "Custom",
};

export const SMS_TRIGGER_LABELS: Record<SmsTemplate["autoTrigger"], string> = {
  manual: "Manual only",
  on_booking_create: "Auto: when booking is created",
  on_pin_set: "Auto: when portal PIN is set",
  days_before_departure: "Auto: N days before departure",
};

export const SMS_PLACEHOLDERS = [
  "first_name",
  "last_name",
  "destination",
  "departure_date",
  "balance_due",
  "balance_due_date",
  "hays_ref",
  "supplier_ref",
  "portal_link",
  "portal_email",
  "portal_pin",
  "portal_credentials",
  "quote_url",
  "agent_name",
  "company_name",
];

function StatCard({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-black/10 bg-white p-4 dark:border-white/10 dark:bg-white/5">
      <div className="mb-2 flex items-center gap-2 text-xs uppercase tracking-wider text-black/50 dark:text-white/50">
        {icon}
        <span>{label}</span>
      </div>
      <div className="truncate text-2xl font-semibold">{value}</div>
    </div>
  );
}

export function SmsTemplatesManager({ showStats = true }: { showStats?: boolean } = {}) {
  const { toast } = useToast();
  const templatesQ = useSmsTemplates();
  const remove = useDeleteSmsTemplate();
  const templates: SmsTemplate[] = templatesQ.data ?? [];
  const [editing, setEditing] = useState<SmsTemplate | null>(null);
  const [creating, setCreating] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<SmsTemplate | null>(null);

  const total = templates.length;
  const customCount = templates.filter((t) => t.category === "custom").length;
  const autoCount = templates.filter((t) => t.autoTrigger !== "manual" && t.active).length;

  const handleDelete = (t: SmsTemplate) => {
    remove.mutate(t.id, {
      onSuccess: () => {
        toast({ title: "Template deleted", description: t.name });
        setConfirmDelete(null);
      },
      onError: (e: any) =>
        toast({
          title: "Delete failed",
          description: e?.response?.data?.message ?? e.message,
          variant: "destructive",
        }),
    });
  };

  return (
    <div className="space-y-5">
      {showStats && (
        <div className="grid gap-4 md:grid-cols-3">
          <StatCard
            icon={<FileText className="h-3.5 w-3.5" />}
            label="Total templates"
            value={String(total)}
          />
          <StatCard
            icon={<MessageSquare className="h-3.5 w-3.5" />}
            label="Custom"
            value={String(customCount)}
          />
          <StatCard
            icon={<Zap className="h-3.5 w-3.5" />}
            label="Auto-fire enabled"
            value={String(autoCount)}
          />
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3 rounded-3xl border border-black/10 bg-white p-3 dark:border-white/10 dark:bg-white/5">
        <p className="text-sm text-black/60 dark:text-white/60">
          Edit the body to match your tone; trigger paths control when each one fires automatically.
        </p>
        <Button onClick={() => setCreating(true)} data-testid="button-new-template">
          <Plus className="mr-1.5 h-3.5 w-3.5" /> New template
        </Button>
      </div>

      {templates.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-black/10 p-12 text-center dark:border-white/10">
          <MessageSquare className="mx-auto mb-3 h-8 w-8 text-black/40 dark:text-white/40" />
          <div className="text-sm font-medium">
            {templatesQ.isLoading ? "Loading templates…" : "No templates yet"}
          </div>
          {!templatesQ.isLoading && (
            <div className="mt-1 text-xs text-black/50 dark:text-white/50">
              Click "New template" to create your first one.
            </div>
          )}
        </div>
      ) : (
        <div className="grid gap-3">
          {templates.map((t) => (
            <div
              key={t.id}
              className="rounded-3xl border border-black/10 bg-white p-4 transition hover:border-black/20 dark:border-white/10 dark:bg-white/5 dark:hover:border-white/20"
              data-testid={`card-template-${t.id}`}
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3
                      className="text-sm font-semibold"
                      data-testid={`text-template-name-${t.id}`}
                    >
                      {t.name}
                    </h3>
                    {!t.active && (
                      <Badge variant="secondary" className="text-[10px]">
                        Inactive
                      </Badge>
                    )}
                  </div>
                  <div className="mt-1.5 flex flex-wrap gap-1.5">
                    <Badge variant="outline" className="text-[10px]">
                      {SMS_CATEGORY_LABELS[t.category]}
                    </Badge>
                    <Badge
                      variant="outline"
                      className={
                        "text-[10px] " +
                        (t.autoTrigger === "manual"
                          ? "border-black/15 text-black/60 dark:border-white/20 dark:text-white/60"
                          : "border-emerald-500/30 text-emerald-700 dark:text-emerald-300")
                      }
                    >
                      {SMS_TRIGGER_LABELS[t.autoTrigger]}
                    </Badge>
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => setEditing(t)}
                    className="rounded-lg p-1.5 text-black/60 transition hover:bg-black/5 dark:text-white/60 dark:hover:bg-white/10"
                    title="Edit"
                    data-testid={`button-edit-template-${t.id}`}
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </button>
                  <button
                    onClick={() => setConfirmDelete(t)}
                    className="rounded-lg p-1.5 text-red-600 transition hover:bg-red-500/10"
                    title="Delete"
                    data-testid={`button-delete-template-${t.id}`}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
              <div className="mt-3 whitespace-pre-wrap rounded-2xl bg-black/[0.03] px-4 py-3 text-xs leading-relaxed text-black/70 dark:bg-white/[0.04] dark:text-white/70">
                {t.body}
              </div>
            </div>
          ))}
        </div>
      )}

      <TemplateEditorSheet
        template={editing}
        open={!!editing || creating}
        onClose={() => {
          setEditing(null);
          setCreating(false);
        }}
      />

      <AlertDialog
        open={!!confirmDelete}
        onOpenChange={(o) => !o && setConfirmDelete(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this template?</AlertDialogTitle>
            <AlertDialogDescription>
              "{confirmDelete?.name ?? "This template"}" will be removed. Messages already sent
              using it stay in your log.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-delete-template">
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() => confirmDelete && handleDelete(confirmDelete)}
              className="bg-red-600 hover:bg-red-700"
              data-testid="button-confirm-delete-template"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function TemplateEditorSheet({
  template,
  open,
  onClose,
}: {
  template: SmsTemplate | null;
  open: boolean;
  onClose: () => void;
}) {
  const { toast } = useToast();
  const create = useCreateSmsTemplate();
  const update = useUpdateSmsTemplate();
  const [name, setName] = useState("");
  const [category, setCategory] = useState<SmsTemplate["category"]>("custom");
  const [body, setBody] = useState("");
  const [autoTrigger, setAutoTrigger] = useState<SmsTemplate["autoTrigger"]>("manual");
  const [triggerDaysBefore, setTriggerDaysBefore] = useState<string>("");
  const [triggerHour, setTriggerHour] = useState<string>("9");
  const [active, setActive] = useState<boolean>(true);

  const isEdit = !!template;
  const isPending = create.isPending || update.isPending;

  useEffect(() => {
    if (!open) return;
    setName(template?.name ?? "");
    setCategory(template?.category ?? "custom");
    setBody(template?.body ?? "");
    setAutoTrigger(template?.autoTrigger ?? "manual");
    setTriggerDaysBefore(template?.triggerDaysBefore?.toString() ?? "");
    setTriggerHour(template?.triggerHour?.toString() ?? "9");
    setActive(template?.active ?? true);
  }, [open, template]);

  const handleSave = () => {
    const input: SmsTemplateInput = {
      name,
      category,
      body,
      autoTrigger,
      triggerDaysBefore:
        autoTrigger === "days_before_departure" ? Number(triggerDaysBefore) || 0 : null,
      triggerWeekday: null,
      triggerHour:
        autoTrigger === "days_before_departure" ? Number(triggerHour) || 9 : null,
      active,
    };
    const onSuccess = () => {
      toast({ title: isEdit ? "Template updated" : "Template created", description: name });
      onClose();
    };
    const onError = (e: any) =>
      toast({
        title: "Save failed",
        description: e?.response?.data?.message ?? e.message,
        variant: "destructive",
      });
    if (isEdit) {
      update.mutate({ id: template!.id, input }, { onSuccess, onError });
    } else {
      create.mutate(input, { onSuccess, onError });
    }
  };

  const segmentCount = Math.max(1, Math.ceil(body.length / 160));

  return (
    <Sheet open={open} onOpenChange={(o) => !o && onClose()}>
      <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-xl">
        <SheetHeader>
          <SheetTitle data-testid="text-template-editor-title">
            {isEdit ? "Edit template" : "New template"}
          </SheetTitle>
          <SheetDescription>
            Use placeholders like <code className="rounded bg-black/5 px-1 py-0.5 text-[11px] dark:bg-white/10">{"{{first_name}}"}</code> — they're filled in for each recipient when the message sends.
          </SheetDescription>
        </SheetHeader>

        <div className="mt-6 space-y-5">
          <div className="space-y-1.5">
            <Label className="text-xs uppercase tracking-wider text-black/55 dark:text-white/55">Name</Label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Quote follow-up"
              autoFocus
              data-testid="input-template-name"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs uppercase tracking-wider text-black/55 dark:text-white/55">Category</Label>
              <Select value={category} onValueChange={(v) => setCategory(v as SmsTemplate["category"])}>
                <SelectTrigger data-testid="select-template-category">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(SMS_CATEGORY_LABELS).map(([v, l]) => (
                    <SelectItem key={v} value={v}>
                      {l}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs uppercase tracking-wider text-black/55 dark:text-white/55">Trigger</Label>
              <Select value={autoTrigger} onValueChange={(v) => setAutoTrigger(v as SmsTemplate["autoTrigger"])}>
                <SelectTrigger data-testid="select-template-trigger">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(SMS_TRIGGER_LABELS).map(([v, l]) => (
                    <SelectItem key={v} value={v}>
                      {l}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {autoTrigger === "days_before_departure" && (
            <div className="grid grid-cols-2 gap-3 rounded-2xl border border-black/10 bg-black/[0.02] p-3 dark:border-white/10 dark:bg-white/[0.03]">
              <div className="space-y-1.5">
                <Label className="text-xs">Days before departure</Label>
                <Input
                  type="number"
                  min={0}
                  value={triggerDaysBefore}
                  onChange={(e) => setTriggerDaysBefore(e.target.value)}
                  data-testid="input-trigger-days"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Send hour (0–23)</Label>
                <Input
                  type="number"
                  min={0}
                  max={23}
                  value={triggerHour}
                  onChange={(e) => setTriggerHour(e.target.value)}
                />
              </div>
            </div>
          )}
          <div className="space-y-2">
            <div className="flex items-baseline justify-between">
              <Label className="text-xs uppercase tracking-wider text-black/55 dark:text-white/55">Message body</Label>
              <span className="text-[11px] tabular-nums text-black/50 dark:text-white/50">
                {body.length} chars · {segmentCount} SMS segment{segmentCount === 1 ? "" : "s"}
              </span>
            </div>
            <Textarea
              rows={6}
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="Hi {{first_name}}, your booking to {{destination}} is confirmed. Ref: {{hays_ref}}"
              data-testid="textarea-template-body"
            />
            <div className="flex flex-wrap gap-1">
              {SMS_PLACEHOLDERS.map((p) => (
                <button
                  type="button"
                  key={p}
                  className="rounded-full border border-black/10 bg-black/[0.03] px-2 py-0.5 text-[11px] text-black/65 transition hover:border-black/20 hover:bg-black/[0.06] dark:border-white/10 dark:bg-white/[0.04] dark:text-white/65 dark:hover:bg-white/[0.08]"
                  onClick={() => setBody((b) => `${b}{{${p}}}`)}
                  data-testid={`button-placeholder-${p}`}
                >
                  {`{{${p}}}`}
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-center justify-between rounded-2xl border border-black/10 bg-white p-3 dark:border-white/10 dark:bg-white/5">
            <div>
              <Label className="text-sm font-medium">Active</Label>
              <p className="text-xs text-black/55 dark:text-white/55">
                Inactive templates stay in the list but can't be sent or auto-fire.
              </p>
            </div>
            <Switch
              checked={active}
              onCheckedChange={setActive}
              data-testid="switch-template-active"
            />
          </div>
        </div>

        <SheetFooter className="mt-6 gap-2 sm:gap-2">
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button
            onClick={handleSave}
            disabled={isPending || !name.trim() || !body.trim()}
            data-testid="button-save-template"
          >
            {isPending && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />}
            {isEdit ? "Save changes" : "Create template"}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}

import { useEffect, useMemo, useState } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { OUTLINE_ACTION, PRIMARY_ACTION } from "@/features/pipeline/shared/button-styles";
import { useToast } from "@/hooks/use-toast";
import { useCreateTemplate } from "../api/use-whatsapp-templates";
import { extractPlaceholders } from "../lib/template-placeholders";
import { nameProblem, requestProblem, toRequestInput, type TemplateRequestForm } from "../lib/template-request";
import { apiErrorMessage } from "../lib/whatsapp-channels";
import type { WaTemplateCategory } from "../types";

const EMPTY: TemplateRequestForm = {
  name: "",
  category: "UTILITY",
  language: "en",
  header: "",
  body: "",
  examples: {},
  footer: "",
  buttonKind: "none",
  buttonText: "",
  buttonUrl: "",
};

interface RequestTemplateDialogProps {
  open: boolean;
  channelId: string;
  onClose: () => void;
}

/** Submit a new WhatsApp template to Meta for review. */
export function RequestTemplateDialog({ open, channelId, onClose }: RequestTemplateDialogProps) {
  const { toast } = useToast();
  const create = useCreateTemplate();
  const [form, setForm] = useState<TemplateRequestForm>(EMPTY);
  const [serverError, setServerError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setForm(EMPTY);
    setServerError(null);
    create.reset();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const patch = (p: Partial<TemplateRequestForm>) => {
    setForm((f) => ({ ...f, ...p }));
    setServerError(null);
  };

  const placeholders = useMemo(() => extractPlaceholders(form.body), [form.body]);
  const problem = requestProblem(form);
  const nameError = nameProblem(form.name);

  const submit = async () => {
    if (problem || create.isPending) return;
    try {
      await create.mutateAsync(toRequestInput(channelId, form));
      toast({ title: "Template submitted for review" });
      onClose();
    } catch (err) {
      setServerError(apiErrorMessage(err, "Meta rejected the template"));
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && !create.isPending && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg" data-testid="dialog-request-template">
        <DialogHeader>
          <DialogTitle>Request a template</DialogTitle>
          <DialogDescription>Meta reviews new templates, usually within 24–48 hours.</DialogDescription>
        </DialogHeader>
        <form
          className="min-w-0 space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            void submit();
          }}
        >
          <div className="space-y-1.5">
            <Label htmlFor="tpl-name">Name</Label>
            <Input id="tpl-name" className="font-mono" value={form.name} onChange={(e) => patch({ name: e.target.value })} data-testid="input-template-name" />
            {nameError ? <p className="text-[12px] text-destructive">{nameError}</p> : <p className="text-[12px] text-social-muted">Lowercase letters, numbers and underscores.</p>}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Category</Label>
              <Select value={form.category} onValueChange={(v) => patch({ category: v as WaTemplateCategory })}>
                <SelectTrigger aria-label="Category">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="UTILITY">Utility (recommended)</SelectItem>
                  <SelectItem value="MARKETING">Marketing</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="tpl-lang">Language</Label>
              <Input id="tpl-lang" value={form.language} onChange={(e) => patch({ language: e.target.value })} />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="tpl-header">Header (optional)</Label>
            <Input id="tpl-header" maxLength={60} value={form.header} onChange={(e) => patch({ header: e.target.value })} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="tpl-body">Body</Label>
            <Textarea id="tpl-body" rows={4} maxLength={1024} value={form.body} onChange={(e) => patch({ body: e.target.value })} data-testid="input-template-body" />
            <p className="text-[12px] text-social-muted">Use {"{{1}}, {{2}}"} for values that change.</p>
          </div>
          {placeholders.map((p) => (
            <div key={p} className="space-y-1.5">
              <Label htmlFor={`tpl-ex-${p}`}>{`Example for {{${p}}}`}</Label>
              <Input
                id={`tpl-ex-${p}`}
                value={form.examples[p] ?? ""}
                onChange={(e) => patch({ examples: { ...form.examples, [p]: e.target.value } })}
              />
            </div>
          ))}
          <div className="space-y-1.5">
            <Label htmlFor="tpl-footer">Footer (optional)</Label>
            <Input id="tpl-footer" maxLength={60} value={form.footer} onChange={(e) => patch({ footer: e.target.value })} />
          </div>
          <div className="space-y-1.5">
            <Label>Button (optional)</Label>
            <Select value={form.buttonKind} onValueChange={(v) => patch({ buttonKind: v as TemplateRequestForm["buttonKind"] })}>
              <SelectTrigger aria-label="Button type">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">No button</SelectItem>
                <SelectItem value="URL">URL</SelectItem>
                <SelectItem value="QUICK_REPLY">Quick reply</SelectItem>
              </SelectContent>
            </Select>
            {form.buttonKind !== "none" && (
              <Input placeholder="Button text" maxLength={25} value={form.buttonText} onChange={(e) => patch({ buttonText: e.target.value })} aria-label="Button text" />
            )}
            {form.buttonKind === "URL" && (
              <Input placeholder="https://…" value={form.buttonUrl} onChange={(e) => patch({ buttonUrl: e.target.value })} aria-label="Button URL" />
            )}
          </div>
          {serverError && (
            <p className="rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-[13px] text-destructive" role="alert" data-testid="template-server-error">
              {serverError}
            </p>
          )}
          {!serverError && problem && form.body.trim() && <p className="text-[12px] text-social-muted">{problem}</p>}
          <DialogFooter>
            <Button type="button" variant="outline" className={OUTLINE_ACTION} disabled={create.isPending} onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" className={PRIMARY_ACTION} disabled={!!problem || create.isPending} data-testid="button-submit-template">
              {create.isPending && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
              Submit for review
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

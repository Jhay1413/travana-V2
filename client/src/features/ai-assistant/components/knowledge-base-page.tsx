import { useEffect, useState } from "react";
import { BookOpen, Loader2, Pencil, Plus, Trash2 } from "lucide-react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import {
  useCreateKbEntry,
  useDeleteKbEntry,
  useKnowledgeBase,
  useUpdateKbEntry,
} from "../api/use-knowledge-base";
import type { BotAudience, KbEntry } from "../types";

type FormState = {
  title: string;
  content: string;
  category: string;
  audience: BotAudience;
  isActive: boolean;
};

const EMPTY_FORM: FormState = { title: "", content: "", category: "", audience: "general", isActive: true };

const AUDIENCE_LABELS: Record<BotAudience, string> = {
  general: "General",
  sales: "Sales",
  admin: "Admin",
};

function toFormState(entry: KbEntry | null): FormState {
  if (!entry) return EMPTY_FORM;
  return {
    title: entry.title,
    content: entry.content,
    category: entry.category ?? "",
    audience: entry.audience ?? "general",
    isActive: entry.isActive,
  };
}

function snippet(content: string, max = 160): string {
  const trimmed = content.trim();
  return trimmed.length > max ? `${trimmed.slice(0, max)}…` : trimmed;
}

export function KnowledgeBasePage() {
  const { toast } = useToast();
  const { data: entries, isLoading } = useKnowledgeBase();
  const createEntry = useCreateKbEntry();
  const updateEntry = useUpdateKbEntry();
  const deleteEntry = useDeleteKbEntry();

  const [editing, setEditing] = useState<KbEntry | null>(null);
  const [creating, setCreating] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<KbEntry | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);

  useEffect(() => {
    setForm(toFormState(editing));
  }, [editing]);

  const open = creating || !!editing;

  const closeDialog = () => {
    setCreating(false);
    setEditing(null);
  };

  const handleSubmit = () => {
    const title = form.title.trim();
    const content = form.content.trim();
    if (!title || !content) {
      toast({ title: "Title and content are required", variant: "destructive" });
      return;
    }
    const payload = {
      title,
      content,
      category: form.category.trim() || null,
      audience: form.audience,
      isActive: form.isActive,
    };

    if (editing) {
      updateEntry.mutate(
        { id: editing.id, data: payload },
        {
          onSuccess: () => {
            toast({ title: "Entry updated" });
            closeDialog();
          },
          onError: (err) => toast({ title: "Couldn't save entry", description: (err as Error).message, variant: "destructive" }),
        },
      );
    } else {
      createEntry.mutate(payload, {
        onSuccess: () => {
          toast({ title: "Entry created" });
          closeDialog();
        },
        onError: (err) => toast({ title: "Couldn't create entry", description: (err as Error).message, variant: "destructive" }),
      });
    }
  };

  const handleDelete = (entry: KbEntry) => {
    deleteEntry.mutate(entry.id, {
      onSuccess: () => {
        toast({ title: "Entry deleted" });
        setConfirmDelete(null);
      },
      onError: (err) => toast({ title: "Couldn't delete entry", description: (err as Error).message, variant: "destructive" }),
    });
  };

  const list = entries ?? [];

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 py-12 text-sm text-black/50 dark:text-white/50">
        <Loader2 className="h-4 w-4 animate-spin" /> Loading knowledge base…
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 text-lg font-semibold">
            <BookOpen className="h-4 w-4" /> Knowledge base
          </h2>
          <p className="text-sm text-black/50 dark:text-white/50">
            Reference material the AI assistant uses to answer customer questions.
          </p>
        </div>
        <Button
          onClick={() => {
            setEditing(null);
            setCreating(true);
          }}
        >
          <Plus className="mr-1 h-3.5 w-3.5" /> Add entry
        </Button>
      </div>

      {list.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-black/10 p-12 text-center dark:border-white/10">
          <BookOpen className="mx-auto mb-3 h-8 w-8 text-black/40 dark:text-white/40" />
          <div className="text-sm font-medium">No knowledge base entries yet</div>
          <div className="text-xs text-black/50 dark:text-white/50">
            Add articles or facts to help the bot answer customer questions accurately.
          </div>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {list.map((entry) => (
            <Card key={entry.id}>
              <CardHeader className="space-y-2 pb-2">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="truncate text-sm font-semibold">{entry.title}</div>
                    <div className="mt-1 flex flex-wrap items-center gap-1.5">
                      {entry.category && (
                        <span className="inline-block rounded-full bg-black/5 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-black/60 dark:bg-white/10 dark:text-white/60">
                          {entry.category}
                        </span>
                      )}
                      {entry.audience !== "general" && (
                        <span className="inline-block rounded-full bg-blue-500/10 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-blue-600 dark:bg-blue-400/10 dark:text-blue-400">
                          {AUDIENCE_LABELS[entry.audience]} only
                        </span>
                      )}
                    </div>
                  </div>
                  <span
                    className={
                      entry.isActive
                        ? "shrink-0 rounded-md bg-green-500/15 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-green-600 dark:text-green-400"
                        : "shrink-0 rounded-md bg-black/10 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-black/50 dark:bg-white/10 dark:text-white/50"
                    }
                  >
                    {entry.isActive ? "Active" : "Inactive"}
                  </span>
                </div>
              </CardHeader>
              <CardContent className="space-y-3 pt-0">
                <p className="text-sm text-black/60 dark:text-white/60">{snippet(entry.content)}</p>
                <div className="flex justify-end gap-1">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      setCreating(false);
                      setEditing(entry);
                    }}
                  >
                    <Pencil className="mr-1 h-3.5 w-3.5" /> Edit
                  </Button>
                  <Button size="sm" variant="outline" className="text-red-600 hover:bg-red-500/10" onClick={() => setConfirmDelete(entry)}>
                    <Trash2 className="mr-1 h-3.5 w-3.5" /> Delete
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={open} onOpenChange={(v) => !v && closeDialog()}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{editing ? "Edit entry" : "Add entry"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="kb-title">Title</Label>
              <Input id="kb-title" value={form.title} onChange={(e) => setForm((p) => ({ ...p, title: e.target.value }))} />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="kb-category">Category</Label>
                <Input
                  id="kb-category"
                  list="kb-category-options"
                  value={form.category}
                  onChange={(e) => setForm((p) => ({ ...p, category: e.target.value }))}
                  placeholder="Optional — e.g. Conversation Example, Policy, FAQ"
                />
                <datalist id="kb-category-options">
                  <option value="Conversation Example" />
                  <option value="Policy" />
                  <option value="FAQ" />
                  <option value="ATOL / ABTA" />
                  <option value="Specialisms" />
                  <option value="Opening Hours" />
                </datalist>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="kb-audience">Used by</Label>
                <Select
                  value={form.audience}
                  onValueChange={(v) => setForm((p) => ({ ...p, audience: v as BotAudience }))}
                >
                  <SelectTrigger id="kb-audience">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="general">General</SelectItem>
                    <SelectItem value="sales">Sales</SelectItem>
                    <SelectItem value="admin">Admin</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <p className="text-xs text-muted-foreground">
              Tip: use <span className="font-medium">&ldquo;Conversation Example&rdquo;</span> for pasted chats &mdash; the AI learns your
              reply tone from these (they&rsquo;re treated as style, not facts).
            </p>
            <div className="space-y-1.5">
              <Label htmlFor="kb-content">Content</Label>
              <Textarea
                id="kb-content"
                value={form.content}
                onChange={(e) => setForm((p) => ({ ...p, content: e.target.value }))}
                rows={6}
              />
            </div>
            <div className="flex items-center justify-between">
              <Label htmlFor="kb-active">Active</Label>
              <Switch id="kb-active" checked={form.isActive} onCheckedChange={(v) => setForm((p) => ({ ...p, isActive: v }))} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={closeDialog}>
              Cancel
            </Button>
            <Button onClick={handleSubmit} disabled={createEntry.isPending || updateEntry.isPending}>
              {(createEntry.isPending || updateEntry.isPending) && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />}
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!confirmDelete} onOpenChange={(o) => !o && setConfirmDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this entry?</AlertDialogTitle>
            <AlertDialogDescription>
              "{confirmDelete?.title ?? "This entry"}" will be removed from the knowledge base and will no longer inform bot
              replies.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => confirmDelete && handleDelete(confirmDelete)}
              className="bg-red-600 hover:bg-red-700"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

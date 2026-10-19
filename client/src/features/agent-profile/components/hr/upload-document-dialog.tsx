import { useState } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { DocumentCategory } from "@/features/hr";
import { useUploadHrDocumentFile } from "@/hooks/mutations";
import { useToast } from "@/hooks/use-toast";

const CATEGORIES: DocumentCategory[] = ["Contract", "NDA", "Right to Work", "Policies", "Training", "Other"];
const MAX_BYTES = 10 * 1024 * 1024;

export function UploadDocumentDialog({ open, userId, onClose }: { open: boolean; userId: string; onClose: () => void }) {
  const { toast } = useToast();
  const upload = useUploadHrDocumentFile();
  const [file, setFile] = useState<File | null>(null);
  const [name, setName] = useState("");
  const [category, setCategory] = useState<DocumentCategory>("Contract");
  const [expiresAt, setExpiresAt] = useState("");
  const tooBig = !!file && file.size > MAX_BYTES;

  const reset = () => {
    setFile(null);
    setName("");
    setCategory("Contract");
    setExpiresAt("");
    onClose();
  };
  // The dialog cannot be dismissed while the file is uploading.
  const close = () => {
    if (!upload.isPending) reset();
  };

  const submit = () => {
    if (!file || tooBig) return;
    upload.mutate(
      { userId, file, name: name.trim() || undefined, category, expiresAt: expiresAt || null },
      {
        onSuccess: () => {
          toast({ title: "Document uploaded" });
          reset();
        },
        onError: (err: Error) => toast({ title: "Upload failed", description: err.message, variant: "destructive" }),
      },
    );
  };

  return (
    <Dialog open={open} onOpenChange={(next) => (next || upload.isPending ? undefined : close())}>
      <DialogContent className="max-w-md" data-testid="dialog-upload-document">
        <DialogHeader>
          <DialogTitle>Upload a document</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="upload-doc-file">File</Label>
            <Input id="upload-doc-file" type="file" onChange={(e) => setFile(e.target.files?.[0] ?? null)} data-testid="input-upload-file" />
            {tooBig && <p className="text-[12px] text-status-failed-fg">That file is over 10 MB. Choose a smaller one.</p>}
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="upload-doc-name">Name (optional)</Label>
            <Input id="upload-doc-name" value={name} onChange={(e) => setName(e.target.value)} placeholder={file?.name ?? "Defaults to the file name"} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="upload-doc-category">Category</Label>
            <Select value={category} onValueChange={(v) => setCategory(v as DocumentCategory)}>
              <SelectTrigger id="upload-doc-category" data-testid="select-upload-category">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CATEGORIES.map((c) => (
                  <SelectItem key={c} value={c}>
                    {c}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="upload-doc-expiry">Expires on (optional)</Label>
            <Input id="upload-doc-expiry" type="date" value={expiresAt} onChange={(e) => setExpiresAt(e.target.value)} data-testid="input-upload-expiry" />
            <p className="text-[12px] text-social-muted">Documents with an expiry date are flagged 60 days before they expire.</p>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={close} disabled={upload.isPending}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={!file || tooBig || upload.isPending} data-testid="button-upload-submit">
            {upload.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Upload
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

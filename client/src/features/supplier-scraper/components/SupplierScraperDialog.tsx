import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { useCreateSupplierScraper, useUpdateSupplierScraper } from "../api/use-supplier-scrapers";
import type { SupplierScraper } from "../types";

// Preset suppliers with a known code adapter. Selecting one seeds supplierKey /
// name / adapterType; the server fills default config for the key on create.
const KNOWN_SUPPLIERS = [{ key: "easyjet", name: "easyJet holidays", adapterType: "easyjet" }];

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editing: SupplierScraper | null;
}

export function SupplierScraperDialog({ open, onOpenChange, editing }: Props) {
  const { toast } = useToast();
  const createMutation = useCreateSupplierScraper();
  const updateMutation = useUpdateSupplierScraper();
  const isEdit = !!editing;

  const [supplierKey, setSupplierKey] = useState("easyjet");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [isActive, setIsActive] = useState(true);
  const [configText, setConfigText] = useState("");
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [configError, setConfigError] = useState<string | null>(null);

  // Reset the form whenever the dialog opens for a new target.
  useEffect(() => {
    if (!open) return;
    setSupplierKey(editing?.supplierKey ?? "easyjet");
    setUsername("");
    setPassword("");
    setIsActive(editing?.isActive ?? true);
    setConfigText(editing ? JSON.stringify(editing.config ?? {}, null, 2) : "");
    setShowAdvanced(false);
    setConfigError(null);
  }, [open, editing]);

  const saving = createMutation.isPending || updateMutation.isPending;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setConfigError(null);

    // Parse the advanced config JSON if the user edited it.
    let config: Record<string, unknown> | undefined;
    if (showAdvanced && configText.trim()) {
      try {
        config = JSON.parse(configText);
      } catch (err) {
        setConfigError(err instanceof Error ? err.message : "Invalid JSON");
        return;
      }
    }

    // Send only credential fields the user actually entered — blank means
    // "leave unchanged" on edit.
    const credentials: { username?: string; password?: string } = {};
    if (username.trim()) credentials.username = username.trim();
    if (password) credentials.password = password;

    const onSuccess = () => {
      toast({ title: isEdit ? "Scraper updated" : "Scraper added" });
      onOpenChange(false);
    };
    const onError = (error: unknown) => {
      toast({
        title: isEdit ? "Could not update scraper" : "Could not add scraper",
        description: error instanceof Error ? error.message : "Something went wrong.",
        variant: "destructive",
      });
    };

    if (isEdit && editing) {
      updateMutation.mutate(
        { id: editing.id, input: { isActive, config, credentials } },
        { onSuccess, onError },
      );
    } else {
      const preset = KNOWN_SUPPLIERS.find((s) => s.key === supplierKey);
      createMutation.mutate(
        {
          supplierKey,
          supplierName: preset?.name,
          adapterType: preset?.adapterType,
          isActive,
          config,
          credentials,
        },
        { onSuccess, onError },
      );
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !saving && onOpenChange(v)}>
      <DialogContent className="max-w-md rounded-2xl">
        <DialogHeader>
          <DialogTitle>{isEdit ? `Edit ${editing?.supplierName}` : "Add supplier scraper"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 py-2">
          {!isEdit && (
            <div className="space-y-1.5">
              <Label>Supplier</Label>
              <Select value={supplierKey} onValueChange={setSupplierKey}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a supplier" />
                </SelectTrigger>
                <SelectContent>
                  {KNOWN_SUPPLIERS.map((s) => (
                    <SelectItem key={s.key} value={s.key}>
                      {s.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="space-y-1.5">
            <Label>Username / email</Label>
            <Input
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder={editing?.credentials.hasUsername ? "•••••• (unchanged)" : "trade portal login"}
              autoComplete="off"
            />
          </div>

          <div className="space-y-1.5">
            <Label>Password</Label>
            <Input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder={editing?.credentials.hasPassword ? "•••••• (unchanged)" : "trade portal password"}
              autoComplete="new-password"
            />
          </div>

          <div className="flex items-center justify-between rounded-xl border px-3 py-2">
            <div>
              <div className="text-sm font-medium">Active</div>
              <div className="text-xs text-muted-foreground">Enable this supplier for URL imports</div>
            </div>
            <Switch checked={isActive} onCheckedChange={setIsActive} />
          </div>

          <button
            type="button"
            className="text-xs font-medium text-muted-foreground underline"
            onClick={() => setShowAdvanced((v) => !v)}
          >
            {showAdvanced ? "Hide advanced config" : "Advanced config (JSON)"}
          </button>
          {showAdvanced && (
            <div className="space-y-1.5">
              <Label>Scraper config</Label>
              <Textarea
                value={configText}
                onChange={(e) => setConfigText(e.target.value)}
                rows={10}
                spellCheck={false}
                className="font-mono text-xs"
                placeholder="{ }"
              />
              <p className="text-xs text-muted-foreground">
                Browser/proxy, login selectors, and API endpoints. Leave blank to use the supplier's defaults.
              </p>
              {configError && <p className="text-xs text-destructive">Invalid JSON: {configError}</p>}
            </div>
          )}

          <DialogFooter className="pt-2">
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)} disabled={saving}>
              Cancel
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? "Saving…" : isEdit ? "Save changes" : "Add scraper"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

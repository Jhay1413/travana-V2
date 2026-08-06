import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { useCreateSupplierScraper, useUpdateSupplierScraper } from "../api/use-supplier-scrapers";
import type { SupplierScraper } from "../types";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editing: SupplierScraper | null;
}

// Stable key suggestion from a free-text name: lowercase alphanumerics only.
function slugify(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, "");
}

export function SupplierScraperDialog({ open, onOpenChange, editing }: Props) {
  const { toast } = useToast();
  const createMutation = useCreateSupplierScraper();
  const updateMutation = useUpdateSupplierScraper();
  const isEdit = !!editing;

  const [supplierName, setSupplierName] = useState("");
  const [supplierKey, setSupplierKey] = useState("");
  const [keyTouched, setKeyTouched] = useState(false);
  const [requiresLogin, setRequiresLogin] = useState(false);
  const [loginUrl, setLoginUrl] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [abtaNumber, setAbtaNumber] = useState("");
  const [isActive, setIsActive] = useState(true);
  const [hasApi, setHasApi] = useState(false);
  const [apiPath, setApiPath] = useState("");
  const [configText, setConfigText] = useState("");
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [configError, setConfigError] = useState<string | null>(null);

  // Reset the form whenever the dialog opens for a new target.
  useEffect(() => {
    if (!open) return;
    const cfg = editing?.config as { auth?: Record<string, unknown>; fetch?: Record<string, unknown> } | undefined;
    const auth = cfg?.auth;
    const authType = auth?.type as string | undefined;
    setSupplierName(editing?.supplierName ?? "");
    setSupplierKey(editing?.supplierKey ?? "");
    setKeyTouched(false);
    // On edit, infer the toggle from the stored auth type (or from having creds).
    setRequiresLogin(
      editing ? (authType ? authType !== "none" : editing.credentials.hasPassword) : false,
    );
    setLoginUrl((auth?.loginUrl as string) ?? "");
    setUsername("");
    setPassword("");
    setAbtaNumber("");
    setIsActive(editing?.isActive ?? true);
    const storedApiPath = (cfg?.fetch?.apiPath as string) ?? "";
    setHasApi(!!storedApiPath);
    setApiPath(storedApiPath);
    setConfigText(editing ? JSON.stringify(editing.config ?? {}, null, 2) : "");
    setShowAdvanced(false);
    setConfigError(null);
  }, [open, editing]);

  const saving = createMutation.isPending || updateMutation.isPending;

  const handleNameChange = (value: string) => {
    setSupplierName(value);
    // Auto-suggest the key from the name until the user edits the key directly.
    if (!isEdit && !keyTouched) setSupplierKey(slugify(value));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setConfigError(null);

    if (!isEdit && (!supplierName.trim() || !supplierKey.trim())) {
      toast({ title: "Name and key are required", variant: "destructive" });
      return;
    }

    // Start from the advanced JSON (if edited), then overlay the login settings
    // the toggle drives so the two never fight.
    let config: Record<string, unknown> = {};
    if (showAdvanced && configText.trim()) {
      try {
        config = JSON.parse(configText);
      } catch (err) {
        setConfigError(err instanceof Error ? err.message : "Invalid JSON");
        return;
      }
    }

    const auth: Record<string, unknown> = { ...((config.auth as Record<string, unknown>) ?? {}) };
    if (requiresLogin) {
      // Keep an existing form type (keycloak-form) if set; else basic-form.
      auth.type = auth.type && auth.type !== "none" ? auth.type : "basic-form";
      if (loginUrl.trim()) {
        auth.loginUrl = loginUrl.trim();
        // A login URL means "log in there first, then open the deal" — the fix
        // for portals whose deal link lands on a home/search page, not login.
        // The scraper learns the form's fields from that page automatically.
        auth.loginFirst = true;
      }
    } else {
      // No login: mark it explicitly so the scraper reads the page directly and
      // never asks for credentials.
      auth.type = "none";
    }
    config.auth = auth;

    // Data-API endpoint: stored as fetch.apiPath. During a scrape the browser
    // intercepts responses whose URL contains this path; the captured JSON is
    // preferred over page text for field extraction (and the AI writes
    // jsonPath rules against it when the spec is first generated).
    const fetchCfg: Record<string, unknown> = { ...((config.fetch as Record<string, unknown>) ?? {}) };
    if (hasApi && apiPath.trim()) fetchCfg.apiPath = apiPath.trim();
    else delete fetchCfg.apiPath;
    if (Object.keys(fetchCfg).length > 0) config.fetch = fetchCfg;
    else delete config.fetch;

    // Credentials only matter when login is required; blank = "leave unchanged".
    const credentials: { username?: string; password?: string; abtaNumber?: string } = {};
    if (requiresLogin) {
      if (username.trim()) credentials.username = username.trim();
      if (password) credentials.password = password;
      if (abtaNumber.trim()) credentials.abtaNumber = abtaNumber.trim();
    }

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
        { id: editing.id, input: { supplierName: supplierName.trim() || undefined, isActive, config, credentials } },
        { onSuccess, onError },
      );
    } else {
      createMutation.mutate(
        {
          supplierKey: supplierKey.trim(),
          supplierName: supplierName.trim(),
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
          <div className="space-y-1.5">
            <Label>Supplier name</Label>
            <Input
              value={supplierName}
              onChange={(e) => handleNameChange(e.target.value)}
              placeholder="e.g. Jet2holidays"
              autoComplete="off"
            />
          </div>

          {!isEdit && (
            <div className="space-y-1.5">
              <Label>Key</Label>
              <Input
                value={supplierKey}
                onChange={(e) => {
                  setKeyTouched(true);
                  setSupplierKey(slugify(e.target.value));
                }}
                placeholder="e.g. jet2"
                autoComplete="off"
              />
              <p className="text-xs text-muted-foreground">
                A short, unique id used internally (letters/numbers only). Auto-filled from the name.
              </p>
            </div>
          )}

          <div className="flex items-center justify-between rounded-xl border px-3 py-2">
            <div>
              <div className="text-sm font-medium">Requires login</div>
              <div className="text-xs text-muted-foreground">
                Turn on for trade portals that need credentials. Off = public site, scraped directly.
              </div>
            </div>
            <Switch checked={requiresLogin} onCheckedChange={setRequiresLogin} />
          </div>

          {requiresLogin && (
            <div className="space-y-4 rounded-xl border border-dashed p-3">
              <div className="space-y-1.5">
                <Label>Login page URL</Label>
                <Input
                  value={loginUrl}
                  onChange={(e) => setLoginUrl(e.target.value)}
                  placeholder="https://…/login"
                  autoComplete="off"
                />
                <p className="text-xs text-muted-foreground">
                  The page with the username/password fields. We open it, work out the fields automatically, log in, then open the deal.
                </p>
              </div>

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

              <div className="space-y-1.5">
                <Label>Agent ref / ABTA / extra ID <span className="font-normal text-muted-foreground">(optional)</span></Label>
                <Input
                  value={abtaNumber}
                  onChange={(e) => setAbtaNumber(e.target.value)}
                  placeholder={editing?.credentials.hasAbtaNumber ? "•••••• (unchanged)" : "a 3rd login field, if the portal has one"}
                  autoComplete="off"
                />
              </div>
            </div>
          )}

          <div className="flex items-center justify-between rounded-xl border px-3 py-2">
            <div>
              <div className="text-sm font-medium">Has a data API</div>
              <div className="text-xs text-muted-foreground">
                Turn on if the supplier's deal page loads its data from a JSON endpoint — extraction then prefers the API over reading page text.
              </div>
            </div>
            <Switch checked={hasApi} onCheckedChange={setHasApi} data-testid="scraper-has-api" />
          </div>

          {hasApi && (
            <div className="space-y-1.5 rounded-xl border border-dashed p-3">
              <Label>API endpoint path</Label>
              <Input
                value={apiPath}
                onChange={(e) => setApiPath(e.target.value)}
                placeholder="e.g. /holidays/_api/v1.0/hotel/offers"
                autoComplete="off"
                data-testid="scraper-api-path"
              />
              <p className="text-xs text-muted-foreground">
                Part of the endpoint's URL path. While the deal page loads, the scraper captures the JSON this endpoint
                returns and uses it as the primary data source — page text only fills the gaps. Find it in the browser's
                Network tab (an XHR returning the price/offer data).
              </p>
            </div>
          )}

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

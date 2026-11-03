import { useState } from "react";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { useSocialSettings } from "../../api/use-social-settings-queries";
import { useUpdateSocialSettings } from "../../api/use-social-settings-mutations";
import { time12 } from "../../lib/schedule-time";
import { MAX_TIME_SHORTCUTS, addShortcut, timezoneOptions } from "./settings-helpers";

export function TimeShortcutsCard() {
  const { data, isLoading } = useSocialSettings();
  const update = useUpdateSocialSettings();
  const { toast } = useToast();
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState("09:00");
  const [error, setError] = useState<string | null>(null);

  const failToast = () =>
    toast({ variant: "destructive", title: "Could not save", description: "Your change was not saved." });
  const fullToast = () => toast({ title: `You can have at most ${MAX_TIME_SHORTCUTS} time shortcuts` });

  const saveTimes = (list: string[], onOk?: () => void) =>
    update.mutate({ timeShortcuts: list }, { onSuccess: onOk, onError: failToast });

  const reset = () => {
    setAdding(false);
    setError(null);
  };

  const submit = () => {
    if (!data) return;
    if (data.timeShortcuts.length >= MAX_TIME_SHORTCUTS) {
      fullToast();
      return;
    }
    const result = addShortcut(data.timeShortcuts, draft);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    saveTimes(result.list, reset);
  };

  const remove = (t: string) => {
    if (!data) return;
    if (data.timeShortcuts.length <= 1) {
      toast({ title: "Keep at least one time shortcut" });
      return;
    }
    saveTimes(data.timeShortcuts.filter((x) => x !== t));
  };

  const zones = timezoneOptions();
  const tz = data?.timezone ?? "";
  const zoneList = tz && !zones.includes(tz) ? [tz, ...zones] : zones;

  return (
    <Card className="border-social-border">
      <CardHeader>
        <CardTitle className="text-social-navy">Time shortcuts</CardTitle>
        <CardDescription className="text-social-muted">
          One-tap choices when you pick a time. You always choose the date and time yourself.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {isLoading || !data ? (
          <Skeleton className="h-24 w-full" />
        ) : (
          <>
            <div className="flex flex-wrap items-center gap-2">
              {data.timeShortcuts.map((t) => (
                <span
                  key={t}
                  className="inline-flex items-center gap-1 rounded-full border border-social-border px-3 py-1 text-sm text-social-navy"
                >
                  {time12(t)}
                  <button
                    type="button"
                    aria-label={`Remove ${time12(t)}`}
                    onClick={() => remove(t)}
                    className="text-social-muted hover:text-social-navy"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </span>
              ))}
              {!adding && (
                <button
                  type="button"
                  className="text-sm font-medium text-social-orange-text hover:underline"
                  onClick={() => (data.timeShortcuts.length >= MAX_TIME_SHORTCUTS ? fullToast() : setAdding(true))}
                >
                  + Add time
                </button>
              )}
            </div>
            {adding && (
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <input
                    type="time"
                    value={draft}
                    autoFocus
                    onChange={(e) => {
                      setDraft(e.target.value);
                      setError(null);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") submit();
                      if (e.key === "Escape") reset();
                    }}
                    className="h-9 rounded-md border border-social-border bg-transparent px-2 text-sm"
                  />
                  <Button size="sm" onClick={submit} disabled={update.isPending}>
                    Add
                  </Button>
                </div>
                {error && <p className="text-xs text-status-failed-fg">{error}</p>}
              </div>
            )}
            <div className="space-y-1">
              <p className="text-sm font-medium text-social-navy">Time zone</p>
              <Select
                value={data.timezone}
                onValueChange={(v) =>
                  update.mutate(
                    { timezone: v },
                    { onSuccess: () => toast({ title: "Time zone saved" }), onError: failToast },
                  )
                }
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {zoneList.map((z) => (
                    <SelectItem key={z} value={z}>
                      {z}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-social-muted">Used for labels. Scheduling uses your browser&apos;s time zone.</p>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}

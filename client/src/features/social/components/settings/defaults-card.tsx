import { useState } from "react";
import { Lock } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { useSocialSettings } from "../../api/use-social-settings-queries";
import { useUpdateSocialSettings } from "../../api/use-social-settings-mutations";

type ToggleKey = "defaultViewLink" | "defaultPriceBadge";

interface RowProps {
  label: string;
  sub: string;
  checked: boolean;
  onChange?: (v: boolean) => void;
  locked?: boolean;
}

function Row({ label, sub, checked, onChange, locked }: RowProps) {
  return (
    <div className="flex items-center justify-between gap-3 py-2">
      <div>
        <p className="text-sm font-medium text-social-navy">{label}</p>
        <p className="text-xs text-social-muted">{sub}</p>
      </div>
      <div className="flex items-center gap-2">
        {locked && <Lock className="h-3.5 w-3.5 text-social-muted" />}
        <Switch checked={checked} disabled={locked} onCheckedChange={onChange} aria-label={label} />
      </div>
    </div>
  );
}

export function DefaultsCard() {
  const { data, isLoading } = useSocialSettings();
  const update = useUpdateSocialSettings();
  const { toast } = useToast();
  const [optimistic, setOptimistic] = useState<Partial<Record<ToggleKey, boolean>>>({});

  const value = (k: ToggleKey) => optimistic[k] ?? data?.[k] ?? false;

  const toggle = (key: ToggleKey, next: boolean) => {
    setOptimistic((o) => ({ ...o, [key]: next }));
    update.mutate(
      { [key]: next },
      {
        onError: () =>
          toast({ variant: "destructive", title: "Could not save", description: "Your change was not saved." }),
        onSettled: () =>
          setOptimistic((o) => {
            const rest = { ...o };
            delete rest[key];
            return rest;
          }),
      },
    );
  };

  return (
    <Card className="border-social-border">
      <CardHeader>
        <CardTitle className="text-social-navy">Defaults for new posts</CardTitle>
        <CardDescription className="text-social-muted">You can change any of these on a single post.</CardDescription>
      </CardHeader>
      <CardContent className="divide-y divide-social-border">
        {isLoading || !data ? (
          <Skeleton className="h-32 w-full" />
        ) : (
          <>
            <Row
              label="Add a 'View quote' link on Facebook"
              sub="Opens the quote page your client can accept"
              checked={value("defaultViewLink")}
              onChange={(v) => toggle("defaultViewLink", v)}
            />
            <Row
              label="Show the price badge on the first image"
              sub="'From £499.00pp' on the picture"
              checked={value("defaultPriceBadge")}
              onChange={(v) => toggle("defaultPriceBadge", v)}
            />
            <Row
              label="Never show cost or profit"
              sub="Always on. Only the price per person is posted."
              checked
              locked
            />
            {data.isDefault && (
              <p className="pt-3 text-xs text-social-muted">Using Travana defaults until you change something.</p>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}

import type { ReactNode } from "react";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";

export function SettingsField({
  label,
  required,
  children,
}: {
  label: string;
  required?: boolean;
  children: ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs">
        {label}
        {required && <span className="ml-1 text-red-500">*</span>}
      </Label>
      {children}
    </div>
  );
}

export function SettingsSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="space-y-3">
      <div className="text-xs font-semibold uppercase tracking-wider text-black/50 dark:text-white/50">{title}</div>
      <div className="space-y-3">{children}</div>
    </section>
  );
}

export function SettingsToggleRow({
  label,
  description,
  checked,
  onChange,
  testId,
}: {
  label: string;
  description: string;
  checked: boolean;
  onChange: (c: boolean) => void;
  testId: string;
}) {
  return (
    <div className="flex items-center justify-between rounded-xl border border-black/10 bg-black/[0.02] px-3 py-2 text-sm dark:border-white/10 dark:bg-white/[0.02]">
      <div>
        <div className="font-medium">{label}</div>
        <div className="text-xs text-black/55 dark:text-white/55">{description}</div>
      </div>
      <Switch checked={checked} onCheckedChange={onChange} data-testid={testId} />
    </div>
  );
}

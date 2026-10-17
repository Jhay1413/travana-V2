import { cn } from "@/lib/utils";
import { roleDisplay } from "../../lib/role-permissions";

export function RolePill({ role, className }: { role: string | null | undefined; className?: string }) {
  const d = roleDisplay(role);
  return (
    <span className={cn("inline-flex items-center whitespace-nowrap rounded-full px-2.5 py-[3px] text-[12px] font-semibold", d.pill, className)}>
      {d.label}
    </span>
  );
}

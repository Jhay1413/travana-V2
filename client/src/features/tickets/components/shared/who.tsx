import { UserRound } from "lucide-react";
import { PersonAvatar } from "@/components/shared/person-avatar";
import { cn } from "@/lib/utils";

/** Assignee avatar plus first name; a dashed circle for unassigned. */
export function Who({ name, size = 26, showName = true, className }: { name: string | null | undefined; size?: number; showName?: boolean; className?: string }) {
  if (!name) {
    return (
      <span className={cn("inline-flex items-center gap-2 whitespace-nowrap text-[12.5px] text-social-muted", className)}>
        <span className="grid place-items-center rounded-full border-[1.5px] border-dashed border-ticket-dashed" style={{ width: size, height: size }}>
          <UserRound className="h-3 w-3" />
        </span>
        {showName && "Unassigned"}
      </span>
    );
  }
  return (
    <span className={cn("inline-flex min-w-0 items-center gap-2", className)}>
      <PersonAvatar name={name} size={size} />
      {showName && <span className="truncate text-[13px]">{name.split(" ")[0]}</span>}
    </span>
  );
}

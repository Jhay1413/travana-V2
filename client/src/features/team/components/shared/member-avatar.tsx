import { PersonAvatar } from "@/components/shared/person-avatar";
import { cn } from "@/lib/utils";

/** Initials avatar, dimmed for suspended members. */
export function MemberAvatar({ name, suspended, size = 36 }: { name: string; suspended?: boolean; size?: number }) {
  return <PersonAvatar name={name} size={size} className={cn(suspended && "opacity-50 grayscale")} />;
}

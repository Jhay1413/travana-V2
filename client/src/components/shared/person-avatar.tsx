import { cn } from "@/lib/utils";

/** Initials avatar tinted from the name, for customers and agents. */
const AVATAR_TONES = [
  "bg-red-100 text-red-600",
  "bg-blue-100 text-blue-700",
  "bg-emerald-100 text-emerald-700",
  "bg-amber-100 text-amber-700",
  "bg-purple-100 text-purple-700",
];

export function nameInitials(name: string | null | undefined): string {
  return (
    (name || "?")
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((p) => p[0]?.toUpperCase())
      .join("") || "?"
  );
}

export function PersonAvatar({
  name,
  size = 34,
  dark = false,
  className,
}: {
  name: string | null | undefined;
  size?: number;
  /** Navy-ink fill (pipeline rows) instead of a tint. */
  dark?: boolean;
  className?: string;
}) {
  const hash = [...(name || "?")].reduce((s, c) => s + c.charCodeAt(0), 0);
  return (
    <span
      className={cn(
        "grid shrink-0 place-items-center rounded-full font-semibold",
        dark ? "bg-social-navy-ink text-white" : AVATAR_TONES[hash % AVATAR_TONES.length],
        className,
      )}
      style={{ width: size, height: size, fontSize: Math.max(10, Math.floor(size * 0.34)) }}
      title={name || undefined}
      aria-hidden
    >
      {nameInitials(name)}
    </span>
  );
}

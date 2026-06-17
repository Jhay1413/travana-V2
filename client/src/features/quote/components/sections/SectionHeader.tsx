import type { ElementType } from "react";

export function SectionHeader({ icon: Icon, title }: { icon: ElementType; title: string }) {
  return (
    <div className="mb-3 flex items-center gap-2 text-sm font-semibold">
      <Icon className="h-4 w-4" />
      {title}
    </div>
  );
}

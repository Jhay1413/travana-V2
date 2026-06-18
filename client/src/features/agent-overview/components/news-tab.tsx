import { ChevronRight } from "lucide-react";

export function NewsTab() {
  return (
    <div className="grid gap-3">
      {[
        { title: "Travel trends 2026", src: "Skift", time: "2h ago" },
        { title: "New BA routes to Asia", src: "TTG", time: "5h ago" },
        { title: "ABTA conference highlights", src: "Travel Weekly", time: "1d ago" },
      ].map((n, i) => (
        <div
          key={i}
          className="flex items-center justify-between rounded-2xl border border-black/10 bg-black/5 p-3 dark:border-white/10 dark:bg-white/5"
        >
          <div>
            <div className="text-sm font-medium">{n.title}</div>
            <div className="text-xs text-black/55 dark:text-white/55">
              {n.src} · {n.time}
            </div>
          </div>
          <ChevronRight className="h-4 w-4 text-black/40 dark:text-white/40" />
        </div>
      ))}
    </div>
  );
}

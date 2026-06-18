import { ClipboardList, Sparkles, Ticket, type LucideIcon } from "lucide-react";
import { TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { TabId } from "./_data";

const tabs: { id: TabId; label: string; icon: LucideIcon }[] = [
  { id: "enquiries", label: "Enquiries", icon: ClipboardList },
  { id: "quotes",    label: "Quotes",    icon: Sparkles },
  { id: "bookings",  label: "Bookings",  icon: Ticket },
];

export function TabStrip() {
  return (
    <TabsList
      className="rounded-2xl bg-black/5 dark:bg-white/5"
      data-testid="tabs-opportunities"
    >
      {tabs.map((tab) => {
        const Icon = tab.icon;
        return (
          <TabsTrigger
            key={tab.id}
            value={tab.id}
            className="rounded-xl gap-1.5"
            data-testid={`tab-opportunities-${tab.id}`}
          >
            <Icon className="h-3.5 w-3.5" /> {tab.label}
          </TabsTrigger>
        );
      })}
    </TabsList>
  );
}

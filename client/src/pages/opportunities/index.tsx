import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Tabs, TabsContent } from "@/components/ui/tabs";
import { TabStrip } from "@/features/opportunities/components/sidebar";
import { SearchBox } from "@/features/opportunities/components/filter-bar";
import { OpportunitiesProvider, useOpportunities } from "@/features/opportunities/components/opportunities-context";
import { EnquiriesPage } from "@/features/opportunities/components/enquiries-page";
import { QuotesPage } from "@/features/opportunities/components/quotes-page";
import { BookingsPage } from "@/features/opportunities/components/bookings-page";
import type { TabId } from "@/features/opportunities/components/_data";

export default function OpportunitiesPage() {
  return (
    <OpportunitiesProvider>
      <OpportunitiesShell />
    </OpportunitiesProvider>
  );
}

function OpportunitiesShell() {
  const [tab, setTab] = useState<TabId>("enquiries");
  const { resetForTabChange } = useOpportunities();

  return (
    <section data-testid="section-opportunities">
      <Card className="glass ringed grain rounded-3xl p-4 md:p-5">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between mb-4">
          <div className="space-y-1">
            <div className="text-sm font-medium">Opportunities</div>
            <div className="text-xs text-muted-foreground">
              View and manage all enquiries, quotes, and bookings.
            </div>
          </div>
        </div>

        <Tabs
          value={tab}
          onValueChange={(v) => {
            setTab(v as TabId);
            resetForTabChange();
          }}
        >
          <div className="flex items-center gap-3 mb-3">
            <TabStrip />
            <SearchBox />
          </div>

          <TabsContent value="enquiries" className="mt-0">
            <EnquiriesPage />
          </TabsContent>
          <TabsContent value="quotes" className="mt-0">
            <QuotesPage />
          </TabsContent>
          <TabsContent value="bookings" className="mt-0">
            <BookingsPage />
          </TabsContent>
        </Tabs>
      </Card>
    </section>
  );
}

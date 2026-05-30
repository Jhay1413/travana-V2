import { useMemo, useState } from "react";
import { Card } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  useAgentStats,
  useCurrentUser,
} from "@/hooks/queries";
import {
  useShopTargets,
  useAgentTargetsByUserId,
} from "@/hooks/queries/use-targets-queries";
import { useRole } from "@/hooks/use-role";
import { ProfitStatBoxes, type ProfitStats } from "./profit-stat-boxes";
import { WhatsOnTab, type WhatsOnFilter } from "./whats-on-tab";
import { PipelineTab } from "./pipeline-tab";
import { SocialPostsTab, type SocialFilter } from "./social-posts-tab";
import { NewsTab } from "./news-tab";
import { NotesTab } from "./notes-tab";
import { PinnedSection } from "./pinned-section";
import { EngagementSection } from "./engagement-section";
import { ExpiringQuotesSection } from "./expiring-quotes-section";

export default function AgentOverviewPage() {
  const { role } = useRole();

  const [tab, setTab] = useState<
    "whats-on" | "pipeline" | "calendar" | "news" | "daily-goals"
  >("whats-on");
  const [whatsOnFilter, setWhatsOnFilter] = useState<WhatsOnFilter>("all");
  const [whatsOnDate, setWhatsOnDate] = useState<string>(
    new Date().toISOString().slice(0, 10),
  );
  const [socialFilter, setSocialFilter] = useState<SocialFilter>("today");
  const [socialDateFrom, setSocialDateFrom] = useState<string>(
    new Date().toISOString().slice(0, 10),
  );
  const [socialDateTo, setSocialDateTo] = useState<string>(
    new Date().toISOString().slice(0, 10),
  );

  const { data: currentUser } = useCurrentUser();
  const { data: shopTargetsData } = useShopTargets();
  const { data: agentTargetsData } = useAgentTargetsByUserId(currentUser?.id || "");
  const { data: agentStats } = useAgentStats({ enabled: !!currentUser?.id });

  const profitStats: ProfitStats = useMemo(() => {
    const now = new Date();
    const currentMonthTarget = shopTargetsData?.find(
      (t: any) => t.year === now.getFullYear() && t.month === now.getMonth() + 1,
    );
    const salesTarget = currentMonthTarget
      ? parseFloat(currentMonthTarget.targetAmount) || 0
      : 0;
    const currentAgentTarget = agentTargetsData?.find(
      (t: any) => t.year === now.getFullYear() && t.month === now.getMonth() + 1,
    );
    const agentSalesTarget = currentAgentTarget
      ? parseFloat(currentAgentTarget.targetAmount) || 0
      : 0;
    return {
      todayProfit: agentStats?.todayProfit ?? 0,
      weekProfit: agentStats?.weekProfit ?? 0,
      monthProfit: agentStats?.monthProfit ?? 0,
      salesTarget,
      agentSalesTarget,
      avgBookingValue: agentStats?.avgBookingValue ?? 0,
      totalOpenQuotesValue: agentStats?.totalOpenQuotesValue ?? 0,
      bookingsCount: agentStats?.bookingsCount ?? 0,
      quotesCount: agentStats?.quotesCount ?? 0,
    };
  }, [agentStats, shopTargetsData, agentTargetsData]);

  const isAgentView = role === "Agent" || role === "Homeworker";
  const userId = currentUser?.id || "";

  return (
    <section className="space-y-4">
      <ProfitStatBoxes profitStats={profitStats} isAgentView={isAgentView} />
      <div className="grid gap-4 lg:grid-cols-[1.35fr_.65fr]">
        <Card className="glass ringed grain rounded-3xl p-4 md:p-5">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div className="space-y-1">
              <div className="text-sm font-medium" data-testid="text-overview-title">
                Agent Dashboard
              </div>
              <div className="text-xs text-muted-foreground" data-testid="text-overview-subtitle">
                Your dashboard at a glance.
              </div>
            </div>

            <Tabs value={tab} onValueChange={(v) => setTab(v as any)}>
              <TabsList className="rounded-2xl bg-black/5 dark:bg-white/5" data-testid="tabs-overview">
                <TabsTrigger value="whats-on" className="rounded-xl" data-testid="tab-overview-whats-on">
                  What's On!
                </TabsTrigger>
                <TabsTrigger value="pipeline" className="rounded-xl" data-testid="tab-overview-pipeline">
                  Pipeline
                </TabsTrigger>
                <TabsTrigger value="calendar" className="rounded-xl" data-testid="tab-overview-social">
                  Social Posts
                </TabsTrigger>
                <TabsTrigger value="news" className="rounded-xl" data-testid="tab-overview-news">
                  News
                </TabsTrigger>
                <TabsTrigger value="daily-goals" className="rounded-xl" data-testid="tab-overview-daily-goals">
                  Notes
                </TabsTrigger>
              </TabsList>
            </Tabs>
          </div>

          <Separator className="my-4 bg-black/10 dark:bg-white/10" />

          <Tabs value={tab}>
            <TabsContent value="whats-on" className="mt-0">
              <WhatsOnTab
                userId={userId}
                whatsOnFilter={whatsOnFilter}
                whatsOnDate={whatsOnDate}
                setWhatsOnFilter={setWhatsOnFilter}
                setWhatsOnDate={setWhatsOnDate}
              />
            </TabsContent>

            <TabsContent value="pipeline" className="mt-0">
              <PipelineTab userId={userId} tab={tab} />
            </TabsContent>

            <TabsContent value="calendar" className="mt-0">
              <SocialPostsTab
                tab={tab}
                socialFilter={socialFilter}
                socialDateFrom={socialDateFrom}
                socialDateTo={socialDateTo}
                setSocialFilter={setSocialFilter}
                setSocialDateFrom={setSocialDateFrom}
                setSocialDateTo={setSocialDateTo}
              />
            </TabsContent>

            <TabsContent value="news" className="mt-0">
              <NewsTab />
            </TabsContent>

            <TabsContent value="daily-goals" className="mt-0">
              <NotesTab />
            </TabsContent>
          </Tabs>
        </Card>

        <div className="flex flex-col gap-4">
          <EngagementSection />
          <PinnedSection />
          <ExpiringQuotesSection userId={userId} tab={tab} />
        </div>
      </div>
    </section>
  );
}

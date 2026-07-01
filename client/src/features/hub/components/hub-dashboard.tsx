import { motion } from "framer-motion";
import { ArrowRight, Clock } from "lucide-react";
import { Link } from "wouter";
import { HubSectionHeader, HubKpiCard, HubAvatar } from "@/features/hub/components/hub-components";
import { dashboardKpis, activityFeed } from "@/data/hub-mock";
import { Button } from "@/components/ui/button";

export default function HubDashboard() {
  return (
    <div data-testid="page-hub-dashboard">
      <HubSectionHeader title="Dashboard" subtitle="Welcome back, Sarah. Here's what's happening today." />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {dashboardKpis.map((kpi, i) => (
          <HubKpiCard key={kpi.id} {...kpi} index={i} />
        ))}
      </div>

      <div className="mt-8 grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <div className="rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
            <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4 dark:border-slate-800">
              <h2 className="text-base font-semibold text-slate-900 dark:text-white" data-testid="text-activity-title">Activity Feed</h2>
              <Button variant="ghost" size="sm" className="text-xs text-blue-600 dark:text-blue-400" data-testid="button-view-all-activity">
                View All
              </Button>
            </div>
            <div className="divide-y divide-slate-100 dark:divide-slate-800">
              {activityFeed.map((item, i) => (
                <motion.div
                  key={item.id}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.05 }}
                  className="flex items-center gap-4 px-5 py-3.5 transition-colors hover:bg-slate-50 dark:hover:bg-slate-800/50"
                  data-testid={`row-activity-${item.id}`}
                >
                  <HubAvatar initials={item.avatar} size="sm" />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm text-slate-700 dark:text-slate-300">
                      <span className="font-semibold text-slate-900 dark:text-white">{item.user}</span>{" "}
                      {item.action}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-1 text-xs text-slate-400">
                    <Clock className="h-3 w-3" />
                    {item.time}
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <div className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
            <h3 className="text-sm font-semibold text-slate-900 dark:text-white" data-testid="text-quick-links">Quick Links</h3>
            <div className="mt-3 space-y-2">
              {[
                { label: "Continue Training", path: "/hub/training", color: "text-blue-600 dark:text-blue-400" },
                { label: "Browse Knowledge Vault", path: "/hub/knowledge", color: "text-emerald-600 dark:text-emerald-400" },
                { label: "AI Destination Intel", path: "/hub/ai-intel", color: "text-purple-600 dark:text-purple-400" },
              ].map((link) => (
                <Link
                  key={link.path}
                  href={link.path}
                  className="flex items-center justify-between rounded-lg px-3 py-2 text-sm font-medium transition-colors hover:bg-slate-50 dark:hover:bg-slate-800"
                  data-testid={`link-quick-${link.label.toLowerCase().replace(/\s+/g, "-")}`}
                >
                  <span className={link.color}>{link.label}</span>
                  <ArrowRight className="h-4 w-4 text-slate-400" />
                </Link>
              ))}
            </div>
          </div>

          <div className="rounded-xl border border-blue-200 bg-gradient-to-br from-blue-50 to-indigo-50 p-5 dark:border-blue-500/20 dark:from-blue-500/5 dark:to-indigo-500/5">
            <h3 className="text-sm font-semibold text-blue-900 dark:text-blue-300" data-testid="text-focus-destination">Focus Destination: Antalya</h3>
            <p className="mt-2 text-xs text-blue-700/70 dark:text-blue-400/70">
              2% commission bonus on all Antalya bookings this month. Complete the training module to maximize your sales.
            </p>
            <Link href="/hub/ai-intel">
              <Button size="sm" className="mt-3 bg-blue-600 text-white hover:bg-blue-700" data-testid="button-explore-antalya">
                Explore Antalya Intel
              </Button>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

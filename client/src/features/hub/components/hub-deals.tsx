import { motion } from "framer-motion";
import {
  Award,
  BookOpen,
  Crown,
  Lightbulb,
  MapPin,
  MessageSquare,
  Star,
  TrendingUp,
  Trophy,
} from "lucide-react";
import { HubSectionHeader, HubAvatar, HubBadge } from "@/features/hub/components/hub-components";
import { dealWins, leaderboard } from "@/data/hub-mock";
import { Button } from "@/components/ui/button";

function LeaderboardCard({ title, icon: Icon, entry, color }: { title: string; icon: React.ElementType; entry: { name: string; avatar: string; value: string }; color: string }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
      <div className={`flex items-center gap-2 text-sm font-semibold ${color}`}>
        <Icon className="h-4 w-4" /> {title}
      </div>
      <div className="mt-3 flex items-center gap-3">
        <HubAvatar initials={entry.avatar} size="md" />
        <div>
          <p className="text-sm font-semibold text-slate-900 dark:text-white">{entry.name}</p>
          <p className="text-xs text-slate-500">{entry.value}</p>
        </div>
      </div>
    </div>
  );
}

export default function HubDeals() {
  return (
    <div data-testid="page-hub-deals">
      <HubSectionHeader title="Deal Wins Wall" subtitle="Celebrate success and learn from top performers." />

      <div className="grid gap-6 lg:grid-cols-[1fr_300px]">
        <div className="grid gap-4 sm:grid-cols-2">
          {dealWins.map((deal, i) => (
            <motion.div
              key={deal.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.06 }}
              className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900"
              data-testid={`card-deal-${deal.id}`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <HubAvatar initials={deal.avatar} />
                  <div>
                    <p className="text-sm font-semibold text-slate-900 dark:text-white">{deal.agentName}</p>
                    <p className="text-xs text-slate-400">{deal.date}</p>
                  </div>
                </div>
                <div className="rounded-lg bg-emerald-50 px-3 py-1.5 text-sm font-bold text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400" data-testid={`text-deal-value-${deal.id}`}>
                  {deal.saleValue}
                </div>
              </div>

              <div className="mt-3 flex items-center gap-1.5">
                <MapPin className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400" />
                <span className="text-sm font-medium text-slate-700 dark:text-slate-300">{deal.destination}</span>
              </div>

              <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">{deal.summary}</p>

              <div className="mt-3 rounded-lg bg-amber-50 p-3 dark:bg-amber-500/5">
                <div className="flex items-center gap-1.5 text-xs font-medium text-amber-700 dark:text-amber-400">
                  <MessageSquare className="h-3 w-3" /> Objection Handled
                </div>
                <p className="mt-1 text-xs italic text-amber-600/80 dark:text-amber-300/80">{deal.objectionHandled}</p>
              </div>

              <Button
                size="sm"
                variant="outline"
                className="mt-4 w-full text-xs border-blue-200 text-blue-600 hover:bg-blue-50 dark:border-blue-500/30 dark:text-blue-400 dark:hover:bg-blue-500/10"
                data-testid={`button-learn-${deal.id}`}
              >
                <Lightbulb className="mr-1.5 h-3 w-3" /> Learn From This
              </Button>
            </motion.div>
          ))}
        </div>

        <div className="space-y-4">
          <h3 className="text-sm font-semibold text-slate-900 dark:text-white" data-testid="text-leaderboard-title">Leaderboard</h3>
          <LeaderboardCard
            title="Top Seller This Month"
            icon={Trophy}
            entry={leaderboard.topSeller}
            color="text-amber-600 dark:text-amber-400"
          />
          <LeaderboardCard
            title="Top Knowledge Contributor"
            icon={Star}
            entry={leaderboard.topContributor}
            color="text-blue-600 dark:text-blue-400"
          />
          <LeaderboardCard
            title="Most Improved Agent"
            icon={TrendingUp}
            entry={leaderboard.mostImproved}
            color="text-emerald-600 dark:text-emerald-400"
          />
        </div>
      </div>
    </div>
  );
}

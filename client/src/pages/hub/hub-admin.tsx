import { motion } from "framer-motion";
import {
  AlertTriangle,
  BarChart3,
  BookOpen,
  CheckCircle2,
  GraduationCap,
  MapPin,
  Megaphone,
  Plus,
  Settings,
  Sparkles,
  Users,
} from "lucide-react";
import { HubSectionHeader, HubBadge, HubProgressBar } from "@/components/hub-components";
import { adminStats, trainingModules } from "@/data/hub-mock";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

function AdminCard({ icon: Icon, title, value, color, description }: { icon: React.ElementType; title: string; value: string | number; color: string; description: string }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
      <div className={cn("grid h-10 w-10 place-items-center rounded-lg", color)}>
        <Icon className="h-5 w-5 text-white" />
      </div>
      <p className="mt-3 text-2xl font-bold text-slate-900 dark:text-white">{value}</p>
      <p className="text-sm font-medium text-slate-700 dark:text-slate-300">{title}</p>
      <p className="mt-1 text-xs text-slate-500">{description}</p>
    </div>
  );
}

export default function HubAdmin() {
  return (
    <div data-testid="page-hub-admin">
      <HubSectionHeader
        title="Admin Panel"
        subtitle="Manage training, content, and team performance."
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <AdminCard icon={CheckCircle2} title="Pending Approvals" value={adminStats.pendingApprovals} color="bg-amber-500" description="Knowledge submissions awaiting review" />
        <AdminCard icon={GraduationCap} title="Active Modules" value={adminStats.activeModules} color="bg-blue-500" description="Training modules currently live" />
        <AdminCard icon={Users} title="Total Agents" value={adminStats.totalAgents} color="bg-emerald-500" description="Active team members" />
        <AdminCard icon={BarChart3} title="Avg Training" value={`${adminStats.avgTrainingCompletion}%`} color="bg-purple-500" description="Average completion rate" />
      </div>

      <div className="mt-8 grid gap-6 lg:grid-cols-2">
        <div className="rounded-xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-semibold text-slate-900 dark:text-white">Quick Actions</h3>
          </div>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <Button variant="outline" className="h-auto flex-col gap-2 p-4 text-left" data-testid="button-admin-add-training">
              <GraduationCap className="h-5 w-5 text-blue-600" />
              <div>
                <p className="text-sm font-medium">Add Training Module</p>
                <p className="text-xs text-slate-500">Create new learning content</p>
              </div>
            </Button>
            <Button variant="outline" className="h-auto flex-col gap-2 p-4 text-left" data-testid="button-admin-approve">
              <CheckCircle2 className="h-5 w-5 text-emerald-600" />
              <div>
                <p className="text-sm font-medium">Approve Submissions</p>
                <p className="text-xs text-slate-500">{adminStats.pendingApprovals} pending reviews</p>
              </div>
            </Button>
            <Button variant="outline" className="h-auto flex-col gap-2 p-4 text-left" data-testid="button-admin-announce">
              <Megaphone className="h-5 w-5 text-amber-600" />
              <div>
                <p className="text-sm font-medium">Post Announcement</p>
                <p className="text-xs text-slate-500">Share news with the team</p>
              </div>
            </Button>
            <Button variant="outline" className="h-auto flex-col gap-2 p-4 text-left" data-testid="button-admin-focus">
              <MapPin className="h-5 w-5 text-purple-600" />
              <div>
                <p className="text-sm font-medium">Set Focus Destination</p>
                <p className="text-xs text-slate-500">Current: Antalya</p>
              </div>
            </Button>
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-semibold text-slate-900 dark:text-white" data-testid="text-skill-gaps">Team Skill Gaps</h3>
            <HubBadge variant="red">
              <AlertTriangle className="mr-1 h-3 w-3" /> Action Needed
            </HubBadge>
          </div>
          <div className="mt-4 space-y-4">
            {adminStats.skillGaps.map((gap) => (
              <div key={gap.skill}>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-slate-700 dark:text-slate-300">{gap.skill}</span>
                  <span className={cn(
                    "text-xs font-medium",
                    gap.gap >= 50 ? "text-red-600 dark:text-red-400" : gap.gap >= 30 ? "text-amber-600 dark:text-amber-400" : "text-slate-500"
                  )}>
                    {gap.gap}% gap
                  </span>
                </div>
                <div className="mt-1.5 h-2 w-full rounded-full bg-slate-200 dark:bg-slate-700">
                  <div
                    className={cn(
                      "h-2 rounded-full transition-all",
                      gap.gap >= 50 ? "bg-red-500" : gap.gap >= 30 ? "bg-amber-500" : "bg-emerald-500"
                    )}
                    style={{ width: `${100 - gap.gap}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="mt-8 rounded-xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900">
        <div className="flex items-center justify-between">
          <h3 className="text-base font-semibold text-slate-900 dark:text-white">Training Modules Overview</h3>
          <Button size="sm" className="bg-blue-600 text-white hover:bg-blue-700" data-testid="button-admin-new-module">
            <Plus className="mr-1.5 h-3 w-3" /> New Module
          </Button>
        </div>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-800">
                <th className="py-3 pr-4 text-left text-xs font-medium text-slate-500">Module</th>
                <th className="py-3 pr-4 text-left text-xs font-medium text-slate-500">Section</th>
                <th className="py-3 pr-4 text-left text-xs font-medium text-slate-500">Level</th>
                <th className="py-3 pr-4 text-left text-xs font-medium text-slate-500">Duration</th>
                <th className="py-3 text-left text-xs font-medium text-slate-500">Status</th>
              </tr>
            </thead>
            <tbody>
              {trainingModules.map((mod) => (
                <tr key={mod.id} className="border-b border-slate-100 dark:border-slate-800">
                  <td className="py-3 pr-4 font-medium text-slate-900 dark:text-white">{mod.title}</td>
                  <td className="py-3 pr-4 text-slate-600 dark:text-slate-400">{mod.section}</td>
                  <td className="py-3 pr-4">
                    <HubBadge variant={mod.level === "Advanced" ? "red" : mod.level === "Intermediate" ? "amber" : "green"}>
                      {mod.level}
                    </HubBadge>
                  </td>
                  <td className="py-3 pr-4 text-slate-600 dark:text-slate-400">{mod.duration}</td>
                  <td className="py-3">
                    <HubBadge variant="green">Active</HubBadge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="mt-8 rounded-xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900">
        <h3 className="text-base font-semibold text-slate-900 dark:text-white">AI Features</h3>
        <p className="mt-1 text-xs text-slate-500">Toggle AI-powered features across TheHUB.</p>
        <div className="mt-4 space-y-3">
          {[
            { label: "AI Destination Summaries", enabled: true },
            { label: "AI Training Summaries", enabled: true },
            { label: "AI Deal Analysis", enabled: false },
            { label: "AI Agent Coaching", enabled: false },
          ].map((feature) => (
            <div key={feature.label} className="flex items-center justify-between rounded-lg border border-slate-200 px-4 py-3 dark:border-slate-700">
              <div className="flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                <span className="text-sm text-slate-700 dark:text-slate-300">{feature.label}</span>
              </div>
              <button
                className={cn(
                  "relative h-6 w-11 rounded-full transition-colors",
                  feature.enabled ? "bg-blue-600" : "bg-slate-300 dark:bg-slate-600"
                )}
                data-testid={`toggle-ai-${feature.label.toLowerCase().replace(/\s+/g, "-")}`}
              >
                <span
                  className={cn(
                    "absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform",
                    feature.enabled ? "left-[22px]" : "left-0.5"
                  )}
                />
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

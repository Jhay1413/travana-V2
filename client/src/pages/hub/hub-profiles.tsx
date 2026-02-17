import { motion } from "framer-motion";
import {
  Award,
  BookOpen,
  FileText,
  Heart,
  MapPin,
  Pen,
  Pin,
  Plus,
  Star,
  Trophy,
  Upload,
  Video,
} from "lucide-react";
import { HubSectionHeader, HubAvatar, HubBadge, HubProgressBar } from "@/components/hub-components";
import { agentProfiles } from "@/data/hub-mock";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

function SkillHeatmap({ skills }: { skills: { name: string; level: number }[] }) {
  const getColor = (level: number) => {
    if (level >= 90) return "bg-emerald-500";
    if (level >= 75) return "bg-blue-500";
    if (level >= 50) return "bg-amber-500";
    return "bg-slate-400";
  };

  return (
    <div className="space-y-2">
      {skills.map((skill) => (
        <div key={skill.name} className="flex items-center gap-3">
          <span className="w-24 text-xs text-slate-600 dark:text-slate-400">{skill.name}</span>
          <div className="flex-1">
            <div className="h-3 w-full rounded-full bg-slate-200 dark:bg-slate-700">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${skill.level}%` }}
                transition={{ duration: 0.8, ease: "easeOut" }}
                className={cn("h-3 rounded-full", getColor(skill.level))}
              />
            </div>
          </div>
          <span className="w-8 text-right text-xs font-medium text-slate-500">{skill.level}</span>
        </div>
      ))}
    </div>
  );
}

function StatCard({ icon: Icon, label, value, color }: { icon: React.ElementType; label: string; value: string | number; color: string }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
      <div className={cn("grid h-10 w-10 place-items-center rounded-lg", color)}>
        <Icon className="h-5 w-5 text-white" />
      </div>
      <p className="mt-2 text-2xl font-bold text-slate-900 dark:text-white">{value}</p>
      <p className="text-xs text-slate-500">{label}</p>
    </div>
  );
}

export default function HubProfiles() {
  const profile = agentProfiles[0];

  return (
    <div data-testid="page-hub-profiles">
      <HubSectionHeader title="My Profile" subtitle="Your agent profile and reputation." />

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-1 space-y-4">
          <div className="rounded-xl border border-slate-200 bg-white p-6 text-center dark:border-slate-800 dark:bg-slate-900">
            <div className="mx-auto">
              <HubAvatar initials={profile.avatar} size="lg" />
            </div>
            <h2 className="mt-3 text-lg font-bold text-slate-900 dark:text-white" data-testid="text-profile-name">{profile.name}</h2>
            <HubBadge variant="blue">{profile.role}</HubBadge>
            <p className="mt-3 text-xs text-slate-500 dark:text-slate-400">{profile.bio}</p>

            <div className="mt-4 flex items-center justify-center gap-1">
              {[1, 2, 3, 4, 5].map((star) => (
                <Star
                  key={star}
                  className={cn("h-4 w-4", star <= 4 ? "fill-amber-400 text-amber-400" : "text-slate-300 dark:text-slate-600")}
                />
              ))}
              <span className="ml-1 text-xs text-slate-500">{profile.reputationScore} pts</span>
            </div>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
            <h3 className="text-sm font-semibold text-slate-900 dark:text-white">Training Progress</h3>
            <div className="mt-3">
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-500">Overall</span>
                <span className="font-medium text-slate-700 dark:text-slate-300">{profile.trainingProgress}%</span>
              </div>
              <div className="mt-1.5">
                <HubProgressBar value={profile.trainingProgress} />
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
            <h3 className="text-sm font-semibold text-slate-900 dark:text-white">Actions</h3>
            <div className="mt-3 space-y-2">
              <Button variant="outline" size="sm" className="w-full justify-start text-xs" data-testid="button-add-blog">
                <Pen className="mr-2 h-3 w-3" /> Add Blog Post
              </Button>
              <Button variant="outline" size="sm" className="w-full justify-start text-xs" data-testid="button-upload-video">
                <Upload className="mr-2 h-3 w-3" /> Upload Training Video
              </Button>
              <Button variant="outline" size="sm" className="w-full justify-start text-xs" data-testid="button-pin-guide">
                <Pin className="mr-2 h-3 w-3" /> Pin Knowledge Guide
              </Button>
              <Button variant="outline" size="sm" className="w-full justify-start text-xs" data-testid="button-add-insight">
                <MapPin className="mr-2 h-3 w-3" /> Add Destination Insight
              </Button>
            </div>
          </div>
        </div>

        <div className="lg:col-span-2 space-y-6">
          <div className="grid gap-4 sm:grid-cols-3">
            <StatCard icon={BookOpen} label="Contributions" value={profile.contributions} color="bg-blue-500" />
            <StatCard icon={Trophy} label="Deal Wins" value={profile.dealWins} color="bg-amber-500" />
            <StatCard icon={Award} label="Reputation" value={profile.reputationScore} color="bg-emerald-500" />
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900">
            <h3 className="text-base font-semibold text-slate-900 dark:text-white" data-testid="text-skill-heatmap">Skill Heatmap</h3>
            <p className="mt-1 text-xs text-slate-500">Visual overview of your strengths and areas for development.</p>
            <div className="mt-4">
              <SkillHeatmap skills={profile.skills} />
            </div>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900">
            <h3 className="text-base font-semibold text-slate-900 dark:text-white">Pinned Posts</h3>
            <div className="mt-3 space-y-2">
              {profile.pinnedPosts.map((post) => (
                <div key={post} className="flex items-center gap-3 rounded-lg bg-slate-50 p-3 dark:bg-slate-800/50">
                  <Pin className="h-4 w-4 text-blue-500" />
                  <span className="text-sm text-slate-700 dark:text-slate-300">{post}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

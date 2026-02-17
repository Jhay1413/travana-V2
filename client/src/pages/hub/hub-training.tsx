import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowLeft,
  BookOpen,
  CheckCircle2,
  Clock,
  Download,
  Play,
  Sparkles,
  Video,
} from "lucide-react";
import { HubSectionHeader, HubBadge, HubProgressBar } from "@/components/hub-components";
import { trainingModules, trainingSections } from "@/data/hub-mock";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { TrainingModule } from "@/data/hub-mock";

export default function HubTraining() {
  const [activeSection, setActiveSection] = useState("All");
  const [selectedModule, setSelectedModule] = useState<TrainingModule | null>(null);

  const filtered = activeSection === "All" ? trainingModules : trainingModules.filter((m) => m.section === activeSection);

  if (selectedModule) {
    return (
      <div data-testid="page-hub-training-detail">
        <button
          onClick={() => setSelectedModule(null)}
          className="mb-4 flex items-center gap-2 text-sm font-medium text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-white"
          data-testid="button-back-training"
        >
          <ArrowLeft className="h-4 w-4" /> Back to Training Centre
        </button>

        <div className="grid gap-6 lg:grid-cols-3">
          <div className="lg:col-span-2 space-y-6">
            <div className="aspect-video rounded-xl bg-slate-900 flex items-center justify-center" data-testid="video-placeholder">
              <div className="text-center">
                <div className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-white/10 backdrop-blur">
                  <Play className="h-8 w-8 text-white ml-1" />
                </div>
                <p className="mt-3 text-sm text-white/60">Video Content</p>
              </div>
            </div>

            <div className="rounded-xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900">
              <h1 className="text-xl font-bold text-slate-900 dark:text-white">{selectedModule.title}</h1>
              <div className="mt-2 flex flex-wrap items-center gap-3">
                <HubBadge variant="blue">{selectedModule.section}</HubBadge>
                <HubBadge>{selectedModule.level}</HubBadge>
                <span className="flex items-center gap-1 text-xs text-slate-500">
                  <Clock className="h-3 w-3" /> {selectedModule.duration}
                </span>
              </div>
              <p className="mt-4 text-sm text-slate-600 dark:text-slate-400">{selectedModule.description}</p>

              <div className="mt-4">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-500">Progress</span>
                  <span className="font-medium text-slate-700 dark:text-slate-300">{selectedModule.progress}%</span>
                </div>
                <div className="mt-1.5">
                  <HubProgressBar value={selectedModule.progress} />
                </div>
              </div>
            </div>

            <div className="rounded-xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900">
              <h2 className="text-base font-semibold text-slate-900 dark:text-white">Key Takeaways</h2>
              <ul className="mt-3 space-y-2">
                {selectedModule.takeaways.map((t, i) => (
                  <li key={i} className="flex items-start gap-2.5 text-sm text-slate-600 dark:text-slate-400">
                    <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" />
                    {t}
                  </li>
                ))}
              </ul>
            </div>
          </div>

          <div className="space-y-6">
            <div className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
              <h3 className="text-sm font-semibold text-slate-900 dark:text-white">Resources</h3>
              <div className="mt-3 space-y-2">
                {selectedModule.resources.map((r) => (
                  <button
                    key={r}
                    className="flex w-full items-center gap-2 rounded-lg border border-slate-200 px-3 py-2.5 text-left text-sm text-slate-700 transition-colors hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
                    data-testid={`button-download-${r}`}
                  >
                    <Download className="h-4 w-4 text-slate-400" />
                    <span className="truncate">{r}</span>
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-3">
              <Button className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 text-white hover:from-blue-700 hover:to-indigo-700" data-testid="button-ai-summary">
                <Sparkles className="mr-2 h-4 w-4" /> AI Summary
              </Button>
              <Button
                variant={selectedModule.progress === 100 ? "outline" : "default"}
                className={cn("w-full", selectedModule.progress === 100 && "border-emerald-300 text-emerald-700 dark:border-emerald-500/30 dark:text-emerald-400")}
                data-testid="button-mark-complete"
              >
                {selectedModule.progress === 100 ? (
                  <>
                    <CheckCircle2 className="mr-2 h-4 w-4" /> Completed
                  </>
                ) : (
                  "Mark Complete"
                )}
              </Button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div data-testid="page-hub-training">
      <HubSectionHeader title="Training Centre" subtitle="Develop your skills and knowledge to close more deals." />

      <div className="mb-6 flex flex-wrap gap-2">
        {["All", ...trainingSections].map((section) => (
          <button
            key={section}
            onClick={() => setActiveSection(section)}
            className={cn(
              "rounded-lg px-3.5 py-2 text-sm font-medium transition-all",
              activeSection === section
                ? "bg-blue-600 text-white shadow-sm shadow-blue-500/25"
                : "bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:hover:bg-slate-700"
            )}
            data-testid={`button-filter-${section.toLowerCase().replace(/\s+/g, "-")}`}
          >
            {section}
          </button>
        ))}
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {filtered.map((mod, i) => (
          <motion.div
            key={mod.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.05 }}
            className="group cursor-pointer rounded-xl border border-slate-200 bg-white p-5 shadow-sm transition-all hover:shadow-md dark:border-slate-800 dark:bg-slate-900"
            onClick={() => setSelectedModule(mod)}
            data-testid={`card-training-${mod.id}`}
          >
            <div className="flex items-start justify-between">
              <div className="grid h-10 w-10 place-items-center rounded-lg bg-blue-50 dark:bg-blue-500/10">
                {mod.progress === 100 ? (
                  <CheckCircle2 className="h-5 w-5 text-emerald-500" />
                ) : mod.progress > 0 ? (
                  <Video className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                ) : (
                  <BookOpen className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                )}
              </div>
              <HubBadge variant={mod.level === "Advanced" ? "red" : mod.level === "Intermediate" ? "amber" : "green"}>
                {mod.level}
              </HubBadge>
            </div>

            <h3 className="mt-3 text-sm font-semibold text-slate-900 group-hover:text-blue-600 dark:text-white dark:group-hover:text-blue-400">
              {mod.title}
            </h3>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{mod.section}</p>

            <div className="mt-3 flex items-center gap-3 text-xs text-slate-500">
              <span className="flex items-center gap-1">
                <Clock className="h-3 w-3" /> {mod.duration}
              </span>
            </div>

            <div className="mt-3">
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-400">{mod.progress}% complete</span>
              </div>
              <div className="mt-1.5">
                <HubProgressBar value={mod.progress} size="sm" />
              </div>
            </div>

            <Button
              size="sm"
              variant={mod.progress === 100 ? "outline" : "default"}
              className={cn("mt-4 w-full text-xs", mod.progress === 100 ? "border-emerald-300 text-emerald-600" : "bg-blue-600 text-white hover:bg-blue-700")}
              data-testid={`button-start-${mod.id}`}
            >
              {mod.progress === 100 ? "Review" : mod.progress > 0 ? "Continue" : "Start"}
            </Button>
          </motion.div>
        ))}
      </div>
    </div>
  );
}

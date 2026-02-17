import { motion } from "framer-motion";
import {
  BookOpen,
  GraduationCap,
  MapPin,
  Megaphone,
  Sparkles,
  Trophy,
} from "lucide-react";
import { cn } from "@/lib/utils";

const ICON_MAP: Record<string, React.ElementType> = {
  GraduationCap,
  BookOpen,
  MapPin,
  Trophy,
  Sparkles,
  Megaphone,
};

export function HubSectionHeader({
  title,
  subtitle,
  action,
}: {
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white" data-testid={`text-hub-section-${title.toLowerCase().replace(/\s+/g, "-")}`}>
          {title}
        </h1>
        {subtitle && <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{subtitle}</p>}
      </div>
      {action && <div className="mt-2 sm:mt-0">{action}</div>}
    </div>
  );
}

export function HubKpiCard({
  title,
  value,
  change,
  trend,
  icon,
  index = 0,
}: {
  title: string;
  value: string;
  change?: string;
  trend?: "up" | "down" | "neutral";
  icon: string;
  index?: number;
}) {
  const Icon = ICON_MAP[icon] || Sparkles;
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05 }}
      className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm transition-shadow hover:shadow-md dark:border-slate-800 dark:bg-slate-900"
      data-testid={`card-kpi-${title.toLowerCase().replace(/\s+/g, "-")}`}
    >
      <div className="flex items-center justify-between">
        <div className="grid h-10 w-10 place-items-center rounded-lg bg-blue-50 text-blue-600 dark:bg-blue-500/10 dark:text-blue-400">
          <Icon className="h-5 w-5" />
        </div>
        {change && (
          <span
            className={cn(
              "rounded-full px-2 py-0.5 text-xs font-medium",
              trend === "up" && "bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400",
              trend === "down" && "bg-red-50 text-red-600 dark:bg-red-500/10 dark:text-red-400",
              trend === "neutral" && "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400"
            )}
          >
            {change}
          </span>
        )}
      </div>
      <div className="mt-3">
        <p className="text-sm font-medium text-slate-500 dark:text-slate-400">{title}</p>
        <p className="mt-1 text-2xl font-bold text-slate-900 dark:text-white">{value}</p>
      </div>
    </motion.div>
  );
}

export function HubAvatar({ initials, size = "md" }: { initials: string; size?: "sm" | "md" | "lg" }) {
  const sizeClasses = {
    sm: "h-8 w-8 text-xs",
    md: "h-10 w-10 text-sm",
    lg: "h-14 w-14 text-base",
  };
  return (
    <div className={cn("grid place-items-center rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 font-bold text-white", sizeClasses[size])}>
      {initials}
    </div>
  );
}

export function HubBadge({ children, variant = "default" }: { children: React.ReactNode; variant?: "default" | "blue" | "green" | "amber" | "red" }) {
  const variants = {
    default: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300",
    blue: "bg-blue-50 text-blue-700 dark:bg-blue-500/10 dark:text-blue-400",
    green: "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400",
    amber: "bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-400",
    red: "bg-red-50 text-red-700 dark:bg-red-500/10 dark:text-red-400",
  };
  return (
    <span className={cn("inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium", variants[variant])}>
      {children}
    </span>
  );
}

export function HubSkeletonCard() {
  return (
    <div className="animate-pulse rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
      <div className="flex items-center gap-3">
        <div className="h-10 w-10 rounded-lg bg-slate-200 dark:bg-slate-700" />
        <div className="flex-1 space-y-2">
          <div className="h-3 w-2/3 rounded bg-slate-200 dark:bg-slate-700" />
          <div className="h-3 w-1/3 rounded bg-slate-200 dark:bg-slate-700" />
        </div>
      </div>
      <div className="mt-4 space-y-2">
        <div className="h-3 w-full rounded bg-slate-200 dark:bg-slate-700" />
        <div className="h-3 w-4/5 rounded bg-slate-200 dark:bg-slate-700" />
      </div>
    </div>
  );
}

export function HubEmptyState({ title, description }: { title: string; description: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <div className="grid h-16 w-16 place-items-center rounded-2xl bg-slate-100 dark:bg-slate-800">
        <BookOpen className="h-8 w-8 text-slate-400" />
      </div>
      <h3 className="mt-4 text-lg font-semibold text-slate-900 dark:text-white">{title}</h3>
      <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{description}</p>
    </div>
  );
}

export function HubProgressBar({ value, size = "md" }: { value: number; size?: "sm" | "md" }) {
  return (
    <div className={cn("w-full rounded-full bg-slate-200 dark:bg-slate-700", size === "sm" ? "h-1.5" : "h-2.5")}>
      <motion.div
        initial={{ width: 0 }}
        animate={{ width: `${Math.min(100, value)}%` }}
        transition={{ duration: 0.8, ease: "easeOut" }}
        className={cn(
          "rounded-full",
          size === "sm" ? "h-1.5" : "h-2.5",
          value === 100 ? "bg-emerald-500" : "bg-blue-600 dark:bg-blue-500"
        )}
      />
    </div>
  );
}

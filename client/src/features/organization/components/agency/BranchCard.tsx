import { Link } from "wouter";
import { MapPin, Mail, Pencil, Phone, Star, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Branch } from "@/features/organization/api/branch.api";

export function BranchCard({
  branch,
  brandColor,
  onEdit,
  onSetDefault,
  onToggleActive,
  onDelete,
}: {
  branch: Branch;
  brandColor: string | null | undefined;
  onEdit: () => void;
  onSetDefault: () => void;
  onToggleActive: () => void;
  onDelete: () => void;
}) {
  return (
    <div
      className={cn(
        "group flex flex-col rounded-2xl border bg-white p-4 transition dark:bg-white/5",
        branch.isActive ? "border-black/10 dark:border-white/10" : "border-black/5 opacity-70 dark:border-white/5",
      )}
      data-testid={`card-branch-${branch.id}`}
    >
      <div className="mb-3 flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <Link
              href={`/agency/branches/${branch.id}`}
              className="truncate text-base font-semibold hover:underline"
              data-testid={`link-branch-${branch.id}`}
            >
              {branch.name}
            </Link>
            {branch.isDefault && (
              <span
                className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold text-white"
                style={{ background: brandColor ?? "#2563eb" }}
              >
                <Star className="h-3 w-3" /> Default
              </span>
            )}
          </div>
          {branch.code && <div className="text-xs text-black/50 dark:text-white/50">Code · {branch.code}</div>}
        </div>
        <span
          className={cn(
            "rounded-full px-2 py-0.5 text-[10px] font-medium",
            branch.isActive
              ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
              : "bg-black/10 text-black/50 dark:bg-white/10 dark:text-white/50",
          )}
        >
          {branch.isActive ? "Active" : "Archived"}
        </span>
      </div>

      <div className="space-y-1.5 text-xs text-black/65 dark:text-white/65">
        {branch.address && (
          <div className="flex items-start gap-2">
            <MapPin className="mt-0.5 h-3.5 w-3.5 flex-shrink-0 text-black/40 dark:text-white/40" />
            <span className="line-clamp-2">{branch.address}</span>
          </div>
        )}
        {branch.phone && (
          <div className="flex items-center gap-2">
            <Phone className="h-3.5 w-3.5 text-black/40 dark:text-white/40" />
            <span>{branch.phone}</span>
          </div>
        )}
        {branch.email && (
          <div className="flex items-center gap-2">
            <Mail className="h-3.5 w-3.5 text-black/40 dark:text-white/40" />
            <span className="truncate">{branch.email}</span>
          </div>
        )}
      </div>

      <div className="mt-4 flex items-center justify-between gap-2 border-t border-black/5 pt-3 dark:border-white/10">
        <div className="flex gap-1.5">
          {!branch.isDefault && (
            <button
              onClick={onSetDefault}
              className="rounded-lg px-2 py-1 text-xs text-black/60 hover:bg-black/5 dark:text-white/60 dark:hover:bg-white/10"
              data-testid={`button-set-default-${branch.id}`}
            >
              Set default
            </button>
          )}
          <button
            onClick={onToggleActive}
            className="rounded-lg px-2 py-1 text-xs text-black/60 hover:bg-black/5 dark:text-white/60 dark:hover:bg-white/10"
            data-testid={`button-toggle-active-${branch.id}`}
          >
            {branch.isActive ? "Archive" : "Reactivate"}
          </button>
        </div>
        <div className="flex gap-1">
          <button
            onClick={onEdit}
            className="rounded-lg p-1.5 text-black/60 hover:bg-black/5 dark:text-white/60 dark:hover:bg-white/10"
            data-testid={`button-edit-branch-${branch.id}`}
            title="Edit branch"
          >
            <Pencil className="h-3.5 w-3.5" />
          </button>
          <button
            onClick={onDelete}
            className="rounded-lg p-1.5 text-red-600 opacity-0 transition group-hover:opacity-100 hover:bg-red-500/10"
            data-testid={`button-delete-branch-${branch.id}`}
            title="Delete branch"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}

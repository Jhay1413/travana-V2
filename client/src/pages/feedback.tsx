import { useState } from "react";
import { useFeedbackList } from "@/features/feedback/api/use-feedback-queries";
import { useUpdateFeedbackStatus, useDeleteFeedback } from "@/features/feedback/api/use-feedback-mutations";
import { useToast } from "@/hooks/use-toast";
import { Bug, Lightbulb, MessageCircle, Trash2, ChevronDown, Clock, CheckCircle2, Eye, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { FeedbackRecord } from "@/features/feedback/api/feedback.api";

const TYPE_CONFIG = {
  suggestion: { icon: Lightbulb, label: "Suggestion", color: "text-amber-600", bg: "bg-amber-500/10 border-amber-500/25" },
  bug: { icon: Bug, label: "Bug Report", color: "text-red-600", bg: "bg-red-500/10 border-red-500/25" },
  general: { icon: MessageCircle, label: "General", color: "text-blue-600", bg: "bg-blue-500/10 border-blue-500/25" },
};

const STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  open: { label: "Open", color: "bg-blue-500/10 text-blue-700 border-blue-500/25" },
  in_review: { label: "In Review", color: "bg-amber-500/10 text-amber-700 border-amber-500/25" },
  resolved: { label: "Resolved", color: "bg-emerald-500/10 text-emerald-700 border-emerald-500/25" },
  closed: { label: "Closed", color: "bg-black/5 text-black/50 border-black/10" },
};

export default function FeedbackPage() {
  const { data: feedbackItems, isLoading } = useFeedbackList();
  const updateStatusMutation = useUpdateFeedbackStatus();
  const deleteMutation = useDeleteFeedback();
  const { toast } = useToast();
  const [filterType, setFilterType] = useState("all");
  const [filterStatus, setFilterStatus] = useState("all");
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const items = (feedbackItems || []).filter((item) => {
    if (filterType !== "all" && item.type !== filterType) return false;
    if (filterStatus !== "all" && item.status !== filterStatus) return false;
    return true;
  });

  const handleStatusChange = (id: string, status: string) => {
    updateStatusMutation.mutate(
      { id, status },
      {
        onSuccess: () => toast({ title: "Status updated" }),
        onError: (err: any) => toast({ title: "Failed to update", description: err?.message, variant: "destructive" }),
      }
    );
  };

  const handleDelete = (id: string) => {
    deleteMutation.mutate(id, {
      onSuccess: () => toast({ title: "Feedback deleted" }),
      onError: (err: any) => toast({ title: "Failed to delete", description: err?.message, variant: "destructive" }),
    });
  };

  return (
    <div className="mx-auto w-full max-w-4xl px-4 py-6">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-xl font-bold text-black/85" data-testid="text-feedback-title">User Feedback</h1>
            <p className="text-sm text-black/50">{items.length} item{items.length !== 1 ? "s" : ""}</p>
          </div>
          <div className="flex items-center gap-2">
            <Select value={filterType} onValueChange={setFilterType}>
              <SelectTrigger className="h-8 w-32 rounded-xl text-xs" data-testid="select-feedback-type-filter">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                <SelectItem value="suggestion">Suggestions</SelectItem>
                <SelectItem value="bug">Bug Reports</SelectItem>
                <SelectItem value="general">General</SelectItem>
              </SelectContent>
            </Select>
            <Select value={filterStatus} onValueChange={setFilterStatus}>
              <SelectTrigger className="h-8 w-32 rounded-xl text-xs" data-testid="select-feedback-status-filter">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                <SelectItem value="open">Open</SelectItem>
                <SelectItem value="in_review">In Review</SelectItem>
                <SelectItem value="resolved">Resolved</SelectItem>
                <SelectItem value="closed">Closed</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-16 text-sm text-black/40" data-testid="loading-feedback">
            Loading feedback…
          </div>
        ) : items.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-black/10 bg-white/40 p-12 text-center" data-testid="empty-feedback">
            <MessageCircle className="mx-auto mb-3 h-8 w-8 text-black/20" />
            <p className="text-sm text-black/40">No feedback items found</p>
          </div>
        ) : (
          <div className="space-y-3">
            {items.map((item) => {
              const typeConf = TYPE_CONFIG[item.type];
              const statusConf = STATUS_CONFIG[item.status];
              const isExpanded = expandedId === item.id;
              const TypeIcon = typeConf.icon;

              return (
                <div
                  key={item.id}
                  className="rounded-2xl border border-black/10 bg-white/70 transition hover:bg-white/90"
                  data-testid={`feedback-item-${item.id}`}
                >
                  <button
                    type="button"
                    className="flex w-full items-center gap-3 p-4 text-left"
                    onClick={() => setExpandedId(isExpanded ? null : item.id)}
                    data-testid={`button-toggle-feedback-${item.id}`}
                  >
                    <div className={`grid h-9 w-9 shrink-0 place-items-center rounded-xl border ${typeConf.bg}`}>
                      <TypeIcon className={`h-4 w-4 ${typeConf.color}`} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="truncate text-sm font-semibold text-black/85">{item.subject}</span>
                        <span className={`inline-flex shrink-0 items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold ${statusConf.color}`}>
                          {statusConf.label}
                        </span>
                      </div>
                      <div className="mt-0.5 flex items-center gap-2 text-xs text-black/45">
                        <span>{item.userName || "Unknown"}</span>
                        <span className="text-black/20">&middot;</span>
                        <span>{new Date(item.createdAt).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}</span>
                        {item.page && (
                          <>
                            <span className="text-black/20">&middot;</span>
                            <span className="truncate max-w-[150px]">{item.page}</span>
                          </>
                        )}
                      </div>
                    </div>
                    <ChevronDown className={`h-4 w-4 shrink-0 text-black/30 transition ${isExpanded ? "rotate-180" : ""}`} />
                  </button>

                  {isExpanded && (
                    <div className="border-t border-black/5 px-4 pb-4 pt-3">
                      <p className="whitespace-pre-wrap text-sm text-black/70 mb-4" data-testid={`text-feedback-message-${item.id}`}>
                        {item.message}
                      </p>
                      <div className="flex items-center justify-between gap-3">
                        <Select
                          value={item.status}
                          onValueChange={(v) => handleStatusChange(item.id, v)}
                        >
                          <SelectTrigger className="h-8 w-36 rounded-xl text-xs" data-testid={`select-feedback-status-${item.id}`}>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="open">Open</SelectItem>
                            <SelectItem value="in_review">In Review</SelectItem>
                            <SelectItem value="resolved">Resolved</SelectItem>
                            <SelectItem value="closed">Closed</SelectItem>
                          </SelectContent>
                        </Select>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 rounded-xl text-xs text-red-500 hover:bg-red-500/10 hover:text-red-600"
                          onClick={() => handleDelete(item.id)}
                          data-testid={`button-delete-feedback-${item.id}`}
                        >
                          <Trash2 className="mr-1 h-3.5 w-3.5" />
                          Delete
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
      )}
    </div>
  );
}

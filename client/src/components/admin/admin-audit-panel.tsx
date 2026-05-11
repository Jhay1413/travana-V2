import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import axiosClient from "@/api/client/axios-client";
import { Card } from "@/components/ui/card";
import { Spinner } from "@/components/ui/spinner";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Trash2, FileText, Eye, ChevronDown, ChevronUp } from "lucide-react";

interface AuditEntry {
  id: string;
  action: string;
  entityType: string;
  entityId: string;
  entityTitle: string | null;
  entityData: any;
  reason: string | null;
  performedBy: string;
  performedByName: string | null;
  clientId: string | null;
  clientName: string | null;
  createdAt: string;
}

function useAuditLogs() {
  return useQuery<AuditEntry[]>({
    queryKey: ["audit-logs"],
    queryFn: () => axiosClient.get("/api/audit").then((r: any) => r.data || r),
  });
}

function formatDate(dateStr: string) {
  const d = new Date(dateStr);
  return d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

export function AdminAuditPanel() {
  const { data: logs, isLoading, isError, refetch } = useAuditLogs();
  const [selectedEntry, setSelectedEntry] = useState<AuditEntry | null>(null);
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());

  const toggleRow = (id: string) => {
    setExpandedRows((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Spinner className="h-6 w-6" />
      </div>
    );
  }

  if (isError) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center" data-testid="audit-error">
        <FileText className="h-10 w-10 text-red-300 mb-4" />
        <h3 className="text-sm font-semibold text-black/60 mb-1">Failed to load audit logs</h3>
        <p className="text-xs text-black/40 mb-4">There was a problem retrieving the records. Please try again.</p>
        <Button variant="outline" size="sm" className="rounded-xl" onClick={() => refetch()} data-testid="button-audit-retry">
          Retry
        </Button>
      </div>
    );
  }

  if (!logs || logs.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center" data-testid="audit-empty">
        <FileText className="h-10 w-10 text-black/20 mb-4" />
        <h3 className="text-sm font-semibold text-black/60 mb-1">No audit records</h3>
        <p className="text-xs text-black/40">Deleted quotes and bookings will appear here with full details.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4" data-testid="admin-audit-panel">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-sm font-semibold" data-testid="text-audit-title">Deletion Audit Log</h2>
          <p className="text-xs text-black/50 mt-0.5">{logs.length} record{logs.length !== 1 ? "s" : ""} found</p>
        </div>
      </div>

      <div className="space-y-2">
        {logs.map((entry) => (
          <Card
            key={entry.id}
            className="glass ringed grain rounded-2xl overflow-hidden"
            data-testid={`audit-entry-${entry.id}`}
          >
            <button
              type="button"
              className="w-full px-4 py-3 flex items-center gap-3 text-left hover:bg-black/[0.02] transition"
              onClick={() => toggleRow(entry.id)}
              data-testid={`audit-toggle-${entry.id}`}
            >
              <div className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-red-100 text-red-600">
                <Trash2 className="h-3.5 w-3.5" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-xs font-semibold text-black/80 truncate">
                    {entry.entityTitle || "Untitled"}
                  </span>
                  <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${
                    entry.entityType === "quote" ? "bg-amber-100 text-amber-700" : "bg-emerald-100 text-emerald-700"
                  }`}>
                    {entry.entityType}
                  </span>
                </div>
                <div className="flex items-center gap-2 mt-0.5 text-[11px] text-black/50">
                  <span>Deleted by {entry.performedByName || "Unknown"}</span>
                  <span>&middot;</span>
                  <span>{formatDate(entry.createdAt)}</span>
                  {entry.clientName && (
                    <>
                      <span>&middot;</span>
                      <span>Client: {entry.clientName}</span>
                    </>
                  )}
                </div>
              </div>
              <div className="shrink-0 text-black/30">
                {expandedRows.has(entry.id) ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              </div>
            </button>

            {expandedRows.has(entry.id) && (
              <div className="border-t border-black/5 px-4 py-3 bg-black/[0.01]" data-testid={`audit-detail-${entry.id}`}>
                <div className="grid gap-3 md:grid-cols-2">
                  <div className="space-y-2">
                    <div>
                      <span className="text-[10px] font-bold uppercase text-black/40 tracking-wider">Reason</span>
                      <p className="text-xs text-black/70 mt-0.5 bg-red-50 rounded-lg p-2 border border-red-100">
                        {entry.reason || "No reason provided"}
                      </p>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <span className="text-[10px] font-bold uppercase text-black/40 tracking-wider">Entity ID</span>
                        <p className="text-xs text-black/60 mt-0.5 font-mono truncate">{entry.entityId}</p>
                      </div>
                      <div>
                        <span className="text-[10px] font-bold uppercase text-black/40 tracking-wider">Client</span>
                        <p className="text-xs text-black/60 mt-0.5">{entry.clientName || "—"}</p>
                      </div>
                    </div>
                  </div>
                  <div>
                    <span className="text-[10px] font-bold uppercase text-black/40 tracking-wider">Deleted Data Snapshot</span>
                    <Button
                      variant="outline"
                      size="sm"
                      className="mt-1 h-7 rounded-lg text-[11px]"
                      onClick={() => setSelectedEntry(entry)}
                      data-testid={`audit-view-data-${entry.id}`}
                    >
                      <Eye className="h-3 w-3 mr-1" />
                      View Full Data
                    </Button>
                  </div>
                </div>
              </div>
            )}
          </Card>
        ))}
      </div>

      <Dialog open={!!selectedEntry} onOpenChange={() => setSelectedEntry(null)}>
        <DialogContent className="max-w-2xl rounded-2xl border-black/10 bg-white/95 backdrop-blur-xl max-h-[80vh] overflow-y-auto" data-testid="dialog-audit-data">
          <DialogHeader>
            <DialogTitle className="text-sm font-semibold">
              Deleted {selectedEntry?.entityType} — {selectedEntry?.entityTitle || "Untitled"}
            </DialogTitle>
            <DialogDescription className="text-xs text-black/55">
              Full snapshot of the data at the time of deletion.
            </DialogDescription>
          </DialogHeader>
          <div className="mt-3">
            <div className="rounded-xl border border-black/10 bg-black/[0.02] p-3 overflow-x-auto">
              <pre className="text-[11px] text-black/70 font-mono whitespace-pre-wrap break-all">
                {selectedEntry?.entityData ? JSON.stringify(selectedEntry.entityData, null, 2) : "No data available"}
              </pre>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

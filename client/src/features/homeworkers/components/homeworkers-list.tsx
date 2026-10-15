import { useState } from "react";
import { Pencil, Archive, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useHomeworkers } from "../api/use-homeworker-queries";
import { canArchive, statusChip } from "../lib/status";
import { formatProfitShare } from "../lib/profit-share";
import type { HomeworkerListItem, HomeworkerStatus } from "../types";
import { EditHomeworkerDialog } from "./edit-homeworker-dialog";
import { ArchiveConfirm } from "./archive-confirm";
import { AdminStatementDialog } from "./admin-statement-dialog";

export function StatusChipView({ status }: { status: HomeworkerStatus }) {
  const chip = statusChip(status);
  return (
    <span
      className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-medium ${chip.className}`}
      data-testid={`chip-homeworker-status-${status}`}
    >
      {chip.label}
    </span>
  );
}

export function HomeworkersList() {
  const [includeArchived, setIncludeArchived] = useState(false);
  const { data, isLoading, isError } = useHomeworkers(includeArchived);
  const [editing, setEditing] = useState<HomeworkerListItem | null>(null);
  const [archiving, setArchiving] = useState<HomeworkerListItem | null>(null);
  const [statementFor, setStatementFor] = useState<HomeworkerListItem | null>(null);

  const rows = data ?? [];

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <Switch
          id="homeworkers-include-archived"
          checked={includeArchived}
          onCheckedChange={setIncludeArchived}
          data-testid="switch-include-archived"
        />
        <Label htmlFor="homeworkers-include-archived" className="text-sm">Show archived</Label>
      </div>

      {isLoading ? (
        <div className="space-y-2">
          {[0, 1, 2].map((i) => <Skeleton key={i} className="h-10 w-full" />)}
        </div>
      ) : isError ? (
        <div className="py-8 text-center text-sm text-rose-500">Couldn't load homeworkers.</div>
      ) : rows.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-black/10 p-12 text-center text-sm text-muted-foreground dark:border-white/10">
          No homeworkers yet. Invite one to create their branch.
        </div>
      ) : (
        <Table data-testid="table-homeworkers">
          <TableHeader>
            <TableRow>
              <TableHead>Branch</TableHead>
              <TableHead>Owner</TableHead>
              <TableHead className="text-right">Share</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((r) => (
              <TableRow key={r.branchId} data-testid={`row-homeworker-${r.branchId}`}>
                <TableCell className="font-medium">{r.name}</TableCell>
                <TableCell>
                  <div className="text-sm">{r.owner.name}</div>
                  <div className="text-xs text-muted-foreground">{r.owner.email}</div>
                </TableCell>
                <TableCell className="text-right">{formatProfitShare(r.profitSharePercent)}</TableCell>
                <TableCell><StatusChipView status={r.status} /></TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end gap-1">
                    {r.status !== "pending" && (
                      <Button variant="ghost" size="sm" onClick={() => setStatementFor(r)} data-testid={`button-statement-homeworker-${r.branchId}`}>
                        <FileText className="mr-1 h-3.5 w-3.5" /> Statement
                      </Button>
                    )}
                    {r.status !== "archived" && (
                      <Button variant="ghost" size="sm" onClick={() => setEditing(r)} data-testid={`button-edit-homeworker-${r.branchId}`}>
                        <Pencil className="mr-1 h-3.5 w-3.5" /> Edit
                      </Button>
                    )}
                    {canArchive(r.status) && (
                      <Button variant="ghost" size="sm" onClick={() => setArchiving(r)} data-testid={`button-archive-homeworker-${r.branchId}`}>
                        <Archive className="mr-1 h-3.5 w-3.5" /> Archive
                      </Button>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      <EditHomeworkerDialog homeworker={editing} onClose={() => setEditing(null)} />
      <ArchiveConfirm homeworker={archiving} onClose={() => setArchiving(null)} />
      <AdminStatementDialog homeworker={statementFor} onClose={() => setStatementFor(null)} />
    </div>
  );
}

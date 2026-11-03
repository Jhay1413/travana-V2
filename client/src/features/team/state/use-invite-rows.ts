import { useCallback, useMemo, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import type { InviteOrgRole } from "@/features/invite/api/invite.api";
import { inviteApi } from "@/features/invite/api/invite.api";
import { inviteKeys } from "@/features/invite/api/use-invite-queries";
import { organizationKeys } from "@/features/organization/api/use-organization-queries";
import { invalidateHomeworkerData } from "@/features/homeworkers/api/invalidate";
import { teamErrorMessage } from "../lib/error-message";
import {
  MAX_ROWS,
  blankRow,
  isBlankRow,
  padRows,
  lockRowsToBranch,
  rowToInviteBody,
  unsentRows,
  validateRows,
  type InviteRow,
  type RowErrors,
  type ValidationContext,
} from "../lib/invite-rows";

export type RowResult = { status: "sent" } | { status: "failed"; message: string };

export interface SendSummary {
  sent: number;
  failed: number;
}

/** Editable invite rows with validation and sequential sending (one POST /invites per row). */
export function useInviteRows(ctx: ValidationContext, initial: InviteRow[]) {
  const qc = useQueryClient();
  const [rows, setRows] = useState<InviteRow[]>(() => padRows(initial));
  const [errors, setErrors] = useState<Record<string, RowErrors>>({});
  const [results, setResults] = useState<Record<string, RowResult>>({});
  const [banner, setBanner] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const ctxRef = useRef(ctx);
  ctxRef.current = ctx;

  const filled = useMemo(() => rows.filter((r) => !isBlankRow(r)), [rows]);

  const patchRow = useCallback((id: string, patch: Partial<InviteRow>) => {
    setRows((rs) => rs.map((r) => (r.id === id ? { ...r, ...patch } : r)));
    setErrors((e) => (e[id] ? { ...e, [id]: {} } : e));
    setResults((r) => {
      if (!r[id]) return r;
      const rest = { ...r };
      delete rest[id];
      return rest;
    });
    setBanner(null);
  }, []);

  const setRole = useCallback(
    (row: InviteRow, role: InviteOrgRole) => {
      const locked = ctxRef.current.lockedBranchId ?? "";
      const branchId = role === "homeworker" ? "" : locked || row.branchId;
      patchRow(row.id, { role, roleIssue: "", branchId, branchText: "" });
    },
    [patchRow],
  );

  const removeRow = useCallback((id: string) => setRows((rs) => padRows(rs.filter((r) => r.id !== id))), []);
  const addRow = useCallback(() => setRows((rs) => (rs.length >= MAX_ROWS ? rs : [...rs, blankRow()])), []);

  /** Add rows from a file. Returns false (and sets no rows) when the list would pass the limit. */
  const addUploaded = useCallback(
    (incoming: InviteRow[]): boolean => {
      if (filled.length + incoming.length > MAX_ROWS) return false;
      setRows((rs) => padRows([...rs.filter((r) => !isBlankRow(r)), ...lockRowsToBranch(incoming, ctxRef.current.lockedBranchId)]));
      setErrors({});
      setBanner(null);
      return true;
    },
    [filled.length],
  );

  const send = useCallback(async (): Promise<SendSummary | null> => {
    setBanner(null);
    if (filled.length === 0) {
      setBanner("Add at least one person to invite.");
      return null;
    }
    // Rows already sent are final: validating them again would flag their own (now taken) emails.
    const found = validateRows(unsentRows(rows, results), ctxRef.current);
    const bad = Object.keys(found).length;
    if (bad > 0) {
      setErrors(found);
      setBanner(`${bad} ${bad === 1 ? "row needs" : "rows need"} fixing before we can send.`);
      return null;
    }
    setErrors({});
    setSending(true);
    const next: Record<string, RowResult> = {};
    let sent = 0;
    for (const row of filled) {
      if (results[row.id]?.status === "sent") {
        next[row.id] = results[row.id];
        sent++;
        continue;
      }
      try {
        await inviteApi.send(rowToInviteBody(row));
        next[row.id] = { status: "sent" };
        sent++;
      } catch (err) {
        next[row.id] = { status: "failed", message: teamErrorMessage(err, "Couldn't send this invite") };
      }
      setResults({ ...results, ...next });
    }
    setResults({ ...results, ...next });
    setSending(false);
    qc.invalidateQueries({ queryKey: inviteKeys.pending() });
    qc.invalidateQueries({ queryKey: organizationKeys.members() });
    invalidateHomeworkerData(qc);
    return { sent, failed: filled.length - sent };
  }, [filled, rows, results, qc]);

  return { rows, errors, results, banner, sending, filled, patchRow, setRole, removeRow, addRow, addUploaded, send, setBanner };
}

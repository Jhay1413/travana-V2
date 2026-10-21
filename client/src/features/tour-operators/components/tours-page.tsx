import { useMemo, useRef, useState } from "react";
import { Loader2 } from "lucide-react";
import { useMediaQuery } from "@/hooks/use-media-query";
import { useRole } from "@/hooks/use-role";
import { useToast } from "@/hooks/use-toast";
import { downloadCsv } from "@/lib/csv";
import { requestErrorMessage } from "@/lib/request-error";
import { tourOperatorsApi } from "../api/tour-operators.api";
import { useOperatorsManage } from "../api/use-tour-operators-manage";
import { EXPORT_FILE_NAME, TEMPLATE_FILE_NAME, templateCsv } from "../lib/csv-template";
import { breadcrumbFor, operatorAccess } from "../lib/access";
import { DEFAULT_SORT, filterOperators, nextSort, sortOperators } from "../lib/sort-filter";
import { summarise } from "../lib/summary";
import { useCopyToast } from "../state/use-copy-toast";
import { useOperatorActions } from "../state/use-operator-actions";
import { useOperatorImport } from "../state/use-operator-import";
import type { OperatorFormValues, OrgOperatorRow, SortKey, SortState } from "../types";
import { CARD } from "./classes";
import { ImportPreviewDialog } from "./import-preview-dialog";
import { OperatorCards } from "./operator-cards";
import { OperatorForm } from "./operator-form";
import { OperatorsEmpty } from "./operators-empty";
import { OperatorsTable } from "./operators-table";
import { OperatorsToolbar } from "./operators-toolbar";
import { PageHead } from "./page-head";
import type { RowContext } from "./row-context";
import { SummaryStrip } from "./summary-strip";

function isForbidden(err: unknown): boolean {
  const e = err as { status?: number; response?: { status?: number } } | null;
  return e?.status === 403 || e?.response?.status === 403;
}

function focusLater(selector: string): void {
  setTimeout(() => document.querySelector<HTMLElement>(selector)?.focus(), 30);
}

/** /agency/tour-operators: the org's tour operators with logins and commission rates. */
export function TourOperatorsPage() {
  const { orgRole } = useRole();
  const { toast } = useToast();
  const { data, isLoading, isError, error } = useOperatorsManage();
  const actions = useOperatorActions();
  const importer = useOperatorImport();
  const { copy, copyLater } = useCopyToast();
  const narrow = useMediaQuery("(max-width: 900px)");

  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<SortState>(DEFAULT_SORT);
  const [adding, setAdding] = useState(false);
  const [editLinkId, setEditLinkId] = useState<string | null>(null);
  const [confirmLinkId, setConfirmLinkId] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);
  const lastEdited = useRef<string | null>(null);

  const fallback = operatorAccess(orgRole);
  const canWrite = isError ? false : (data?.canWrite ?? fallback.canWrite);
  const canSeePasswords = data?.canSeePasswords ?? fallback.canSeePasswords;
  const all = data?.rows ?? [];
  const shown = useMemo(() => sortOperators(filterOperators(all, query), sort), [all, query, sort]);
  const summary = useMemo(() => summarise(all), [all]);
  const existing = useMemo(() => all.map((r) => ({ linkId: r.linkId, name: r.name })), [all]);

  async function onExport() {
    setExporting(true);
    try {
      downloadCsv(EXPORT_FILE_NAME, await tourOperatorsApi.exportCsv());
    } catch (err) {
      toast({ title: "Couldn't export the list", description: requestErrorMessage(err, "Please try again."), variant: "destructive" });
    } finally {
      setExporting(false);
    }
  }

  const ctx: RowContext = {
    canWrite,
    canSeePasswords,
    busy: actions.busy,
    existing,
    editLinkId,
    confirmLinkId,
    copy,
    copyLater,
    onEdit: (id) => {
      if (id) lastEdited.current = id;
      else if (lastEdited.current) focusLater(`[data-testid="edit-${lastEdited.current}"]`);
      setEditLinkId(id);
      setConfirmLinkId(null);
      if (id) setAdding(false);
    },
    onAskDelete: setConfirmLinkId,
    onSave: (row: OrgOperatorRow, values: OperatorFormValues) => {
      void actions.save(row, values).then((ok) => {
        if (!ok) return;
        setEditLinkId(null);
        focusLater(`[data-testid="edit-${row.linkId}"]`);
      });
    },
    onDelete: (row: OrgOperatorRow) => {
      void actions.del(row).then(() => setConfirmLinkId(null));
    },
  };

  const searching = query.trim().length > 0;
  const status = searching ? `${shown.length} of ${all.length} match "${query.trim()}"` : `${all.length} tour operators.${canWrite ? " Select the pencil on a row to change it." : ""}`;

  return (
    <div className="text-compact -m-4 flex min-h-full min-w-0 flex-col gap-5 bg-social-page p-4 md:-m-6 md:p-6" data-testid="tour-operators-page">
      <PageHead
        root={breadcrumbFor(orgRole)}
        canWrite={canWrite}
        exporting={exporting}
        uploading={importer.reading}
        onExport={() => void onExport()}
        onAdd={() => {
          setAdding(true);
          setEditLinkId(null);
          focusLater("#to-new-name");
        }}
        onFile={(file) => void importer.pickFile(file)}
      />
      {isLoading && !data ? (
        <div className="flex min-h-[40vh] items-center justify-center gap-2 text-sm text-muted-foreground" data-testid="operators-loading">
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
          Loading tour operators…
        </div>
      ) : isError ? (
        <section className={CARD}>
          <OperatorsEmpty kind="blocked" forbidden={isForbidden(error)} message={requestErrorMessage(error, "Couldn't load tour operators")} />
        </section>
      ) : (
        <>
          <SummaryStrip summary={summary} />
          <section className={CARD} aria-labelledby="to-h">
            <div>
              <h2 className="text-[15px] font-semibold xl:text-base" id="to-h">
                All tour operators
              </h2>
              <p className="mt-0.5 text-[12px] text-social-muted xl:text-[13px]" role="status" data-testid="operators-status">
                {status}
              </p>
            </div>
            <OperatorsToolbar query={query} onQuery={setQuery} onTemplate={() => downloadCsv(TEMPLATE_FILE_NAME, templateCsv())} />
            {canWrite && adding && (
              <OperatorForm
                mode="add"
                idPrefix="to-new"
                existing={existing}
                busy={actions.busy}
                stacked={narrow}
                onSubmit={(values, catalogueId) => void actions.add(values, catalogueId).then((ok) => ok && setAdding(false))}
                onCancel={() => setAdding(false)}
              />
            )}
            {shown.length === 0 ? (
              <OperatorsEmpty kind={searching ? "search" : "none"} />
            ) : narrow ? (
              <OperatorCards rows={shown} ctx={ctx} />
            ) : (
              <OperatorsTable rows={shown} sort={sort} onSort={(k: SortKey) => setSort((cur) => nextSort(cur, k))} ctx={ctx} />
            )}
          </section>
        </>
      )}
      <ImportPreviewDialog pending={importer.pending} importing={importer.importing} onConfirm={() => void importer.confirm()} onCancel={importer.cancel} />
    </div>
  );
}

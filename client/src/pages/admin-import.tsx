import { useState, useRef, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { CommandCenterShell, type Role } from "@/components/command-center-shell";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { motion, AnimatePresence } from "framer-motion";
import {
  Upload,
  FileSpreadsheet,
  CheckCircle2,
  AlertCircle,
  Trash2,
  ChevronDown,
  ChevronUp,
  Database,
  Download,
  Loader2,
  X,
} from "lucide-react";
import axios from "@/api/client/axios-client";

interface TableInfo {
  key: string;
  label: string;
  columns: string[];
  dependsOn: string[];
}

function useAdminTables() {
  return useQuery({
    queryKey: ["admin", "tables"],
    queryFn: async () => {
      const res = await axios.get("/api/admin/tables");
      return res.data as { tables: TableInfo[]; counts: Record<string, number> };
    },
  });
}

function parseCSV(text: string): Record<string, string>[] {
  const lines = text.split(/\r?\n/).filter((l) => l.trim());
  if (lines.length < 2) return [];
  const headers = lines[0].split(",").map((h) => h.trim().replace(/^"|"$/g, ""));
  return lines.slice(1).map((line) => {
    const values: string[] = [];
    let current = "";
    let inQuotes = false;
    for (const ch of line) {
      if (ch === '"') {
        inQuotes = !inQuotes;
      } else if (ch === "," && !inQuotes) {
        values.push(current.trim());
        current = "";
      } else {
        current += ch;
      }
    }
    values.push(current.trim());
    const obj: Record<string, string> = {};
    headers.forEach((h, i) => {
      const val = values[i] ?? "";
      if (val !== "") obj[h] = val;
    });
    return obj;
  });
}

function coerceRow(row: Record<string, string>, columns: string[]): Record<string, any> {
  const out: Record<string, any> = {};
  const intFields = ["month", "year", "bedrooms", "bathrooms", "sleeps", "pets", "adults", "children", "infants"];
  const boolFields = ["is_used", "isPrimary"];
  const arrayFields = ["deal_ids", "historical_ids"];
  for (const [k, v] of Object.entries(row)) {
    if (!columns.includes(k)) continue;
    if (intFields.includes(k)) {
      out[k] = parseInt(v, 10) || 0;
    } else if (boolFields.includes(k)) {
      out[k] = v === "true" || v === "1" || v === "yes";
    } else if (arrayFields.includes(k)) {
      try {
        out[k] = JSON.parse(v);
      } catch {
        out[k] = v.split(";").filter(Boolean);
      }
    } else {
      out[k] = v;
    }
  }
  return out;
}

function generateSampleCSV(columns: string[]): string {
  return columns.join(",") + "\n";
}

function ImportCard({ table, count, onRefresh }: { table: TableInfo; count: number; onRefresh: () => void }) {
  const [expanded, setExpanded] = useState(false);
  const [preview, setPreview] = useState<Record<string, any>[] | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const importMutation = useMutation({
    mutationFn: async (rows: Record<string, any>[]) => {
      const res = await axios.post(`/api/admin/import/${table.key}`, { rows });
      return res.data as { imported: number; errors: Array<{ row: number; error: string }>; total: number };
    },
    onSuccess: (data) => {
      toast({
        title: `Import complete`,
        description: `${data.imported}/${data.total} rows imported${data.errors.length > 0 ? `, ${data.errors.length} errors` : ""}`,
      });
      setPreview(null);
      setFileName(null);
      queryClient.invalidateQueries({ queryKey: ["admin", "tables"] });
      onRefresh();
    },
    onError: (err: any) => {
      toast({ title: "Import failed", description: err.message, variant: "destructive" });
    },
  });

  const clearMutation = useMutation({
    mutationFn: async () => {
      await axios.delete(`/api/admin/clear/${table.key}`);
    },
    onSuccess: () => {
      toast({ title: `${table.label} cleared` });
      queryClient.invalidateQueries({ queryKey: ["admin", "tables"] });
      onRefresh();
    },
  });

  const handleFile = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      setFileName(file.name);
      const reader = new FileReader();
      reader.onload = (ev) => {
        const text = ev.target?.result as string;
        let rows: Record<string, any>[];
        if (file.name.endsWith(".json")) {
          try {
            const parsed = JSON.parse(text);
            rows = Array.isArray(parsed) ? parsed : [parsed];
          } catch {
            toast({ title: "Invalid JSON file", variant: "destructive" });
            return;
          }
        } else {
          const csvRows = parseCSV(text);
          rows = csvRows.map((r) => coerceRow(r, table.columns));
        }
        setPreview(rows);
      };
      reader.readAsText(file);
      e.target.value = "";
    },
    [table.columns, toast]
  );

  const downloadSample = () => {
    const csv = generateSampleCSV(table.columns);
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${table.key}_sample.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <Card className="overflow-hidden border-black/10 bg-white/80 backdrop-blur dark:border-white/10 dark:bg-white/5" data-testid={`card-import-${table.key}`}>
      <div
        className="flex cursor-pointer items-center justify-between p-4 transition hover:bg-black/[0.02] dark:hover:bg-white/[0.02]"
        onClick={() => setExpanded(!expanded)}
        data-testid={`btn-toggle-${table.key}`}
      >
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-black/10 bg-black/5 dark:border-white/10 dark:bg-white/5">
            <Database className="h-4 w-4 text-black/60 dark:text-white/60" />
          </div>
          <div>
            <div className="text-sm font-semibold">{table.label}</div>
            <div className="text-xs text-black/50 dark:text-white/50">
              {count} rows
              {table.dependsOn.length > 0 && (
                <span className="ml-2 text-amber-600 dark:text-amber-400">
                  Depends on: {table.dependsOn.join(", ")}
                </span>
              )}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="rounded-full border border-black/10 bg-black/5 px-2.5 py-0.5 text-xs font-medium dark:border-white/10 dark:bg-white/5">
            {table.columns.length} columns
          </span>
          {expanded ? <ChevronUp className="h-4 w-4 text-black/40" /> : <ChevronDown className="h-4 w-4 text-black/40" />}
        </div>
      </div>

      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="border-t border-black/10 p-4 dark:border-white/10">
              <div className="mb-3">
                <div className="text-xs font-semibold text-black/50 dark:text-white/50 mb-1.5">Columns</div>
                <div className="flex flex-wrap gap-1.5">
                  {table.columns.map((col) => (
                    <span key={col} className="rounded-lg bg-black/5 px-2 py-0.5 text-xs font-mono dark:bg-white/5">
                      {col}
                    </span>
                  ))}
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <input
                  ref={fileRef}
                  type="file"
                  accept=".csv,.json"
                  className="hidden"
                  onChange={handleFile}
                  data-testid={`input-file-${table.key}`}
                />
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => fileRef.current?.click()}
                  className="gap-1.5 rounded-xl text-xs"
                  data-testid={`btn-upload-${table.key}`}
                >
                  <Upload className="h-3.5 w-3.5" />
                  Upload CSV / JSON
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={downloadSample}
                  className="gap-1.5 rounded-xl text-xs"
                  data-testid={`btn-sample-${table.key}`}
                >
                  <Download className="h-3.5 w-3.5" />
                  Sample CSV
                </Button>
                {count > 0 && (
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => {
                      if (window.confirm(`Clear all ${count} rows from ${table.label}?`)) {
                        clearMutation.mutate();
                      }
                    }}
                    className="gap-1.5 rounded-xl text-xs text-red-600 hover:bg-red-50 hover:text-red-700"
                    disabled={clearMutation.isPending}
                    data-testid={`btn-clear-${table.key}`}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    Clear Table
                  </Button>
                )}
              </div>

              {preview && (
                <div className="mt-4 rounded-xl border border-black/10 bg-black/[0.02] p-3 dark:border-white/10 dark:bg-white/[0.02]">
                  <div className="mb-2 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <FileSpreadsheet className="h-4 w-4 text-green-600" />
                      <span className="text-xs font-semibold">{fileName}</span>
                      <span className="text-xs text-black/50 dark:text-white/50">{preview.length} rows</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setPreview(null);
                        setFileName(null);
                      }}
                      className="rounded-lg p-1 hover:bg-black/5"
                      data-testid={`btn-cancel-preview-${table.key}`}
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>

                  {preview.length > 0 && (
                    <div className="mb-3 max-h-40 overflow-auto rounded-lg border border-black/5 bg-white dark:border-white/5 dark:bg-black/20">
                      <table className="w-full text-xs">
                        <thead>
                          <tr className="border-b border-black/5 dark:border-white/5">
                            {Object.keys(preview[0]).map((k) => (
                              <th key={k} className="px-2 py-1.5 text-left font-mono font-medium text-black/50 dark:text-white/50">
                                {k}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {preview.slice(0, 5).map((row, i) => (
                            <tr key={i} className="border-b border-black/5 last:border-0 dark:border-white/5">
                              {Object.values(row).map((v, j) => (
                                <td key={j} className="max-w-[150px] truncate px-2 py-1 text-black/70 dark:text-white/70">
                                  {String(v ?? "")}
                                </td>
                              ))}
                            </tr>
                          ))}
                          {preview.length > 5 && (
                            <tr>
                              <td colSpan={Object.keys(preview[0]).length} className="px-2 py-1 text-center text-black/40 dark:text-white/40">
                                ... and {preview.length - 5} more rows
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  )}

                  <Button
                    size="sm"
                    onClick={() => importMutation.mutate(preview)}
                    disabled={importMutation.isPending}
                    className="gap-1.5 rounded-xl text-xs"
                    data-testid={`btn-confirm-import-${table.key}`}
                  >
                    {importMutation.isPending ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <CheckCircle2 className="h-3.5 w-3.5" />
                    )}
                    Import {preview.length} Rows
                  </Button>

                  {importMutation.isError && (
                    <div className="mt-2 flex items-center gap-1.5 text-xs text-red-600">
                      <AlertCircle className="h-3.5 w-3.5" />
                      {(importMutation.error as any)?.message || "Import failed"}
                    </div>
                  )}
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </Card>
  );
}

export default function AdminImportPage() {
  const [role, setRole] = useState<Role>("Admin");
  const [query, setQuery] = useState("");
  const { data, refetch } = useAdminTables();

  const independentTables = data?.tables.filter((t) => t.dependsOn.length === 0) || [];
  const dependentTables = data?.tables.filter((t) => t.dependsOn.length > 0) || [];

  return (
    <CommandCenterShell
      active="data-import"
      title="Data Import"
      subtitle="Import lookup and reference data"
      role={role}
      onRoleChange={setRole}
      query={query}
      onQuery={setQuery}
    >
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-2xl border border-black/10 bg-black/5 dark:border-white/10 dark:bg-white/5">
            <Upload className="h-5 w-5 text-black/60 dark:text-white/60" />
          </div>
          <div>
            <h2 className="text-lg font-semibold" data-testid="text-import-title">Data Import</h2>
            <p className="text-sm text-black/50 dark:text-white/50" data-testid="text-import-subtitle">
              Import CSV or JSON files into lookup tables. Import independent tables first, then dependent tables.
            </p>
          </div>
        </div>

        {independentTables.length > 0 && (
          <div>
            <h3 className="mb-3 text-sm font-semibold text-black/60 dark:text-white/60" data-testid="text-section-independent">
              Independent Tables
            </h3>
            <div className="space-y-2">
              {independentTables.map((t) => (
                <ImportCard key={t.key} table={t} count={data?.counts[t.key] || 0} onRefresh={() => refetch()} />
              ))}
            </div>
          </div>
        )}

        {dependentTables.length > 0 && (
          <div>
            <h3 className="mb-3 text-sm font-semibold text-black/60 dark:text-white/60" data-testid="text-section-dependent">
              Dependent Tables (import after their dependencies)
            </h3>
            <div className="space-y-2">
              {dependentTables.map((t) => (
                <ImportCard key={t.key} table={t} count={data?.counts[t.key] || 0} onRefresh={() => refetch()} />
              ))}
            </div>
          </div>
        )}

        {!data && (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-black/30" />
          </div>
        )}
      </div>
    </CommandCenterShell>
  );
}

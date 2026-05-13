import { useState, useRef, useCallback, useMemo, useEffect } from "react";
import { useParams } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type { Role } from "@/types/auth/auth.types";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import {
  Upload,
  FileSpreadsheet,
  CheckCircle2,
  AlertCircle,
  Trash2,
  Plus,
  Search,
  Download,
  Loader2,
  X,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
} from "lucide-react";
import axios from "@/api/client/axios-client";

const TABLE_DEFS: Record<string, { apiKey: string; label: string; navKey: string; columns: string[]; displayColumns: string[] }> = {
  countries: {
    apiKey: "country",
    label: "Countries",
    navKey: "countries",
    columns: ["country_name", "country_code"],
    displayColumns: ["country_name", "country_code"],
  },
  destinations: {
    apiKey: "destination",
    label: "Destinations",
    navKey: "destinations",
    columns: ["name", "type", "country_id"],
    displayColumns: ["name", "type", "country_id"],
  },
  resorts: {
    apiKey: "resorts",
    label: "Resorts",
    navKey: "resorts-admin",
    columns: ["name", "destination_id"],
    displayColumns: ["name", "destination_id"],
  },
  "accommodation-types": {
    apiKey: "accomodation_type",
    label: "Accommodation Types",
    navKey: "accommodation-types",
    columns: ["type"],
    displayColumns: ["type"],
  },
  "accommodation-list": {
    apiKey: "accomodation_list",
    label: "Accommodation List",
    navKey: "accommodation-list",
    columns: ["type_id", "name", "resorts_id", "description"],
    displayColumns: ["type_id", "name", "resorts_id", "description"],
  },
  "board-basis": {
    apiKey: "board_basis",
    label: "Board Basis",
    navKey: "board-basis",
    columns: ["type"],
    displayColumns: ["type"],
  },
  "package-types": {
    apiKey: "package_type",
    label: "Package Types",
    navKey: "package-types",
    columns: ["name"],
    displayColumns: ["name"],
  },
  parks: {
    apiKey: "park",
    label: "Parks",
    navKey: "parks",
    columns: ["name", "location", "city", "county", "code", "description"],
    displayColumns: ["name", "location", "city", "county", "code"],
  },
  cottages: {
    apiKey: "cottages",
    label: "Cottages",
    navKey: "cottages-admin",
    columns: ["cottage_name", "location", "cottage_code", "bedrooms", "bathrooms", "sleeps", "pets"],
    displayColumns: ["cottage_name", "location", "cottage_code", "bedrooms", "sleeps"],
  },
  lodges: {
    apiKey: "lodges",
    label: "Lodges",
    navKey: "lodges-admin",
    columns: ["park_id", "lodge_code", "lodge_name", "image", "adults", "children", "bedrooms", "bathrooms", "pets", "sleeps", "infants"],
    displayColumns: ["park_id", "lodge_name", "lodge_code", "bedrooms", "sleeps"],
  },
  "cruise-extras": {
    apiKey: "cruise_extra_item",
    label: "Cruise Extras",
    navKey: "cruise-extras",
    columns: ["name"],
    displayColumns: ["name"],
  },
  "room-types": {
    apiKey: "room_type",
    label: "Room Types",
    navKey: "room-types",
    columns: ["name"],
    displayColumns: ["name"],
  },
  "deletion-codes": {
    apiKey: "deletion_codes",
    label: "Deletion Codes",
    navKey: "deletion-codes",
    columns: ["code", "description", "is_used"],
    displayColumns: ["code", "description", "is_used"],
  },
  tags: {
    apiKey: "tags",
    label: "Tags",
    navKey: "tags",
    columns: ["name"],
    displayColumns: ["name", "usageCount", "createdAt"],
  },
};

function parseCSV(text: string): Record<string, string>[] {
  const lines = text.split(/\r?\n/).filter((l) => l.trim());
  if (lines.length < 2) return [];
  const headers = lines[0].split(",").map((h) => h.trim().replace(/^"|"$/g, ""));
  return lines.slice(1).map((line) => {
    const values: string[] = [];
    let current = "";
    let inQuotes = false;
    for (const ch of line) {
      if (ch === '"') inQuotes = !inQuotes;
      else if (ch === "," && !inQuotes) { values.push(current.trim()); current = ""; }
      else current += ch;
    }
    values.push(current.trim());
    const obj: Record<string, string> = {};
    headers.forEach((h, i) => {
      if ((values[i] ?? "") !== "") obj[h] = values[i];
    });
    return obj;
  });
}

function coerceValues(row: Record<string, string>): Record<string, any> {
  const uuidFields = ["country_id", "destination_id", "resorts_id", "type_id", "park_id", "package_type_id", "tour_operator_id", "owner_id"];
  const intFields = ["month", "year", "bedrooms", "bathrooms", "sleeps", "pets", "adults", "children", "infants"];
  const boolFields = ["is_used", "isPrimary"];
  const numFields = ["commission_percentage", "target", "company_commission", "agent_commission", "adjustment"];
  const out: Record<string, any> = {};
  for (const [k, v] of Object.entries(row)) {
    if (v === "" || v === undefined || v === null) {
      out[k] = null;
    } else if (uuidFields.includes(k)) {
      out[k] = v;
    } else if (intFields.includes(k)) {
      const parsed = parseInt(v, 10);
      out[k] = isNaN(parsed) ? null : parsed;
    } else if (boolFields.includes(k)) {
      out[k] = v === "true" || v === "1" || v === "yes";
    } else if (numFields.includes(k)) {
      const parsed = parseFloat(v);
      out[k] = isNaN(parsed) ? null : parsed;
    } else {
      out[k] = v;
    }
  }
  return out;
}

const PAGE_SIZE = 50;

export default function AdminLookupPage() {
  const params = useParams<{ tableSlug: string }>();
  const tableSlug = params.tableSlug || "";
  const def = TABLE_DEFS[tableSlug];
  const [role, setRole] = useState<Role>("Admin");
  const [query, setQuery] = useState("");
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [page, setPage] = useState(1);
  const [preview, setPreview] = useState<Record<string, any>[] | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search);
      setPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [search]);

  const prevSlug = useRef(tableSlug);
  useEffect(() => {
    if (prevSlug.current !== tableSlug) {
      setSearch("");
      setDebouncedSearch("");
      setPage(1);
      setPreview(null);
      setFileName(null);
      prevSlug.current = tableSlug;
    }
  }, [tableSlug]);

  const { data, isLoading, refetch } = useQuery({
    queryKey: ["admin", "data", def?.apiKey, page, debouncedSearch],
    queryFn: async () => {
      const params = new URLSearchParams({ page: String(page), limit: String(PAGE_SIZE) });
      if (debouncedSearch) params.set("search", debouncedSearch);
      const res = await axios.get(`/api/admin/data/${def!.apiKey}?${params}`);
      return res.data as { rows: Record<string, any>[]; total: number; page: number; limit: number; totalPages: number };
    },
    enabled: !!def,
    placeholderData: (prev) => prev,
  });

  const hasCountryRef = def?.displayColumns.includes("country_id");
  const hasDestRef = def?.displayColumns.includes("destination_id");
  const hasResortRef = def?.displayColumns.includes("resorts_id");
  const hasTypeRef = def?.displayColumns.includes("type_id");
  const hasParkRef = def?.displayColumns.includes("park_id");

  const { data: countriesLookup } = useQuery({
    queryKey: ["admin", "lookup", "country"],
    queryFn: async () => {
      const res = await axios.get("/api/admin/data/country?limit=200");
      return res.data as { rows: Array<{ id: string; country_name: string }> };
    },
    enabled: !!hasCountryRef,
  });
  const { data: destLookup } = useQuery({
    queryKey: ["admin", "lookup", "destination"],
    queryFn: async () => {
      const res = await axios.get("/api/admin/data/destination?limit=200");
      return res.data as { rows: Array<{ id: string; name: string }> };
    },
    enabled: !!hasDestRef,
  });
  const { data: resortLookup } = useQuery({
    queryKey: ["admin", "lookup", "resorts"],
    queryFn: async () => {
      const res = await axios.get("/api/admin/data/resorts?limit=200");
      return res.data as { rows: Array<{ id: string; name: string }> };
    },
    enabled: !!hasResortRef,
  });
  const { data: accomTypeLookup } = useQuery({
    queryKey: ["admin", "lookup", "accomodation_type"],
    queryFn: async () => {
      const res = await axios.get("/api/admin/data/accomodation_type?limit=200");
      return res.data as { rows: Array<{ id: string; type: string }> };
    },
    enabled: !!hasTypeRef,
  });
  const { data: parkLookup } = useQuery({
    queryKey: ["admin", "lookup", "park"],
    queryFn: async () => {
      const res = await axios.get("/api/admin/data/park?limit=200");
      return res.data as { rows: Array<{ id: string; name: string }> };
    },
    enabled: !!hasParkRef,
  });

  const lookupMaps = useMemo(() => {
    const country: Record<string, string> = {};
    const dest: Record<string, string> = {};
    const resort: Record<string, string> = {};
    const accomType: Record<string, string> = {};
    const parkMap: Record<string, string> = {};
    countriesLookup?.rows?.forEach((r) => { country[r.id] = r.country_name; });
    destLookup?.rows?.forEach((r) => { dest[r.id] = r.name; });
    resortLookup?.rows?.forEach((r) => { resort[r.id] = r.name; });
    accomTypeLookup?.rows?.forEach((r) => { accomType[r.id] = r.type; });
    parkLookup?.rows?.forEach((r) => { parkMap[r.id] = r.name; });
    return { country_id: country, destination_id: dest, resorts_id: resort, type_id: accomType, park_id: parkMap };
  }, [countriesLookup, destLookup, resortLookup, accomTypeLookup, parkLookup]);

  const resolveValue = useCallback((col: string, value: any): string => {
    if (value == null || value === "") return "—";
    const map = lookupMaps[col as keyof typeof lookupMaps];
    if (map && map[String(value)]) return map[String(value)];
    if (typeof value === "boolean") return value ? "Yes" : "No";
    return String(value);
  }, [lookupMaps]);

  const createMutation = useMutation({
    mutationFn: async (row: Record<string, any>) => {
      await axios.post(`/api/admin/data/${def!.apiKey}`, row);
    },
    onSuccess: () => {
      toast({ title: "Row added" });
      queryClient.invalidateQueries({ queryKey: ["admin", "data", def!.apiKey] });
    },
    onError: (err: any) => toast({ title: "Failed to add", description: err.message, variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await axios.delete(`/api/admin/data/${def!.apiKey}/${id}`);
    },
    onSuccess: () => {
      toast({ title: "Row deleted" });
      queryClient.invalidateQueries({ queryKey: ["admin", "data", def!.apiKey] });
    },
    onError: (err: any) => toast({ title: "Failed to delete", description: err.message, variant: "destructive" }),
  });

  const importMutation = useMutation({
    mutationFn: async (rows: Record<string, any>[]) => {
      const res = await axios.post(`/api/admin/import/${def!.apiKey}`, { rows });
      return res.data as { imported: number; errors: Array<{ row: number; error: string }>; total: number };
    },
    onSuccess: (data) => {
      toast({ title: "Import complete", description: `${data.imported}/${data.total} rows imported` });
      setPreview(null);
      setFileName(null);
      queryClient.invalidateQueries({ queryKey: ["admin", "data", def!.apiKey] });
    },
    onError: (err: any) => toast({ title: "Import failed", description: err.message, variant: "destructive" }),
  });

  const clearMutation = useMutation({
    mutationFn: async () => {
      await axios.delete(`/api/admin/clear/${def!.apiKey}`);
    },
    onSuccess: () => {
      toast({ title: `${def!.label} cleared` });
      queryClient.invalidateQueries({ queryKey: ["admin", "data", def!.apiKey] });
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
          rows = parseCSV(text).map(coerceValues);
        }
        setPreview(rows);
      };
      reader.readAsText(file);
      e.target.value = "";
    },
    [toast]
  );

  const handleAddRow = () => {
    const row: Record<string, any> = {};
    for (const col of def!.columns) {
      const val = prompt(`Enter ${col}:`);
      if (val === null) return;
      if (val) row[col] = val;
    }
    if (Object.keys(row).length > 0) {
      createMutation.mutate(coerceValues(row));
    }
  };

  const downloadSample = () => {
    const csv = def!.columns.join(",") + "\n";
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${def!.apiKey}_sample.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (!def) {
    return (
      <Card className="glass ringed grain rounded-3xl p-8 text-center">
        <p className="text-black/50 dark:text-white/50">Table not found.</p>
      </Card>
    );
  }

  const rows = data?.rows || [];
  const total = data?.total ?? 0;
  const totalPages = data?.totalPages ?? 1;
  const currentPage = data?.page ?? 1;

  return (
    <>
      <section>
        <Card className="glass ringed grain rounded-3xl p-4 md:p-5">
          <div className="flex items-center justify-between gap-4 mb-4">
            <div className="space-y-1">
              <div className="text-sm font-semibold" data-testid={`text-${tableSlug}-title`}>{def.label}</div>
              <div className="text-xs text-muted-foreground" data-testid={`text-${tableSlug}-count`}>
                {debouncedSearch
                  ? `${total} result${total !== 1 ? "s" : ""} found`
                  : `${total} record${total !== 1 ? "s" : ""}`}
                {totalPages > 1 && ` · Page ${currentPage} of ${totalPages}`}
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <div className="relative z-10">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-black/40 dark:text-white/40 z-0" />
                <input
                  type="text"
                  placeholder={`Search ${def.label.toLowerCase()}...`}
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-48 h-9 pl-9 pr-3 rounded-2xl border border-black/10 bg-black/5 dark:border-white/10 dark:bg-white/5 relative z-20 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                  data-testid={`input-search-${tableSlug}`}
                />
              </div>
              <input
                ref={fileRef}
                type="file"
                accept=".csv,.json"
                className="hidden"
                onChange={handleFile}
                data-testid={`input-file-${tableSlug}`}
              />
              <label className="cursor-pointer" onClick={() => fileRef.current?.click()}>
                <span className="inline-flex items-center rounded-2xl border border-black/10 bg-black/5 px-4 py-2 text-sm font-medium text-black hover:bg-black/10 dark:border-white/10 dark:bg-white/5 dark:text-white dark:hover:bg-white/10">
                  <Upload className="mr-2 h-4 w-4" />
                  Upload CSV
                </span>
              </label>
              <Button
                variant="ghost"
                size="sm"
                onClick={downloadSample}
                className="gap-1.5 rounded-2xl text-xs"
                data-testid={`btn-sample-${tableSlug}`}
              >
                <Download className="h-4 w-4" />
                Sample
              </Button>
              <Button
                onClick={handleAddRow}
                className="rounded-2xl bg-[#3b82f6] text-white hover:bg-[#3b82f6]/90"
                data-testid={`btn-add-${tableSlug}`}
              >
                <Plus className="mr-2 h-4 w-4" />
                Add
              </Button>
              {total > 0 && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    if (window.confirm(`Clear all ${total} rows from ${def.label}?`)) {
                      clearMutation.mutate();
                    }
                  }}
                  className="gap-1.5 rounded-2xl text-xs text-red-600 hover:bg-red-50 hover:text-red-700"
                  disabled={clearMutation.isPending}
                  data-testid={`btn-clear-${tableSlug}`}
                >
                  <Trash2 className="h-4 w-4" />
                  Clear All
                </Button>
              )}
            </div>
          </div>

          {preview && (
            <div className="mb-4 rounded-xl border border-green-200/60 bg-green-50/50 p-3 dark:border-green-500/20 dark:bg-green-950/30">
              <div className="mb-2 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <FileSpreadsheet className="h-4 w-4 text-green-600" />
                  <span className="text-xs font-semibold">{fileName}</span>
                  <span className="text-xs text-black/50 dark:text-white/50">{preview.length} rows ready to import</span>
                </div>
                <button type="button" onClick={() => { setPreview(null); setFileName(null); }} className="rounded-lg p-1 hover:bg-black/5" data-testid={`btn-cancel-preview-${tableSlug}`}>
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
              {preview.length > 0 && (
                <div className="mb-3 max-h-32 overflow-auto rounded-lg border border-black/5 bg-white dark:border-white/5 dark:bg-black/20">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b border-black/5 dark:border-white/5">
                        {Object.keys(preview[0]).map((k) => (
                          <th key={k} className="px-2 py-1.5 text-left font-mono font-medium text-black/50 dark:text-white/50">{k}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {preview.slice(0, 3).map((row, i) => (
                        <tr key={i} className="border-b border-black/5 last:border-0 dark:border-white/5">
                          {Object.values(row).map((v, j) => (
                            <td key={j} className="max-w-[120px] truncate px-2 py-1">{String(v ?? "")}</td>
                          ))}
                        </tr>
                      ))}
                      {preview.length > 3 && (
                        <tr><td colSpan={99} className="px-2 py-1 text-center text-black/40">... and {preview.length - 3} more</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              )}
              <div className="flex gap-2">
                <Button size="sm" onClick={() => importMutation.mutate(preview)} disabled={importMutation.isPending} className="gap-1.5 rounded-xl text-xs" data-testid={`btn-confirm-import-${tableSlug}`}>
                  {importMutation.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
                  Import {preview.length} Rows
                </Button>
                {importMutation.isError && (
                  <span className="flex items-center gap-1 text-xs text-red-600"><AlertCircle className="h-3.5 w-3.5" />{(importMutation.error as any)?.message}</span>
                )}
              </div>
            </div>
          )}

          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-black/30" />
            </div>
          ) : (
            <div className="overflow-x-auto max-h-[500px] overflow-y-auto">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-white/80 dark:bg-black/80 backdrop-blur-sm">
                  <tr className="border-b border-black/10 dark:border-white/10">
                    {def.displayColumns.map((col) => {
                      const friendly: Record<string, string> = { country_id: "Country", destination_id: "Destination", resorts_id: "Resort", type_id: "Type", park_id: "Park", country_name: "Country Name", country_code: "Country Code", airport_name: "Airport Name", airport_code: "Airport Code", lodge_name: "Lodge Name", lodge_code: "Lodge Code", cottage_name: "Cottage Name", cottage_code: "Cottage Code" };
                      return <th key={col} className="py-3 px-2 text-left font-medium text-black/70 dark:text-white/70">{friendly[col] || col.replace(/_/g, " ").replace(/\b\w/g, l => l.toUpperCase())}</th>;
                    })}
                    <th className="py-3 px-2 text-right font-medium text-black/70 dark:text-white/70">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row, idx) => (
                    <tr key={row.id ?? idx} className="border-b border-black/5 dark:border-white/5" data-testid={`row-${tableSlug}-${row.id ?? idx}`}>
                      {def.displayColumns.map((col) => (
                        <td key={col} className="py-3 px-2 max-w-[200px] truncate">
                          {resolveValue(col, row[col])}
                        </td>
                      ))}
                      <td className="py-3 px-2 text-right">
                        {row.id != null && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => deleteMutation.mutate(row.id)}
                            className="h-8 w-8 p-0 text-red-500 hover:bg-red-50 dark:hover:bg-red-950"
                            data-testid={`btn-delete-${tableSlug}-${row.id}`}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        )}
                      </td>
                    </tr>
                  ))}
                  {rows.length === 0 && (
                    <tr>
                      <td colSpan={def.displayColumns.length + 1} className="py-8 text-center text-black/50 dark:text-white/50">
                        {debouncedSearch ? "No matching records found." : `No ${def.label.toLowerCase()} yet. Add records above or upload a CSV.`}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}

          {totalPages > 1 && (
            <div className="flex items-center justify-between border-t border-black/5 dark:border-white/5 pt-3 mt-3">
              <div className="text-xs text-muted-foreground">
                Showing {((currentPage - 1) * PAGE_SIZE) + 1}–{Math.min(currentPage * PAGE_SIZE, total)} of {total}
              </div>
              <div className="flex items-center gap-1">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setPage(1)}
                  disabled={currentPage <= 1}
                  className="h-8 w-8 p-0 rounded-xl"
                  data-testid={`btn-page-first-${tableSlug}`}
                >
                  <ChevronsLeft className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={currentPage <= 1}
                  className="h-8 w-8 p-0 rounded-xl"
                  data-testid={`btn-page-prev-${tableSlug}`}
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                  let pageNum: number;
                  if (totalPages <= 5) {
                    pageNum = i + 1;
                  } else if (currentPage <= 3) {
                    pageNum = i + 1;
                  } else if (currentPage >= totalPages - 2) {
                    pageNum = totalPages - 4 + i;
                  } else {
                    pageNum = currentPage - 2 + i;
                  }
                  return (
                    <Button
                      key={pageNum}
                      variant={pageNum === currentPage ? "default" : "ghost"}
                      size="sm"
                      onClick={() => setPage(pageNum)}
                      className={`h-8 w-8 p-0 rounded-xl text-xs ${pageNum === currentPage ? "bg-[#3b82f6] text-white hover:bg-[#3b82f6]/90" : ""}`}
                      data-testid={`btn-page-${pageNum}-${tableSlug}`}
                    >
                      {pageNum}
                    </Button>
                  );
                })}
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={currentPage >= totalPages}
                  className="h-8 w-8 p-0 rounded-xl"
                  data-testid={`btn-page-next-${tableSlug}`}
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setPage(totalPages)}
                  disabled={currentPage >= totalPages}
                  className="h-8 w-8 p-0 rounded-xl"
                  data-testid={`btn-page-last-${tableSlug}`}
                >
                  <ChevronsRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </Card>
      </section>
    </>
  );
}

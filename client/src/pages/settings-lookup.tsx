import { useState, useEffect, useCallback } from "react";
import { useParams } from "wouter";
import { useQuery, useQueries, useMutation, useQueryClient } from "@tanstack/react-query";
import type { Role } from "@/types/auth/auth.types";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Plus,
  Search,
  Pencil,
  Trash2,
  Loader2,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
} from "lucide-react";
import axios from "@/api/client/axios-client";
import { SearchableSelect } from "@/components/ui/searchable-select";

// ─── Field & Table Definitions ────────────────────────────────────────────────

type FieldType = "text" | "number" | "boolean" | "select" | "relation";

interface FieldDef {
  key: string;
  label: string;
  type: FieldType;
  required?: boolean;
  options?: { value: string; label: string }[];
  placeholder?: string;
  /** For type="relation": the API endpoint to fetch options from */
  lookupApi?: string;
  /** For type="relation": the row field to use as the display label */
  lookupLabelKey?: string;
}

interface TableDef {
  label: string;
  apiPath: string;
  navKey: string;
  displayColumns: { key: string; label: string }[];
  formFields: FieldDef[];
  primaryLabel: (row: Record<string, any>) => string;
  /** Returns the URL segment for edit/delete (defaults to row.id) */
  getRowId?: (row: Record<string, any>) => string | null;
  /** Overrides the delete endpoint path */
  getDeletePath?: (row: Record<string, any>) => string | null;
  /** Overrides the edit endpoint path */
  getEditPath?: (row: Record<string, any>) => string | null;
}

const TABLE_DEFS: Record<string, TableDef> = {
  "tour-operators": {
    label: "Tour Operators",
    apiPath: "/api/settings/tour-operators",
    navKey: "tour-operators",
    displayColumns: [{ key: "name", label: "Name" }],
    formFields: [
      { key: "name", label: "Name", type: "text", required: true, placeholder: "e.g. TUI, Jet2" },
    ],
    primaryLabel: (r) => r.name ?? "–",
  },
  "airports": {
    label: "Airports",
    apiPath: "/api/settings/airports",
    navKey: "airports",
    displayColumns: [
      { key: "airport_name", label: "Airport Name" },
      { key: "airport_code", label: "Code" },
    ],
    formFields: [
      { key: "airport_name", label: "Airport Name", type: "text", required: true, placeholder: "e.g. London Heathrow" },
      { key: "airport_code", label: "IATA Code", type: "text", required: true, placeholder: "e.g. LHR" },
    ],
    primaryLabel: (r) => `${r.airport_name ?? ""}${r.airport_code ? ` (${r.airport_code})` : ""}`,
  },
  "countries": {
    label: "Countries",
    apiPath: "/api/settings/countries",
    navKey: "countries",
    displayColumns: [
      { key: "country_name", label: "Country Name" },
      { key: "country_code", label: "Code" },
    ],
    formFields: [
      { key: "country_name", label: "Country Name", type: "text", required: true, placeholder: "e.g. United Kingdom" },
      { key: "country_code", label: "Country Code", type: "text", placeholder: "e.g. GB" },
    ],
    primaryLabel: (r) => r.country_name ?? "–",
  },
  "destinations": {
    label: "Destinations",
    apiPath: "/api/settings/destinations",
    navKey: "destinations",
    displayColumns: [
      { key: "name", label: "Name" },
      { key: "type", label: "Type" },
      { key: "country_name", label: "Country" },
    ],
    formFields: [
      { key: "name", label: "Name", type: "text", required: true, placeholder: "e.g. Maldives" },
      { key: "type", label: "Type", type: "text", placeholder: "e.g. Beach, City" },
      { key: "country_id", label: "Country", type: "relation", lookupApi: "/api/settings/countries", lookupLabelKey: "country_name" },
    ],
    primaryLabel: (r) => r.name ?? "–",
  },
  "resorts": {
    label: "Resorts",
    apiPath: "/api/settings/resorts",
    navKey: "resorts-admin",
    displayColumns: [
      { key: "name", label: "Name" },
      { key: "destination_name", label: "Destination" },
    ],
    formFields: [
      { key: "name", label: "Resort Name", type: "text", required: true, placeholder: "e.g. Palm Beach Resort" },
      { key: "destination_id", label: "Destination", type: "relation", lookupApi: "/api/settings/destinations", lookupLabelKey: "name" },
    ],
    primaryLabel: (r) => r.name ?? "–",
  },
  "accommodation-types": {
    label: "Accommodation Types",
    apiPath: "/api/settings/accommodation-types",
    navKey: "accommodation-types",
    displayColumns: [{ key: "type", label: "Type" }],
    formFields: [
      { key: "type", label: "Type", type: "text", required: true, placeholder: "e.g. Hotel, Villa, Apartment" },
    ],
    primaryLabel: (r) => r.type ?? "–",
  },
  "accommodation-list": {
    label: "Accommodation List",
    apiPath: "/api/settings/accommodation-list",
    navKey: "accommodation-list",
    displayColumns: [
      { key: "name", label: "Name" },
      { key: "description", label: "Description" },
      { key: "resort_name", label: "Resort" },
      { key: "destination_name", label: "Destination" },
      { key: "country_name", label: "Country" },
      { key: "accommodation_type_name", label: "Type" },
    ],
    formFields: [
      { key: "name", label: "Name", type: "text", required: true, placeholder: "Accommodation name" },
      { key: "description", label: "Description", type: "text", placeholder: "Brief description" },
      { key: "resorts_id", label: "Resort", type: "relation", lookupApi: "/api/settings/resorts", lookupLabelKey: "name" },
      { key: "type_id", label: "Accommodation Type", type: "relation", lookupApi: "/api/settings/accommodation-types", lookupLabelKey: "type" },
    ],
    primaryLabel: (r) => r.name ?? "–",
  },
  "board-basis": {
    label: "Board Basis",
    apiPath: "/api/settings/board-basis",
    navKey: "board-basis",
    displayColumns: [{ key: "type", label: "Type" }],
    formFields: [
      { key: "type", label: "Board Type", type: "text", required: true, placeholder: "e.g. All Inclusive, Bed & Breakfast" },
    ],
    primaryLabel: (r) => r.type ?? "–",
  },
  "package-types": {
    label: "Package Types",
    apiPath: "/api/settings/package-types",
    navKey: "package-types",
    displayColumns: [{ key: "name", label: "Name" }],
    formFields: [
      { key: "name", label: "Name", type: "text", required: true, placeholder: "e.g. Package Holiday, Cruise Package" },
    ],
    primaryLabel: (r) => r.name ?? "–",
  },
  "package-commissions": {
    label: "Package Commissions",
    apiPath: "/api/settings/package-commissions",
    navKey: "package-commissions",
    displayColumns: [
      { key: "package_type_name", label: "Package Type" },
      { key: "tour_operator_name", label: "Tour Operator" },
      { key: "percentage_commission", label: "Commission %" },
    ],
    formFields: [
      { key: "package_type_id", label: "Package Type", type: "relation", required: true, lookupApi: "/api/settings/package-types", lookupLabelKey: "name" },
      { key: "tour_operator_id", label: "Tour Operator", type: "relation", required: true, lookupApi: "/api/settings/tour-operators", lookupLabelKey: "name" },
      { key: "percentage_commission", label: "Commission %", type: "number", placeholder: "e.g. 10.5" },
    ],
    primaryLabel: (r) => `${r.package_type_id ?? "?"} / ${r.tour_operator_id ?? "?"}`,
    getDeletePath: (r) =>
      r.package_type_id && r.tour_operator_id
        ? `/api/settings/package-commissions/${r.package_type_id}/${r.tour_operator_id}`
        : null,
    getEditPath: (r) =>
      r.package_type_id && r.tour_operator_id
        ? `/api/settings/package-commissions/${r.package_type_id}/${r.tour_operator_id}`
        : null,
    getRowId: (r) => r.package_type_id ?? null,
  },
  "parks": {
    label: "Parks",
    apiPath: "/api/settings/parks",
    navKey: "parks",
    displayColumns: [
      { key: "name", label: "Name" },
      { key: "location", label: "Location" },
      { key: "city", label: "City" },
      { key: "code", label: "Code" },
    ],
    formFields: [
      { key: "name", label: "Park Name", type: "text", required: true, placeholder: "e.g. Sunhaven Holiday Park" },
      { key: "location", label: "Location", type: "text", placeholder: "e.g. Coastal" },
      { key: "city", label: "City", type: "text", placeholder: "e.g. Torquay" },
      { key: "county", label: "County", type: "text", placeholder: "e.g. Devon" },
      { key: "code", label: "Code", type: "text", placeholder: "Park code" },
      { key: "description", label: "Description", type: "text", placeholder: "Brief description" },
    ],
    primaryLabel: (r) => r.name ?? "–",
  },
  "cottages": {
    label: "Cottages",
    apiPath: "/api/settings/cottages",
    navKey: "cottages-admin",
    displayColumns: [
      { key: "cottage_name", label: "Name" },
      { key: "cottage_code", label: "Code" },
      { key: "location", label: "Location" },
      { key: "bedrooms", label: "Bedrooms" },
      { key: "sleeps", label: "Sleeps" },
    ],
    formFields: [
      { key: "cottage_name", label: "Cottage Name", type: "text", required: true, placeholder: "e.g. Sea View Cottage" },
      { key: "cottage_code", label: "Cottage Code", type: "text", placeholder: "e.g. SVC001" },
      { key: "location", label: "Location", type: "text", placeholder: "e.g. Cornwall" },
      { key: "bedrooms", label: "Bedrooms", type: "number", placeholder: "2" },
      { key: "bathrooms", label: "Bathrooms", type: "number", placeholder: "1" },
      { key: "sleeps", label: "Sleeps", type: "number", placeholder: "4" },
      { key: "pets", label: "Pets Allowed", type: "number", placeholder: "0 = no, 1 = yes" },
    ],
    primaryLabel: (r) => r.cottage_name ?? "–",
  },
  "lodges": {
    label: "Lodges",
    apiPath: "/api/settings/lodges",
    navKey: "lodges-admin",
    displayColumns: [
      { key: "lodge_name", label: "Name" },
      { key: "lodge_code", label: "Code" },
      { key: "park_name", label: "Park" },
      { key: "bedrooms", label: "Bedrooms" },
      { key: "sleeps", label: "Sleeps" },
    ],
    formFields: [
      { key: "lodge_name", label: "Lodge Name", type: "text", required: true, placeholder: "e.g. Lakeside Lodge" },
      { key: "lodge_code", label: "Lodge Code", type: "text", placeholder: "e.g. LL001" },
      { key: "park_id", label: "Park", type: "relation", lookupApi: "/api/settings/parks", lookupLabelKey: "name" },
      { key: "adults", label: "Adults", type: "number", placeholder: "2" },
      { key: "children", label: "Children", type: "number", placeholder: "0" },
      { key: "infants", label: "Infants", type: "number", placeholder: "0" },
      { key: "bedrooms", label: "Bedrooms", type: "number", placeholder: "2" },
      { key: "bathrooms", label: "Bathrooms", type: "number", placeholder: "1" },
      { key: "sleeps", label: "Sleeps", type: "number", placeholder: "4" },
      { key: "pets", label: "Pets Allowed", type: "number", placeholder: "0 = no, 1 = yes" },
    ],
    primaryLabel: (r) => r.lodge_name ?? "–",
  },
  "cruise-extras": {
    label: "Cruise Extras",
    apiPath: "/api/settings/cruise-extras",
    navKey: "cruise-extras",
    displayColumns: [{ key: "name", label: "Name" }],
    formFields: [
      { key: "name", label: "Name", type: "text", required: true, placeholder: "e.g. Shore Excursion, Drinks Package" },
    ],
    primaryLabel: (r) => r.name ?? "–",
  },
  "cruise-lines": {
    label: "Cruise Lines",
    apiPath: "/api/settings/cruise-lines",
    navKey: "cruise-lines",
    displayColumns: [{ key: "name", label: "Name" }],
    formFields: [
      { key: "name", label: "Cruise Line Name", type: "text", required: true, placeholder: "e.g. Royal Caribbean, P&O Cruises" },
    ],
    primaryLabel: (r) => r.name ?? "–",
  },
  "cruise-ships": {
    label: "Cruise Ships",
    apiPath: "/api/settings/cruise-ships",
    navKey: "cruise-ships",
    displayColumns: [
      { key: "name", label: "Ship Name" },
      { key: "cruise_line_name", label: "Cruise Line" },
    ],
    formFields: [
      { key: "name", label: "Ship Name", type: "text", required: true, placeholder: "e.g. Symphony of the Seas" },
      { key: "cruise_line_id", label: "Cruise Line", type: "relation", lookupApi: "/api/settings/cruise-lines", lookupLabelKey: "name" },
    ],
    primaryLabel: (r) => r.name ?? "–",
  },
  "cruise-itineraries": {
    label: "Cruise Itineraries",
    apiPath: "/api/settings/cruise-itineraries",
    navKey: "cruise-itineraries",
    displayColumns: [
      { key: "itenary", label: "Itinerary Name" },
      { key: "departure_port", label: "Departure Port" },
      { key: "date", label: "Date" },
      { key: "ship_name", label: "Ship" },
    ],
    formFields: [
      { key: "itenary", label: "Itinerary Name", type: "text", placeholder: "e.g. Mediterranean Explorer" },
      { key: "departure_port", label: "Departure Port", type: "text", required: true, placeholder: "e.g. Southampton" },
      { key: "date", label: "Departure Date", type: "text", placeholder: "YYYY-MM-DD" },
      { key: "ship_id", label: "Ship", type: "relation", lookupApi: "/api/settings/cruise-ships", lookupLabelKey: "name" },
    ],
    primaryLabel: (r) => r.itenary ?? r.departure_port ?? "–",
  },
  "cruise-voyages": {
    label: "Cruise Voyage Days",
    apiPath: "/api/settings/cruise-voyages",
    navKey: "cruise-voyages",
    displayColumns: [
      { key: "day_number", label: "Day" },
      { key: "description", label: "Description" },
      { key: "itinerary_name", label: "Itinerary" },
    ],
    formFields: [
      { key: "day_number", label: "Day Number", type: "number", required: true, placeholder: "e.g. 1" },
      { key: "description", label: "Description", type: "text", placeholder: "e.g. At sea, Arrive Naples" },
      { key: "itinerary_id", label: "Itinerary", type: "relation", lookupApi: "/api/settings/cruise-itineraries", lookupLabelKey: "itenary" },
    ],
    primaryLabel: (r) => `Day ${r.day_number ?? "?"}${r.description ? ` – ${r.description}` : ""}`,
  },
  "room-types": {
    label: "Room Types",
    apiPath: "/api/settings/room-types",
    navKey: "room-types",
    displayColumns: [{ key: "name", label: "Name" }],
    formFields: [
      { key: "name", label: "Name", type: "text", required: true, placeholder: "e.g. Double, Twin, Suite" },
    ],
    primaryLabel: (r) => r.name ?? "–",
  },
  "deletion-codes": {
    label: "Deletion Codes",
    apiPath: "/api/settings/deletion-codes",
    navKey: "deletion-codes",
    displayColumns: [
      { key: "code", label: "Code" },
      { key: "is_used", label: "Used?" },
    ],
    formFields: [
      { key: "code", label: "Code", type: "text", required: true, placeholder: "e.g. CANCELLED, EXPIRED" },
      {
        key: "is_used",
        label: "Is Used",
        type: "select",
        options: [
          { value: "false", label: "No" },
          { value: "true", label: "Yes" },
        ],
      },
    ],
    primaryLabel: (r) => r.code ?? "–",
  },
  "tags": {
    label: "Tags",
    apiPath: "/api/settings/tags",
    navKey: "tags",
    displayColumns: [
      { key: "name", label: "Name" },
      { key: "usageCount", label: "Usage Count" },
    ],
    formFields: [
      { key: "name", label: "Name", type: "text", required: true, placeholder: "e.g. Beach, Family, Luxury" },
    ],
    primaryLabel: (r) => r.name ?? "–",
  },
};

const PAGE_SIZE = 25;

// ─── Relation Select ──────────────────────────────────────────────────────────

function RelationSelect({
  lookupApi,
  lookupLabelKey,
  value,
  onChange,
  placeholder,
}: {
  lookupApi: string;
  lookupLabelKey: string;
  value: any;
  onChange: (val: any) => void;
  placeholder?: string;
}) {
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");

  // Debounce the search input
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(timer);
  }, [search]);

  const { data: lookupData, isLoading } = useQuery({
    queryKey: ["relation-lookup", lookupApi, debouncedSearch],
    queryFn: async () => {
      const params = new URLSearchParams({ limit: "50" });
      if (debouncedSearch) params.set("search", debouncedSearch);
      const res = await axios.get(`${lookupApi}?${params}`);
      const body = res.data as { data?: { rows?: Record<string, any>[] }; rows?: Record<string, any>[] };
      return body.data?.rows ?? body.rows ?? [];
    },
    staleTime: 60 * 1000,
  });

  // Fetch the selected item's label when value is set but not in current results
  const { data: selectedItem } = useQuery({
    queryKey: ["relation-lookup-item", lookupApi, value],
    queryFn: async () => {
      const res = await axios.get(`${lookupApi}/${value}`);
      return res.data?.data as Record<string, any> | undefined;
    },
    enabled: !!value && !(lookupData ?? []).some((r) => r.id === value),
    staleTime: 5 * 60 * 1000,
  });

  const options = (lookupData ?? []).map((row) => ({
    value: row.id,
    label: row[lookupLabelKey] ?? row.id,
  }));

  const selectedLabel =
    (lookupData ?? []).find((r) => r.id === value)?.[lookupLabelKey] ??
    (selectedItem ? selectedItem[lookupLabelKey] : undefined);

  return (
    <SearchableSelect
      value={value ?? ""}
      onValueChange={(val) => onChange(val || null)}
      options={options}
      placeholder={placeholder ?? "— Select —"}
      searchPlaceholder="Search…"
      onSearch={setSearch}
      isLoading={isLoading}
      selectedLabel={selectedLabel}
    />
  );
}

// ─── Field Input Component ────────────────────────────────────────────────────

function FieldInput({
  field,
  value,
  onChange,
}: {
  field: FieldDef;
  value: any;
  onChange: (val: any) => void;
}) {
  const baseClass =
    "w-full h-9 rounded-xl border border-black/10 bg-black/5 px-3 text-sm dark:border-white/10 dark:bg-white/5 focus:outline-none focus:ring-1 focus:ring-ring";

  if (field.type === "relation" && field.lookupApi && field.lookupLabelKey) {
    return (
      <RelationSelect
        lookupApi={field.lookupApi}
        lookupLabelKey={field.lookupLabelKey}
        value={value}
        onChange={onChange}
        placeholder={field.placeholder}
      />
    );
  }

  if (field.type === "boolean") {
    return (
      <div className="flex items-center gap-2">
        <input
          type="checkbox"
          checked={!!value}
          onChange={(e) => onChange(e.target.checked)}
          className="h-4 w-4 rounded border-black/20"
        />
        <span className="text-sm text-muted-foreground">{value ? "Yes" : "No"}</span>
      </div>
    );
  }

  if (field.type === "select" && field.options) {
    return (
      <select
        value={value ?? ""}
        onChange={(e) => onChange(e.target.value)}
        className={baseClass}
      >
        <option value="">Select...</option>
        {field.options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
    );
  }

  if (field.type === "number") {
    return (
      <input
        type="number"
        value={value ?? ""}
        placeholder={field.placeholder}
        onChange={(e) => onChange(e.target.value === "" ? null : Number(e.target.value))}
        className={baseClass}
      />
    );
  }

  return (
    <input
      type="text"
      value={value ?? ""}
      placeholder={field.placeholder}
      onChange={(e) => onChange(e.target.value)}
      className={baseClass}
    />
  );
}

// ─── Record Modal (Add / Edit) ────────────────────────────────────────────────

function RecordModal({
  open,
  onClose,
  onSave,
  fields,
  initial,
  title,
  isSaving,
}: {
  open: boolean;
  onClose: () => void;
  onSave: (data: Record<string, any>) => void;
  fields: FieldDef[];
  initial: Record<string, any>;
  title: string;
  isSaving: boolean;
}) {
  const [form, setForm] = useState<Record<string, any>>(initial);

  useEffect(() => {
    setForm(initial);
  }, [initial, open]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(form);
  };

  const setField = useCallback((key: string, val: any) => {
    setForm((prev) => ({ ...prev, [key]: val }));
  }, []);

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-md rounded-2xl">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 py-2">
          {fields.map((field) => (
            <div key={field.key} className="space-y-1.5">
              <label className="text-sm font-medium text-black/70 dark:text-white/70">
                {field.label}
                {field.required && <span className="text-red-500 ml-1">*</span>}
              </label>
              <FieldInput field={field} value={form[field.key]} onChange={(v) => setField(field.key, v)} />
            </div>
          ))}
          <DialogFooter className="pt-2">
            <Button type="button" variant="ghost" onClick={onClose} className="rounded-xl">
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={isSaving}
              className="rounded-xl bg-[#3b82f6] text-white hover:bg-[#3b82f6]/90"
            >
              {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function SettingsLookupPage() {
  const params = useParams<{ tableSlug: string }>();
  const tableSlug = params.tableSlug || "";
  const def = TABLE_DEFS[tableSlug];

  const [role, setRole] = useState<Role>("Admin");
  const [query, setQuery] = useState("");
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [page, setPage] = useState(1);
  const [addOpen, setAddOpen] = useState(false);
  const [editRecord, setEditRecord] = useState<Record<string, any> | null>(null);
  const [deleteRecord, setDeleteRecord] = useState<Record<string, any> | null>(null);

  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Debounce search
  useEffect(() => {
    const t = setTimeout(() => {
      setDebouncedSearch(search);
      setPage(1);
    }, 300);
    return () => clearTimeout(t);
  }, [search]);

  // Reset on table change
  useEffect(() => {
    setSearch("");
    setDebouncedSearch("");
    setPage(1);
    setAddOpen(false);
    setEditRecord(null);
    setDeleteRecord(null);
  }, [tableSlug]);

  const queryKey = ["settings", tableSlug, page, debouncedSearch];

  const { data, isLoading } = useQuery({
    queryKey,
    queryFn: async () => {
      if (!def) return null;
      const p = new URLSearchParams({ page: String(page), limit: String(PAGE_SIZE) });
      if (debouncedSearch) p.set("search", debouncedSearch);
      const res = await axios.get(`${def.apiPath}?${p}`);
      const payload = res.data?.data ?? res.data;
      return payload as {
        rows: Record<string, any>[];
        total: number;
        page: number;
        limit: number;
        totalPages: number;
      };
    },
    enabled: !!def,
    placeholderData: (prev) => prev,
  });

  const createMutation = useMutation({
    mutationFn: async (payload: Record<string, any>) => {
      await axios.post(def!.apiPath, payload);
    },
    onSuccess: () => {
      toast({ title: "Record added successfully" });
      queryClient.invalidateQueries({ queryKey: ["settings", tableSlug] });
      setAddOpen(false);
    },
    onError: (err: any) =>
      toast({ title: "Failed to add record", description: err?.response?.data?.message ?? err.message, variant: "destructive" }),
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, payload, record }: { id: string; payload: Record<string, any>; record?: Record<string, any> }) => {
      const path = record && def!.getEditPath ? def!.getEditPath(record) : `${def!.apiPath}/${id}`;
      if (!path) throw new Error("Cannot determine edit path for this record");
      await axios.patch(path, payload);
    },
    onSuccess: () => {
      toast({ title: "Record updated successfully" });
      queryClient.invalidateQueries({ queryKey: ["settings", tableSlug] });
      setEditRecord(null);
    },
    onError: (err: any) =>
      toast({ title: "Failed to update record", description: err?.response?.data?.message ?? err.message, variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: async ({ id, record }: { id: string; record: Record<string, any> }) => {
      const path = def!.getDeletePath ? def!.getDeletePath(record) : `${def!.apiPath}/${id}`;
      if (!path) throw new Error("Cannot determine delete path for this record");
      await axios.delete(path);
    },
    onSuccess: () => {
      toast({ title: "Record deleted" });
      queryClient.invalidateQueries({ queryKey: ["settings", tableSlug] });
      setDeleteRecord(null);
    },
    onError: (err: any) =>
      toast({ title: "Failed to delete record", description: err?.response?.data?.message ?? err.message, variant: "destructive" }),
  });

  const emptyForm = useCallback(() => {
    if (!def) return {};
    return def.formFields.reduce<Record<string, any>>((acc, f) => {
      acc[f.key] = f.type === "boolean" ? false : f.type === "number" ? null : "";
      return acc;
    }, {});
  }, [def]);

  const editForm = useCallback(
    (record: Record<string, any>) => {
      if (!def) return {};
      return def.formFields.reduce<Record<string, any>>((acc, f) => {
        acc[f.key] = record[f.key] ?? (f.type === "boolean" ? false : f.type === "number" ? null : "");
        return acc;
      }, {});
    },
    [def]
  );

  if (!def) {
    return (
      <Card className="glass ringed grain rounded-3xl p-8 text-center">
        <p className="text-black/50 dark:text-white/50">Settings table not found: {tableSlug}</p>
      </Card>
    );
  }

  const rows = data?.rows ?? [];
  const total = data?.total ?? 0;
  const totalPages = data?.totalPages ?? 1;
  const currentPage = data?.page ?? 1;

  // Fetch lookup data for every relation field so UUIDs can be resolved to labels in the table
  const relationFields = def.formFields.filter(
    (f) => f.type === "relation" && f.lookupApi && f.lookupLabelKey
  );
  const relationQueries = useQueries({
    queries: relationFields.map((f) => ({
      queryKey: ["relation-lookup", f.lookupApi],
      queryFn: async () => {
        const res = await axios.get(`${f.lookupApi}?limit=500`);
        return (res.data as { rows: Record<string, any>[] }).rows ?? [];
      },
      staleTime: 5 * 60 * 1000,
    })),
  });

  // Build a map: { columnKey -> { uuid -> label } }
  const relationLookupMap: Record<string, Record<string, string>> = {};
  relationFields.forEach((f, i) => {
    const relRows = relationQueries[i]?.data ?? [];
    relationLookupMap[f.key] = {};
    relRows.forEach((row: Record<string, any>) => {
      if (row.id) relationLookupMap[f.key][row.id] = row[f.lookupLabelKey!] ?? row.id;
    });
  });

  const renderCellValue = (col: string, value: any) => {
    if (value === null || value === undefined || value === "") return <span className="text-black/30 dark:text-white/30">—</span>;
    if (typeof value === "boolean") return value ? "Yes" : "No";
    // Resolve relation UUID to its display label
    if (relationLookupMap[col]?.[value]) return relationLookupMap[col][value];
    return String(value);
  };

  return (
    <>
      <section>
        <Card className="glass ringed grain rounded-3xl p-4 md:p-5">
          {/* Header */}
          <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
            <div>
              <p className="text-sm font-semibold">{def.label}</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                {debouncedSearch
                  ? `${total} result${total !== 1 ? "s" : ""} for "${debouncedSearch}"`
                  : `${total} record${total !== 1 ? "s" : ""} total`}
                {totalPages > 1 && ` · Page ${currentPage} of ${totalPages}`}
              </p>
            </div>
            <div className="flex items-center gap-2">
              {/* Search */}
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-black/40 dark:text-white/40" />
                <input
                  type="text"
                  placeholder={`Search ${def.label.toLowerCase()}...`}
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-48 h-9 pl-9 pr-3 rounded-2xl border border-black/10 bg-black/5 dark:border-white/10 dark:bg-white/5 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                />
              </div>
              {/* Add Button */}
              <Button
                onClick={() => setAddOpen(true)}
                className="rounded-2xl bg-[#3b82f6] text-white hover:bg-[#3b82f6]/90 gap-1.5"
              >
                <Plus className="h-4 w-4" />
                Add {def.label.replace(/s$/, "")}
              </Button>
            </div>
          </div>

          {/* Table */}
          {isLoading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="h-6 w-6 animate-spin text-black/30 dark:text-white/30" />
            </div>
          ) : (
            <div className="overflow-x-auto rounded-xl border border-black/5 dark:border-white/5">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-black/5 dark:border-white/5 bg-black/2 dark:bg-white/2">
                    <th className="py-3 px-3 text-left text-xs font-semibold text-black/50 dark:text-white/50 w-10">#</th>
                    {def.displayColumns.map((col) => (
                      <th key={col.key} className="py-3 px-3 text-left text-xs font-semibold text-black/50 dark:text-white/50">
                        {col.label}
                      </th>
                    ))}
                    <th className="py-3 px-3 text-right text-xs font-semibold text-black/50 dark:text-white/50">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.length === 0 ? (
                    <tr>
                      <td
                        colSpan={def.displayColumns.length + 2}
                        className="py-12 text-center text-sm text-black/40 dark:text-white/40"
                      >
                        {debouncedSearch
                          ? `No ${def.label.toLowerCase()} found matching "${debouncedSearch}".`
                          : `No ${def.label.toLowerCase()} yet. Click "Add" to create the first one.`}
                      </td>
                    </tr>
                  ) : (
                    rows.map((row, idx) => (
                      <tr
                        key={row.id ?? idx}
                        className="border-b border-black/5 dark:border-white/5 last:border-0 hover:bg-black/2 dark:hover:bg-white/2 transition-colors"
                      >
                        <td className="py-3 px-3 text-xs text-black/30 dark:text-white/30">
                          {(currentPage - 1) * PAGE_SIZE + idx + 1}
                        </td>
                        {def.displayColumns.map((col) => (
                          <td key={col.key} className="py-3 px-3 max-w-[240px] truncate">
                            {renderCellValue(col.key, row[col.key])}
                          </td>
                        ))}
                        <td className="py-3 px-3">
                          <div className="flex items-center justify-end gap-1">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => setEditRecord(row)}
                              className="h-7 w-7 p-0 rounded-lg text-black/50 hover:text-black hover:bg-black/5 dark:text-white/50 dark:hover:text-white dark:hover:bg-white/5"
                            >
                              <Pencil className="h-3.5 w-3.5" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => setDeleteRecord(row)}
                              className="h-7 w-7 p-0 rounded-lg text-red-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between border-t border-black/5 dark:border-white/5 pt-4 mt-4">
              <span className="text-xs text-muted-foreground">
                Showing {(currentPage - 1) * PAGE_SIZE + 1}–{Math.min(currentPage * PAGE_SIZE, total)} of {total}
              </span>
              <div className="flex items-center gap-1">
                <Button variant="ghost" size="sm" onClick={() => setPage(1)} disabled={currentPage <= 1} className="h-8 w-8 p-0 rounded-xl">
                  <ChevronsLeft className="h-4 w-4" />
                </Button>
                <Button variant="ghost" size="sm" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={currentPage <= 1} className="h-8 w-8 p-0 rounded-xl">
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                  let pn: number;
                  if (totalPages <= 5) pn = i + 1;
                  else if (currentPage <= 3) pn = i + 1;
                  else if (currentPage >= totalPages - 2) pn = totalPages - 4 + i;
                  else pn = currentPage - 2 + i;
                  return (
                    <Button
                      key={pn}
                      variant={pn === currentPage ? "default" : "ghost"}
                      size="sm"
                      onClick={() => setPage(pn)}
                      className={`h-8 w-8 p-0 rounded-xl text-xs ${pn === currentPage ? "bg-[#3b82f6] text-white hover:bg-[#3b82f6]/90" : ""}`}
                    >
                      {pn}
                    </Button>
                  );
                })}
                <Button variant="ghost" size="sm" onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={currentPage >= totalPages} className="h-8 w-8 p-0 rounded-xl">
                  <ChevronRight className="h-4 w-4" />
                </Button>
                <Button variant="ghost" size="sm" onClick={() => setPage(totalPages)} disabled={currentPage >= totalPages} className="h-8 w-8 p-0 rounded-xl">
                  <ChevronsRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </Card>
      </section>

      {/* Add Modal */}
      <RecordModal
        open={addOpen}
        onClose={() => setAddOpen(false)}
        onSave={(data) => createMutation.mutate(data)}
        fields={def.formFields}
        initial={emptyForm()}
        title={`Add ${def.label.replace(/s$/, "")}`}
        isSaving={createMutation.isPending}
      />

      {/* Edit Modal */}
      <RecordModal
        open={!!editRecord}
        onClose={() => setEditRecord(null)}
        onSave={(data) => {
          const rowId = editRecord ? (def.getRowId ? def.getRowId(editRecord) : editRecord.id) : null;
          if (rowId || def.getEditPath) {
            updateMutation.mutate({ id: rowId ?? "", payload: data, record: editRecord ?? undefined });
          }
        }}
        fields={def.formFields}
        initial={editRecord ? editForm(editRecord) : emptyForm()}
        title={`Edit ${def.label.replace(/s$/, "")}`}
        isSaving={updateMutation.isPending}
      />

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteRecord} onOpenChange={(v) => !v && setDeleteRecord(null)}>
        <AlertDialogContent className="rounded-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {def.label.replace(/s$/, "")}</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete{" "}
              <span className="font-semibold text-black dark:text-white">
                {deleteRecord ? def.primaryLabel(deleteRecord) : "this record"}
              </span>
              ? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-xl">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (deleteRecord) {
                  const rowId = def.getRowId ? def.getRowId(deleteRecord) : deleteRecord.id;
                  deleteMutation.mutate({ id: rowId ?? "", record: deleteRecord });
                }
              }}
              disabled={deleteMutation.isPending}
              className="rounded-xl bg-red-600 hover:bg-red-700 text-white"
            >
              {deleteMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

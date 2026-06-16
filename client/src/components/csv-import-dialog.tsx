import { useState, useRef, useCallback } from "react";
import Papa from "papaparse";
import { motion, AnimatePresence } from "framer-motion";
import { Upload, FileText, AlertCircle, CheckCircle2, X, Download, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useImportNeonClients } from "@/hooks/mutations";
import type { NeonClientImportRow } from "@/types/neon-client";

const EXPECTED_HEADERS = [
  "title", "firstName", "surename", "DOB", "phoneNumber",
  "email", "emailIsAllowed", "VMB", "VMBfirstAccess",
  "whatsAppVerified", "mailAllowed", "houseNumber", "city",
  "street", "country", "post_code", "avatarUrl", "badge", "referrerId",
];

const REQUIRED_FIELDS = ["firstName", "surename", "phoneNumber"];

type ValidationError = {
  row: number;
  field: string;
  message: string;
};

type ImportStep = "upload" | "preview" | "importing" | "result";

interface CsvImportDialogProps {
  open: boolean;
  onClose: () => void;
}

function parseBooleanField(value: string | undefined): boolean | undefined {
  if (value === undefined || value === "") return undefined;
  const lower = value.toLowerCase().trim();
  if (lower === "true" || lower === "1" || lower === "yes") return true;
  if (lower === "false" || lower === "0" || lower === "no") return false;
  return undefined;
}

function validateRows(rows: Record<string, string>[]): { valid: NeonClientImportRow[]; errors: ValidationError[] } {
  const errors: ValidationError[] = [];
  const valid: NeonClientImportRow[] = [];

  rows.forEach((row, index) => {
    const rowNum = index + 1;
    let hasError = false;

    for (const field of REQUIRED_FIELDS) {
      if (!row[field] || row[field]!.trim() === "") {
        errors.push({ row: rowNum, field, message: `"${field}" is required` });
        hasError = true;
      }
    }

    if (hasError) return;

    const client: NeonClientImportRow = {
      firstName: row.firstName!.trim(),
      surename: row.surename!.trim(),
      phoneNumber: row.phoneNumber!.trim(),
    };

    if (row.title) client.title = row.title.trim();
    if (row.DOB) client.DOB = row.DOB.trim();
    if (row.email) client.email = row.email.trim();
    if (row.VMB) client.VMB = row.VMB.trim();
    if (row.VMBfirstAccess) client.VMBfirstAccess = row.VMBfirstAccess.trim();
    if (row.houseNumber) client.houseNumber = row.houseNumber.trim();
    if (row.city) client.city = row.city.trim();
    if (row.street) client.street = row.street.trim();
    if (row.country) client.country = row.country.trim();
    if (row.post_code) client.post_code = row.post_code.trim();
    if (row.avatarUrl) client.avatarUrl = row.avatarUrl.trim();
    if (row.badge) client.badge = row.badge.trim();
    if (row.referrerId) client.referrerId = row.referrerId.trim();

    const emailAllowed = parseBooleanField(row.emailIsAllowed);
    if (emailAllowed !== undefined) client.emailIsAllowed = emailAllowed;

    const whatsApp = parseBooleanField(row.whatsAppVerified);
    if (whatsApp !== undefined) client.whatsAppVerified = whatsApp;

    const mail = parseBooleanField(row.mailAllowed);
    if (mail !== undefined) client.mailAllowed = mail;

    valid.push(client);
  });

  return { valid, errors };
}

export default function CsvImportDialog({ open, onClose }: CsvImportDialogProps) {
  const [step, setStep] = useState<ImportStep>("upload");
  const [fileName, setFileName] = useState("");
  const [parsedRows, setParsedRows] = useState<Record<string, string>[]>([]);
  const [validClients, setValidClients] = useState<NeonClientImportRow[]>([]);
  const [validationErrors, setValidationErrors] = useState<ValidationError[]>([]);
  const [importResult, setImportResult] = useState<{ imported: number; errors: Array<{ row: number; id: string; error: string }> } | null>(null);
  const [parseError, setParseError] = useState<string | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const importMutation = useImportNeonClients();

  const reset = useCallback(() => {
    setStep("upload");
    setFileName("");
    setParsedRows([]);
    setValidClients([]);
    setValidationErrors([]);
    setImportResult(null);
    setParseError(null);
    setDragActive(false);
  }, []);

  const handleClose = useCallback(() => {
    reset();
    onClose();
  }, [reset, onClose]);

  const processFile = useCallback((file: File) => {
    if (!file.name.endsWith(".csv")) {
      setParseError("Please upload a CSV file");
      return;
    }

    setFileName(file.name);
    setParseError(null);

    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        if (results.errors.length > 0) {
          setParseError(`CSV parsing error: ${results.errors[0]?.message || "Unknown error"}`);
          return;
        }

        const rows = results.data as Record<string, string>[];
        if (rows.length === 0) {
          setParseError("CSV file is empty");
          return;
        }

        const headers = Object.keys(rows[0] || {});
        const missingRequired = REQUIRED_FIELDS.filter(f => !headers.includes(f));
        if (missingRequired.length > 0) {
          setParseError(`Missing required columns: ${missingRequired.join(", ")}`);
          return;
        }

        setParsedRows(rows);
        const { valid, errors } = validateRows(rows);
        setValidClients(valid);
        setValidationErrors(errors);
        setStep("preview");
      },
      error: (err) => {
        setParseError(`Failed to read file: ${err.message}`);
      },
    });
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragActive(false);
    const file = e.dataTransfer.files[0];
    if (file) processFile(file);
  }, [processFile]);

  const handleFileInput = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) processFile(file);
  }, [processFile]);

  const handleImport = useCallback(async () => {
    setStep("importing");
    try {
      const result = await importMutation.mutateAsync(validClients);
      setImportResult(result);
      setStep("result");
    } catch (err: any) {
      setImportResult({ imported: 0, errors: [{ row: 0, id: "-", error: err.message || "Import failed" }] });
      setStep("result");
    }
  }, [validClients, importMutation]);

  const downloadTemplate = useCallback(() => {
    const csv = Papa.unparse({
      fields: EXPECTED_HEADERS,
      data: [
        {
          title: "Mr",
          firstName: "John",
          surename: "Smith",
          DOB: "1990-01-15",
          phoneNumber: "+447700900000",
          email: "john@example.com",
          emailIsAllowed: "true",
          VMB: "",
          VMBfirstAccess: "",
          whatsAppVerified: "true",
          mailAllowed: "false",
          houseNumber: "42",
          city: "London",
          street: "Baker Street",
          country: "UK",
          post_code: "NW1 6XE",
          avatarUrl: "",
          badge: "",
          referrerId: "",
        },
      ],
    });
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "client-import-template.csv";
    a.click();
    URL.revokeObjectURL(url);
  }, []);

  if (!open) return null;

  const detectedHeaders = parsedRows.length > 0 ? Object.keys(parsedRows[0] || {}) : [];
  const previewData = parsedRows.slice(0, 5);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={handleClose} />
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 10 }}
        className="relative z-10 w-full max-w-4xl max-h-[90vh] overflow-hidden rounded-3xl border border-black/10 dark:border-white/10 bg-white dark:bg-gray-900 shadow-2xl"
      >
        <div className="flex items-center justify-between border-b border-black/5 dark:border-white/5 px-6 py-4">
          <div>
            <h2 className="text-lg font-semibold text-black dark:text-white">Import Clients</h2>
            <p className="text-sm text-black/50 dark:text-white/50">
              Upload a CSV file to import clients in bulk
            </p>
          </div>
          <button
            onClick={handleClose}
            className="flex h-8 w-8 items-center justify-center rounded-full text-black/40 dark:text-white/40 hover:bg-black/5 dark:hover:bg-white/5 transition"
            data-testid="button-close-import"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="overflow-y-auto max-h-[calc(90vh-80px)] p-6">
          <AnimatePresence mode="wait">
            {step === "upload" && (
              <motion.div
                key="upload"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="space-y-6"
              >
                <div
                  onDragOver={(e) => { e.preventDefault(); setDragActive(true); }}
                  onDragLeave={() => setDragActive(false)}
                  onDrop={handleDrop}
                  onClick={() => fileInputRef.current?.click()}
                  className={`flex cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed py-16 transition ${
                    dragActive
                      ? "border-blue-500 bg-blue-50 dark:bg-blue-900/20"
                      : "border-black/10 dark:border-white/10 bg-black/[0.02] dark:bg-white/[0.02] hover:border-black/20 dark:hover:border-white/20"
                  }`}
                  data-testid="dropzone-csv"
                >
                  <div className={`flex h-14 w-14 items-center justify-center rounded-2xl transition ${
                    dragActive ? "bg-blue-100 dark:bg-blue-800/40" : "bg-black/5 dark:bg-white/5"
                  }`}>
                    <Upload className={`h-6 w-6 ${dragActive ? "text-blue-500" : "text-black/40 dark:text-white/40"}`} />
                  </div>
                  <p className="mt-4 text-sm font-medium text-black dark:text-white">
                    Drop your CSV file here, or click to browse
                  </p>
                  <p className="mt-1 text-xs text-black/40 dark:text-white/40">
                    Supports .csv files with client data
                  </p>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".csv"
                    onChange={handleFileInput}
                    className="hidden"
                    data-testid="input-csv-file"
                  />
                </div>

                {parseError && (
                  <div className="flex items-start gap-3 rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-100 dark:border-red-800 p-4" data-testid="text-parse-error">
                    <AlertCircle className="h-5 w-5 shrink-0 text-red-500 mt-0.5" />
                    <p className="text-sm text-red-700 dark:text-red-300">{parseError}</p>
                  </div>
                )}

                <div className="rounded-2xl border border-black/5 dark:border-white/5 bg-black/[0.02] dark:bg-white/[0.02] p-5">
                  <h3 className="text-sm font-semibold text-black dark:text-white mb-3">CSV Format Requirements</h3>
                  <div className="space-y-2">
                    <p className="text-xs text-black/60 dark:text-white/60">
                      <span className="font-medium text-black dark:text-white">Required columns:</span>{" "}
                      {REQUIRED_FIELDS.join(", ")}
                    </p>
                    <p className="text-xs text-black/60 dark:text-white/60">
                      <span className="font-medium text-black dark:text-white">Optional columns:</span>{" "}
                      {EXPECTED_HEADERS.filter(h => !REQUIRED_FIELDS.includes(h)).join(", ")}
                    </p>
                    <p className="text-xs text-black/60 dark:text-white/60">
                      <span className="font-medium text-black dark:text-white">Boolean fields</span> accept: true/false, yes/no, 1/0
                    </p>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    className="mt-4 gap-2 rounded-full"
                    onClick={(e) => { e.stopPropagation(); downloadTemplate(); }}
                    data-testid="button-download-template"
                  >
                    <Download className="h-4 w-4" />
                    Download Template
                  </Button>
                </div>
              </motion.div>
            )}

            {step === "preview" && (
              <motion.div
                key="preview"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="space-y-6"
              >
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-100 dark:bg-blue-900/30">
                    <FileText className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-black dark:text-white" data-testid="text-file-name">{fileName}</p>
                    <p className="text-xs text-black/50 dark:text-white/50">
                      {parsedRows.length} rows found, {detectedHeaders.length} columns detected
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-3">
                  <div className="rounded-xl bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-100 dark:border-emerald-800 p-3 text-center">
                    <div className="text-2xl font-bold text-emerald-700 dark:text-emerald-300" data-testid="text-valid-count">{validClients.length}</div>
                    <div className="text-xs text-emerald-600 dark:text-emerald-400">Valid</div>
                  </div>
                  <div className="rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-100 dark:border-red-800 p-3 text-center">
                    <div className="text-2xl font-bold text-red-700 dark:text-red-300" data-testid="text-error-count">{validationErrors.length}</div>
                    <div className="text-xs text-red-600 dark:text-red-400">Errors</div>
                  </div>
                  <div className="rounded-xl bg-blue-50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-800 p-3 text-center">
                    <div className="text-2xl font-bold text-blue-700 dark:text-blue-300" data-testid="text-total-count">{parsedRows.length}</div>
                    <div className="text-xs text-blue-600 dark:text-blue-400">Total Rows</div>
                  </div>
                </div>

                {validationErrors.length > 0 && (
                  <div className="rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-100 dark:border-red-800 p-4">
                    <h4 className="text-sm font-semibold text-red-700 dark:text-red-300 mb-2">Validation Errors</h4>
                    <div className="max-h-32 overflow-y-auto space-y-1">
                      {validationErrors.slice(0, 20).map((err, i) => (
                        <p key={i} className="text-xs text-red-600 dark:text-red-400">
                          Row {err.row}: {err.message}
                        </p>
                      ))}
                      {validationErrors.length > 20 && (
                        <p className="text-xs text-red-500">...and {validationErrors.length - 20} more errors</p>
                      )}
                    </div>
                  </div>
                )}

                <div>
                  <h4 className="text-sm font-semibold text-black dark:text-white mb-2">Data Preview (first 5 rows)</h4>
                  <div className="overflow-x-auto rounded-xl border border-black/5 dark:border-white/5">
                    <table className="w-full text-xs">
                      <thead className="bg-black/[0.03] dark:bg-white/[0.03]">
                        <tr>
                          <th className="px-3 py-2 text-left font-medium text-black/50 dark:text-white/50 whitespace-nowrap">#</th>
                          {detectedHeaders.slice(0, 8).map(h => (
                            <th key={h} className={`px-3 py-2 text-left font-medium whitespace-nowrap ${
                              REQUIRED_FIELDS.includes(h) ? "text-black dark:text-white" : "text-black/50 dark:text-white/50"
                            }`}>
                              {h}
                              {REQUIRED_FIELDS.includes(h) && <span className="text-red-500 ml-0.5">*</span>}
                            </th>
                          ))}
                          {detectedHeaders.length > 8 && (
                            <th className="px-3 py-2 text-left font-medium text-black/40 dark:text-white/40 whitespace-nowrap">
                              +{detectedHeaders.length - 8} more
                            </th>
                          )}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-black/5 dark:divide-white/5">
                        {previewData.map((row, i) => (
                          <tr key={i}>
                            <td className="px-3 py-2 text-black/40 dark:text-white/40">{i + 1}</td>
                            {detectedHeaders.slice(0, 8).map(h => (
                              <td key={h} className="px-3 py-2 text-black/70 dark:text-white/70 max-w-[120px] truncate whitespace-nowrap">
                                {row[h] || <span className="text-black/20 dark:text-white/20">—</span>}
                              </td>
                            ))}
                            {detectedHeaders.length > 8 && (
                              <td className="px-3 py-2 text-black/30 dark:text-white/30">...</td>
                            )}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                <div className="flex items-center justify-between pt-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-2 rounded-full"
                    onClick={reset}
                    data-testid="button-back-upload"
                  >
                    Choose Different File
                  </Button>
                  <Button
                    size="sm"
                    className="gap-2 rounded-full bg-[#3b82f6] text-white hover:bg-[#3b82f6]/90"
                    onClick={handleImport}
                    disabled={validClients.length === 0}
                    data-testid="button-start-import"
                  >
                    <Upload className="h-4 w-4" />
                    Import {validClients.length} Clients
                  </Button>
                </div>
              </motion.div>
            )}

            {step === "importing" && (
              <motion.div
                key="importing"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="flex flex-col items-center justify-center py-16"
              >
                <Loader2 className="h-10 w-10 animate-spin text-blue-500" />
                <p className="mt-4 text-sm font-medium text-black dark:text-white">Importing clients...</p>
                <p className="mt-1 text-xs text-black/40 dark:text-white/40">
                  Processing {validClients.length} records in batches
                </p>
                <div className="mt-4 w-48">
                  <div className="h-1.5 w-full rounded-full bg-black/5 dark:bg-white/5 overflow-hidden">
                    <motion.div
                      className="h-full rounded-full bg-blue-500"
                      initial={{ width: "5%" }}
                      animate={{ width: "90%" }}
                      transition={{ duration: Math.max(3, validClients.length / 200), ease: "easeOut" }}
                    />
                  </div>
                </div>
              </motion.div>
            )}

            {step === "result" && importResult && (
              <motion.div
                key="result"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="space-y-6"
              >
                <div className="flex flex-col items-center py-8">
                  {importResult.imported > 0 ? (
                    <>
                      <div className="flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100 dark:bg-emerald-900/30">
                        <CheckCircle2 className="h-8 w-8 text-emerald-600 dark:text-emerald-400" />
                      </div>
                      <h3 className="mt-4 text-lg font-semibold text-black dark:text-white" data-testid="text-import-success">
                        Import Complete
                      </h3>
                      <p className="mt-1 text-sm text-black/50 dark:text-white/50">
                        Successfully imported {importResult.imported} client{importResult.imported !== 1 ? "s" : ""}
                      </p>
                    </>
                  ) : (
                    <>
                      <div className="flex h-16 w-16 items-center justify-center rounded-full bg-red-100 dark:bg-red-900/30">
                        <AlertCircle className="h-8 w-8 text-red-600 dark:text-red-400" />
                      </div>
                      <h3 className="mt-4 text-lg font-semibold text-black dark:text-white" data-testid="text-import-failed">
                        Import Failed
                      </h3>
                      <p className="mt-1 text-sm text-black/50 dark:text-white/50">
                        No clients were imported
                      </p>
                    </>
                  )}
                </div>

                {importResult.errors.length > 0 && (
                  <div className="rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-100 dark:border-red-800 p-4">
                    <h4 className="text-sm font-semibold text-red-700 dark:text-red-300 mb-2">
                      {importResult.errors.length} Error{importResult.errors.length !== 1 ? "s" : ""}
                    </h4>
                    <div className="max-h-40 overflow-y-auto space-y-1">
                      {importResult.errors.map((err, i) => (
                        <p key={i} className="text-xs text-red-600 dark:text-red-400">
                          Row {err.row} (ID: {err.id}): {err.error}
                        </p>
                      ))}
                    </div>
                  </div>
                )}

                <div className="flex justify-center pt-2">
                  <Button
                    size="sm"
                    className="gap-2 rounded-full bg-[#3b82f6] text-white hover:bg-[#3b82f6]/90"
                    onClick={handleClose}
                    data-testid="button-done-import"
                  >
                    Done
                  </Button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </motion.div>
    </div>
  );
}

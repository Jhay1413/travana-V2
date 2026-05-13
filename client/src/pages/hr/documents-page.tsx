import { useState } from "react";
import { AlertTriangle, Clock, FileText, Upload } from "lucide-react";
import { useHR } from "./hr-context";
import { Avatar } from "./avatar";
import { StatCard } from "./dashboard-page";
import { docStatusBadge } from "./helpers";

export function DocumentsPage({ onOpenProfile }: { onOpenProfile: (id: string) => void }) {
  const { employees, uploadDocument } = useHR();
  const [uploadOpen, setUploadOpen] = useState(false);
  const [uploadEmpId, setUploadEmpId] = useState(employees[0]?.id ?? "");
  const [uploadName, setUploadName] = useState("");
  const allDocs = employees.flatMap((e) => e.documents.map((d) => ({ ...d, employee: e })));
  const missing = allDocs.filter((d) => d.status === "Missing");
  const expiring = allDocs.filter((d) => d.status === "Expiring Soon");

  const handleUpload = () => {
    const name = uploadName.trim();
    if (!name || !uploadEmpId) return;
    uploadDocument(uploadEmpId, name);
    setUploadName("");
    setUploadOpen(false);
  };

  return (
    <div className="p-4 md:p-8 space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard label="Documents on file" value={allDocs.length} icon={FileText}        tone="indigo" testId="card-docs-total" />
        <StatCard label="Missing"           value={missing.length} icon={AlertTriangle}   tone="rose"   testId="card-docs-missing" />
        <StatCard label="Expiring soon"     value={expiring.length} icon={Clock}          tone="amber"  testId="card-docs-expiring" />
      </div>

      <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
          <h2 className="text-base font-semibold text-slate-900">Action required</h2>
          <button
            onClick={() => setUploadOpen((v) => !v)}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg"
            data-testid="button-upload-global"
          >
            <Upload className="w-4 h-4" />
            Upload
          </button>
        </div>
        {uploadOpen && (
          <div className="px-5 py-4 border-b border-slate-100 bg-slate-50/60 flex flex-col sm:flex-row gap-2" data-testid="form-upload-global">
            <select
              value={uploadEmpId}
              onChange={(e) => setUploadEmpId(e.target.value)}
              className="px-3 py-2 text-sm border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
              data-testid="select-upload-employee"
            >
              {employees.map((e) => (
                <option key={e.id} value={e.id}>{e.name}</option>
              ))}
            </select>
            <input
              type="text"
              value={uploadName}
              onChange={(e) => setUploadName(e.target.value)}
              placeholder="Document name"
              className="flex-1 px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
              data-testid="input-upload-name"
            />
            <div className="flex gap-2">
              <button
                onClick={() => { setUploadOpen(false); setUploadName(""); }}
                className="px-3 py-2 text-sm font-medium text-slate-600 border border-slate-200 hover:bg-white rounded-lg"
                data-testid="button-upload-cancel"
              >
                Cancel
              </button>
              <button
                onClick={handleUpload}
                disabled={!uploadName.trim()}
                className="px-3 py-2 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg disabled:opacity-50"
                data-testid="button-upload-confirm"
              >
                Save
              </button>
            </div>
          </div>
        )}
        <ul className="divide-y divide-slate-100">
          {[...missing, ...expiring].map((d) => (
            <li
              key={`${d.employee.id}-${d.id}`}
              className="px-5 py-4 flex items-center gap-4"
              data-testid={`row-doc-action-${d.employee.id}-${d.id}`}
            >
              <Avatar employee={d.employee} size="sm" />
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium text-slate-800">{d.name}</div>
                <div className="text-xs text-slate-500">
                  {d.employee.name} · {d.category}
                </div>
              </div>
              <span className={`px-2 py-0.5 rounded-full text-[11px] font-medium border ${docStatusBadge(d.status)}`}>
                {d.status}
              </span>
              <button
                onClick={() => onOpenProfile(d.employee.id)}
                className="text-xs font-medium text-indigo-600 hover:text-indigo-700"
                data-testid={`button-doc-open-${d.employee.id}-${d.id}`}
              >
                Open
              </button>
            </li>
          ))}
          {missing.length + expiring.length === 0 && (
            <li className="p-6 text-center text-sm text-slate-500">All documents are up to date.</li>
          )}
        </ul>
      </div>
    </div>
  );
}

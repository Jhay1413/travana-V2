import { useMemo, useRef, useState } from "react";
import {
  ArrowLeft, CalendarDays, Download, FileText, Loader2, Mail, MapPin, Phone,
  Plus, ShieldCheck, StickyNote, Trash2, Upload, UserCheck,
} from "lucide-react";
import type { Employee } from "./_data";
import { hrApi, type EmployeeRow as ApiEmployeeRow } from "@/features/hr/api/hr.api";
import { useUploadHrDocumentFile, useDeleteHrDocument } from "@/hooks/mutations";
import { useToast } from "@/hooks/use-toast";
import type { ProfileTab } from "./sidebar";
import { useHR } from "./hr-context";
import { Avatar } from "./avatar";
import { statusBadgeClasses, docStatusBadge } from "./helpers";
import { EmployeeEditDialog } from "./employee-edit-dialog";

export function ProfilePage({
  employee, apiEmployee, tab, onTabChange, onBack, onEdited,
}: {
  employee: Employee;
  apiEmployee: ApiEmployeeRow | null;
  tab: ProfileTab;
  onTabChange: (t: ProfileTab) => void;
  onBack: () => void;
  onEdited: () => void;
}) {
  const [editOpen, setEditOpen] = useState(false);
  const tabs: { id: ProfileTab; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
    { id: "overview",  label: "Overview",          icon: UserCheck },
    { id: "documents", label: "Documents",         icon: FileText },
    { id: "holiday",   label: "Holiday & Absence", icon: CalendarDays },
    { id: "notes",     label: "HR Notes",          icon: StickyNote },
  ];

  return (
    <div className="p-4 md:p-8 space-y-6">
      <button
        onClick={onBack}
        className="inline-flex items-center gap-1.5 text-sm text-slate-600 hover:text-slate-900"
        data-testid="button-back-to-directory"
      >
        <ArrowLeft className="w-4 h-4" />
        Back to directory
      </button>

      <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
        <div className="p-6 border-b border-slate-100 flex flex-col md:flex-row md:items-center gap-5">
          <Avatar employee={employee} size="lg" />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-3 flex-wrap">
              <h2 className="text-xl font-semibold text-slate-900" data-testid="text-profile-name">
                {employee.name}
              </h2>
              <span
                className={`px-2 py-0.5 rounded-full text-[11px] font-medium border ${statusBadgeClasses(employee.status)}`}
                data-testid="status-profile"
              >
                {employee.status}
              </span>
            </div>
            <div className="text-sm text-slate-500 mt-1">
              {employee.role} · {employee.team}
            </div>
            <div className="flex flex-wrap items-center gap-4 mt-3 text-xs text-slate-500">
              <span className="flex items-center gap-1.5">
                <Mail className="w-3.5 h-3.5" /> {employee.email}
              </span>
              <span className="flex items-center gap-1.5">
                <Phone className="w-3.5 h-3.5" /> {employee.phone}
              </span>
              <span className="flex items-center gap-1.5">
                <MapPin className="w-3.5 h-3.5" /> {employee.location}
              </span>
            </div>
          </div>
          <div className="flex gap-2 flex-none">
            <button
              className="px-3 py-2 text-sm font-medium text-slate-700 border border-slate-200 hover:bg-slate-50 rounded-lg"
              data-testid="button-profile-message"
            >
              Message
            </button>
            <button
              onClick={() => setEditOpen(true)}
              className="px-3 py-2 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg"
              data-testid="button-profile-edit"
            >
              Edit profile
            </button>
          </div>
        </div>

        <div className="px-2 md:px-6 border-b border-slate-100 overflow-x-auto">
          <div className="flex gap-1 min-w-max">
            {tabs.map((t) => {
              const Icon = t.icon;
              const active = tab === t.id;
              return (
                <button
                  key={t.id}
                  onClick={() => onTabChange(t.id)}
                  data-testid={`tab-${t.id}`}
                  className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                    active
                      ? "border-indigo-600 text-indigo-700"
                      : "border-transparent text-slate-500 hover:text-slate-800"
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  {t.label}
                </button>
              );
            })}
          </div>
        </div>

        <div className="p-6 bg-slate-50/40">
          {tab === "overview"  && <OverviewTab employee={employee} />}
          {tab === "documents" && <DocumentsTab employee={employee} />}
          {tab === "holiday"   && <HolidayTab employee={employee} />}
          {tab === "notes"     && <NotesTab employee={employee} />}
        </div>
      </div>

      <EmployeeEditDialog
        open={editOpen}
        employee={apiEmployee}
        onClose={(changed) => {
          setEditOpen(false);
          if (changed) onEdited();
        }}
      />
    </div>
  );
}

function OverviewTab({ employee }: { employee: Employee }) {
  const fields: { label: string; value: string }[] = [
    { label: "Employment type", value: employee.employmentType },
    { label: "Start date",      value: employee.startDate },
    { label: "Probation end",   value: employee.probationEnd ?? "—" },
    { label: "Manager",         value: employee.manager },
    { label: "Location",        value: employee.location },
    { label: "Team",            value: employee.team },
  ];
  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <div className="lg:col-span-2 space-y-6">
        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm" data-testid="card-basic-details">
          <h3 className="text-sm font-semibold text-slate-900 mb-4">Basic details</h3>
          <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-4">
            {fields.map((f) => (
              <div key={f.label}>
                <dt className="text-xs text-slate-500">{f.label}</dt>
                <dd className="text-sm font-medium text-slate-800 mt-0.5">{f.value}</dd>
              </div>
            ))}
          </dl>
        </div>
        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm" data-testid="card-emergency-contact">
          <h3 className="text-sm font-semibold text-slate-900 mb-4">Emergency contact</h3>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-sm">
            <div>
              <div className="text-xs text-slate-500">Name</div>
              <div className="font-medium text-slate-800">{employee.emergencyContact.name}</div>
            </div>
            <div>
              <div className="text-xs text-slate-500">Relationship</div>
              <div className="font-medium text-slate-800">{employee.emergencyContact.relation}</div>
            </div>
            <div>
              <div className="text-xs text-slate-500">Phone</div>
              <div className="font-medium text-slate-800">{employee.emergencyContact.phone}</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function DocumentsTab({ employee }: { employee: Employee }) {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const { toast } = useToast();
  const upload = useUploadHrDocumentFile();
  const remove = useDeleteHrDocument();

  const grouped = useMemo(() => {
    const map = new Map<string, typeof employee.documents>();
    employee.documents.forEach((d) => {
      const list = map.get(d.category) ?? [];
      list.push(d);
      map.set(d.category, list);
    });
    return Array.from(map.entries());
  }, [employee]);

  const handleFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    for (const file of Array.from(files)) {
      await new Promise<void>((resolve) =>
        upload.mutate(
          { userId: employee.id, file },
          {
            onSuccess: () => {
              toast({ title: "Uploaded", description: `${file.name} attached.` });
              resolve();
            },
            onError: (err: any) => {
              toast({
                title: "Upload failed",
                description: err?.response?.data?.message ?? `Could not upload ${file.name}.`,
                variant: "destructive",
              });
              resolve();
            },
          },
        ),
      );
    }
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-slate-900">Document hub</h3>
          <p className="text-xs text-slate-500 mt-0.5">
            Contracts, policies and certificates · PDF, image, Word, Excel · up to 10MB
          </p>
        </div>
        <button
          onClick={() => fileInputRef.current?.click()}
          disabled={upload.isPending}
          className="inline-flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg disabled:opacity-50"
          data-testid="button-upload-document"
        >
          {upload.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
          Upload
        </button>
        <input
          ref={fileInputRef}
          type="file"
          className="hidden"
          multiple
          accept=".pdf,.jpg,.jpeg,.png,.gif,.webp,.doc,.docx,.xls,.xlsx"
          onChange={(e) => handleFiles(e.target.files)}
          data-testid="input-upload-document"
        />
      </div>
      <div className="space-y-4">
        {grouped.map(([category, docs]) => (
          <div
            key={category}
            className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden"
            data-testid={`card-doc-category-${category.toLowerCase().replace(/\s/g, "-")}`}
          >
            <div className="px-5 py-3 border-b border-slate-100 flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-indigo-500" />
              <h4 className="text-sm font-semibold text-slate-800">{category}</h4>
              <span className="text-xs text-slate-400">({docs.length})</span>
            </div>
            <ul className="divide-y divide-slate-100">
              {docs.map((d) => (
                <li key={d.id} className="px-5 py-3 flex items-center gap-4" data-testid={`row-document-${d.id}`}>
                  <FileText className="w-4 h-4 text-slate-400 flex-none" />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-slate-800 truncate">{d.name}</div>
                    <div className="text-xs text-slate-500">Updated {d.updated}</div>
                  </div>
                  <span
                    className={`px-2 py-0.5 rounded-full text-[11px] font-medium border ${docStatusBadge(d.status)} flex-none`}
                    data-testid={`status-doc-${d.id}`}
                  >
                    {d.status}
                  </span>
                  <a
                    href={hrApi.documentDownloadUrl(employee.id, d.id)}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 text-xs font-medium text-indigo-600 hover:text-indigo-700"
                    data-testid={`button-doc-download-${d.id}`}
                  >
                    <Download className="w-3.5 h-3.5" />
                    Download
                  </a>
                  <button
                    onClick={() => {
                      if (!confirm(`Delete "${d.name}"?`)) return;
                      remove.mutate(
                        { userId: employee.id, docId: d.id },
                        {
                          onError: (err: any) =>
                            toast({
                              title: "Delete failed",
                              description: err?.response?.data?.message ?? "Could not delete document.",
                              variant: "destructive",
                            }),
                        },
                      );
                    }}
                    className="text-slate-400 hover:text-rose-600 p-1"
                    data-testid={`button-doc-delete-${d.id}`}
                    aria-label="Delete document"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </div>
  );
}

function HolidayTab({ employee }: { employee: Employee }) {
  const { approveLeave, rejectLeave } = useHR();
  const remaining = employee.holidayAllowance - employee.holidayUsed;
  const pct = employee.holidayAllowance ? Math.round((employee.holidayUsed / employee.holidayAllowance) * 100) : 0;
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-slate-900">Holiday & absence</h3>
          <p className="text-xs text-slate-500 mt-0.5">Allowance, requests and sick log</p>
        </div>
        <button
          className="inline-flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg"
          data-testid="button-request-leave"
        >
          <Plus className="w-4 h-4" />
          Request leave
        </button>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm" data-testid="card-allowance">
          <div className="text-xs text-slate-500 mb-1">Holiday allowance</div>
          <div className="text-2xl font-semibold text-slate-900">
            {employee.holidayUsed}
            <span className="text-base font-medium text-slate-400"> / {employee.holidayAllowance} days</span>
          </div>
          <div className="h-1.5 bg-slate-100 rounded-full mt-3 overflow-hidden">
            <div className="h-full bg-indigo-500 rounded-full" style={{ width: `${pct}%` }} />
          </div>
          <div className="text-xs text-slate-500 mt-2">{remaining} days remaining</div>
        </div>
        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm" data-testid="card-sick-days">
          <div className="text-xs text-slate-500 mb-1">Sick days YTD</div>
          <div className="text-2xl font-semibold text-slate-900">{employee.sickDaysYTD}</div>
          <div className="text-xs text-slate-500 mt-3">
            {employee.holidays.filter((h) => h.type === "Sick").length} entries logged
          </div>
        </div>
        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm" data-testid="card-pending-approvals">
          <div className="text-xs text-slate-500 mb-1">Pending approvals</div>
          <div className="text-2xl font-semibold text-slate-900">
            {employee.holidays.filter((h) => h.status === "Pending").length}
          </div>
          <div className="text-xs text-slate-500 mt-3">Awaiting manager sign-off</div>
        </div>
      </div>

      <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm" data-testid="card-calendar">
        <div className="flex items-center justify-between mb-3">
          <h4 className="text-sm font-semibold text-slate-800">Absence calendar 2026</h4>
          <span className="text-xs text-slate-400">Approved · Pending · Sick</span>
        </div>
        <div className="grid grid-cols-6 sm:grid-cols-12 gap-1.5">
          {months.map((m, i) => {
            const monthIdx = i + 1;
            const events = employee.holidays.filter((h) => {
              const match = h.from.match(/(\w{3})/);
              return match && months.indexOf(match[1]) + 1 === monthIdx;
            });
            const tone = events[0]
              ? events[0].type === "Sick"
                ? "bg-rose-100 text-rose-700"
                : events[0].status === "Pending"
                  ? "bg-amber-100 text-amber-700"
                  : "bg-emerald-100 text-emerald-700"
              : "bg-slate-50 text-slate-400";
            return (
              <div
                key={m}
                className={`rounded-lg px-2 py-3 text-center text-xs font-medium ${tone}`}
                title={events.map((e) => `${e.type} ${e.from}–${e.to}`).join("\n")}
                data-testid={`calendar-month-${m.toLowerCase()}`}
              >
                {m}
              </div>
            );
          })}
        </div>
      </div>

      <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
        <div className="px-5 py-3 border-b border-slate-100">
          <h4 className="text-sm font-semibold text-slate-800">Recent requests</h4>
        </div>
        <ul className="divide-y divide-slate-100">
          {employee.holidays.map((h) => (
            <li key={h.id} className="px-5 py-3 flex items-center gap-4" data-testid={`row-leave-${h.id}`}>
              <div
                className={`w-2 h-8 rounded-full flex-none ${
                  h.type === "Sick" ? "bg-rose-400"
                  : h.status === "Pending" ? "bg-amber-400"
                  : "bg-emerald-400"
                }`}
              />
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium text-slate-800">
                  {h.type} · {h.from} – {h.to}
                </div>
                <div className="text-xs text-slate-500">
                  {h.days} day{h.days === 1 ? "" : "s"}
                  {h.reason ? ` · ${h.reason}` : ""}
                </div>
              </div>
              <span
                className={`px-2 py-0.5 rounded-full text-[11px] font-medium border ${
                  h.status === "Approved"
                    ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                    : h.status === "Pending"
                      ? "bg-amber-50 text-amber-700 border-amber-200"
                      : "bg-rose-50 text-rose-700 border-rose-200"
                }`}
                data-testid={`status-leave-${h.id}`}
              >
                {h.status}
              </span>
              {h.status === "Pending" && (
                <div className="flex gap-1.5 flex-none">
                  <button
                    onClick={() => rejectLeave(employee.id, h.id)}
                    className="px-2.5 py-1 text-[11px] font-medium text-rose-700 border border-rose-200 bg-white hover:bg-rose-50 rounded-md"
                    data-testid={`button-leave-reject-${h.id}`}
                  >
                    Reject
                  </button>
                  <button
                    onClick={() => approveLeave(employee.id, h.id)}
                    className="px-2.5 py-1 text-[11px] font-medium text-white bg-emerald-600 hover:bg-emerald-700 rounded-md"
                    data-testid={`button-leave-approve-${h.id}`}
                  >
                    Approve
                  </button>
                </div>
              )}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

function NotesTab({ employee }: { employee: Employee }) {
  const { addNote } = useHR();
  const [noteOpen, setNoteOpen] = useState(false);
  const [noteBody, setNoteBody] = useState("");
  const handleSave = () => {
    const body = noteBody.trim();
    if (!body) return;
    addNote(employee.id, body);
    setNoteBody("");
    setNoteOpen(false);
  };
  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-slate-900">HR notes</h3>
          <p className="text-xs text-slate-500 mt-0.5">Private to People team only</p>
        </div>
        <button
          onClick={() => setNoteOpen((v) => !v)}
          className="inline-flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg"
          data-testid="button-add-note"
        >
          <Plus className="w-4 h-4" />
          Add note
        </button>
      </div>
      {noteOpen && (
        <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm space-y-3" data-testid="form-add-note">
          <textarea
            value={noteBody}
            onChange={(e) => setNoteBody(e.target.value)}
            placeholder="Write a private HR note…"
            rows={3}
            className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 resize-none"
            data-testid="input-note-body"
          />
          <div className="flex justify-end gap-2">
            <button
              onClick={() => { setNoteOpen(false); setNoteBody(""); }}
              className="px-3 py-2 text-sm font-medium text-slate-600 border border-slate-200 hover:bg-slate-50 rounded-lg"
              data-testid="button-note-cancel"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={!noteBody.trim()}
              className="px-3 py-2 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg disabled:opacity-50"
              data-testid="button-note-save"
            >
              Save note
            </button>
          </div>
        </div>
      )}
      <ul className="space-y-3">
        {employee.notes.map((n) => (
          <li key={n.id} className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm" data-testid={`row-note-${n.id}`}>
            <div className="flex items-center justify-between mb-2">
              <div className="text-sm font-semibold text-slate-800">{n.author}</div>
              <div className="text-xs text-slate-400">{n.date}</div>
            </div>
            <p className="text-sm text-slate-600 leading-relaxed">{n.body}</p>
          </li>
        ))}
        {employee.notes.length === 0 && (
          <li className="text-sm text-slate-500 text-center py-8 border border-dashed border-slate-200 rounded-2xl bg-white">
            No notes logged yet.
          </li>
        )}
      </ul>
    </div>
  );
}

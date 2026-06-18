import { useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  Briefcase, CalendarCheck, Filter, Mail, MapPin, Search, UserPlus,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { hrKeys } from "@/hooks/queries";
import { useHR } from "./hr-context";
import { Avatar } from "./avatar";
import { statusBadgeClasses } from "./helpers";
import { roles, statuses, locations } from "./_data";
import { InviteEmployeeDialog } from "./invite-employee-dialog";

export function DirectoryPage({
  onOpenProfile,
}: {
  onOpenProfile: (id: string) => void;
}) {
  const { employees } = useHR();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [search, setSearch] = useState("");
  const [role, setRole] = useState<string>("All");
  const [status, setStatus] = useState<string>("All");
  const [location, setLocation] = useState<string>("All");
  const [inviteOpen, setInviteOpen] = useState(false);

  const filtered = useMemo(() => {
    return employees.filter((e) => {
      if (role !== "All" && e.role !== role) return false;
      if (status !== "All" && e.status !== status) return false;
      if (location !== "All" && e.location !== location) return false;
      if (search) {
        const q = search.toLowerCase();
        if (
          !e.name.toLowerCase().includes(q) &&
          !e.role.toLowerCase().includes(q) &&
          !e.team.toLowerCase().includes(q)
        )
          return false;
      }
      return true;
    });
  }, [employees, search, role, status, location]);

  return (
    <div className="p-4 md:p-8 space-y-6">
      <div className="flex items-center justify-between">
        <p className="text-sm text-slate-500">
          {filtered.length} of {employees.length} employees
        </p>
        <button
          onClick={() => setInviteOpen(true)}
          className="inline-flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg"
          data-testid="button-open-invite"
        >
          <UserPlus className="w-4 h-4" />
          Invite employee
        </button>
      </div>

      <InviteEmployeeDialog
        open={inviteOpen}
        onClose={(invitedEmail) => {
          setInviteOpen(false);
          if (invitedEmail) {
            toast({ title: "Invite sent", description: `An invitation has been sent to ${invitedEmail}.` });
            queryClient.invalidateQueries({ queryKey: hrKeys.employees() });
            queryClient.invalidateQueries({ queryKey: hrKeys.reminders() });
          }
        }}
      />

      <div className="bg-white border border-slate-200 rounded-2xl p-4 md:p-5 shadow-sm">
        <div className="flex flex-col lg:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by name, role or team"
              data-testid="input-directory-search"
              className="w-full pl-9 pr-3 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400"
            />
          </div>
          <div className="flex flex-wrap gap-2">
            <FilterSelect label="Role"     value={role}     onChange={setRole}     options={["All", ...roles]}     testId="select-filter-role" />
            <FilterSelect label="Status"   value={status}   onChange={setStatus}   options={["All", ...statuses]}  testId="select-filter-status" />
            <FilterSelect label="Location" value={location} onChange={setLocation} options={["All", ...locations]} testId="select-filter-location" />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
        {filtered.map((e) => (
          <article
            key={e.id}
            className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm hover:shadow-md transition-shadow flex flex-col"
            data-testid={`card-employee-${e.id}`}
          >
            <div className="flex items-start gap-3">
              <Avatar employee={e} />
              <div className="flex-1 min-w-0">
                <div className="font-semibold text-slate-900 truncate" data-testid={`text-name-${e.id}`}>
                  {e.name}
                </div>
                <div className="text-xs text-slate-500 truncate">{e.role}</div>
              </div>
              <span
                className={`px-2 py-0.5 rounded-full text-[11px] font-medium border ${statusBadgeClasses(e.status)} flex-none`}
                data-testid={`status-${e.id}`}
              >
                {e.status}
              </span>
            </div>
            <dl className="mt-4 space-y-1.5 text-xs text-slate-500">
              <div className="flex items-center gap-2">
                <Briefcase className="w-3.5 h-3.5 text-slate-400" />
                <span>{e.team}</span>
              </div>
              <div className="flex items-center gap-2">
                <MapPin className="w-3.5 h-3.5 text-slate-400" />
                <span>{e.location}</span>
              </div>
              <div className="flex items-center gap-2">
                <CalendarCheck className="w-3.5 h-3.5 text-slate-400" />
                <span>Started {e.startDate}</span>
              </div>
            </dl>
            <div className="mt-5 flex gap-2">
              <button
                className="flex-1 inline-flex items-center justify-center gap-1.5 text-xs font-medium text-slate-700 border border-slate-200 hover:bg-slate-50 rounded-lg py-2 transition-colors"
                data-testid={`button-contact-${e.id}`}
              >
                <Mail className="w-3.5 h-3.5" />
                Contact
              </button>
              <button
                onClick={() => onOpenProfile(e.id)}
                className="flex-1 inline-flex items-center justify-center text-xs font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg py-2 transition-colors"
                data-testid={`button-view-profile-${e.id}`}
              >
                View profile
              </button>
            </div>
          </article>
        ))}
        {filtered.length === 0 && (
          <div className="col-span-full text-center text-sm text-slate-500 py-12">
            No employees match those filters.
          </div>
        )}
      </div>
    </div>
  );
}

function FilterSelect({
  label, value, onChange, options, testId,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: string[];
  testId: string;
}) {
  return (
    <label className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs">
      <Filter className="w-3.5 h-3.5 text-slate-400" />
      <span className="text-slate-500">{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        data-testid={testId}
        className="bg-transparent text-slate-800 text-xs font-medium focus:outline-none"
      >
        {options.map((o) => <option key={o} value={o}>{o}</option>)}
      </select>
    </label>
  );
}

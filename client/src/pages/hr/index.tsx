import { useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import type { EmployeeRow as ApiEmployeeRow } from "@/features/hr/api/hr.api";
import {
  useHrEmployees,
  useHrEmployee,
  useHrReminders,
  hrKeys,
} from "@/hooks/queries";
import {
  useApproveLeave,
  useRejectLeave,
  useAddHrNote,
  useAddHrDocument,
} from "@/hooks/mutations";
import type { Employee, Reminder } from "@/features/hr/components/_data";
import { mapApiEmployee, mapApiReminder } from "@/features/hr/components/helpers";
import { HRContext, type HRContextValue } from "@/features/hr/components/hr-context";
import { Sidebar, MobileNav, Header, type View, type ProfileTab } from "@/features/hr/components/sidebar";
import { DashboardPage } from "@/features/hr/components/dashboard-page";
import { DirectoryPage } from "@/features/hr/components/directory-page";
import { ProfilePage } from "@/features/hr/components/profile-page";
import { HolidayPage } from "@/features/hr/components/holiday-page";
import { DocumentsPage } from "@/features/hr/components/documents-page";

export default function HrPage() {
  const [view, setView] = useState<View>({ name: "dashboard" });
  const queryClient = useQueryClient();

  const employeesQuery = useHrEmployees();
  const remindersQuery = useHrReminders();

  // When a profile is open, fetch full detail (holidays/documents/notes) for that user.
  const profileUserId = view.name === "profile" ? view.employeeId : null;
  const profileQuery = useHrEmployee(profileUserId);

  const employees = useMemo<Employee[]>(() => {
    const rows = employeesQuery.data ?? [];
    return rows.map((row) => {
      if (profileQuery.data && profileQuery.data.userId === row.userId) {
        return mapApiEmployee({ ...row, ...profileQuery.data });
      }
      return mapApiEmployee(row);
    });
  }, [employeesQuery.data, profileQuery.data]);

  const apiEmployeeByUserId = useMemo(() => {
    const map = new Map<string, ApiEmployeeRow>();
    for (const row of employeesQuery.data ?? []) map.set(row.userId, row);
    if (profileQuery.data) map.set(profileQuery.data.userId, profileQuery.data);
    return map;
  }, [employeesQuery.data, profileQuery.data]);

  const reminders = useMemo<Reminder[]>(
    () => (remindersQuery.data ?? []).map(mapApiReminder),
    [remindersQuery.data],
  );

  const invalidateAll = () => {
    queryClient.invalidateQueries({ queryKey: hrKeys.employees() });
    queryClient.invalidateQueries({ queryKey: hrKeys.reminders() });
  };

  const approveLeaveMut = useApproveLeave();
  const rejectLeaveMut  = useRejectLeave();
  const addNoteMut      = useAddHrNote();
  const uploadDocumentMut = useAddHrDocument();

  const ctxValue = useMemo<HRContextValue>(
    () => ({
      employees,
      reminders,
      approveLeave: (empId, leaveId) => approveLeaveMut.mutate({ userId: empId, leaveId }),
      rejectLeave:  (empId, leaveId) => rejectLeaveMut.mutate({ userId: empId, leaveId }),
      addNote:      (empId, body)    => addNoteMut.mutate({ userId: empId, body }),
      // Onboarding checklist is not backed by the new API — no-op so HRContext
      // shape stays compatible. The Overview tab no longer mounts the checklist.
      toggleOnboarding: () => {},
      uploadDocument:   (empId, name) => uploadDocumentMut.mutate({ userId: empId, name }),
    }),
    [employees, reminders, approveLeaveMut, rejectLeaveMut, addNoteMut, uploadDocumentMut],
  );

  if (employeesQuery.isLoading || remindersQuery.isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]" data-testid="hr-loading">
        <Loader2 className="h-6 w-6 text-slate-400 animate-spin" />
      </div>
    );
  }

  if (employeesQuery.isError || remindersQuery.isError) {
    return (
      <div className="p-8 text-sm text-rose-600" data-testid="hr-error">
        Failed to load HR data. Please refresh.
      </div>
    );
  }

  const employee =
    view.name === "profile" ? employees.find((e) => e.id === view.employeeId) ?? employees[0] : null;
  const profileTab: ProfileTab = view.name === "profile" ? view.tab ?? "overview" : "overview";

  let title = "HR Dashboard";
  let subtitle: string | undefined = "Travana People · Snapshot of the team";
  if (view.name === "directory") {
    title = "Employee Directory";
    subtitle = `${employees.length} people across the business`;
  } else if (view.name === "profile" && employee) {
    title = employee.name;
    subtitle = `${employee.role} · ${employee.team}`;
  } else if (view.name === "holiday") {
    title = "Holiday & Absence";
    subtitle = "Approvals, calendar and sick log";
  } else if (view.name === "documents") {
    title = "Documents";
    subtitle = "Contracts, policies and certificates";
  }

  return (
    <HRContext.Provider value={ctxValue}>
      <div className="h-full min-h-screen flex bg-slate-50 text-slate-900 font-sans" data-testid="travana-hr-root">
        <Sidebar
          current={view.name === "profile" ? "directory" : view.name}
          onNavigate={setView}
        />
        <div className="flex-1 flex flex-col min-w-0">
          <Header title={title} subtitle={subtitle} />
          <MobileNav
            current={view.name === "profile" ? "directory" : view.name}
            onNavigate={setView}
          />
          <main className="flex-1 overflow-y-auto">
            {view.name === "dashboard" && <DashboardPage onNavigate={setView} />}
            {view.name === "directory" && (
              <DirectoryPage
                key={view.team ?? "all"}
                initialTeam={view.team}
                onOpenProfile={(id) => setView({ name: "profile", employeeId: id })}
              />
            )}
            {view.name === "profile" && employee && (
              <ProfilePage
                employee={employee}
                apiEmployee={apiEmployeeByUserId.get(employee.id) ?? null}
                tab={profileTab}
                onTabChange={(t) => setView({ name: "profile", employeeId: employee.id, tab: t })}
                onBack={() => setView({ name: "directory" })}
                onEdited={invalidateAll}
              />
            )}
            {view.name === "holiday" && (
              <HolidayPage onOpenProfile={(id) => setView({ name: "profile", employeeId: id, tab: "holiday" })} />
            )}
            {view.name === "documents" && (
              <DocumentsPage onOpenProfile={(id) => setView({ name: "profile", employeeId: id, tab: "documents" })} />
            )}
          </main>
        </div>
      </div>
    </HRContext.Provider>
  );
}

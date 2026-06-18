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
import type { Employee, Reminder } from "@/features/hr-v2/components/_data";
import { mapApiEmployee, mapApiReminder } from "@/features/hr-v2/components/helpers";
import { HRContext, type HRContextValue } from "@/features/hr-v2/components/hr-context";
import { TabStrip, type View, type ProfileTab } from "@/features/hr-v2/components/sidebar";
import { DashboardPage } from "@/features/hr-v2/components/dashboard-page";
import { DirectoryPage } from "@/features/hr-v2/components/directory-page";
import { ProfilePage } from "@/features/hr-v2/components/profile-page";
import { HolidayPage } from "@/features/hr-v2/components/holiday-page";
import { DocumentsPage } from "@/features/hr-v2/components/documents-page";
import { OnboardingPage } from "@/features/hr-v2/components/onboarding-page";
import { TrainingPage } from "@/features/hr-v2/components/training-page";

export default function HrV2Page() {
  const [view, setView] = useState<View>({ name: "dashboard" });
  const queryClient = useQueryClient();

  const employeesQuery = useHrEmployees();
  const remindersQuery = useHrReminders();

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
  const rejectLeaveMut = useRejectLeave();
  const addNoteMut = useAddHrNote();
  const uploadDocumentMut = useAddHrDocument();

  const ctxValue = useMemo<HRContextValue>(
    () => ({
      employees,
      reminders,
      approveLeave: (empId, leaveId) => approveLeaveMut.mutate({ userId: empId, leaveId }),
      rejectLeave: (empId, leaveId) => rejectLeaveMut.mutate({ userId: empId, leaveId }),
      addNote: (empId, body) => addNoteMut.mutate({ userId: empId, body }),
      toggleOnboarding: () => {},
      uploadDocument: (empId, name) => uploadDocumentMut.mutate({ userId: empId, name }),
    }),
    [employees, reminders, approveLeaveMut, rejectLeaveMut, addNoteMut, uploadDocumentMut],
  );

  if (employeesQuery.isLoading || remindersQuery.isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]" data-testid="hr-v2-loading">
        <Loader2 className="h-6 w-6 text-slate-400 animate-spin" />
      </div>
    );
  }

  if (employeesQuery.isError || remindersQuery.isError) {
    return (
      <div className="p-8 text-sm text-rose-600" data-testid="hr-v2-error">
        Failed to load HR data. Please refresh.
      </div>
    );
  }

  const employee =
    view.name === "profile"
      ? employees.find((e) => e.id === view.employeeId) ?? employees[0]
      : null;
  const profileTab: ProfileTab = view.name === "profile" ? view.tab ?? "overview" : "overview";

  let title = "HR";
  let subtitle: string | undefined = "Snapshot of the team";
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
  } else if (view.name === "onboarding") {
    title = "Onboarding";
    subtitle = "New starter checklists and probation tracking";
  } else if (view.name === "training") {
    title = "Training & Compliance";
    subtitle = "Certificates, renewals and branch compliance";
  }

  const activeTab: "dashboard" | "directory" | "onboarding" | "holiday" | "training" | "documents" =
    view.name === "profile" ? "directory" : view.name;

  return (
    <HRContext.Provider value={ctxValue}>
      <div className="flex flex-col gap-4" data-testid="hr-v2-root">
        <div>
          <h1 className="text-xl md:text-2xl font-semibold text-slate-900" data-testid="hr-v2-title">
            {title}
          </h1>
          {subtitle && <p className="text-sm text-slate-500">{subtitle}</p>}
        </div>
        <TabStrip current={activeTab} onNavigate={setView} />
        <div className="min-w-0">
          {view.name === "dashboard" && <DashboardPage onNavigate={setView} />}
          {view.name === "directory" && (
            <DirectoryPage
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
            <HolidayPage
              onOpenProfile={(id) => setView({ name: "profile", employeeId: id, tab: "holiday" })}
            />
          )}
          {view.name === "documents" && (
            <DocumentsPage
              onOpenProfile={(id) => setView({ name: "profile", employeeId: id, tab: "documents" })}
            />
          )}
          {view.name === "onboarding" && (
            <OnboardingPage
              onOpenProfile={(id) => setView({ name: "profile", employeeId: id })}
            />
          )}
          {view.name === "training" && (
            <TrainingPage
              onOpenProfile={(id) => setView({ name: "profile", employeeId: id, tab: "documents" })}
            />
          )}
        </div>
      </div>
    </HRContext.Provider>
  );
}

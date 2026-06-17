import { useQuery } from "@tanstack/react-query";
import {
  hrApi,
  type EmployeeDetail,
  type EmployeeRow,
  type HrReminder,
} from "./hr.api";

export const hrKeys = {
  all:       ["hr"] as const,
  employees: () => [...hrKeys.all, "employees"] as const,
  employee:  (userId: string) => [...hrKeys.all, "employees", userId] as const,
  reminders: () => [...hrKeys.all, "reminders"] as const,
  me:        () => [...hrKeys.all, "me"] as const,
};

export function useHrEmployees() {
  return useQuery<EmployeeRow[]>({
    queryKey: hrKeys.employees(),
    queryFn: hrApi.listEmployees,
  });
}

export function useHrEmployee(userId: string | null | undefined) {
  return useQuery<EmployeeDetail>({
    queryKey: hrKeys.employee(userId ?? ""),
    queryFn: () => hrApi.getEmployee(userId as string),
    enabled: !!userId,
  });
}

export function useHrReminders() {
  return useQuery<HrReminder[]>({
    queryKey: hrKeys.reminders(),
    queryFn: hrApi.listReminders,
  });
}

export function useMyHrRecord() {
  return useQuery<EmployeeDetail>({
    queryKey: hrKeys.me(),
    queryFn: hrApi.getMyRecord,
  });
}

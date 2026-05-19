import { createContext, useContext } from "react";
import type { Employee, Reminder } from "./_data";

export interface HRContextValue {
  employees: Employee[];
  reminders: Reminder[];
  approveLeave: (empId: string, leaveId: string) => void;
  rejectLeave: (empId: string, leaveId: string) => void;
  addNote: (empId: string, body: string) => void;
  toggleOnboarding: (empId: string, itemId: string) => void;
  uploadDocument: (empId: string, name: string) => void;
}

export const HRContext = createContext<HRContextValue | null>(null);

export function useHR(): HRContextValue {
  const ctx = useContext(HRContext);
  if (!ctx) throw new Error("HRContext missing");
  return ctx;
}

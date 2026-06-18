import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  hrApi,
  type InviteEmployeeInput,
  type RequestLeaveInput,
  type UpdateEmployeeInput,
} from "./hr.api";
import { hrKeys } from "./use-hr-queries";

function invalidateAllHr(qc: ReturnType<typeof useQueryClient>) {
  qc.invalidateQueries({ queryKey: hrKeys.employees() });
  qc.invalidateQueries({ queryKey: hrKeys.reminders() });
}

export function useInviteEmployee() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: InviteEmployeeInput) => hrApi.invite(input),
    onSuccess: () => invalidateAllHr(qc),
  });
}

export function useUpdateHrEmployee() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ userId, input }: { userId: string; input: UpdateEmployeeInput }) =>
      hrApi.update(userId, input),
    onSuccess: (_, vars) => {
      invalidateAllHr(qc);
      qc.invalidateQueries({ queryKey: hrKeys.employee(vars.userId) });
    },
  });
}

export function useRequestLeave() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ userId, input }: { userId: string; input: RequestLeaveInput }) =>
      hrApi.requestLeave(userId, input),
    onSuccess: (_, vars) => {
      invalidateAllHr(qc);
      qc.invalidateQueries({ queryKey: hrKeys.employee(vars.userId) });
    },
  });
}

export function useApproveLeave() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ userId, leaveId }: { userId: string; leaveId: string }) =>
      hrApi.approveLeave(userId, leaveId),
    onSuccess: (_, vars) => {
      invalidateAllHr(qc);
      qc.invalidateQueries({ queryKey: hrKeys.employee(vars.userId) });
    },
  });
}

export function useRejectLeave() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ userId, leaveId }: { userId: string; leaveId: string }) =>
      hrApi.rejectLeave(userId, leaveId),
    onSuccess: (_, vars) => {
      invalidateAllHr(qc);
      qc.invalidateQueries({ queryKey: hrKeys.employee(vars.userId) });
    },
  });
}

export function useAddHrNote() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ userId, body }: { userId: string; body: string }) =>
      hrApi.addNote(userId, body),
    onSuccess: (_, vars) => {
      invalidateAllHr(qc);
      qc.invalidateQueries({ queryKey: hrKeys.employee(vars.userId) });
    },
  });
}

export function useAddHrDocument() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      userId,
      ...rest
    }: {
      userId: string;
      name: string;
      url?: string;
      category?: Parameters<typeof hrApi.addDocument>[1]["category"];
      status?: Parameters<typeof hrApi.addDocument>[1]["status"];
      expiresAt?: string | null;
    }) => hrApi.addDocument(userId, rest),
    onSuccess: (_, vars) => {
      invalidateAllHr(qc);
      qc.invalidateQueries({ queryKey: hrKeys.employee(vars.userId) });
    },
  });
}

export function useUploadHrDocumentFile() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      userId,
      file,
      name,
      category,
      expiresAt,
    }: {
      userId: string;
      file: File;
      name?: string;
      category?: NonNullable<Parameters<typeof hrApi.uploadDocumentFile>[2]>["category"];
      expiresAt?: string | null;
    }) => hrApi.uploadDocumentFile(userId, file, { name, category, expiresAt }),
    onSuccess: (_, vars) => {
      invalidateAllHr(qc);
      qc.invalidateQueries({ queryKey: hrKeys.employee(vars.userId) });
    },
  });
}

export function useDeleteHrDocument() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ userId, docId }: { userId: string; docId: string }) =>
      hrApi.deleteDocument(userId, docId),
    onSuccess: (_, vars) => {
      invalidateAllHr(qc);
      qc.invalidateQueries({ queryKey: hrKeys.employee(vars.userId) });
    },
  });
}

export function useRequestMyLeave() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: RequestLeaveInput) => hrApi.requestMyLeave(input),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: hrKeys.me() });
      invalidateAllHr(qc);
    },
  });
}

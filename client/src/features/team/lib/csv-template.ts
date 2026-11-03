import { downloadCsv } from "@/lib/csv";
import type { BranchOption } from "./invite-rows";

export const TEMPLATE_FILE_NAME = "travana-team-invite-template.csv";
export const TEMPLATE_HEADER = ["First name", "Last name", "Email", "Role", "Branch"];

const cell = (v: string) => (/[",\r\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);

/** The template text: a header and two example rows. Homeworkers leave the branch empty. */
export function buildTemplateCsv(branches: BranchOption[]): string {
  const branchName = branches[0]?.name ?? "Your branch name";
  const rows = [
    TEMPLATE_HEADER,
    ["Alex", "Taylor", "alex@yourbusiness.example", "Agent", branchName],
    ["Sam", "Rivers", "sam@yourbusiness.example", "Homeworker", ""],
  ];
  return "﻿" + rows.map((r) => r.map(cell).join(",")).join("\r\n");
}

export function downloadTemplate(branches: BranchOption[]): void {
  downloadCsv(TEMPLATE_FILE_NAME, buildTemplateCsv(branches));
}

export { downloadCsv };

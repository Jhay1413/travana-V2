import { downloadCsv } from "@/lib/csv";

export type TemplateKind = "agents" | "team" | "shops";

const TEMPLATES: Record<TemplateKind, { file: string; rows: string[][] }> = {
  agents: {
    file: "travana-agents-template.csv",
    rows: [
      ["First name", "Last name", "Email", "Role"],
      ["Alex", "Taylor", "alex@yourbusiness.example", "Agent"],
      ["Sam", "Rivers", "sam@yourbusiness.example", "Branch Manager"],
    ],
  },
  team: {
    file: "travana-team-template.csv",
    rows: [
      ["First name", "Last name", "Email", "Shop", "Role"],
      ["Alex", "Taylor", "alex@yourbusiness.example", "Shop name, or Homeworker", "Agent"],
    ],
  },
  shops: {
    file: "travana-shops-template.csv",
    rows: [
      ["Shop name", "Address", "Email", "Phone", "Manager email"],
      ["Hetton", "12 Front Street, Hetton", "hetton@yourbusiness.example", "0191 000 0001", "manager@yourbusiness.example"],
    ],
  },
};

const cell = (v: string) => (/[",\r\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);

export function templateCsv(kind: TemplateKind): string {
  return "﻿" + TEMPLATES[kind].rows.map((r) => r.map(cell).join(",")).join("\r\n");
}

export function downloadOnboardingTemplate(kind: TemplateKind): void {
  downloadCsv(TEMPLATES[kind].file, templateCsv(kind));
}

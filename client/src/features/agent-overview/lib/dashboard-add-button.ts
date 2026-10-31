export interface DashboardAddButton {
  kind: "ticket" | "task";
  label: string;
  ariaLabel: string;
}

/** The Agent Dashboard add button: "+ New Ticket" on the Tickets tab, "+ New Task" everywhere else. */
export function dashboardAddButton(tab: string): DashboardAddButton {
  return tab === "tickets"
    ? { kind: "ticket", label: "+ New Ticket", ariaLabel: "New ticket" }
    : { kind: "task", label: "+ New Task", ariaLabel: "New task" };
}

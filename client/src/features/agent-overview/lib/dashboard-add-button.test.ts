import { describe, expect, it } from "vitest";
import { dashboardAddButton } from "./dashboard-add-button";

describe("dashboardAddButton", () => {
  it("offers a new ticket on the Tickets tab", () => {
    expect(dashboardAddButton("tickets")).toEqual({ kind: "ticket", label: "+ New Ticket", ariaLabel: "New ticket" });
  });
  it("offers a new task on every other tab", () => {
    for (const tab of ["tasks", "conversations", "my-courses", "notes"]) {
      expect(dashboardAddButton(tab)).toEqual({ kind: "task", label: "+ New Task", ariaLabel: "New task" });
    }
  });
});

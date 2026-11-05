import { describe, expect, it } from "vitest";
import type { PipelineStage } from "@/features/pipeline/lib/pipeline-helpers";
import { drawerFooterModel } from "./drawer-footer-model";

const STAGES: PipelineStage[] = ["Enquiry", "Quoted", "In Play", "Booked", "Lost", "Future"];

describe("drawerFooterModel", () => {
  it.each(STAGES)("%s: primary action is Open full deal", (stage) => {
    expect(drawerFooterModel(stage).primaryLabel).toBe("Open full deal");
  });

  it("offers Mark as lost only on open stages", () => {
    expect(drawerFooterModel("Enquiry").canMarkLost).toBe(true);
    expect(drawerFooterModel("Quoted").canMarkLost).toBe(true);
    expect(drawerFooterModel("In Play").canMarkLost).toBe(true);
    expect(drawerFooterModel("Future").canMarkLost).toBe(true);
    expect(drawerFooterModel("Booked").canMarkLost).toBe(false);
    expect(drawerFooterModel("Lost").canMarkLost).toBe(false);
  });

  it("disables Open full deal for a non-admin when the client is deleted", () => {
    const m = drawerFooterModel("Quoted", { clientDeleted: true, canOpenDeletedClient: false });
    expect(m.openDisabled).toBe(true);
    expect(m.disabledLabel).toBe("Client deleted");
  });

  it("lets an admin open a deleted client's deal and leaves normal deals alone", () => {
    expect(drawerFooterModel("Quoted", { clientDeleted: true, canOpenDeletedClient: true }).openDisabled).toBe(false);
    expect(drawerFooterModel("Quoted", { clientDeleted: false, canOpenDeletedClient: false }).openDisabled).toBe(false);
    expect(drawerFooterModel("Quoted").disabledLabel).toBeNull();
  });
});

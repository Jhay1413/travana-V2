import { blankPerson, blankShop, seedAgents } from "../lib/rows";
import { reviewOrigin } from "../lib/stepper";
import type { BusinessDraft } from "../lib/schemas";
import type { OnboardingState, PersonRow, ReviewState, ShopRow, Step } from "../types";

export interface WizardState {
  step: Step;
  business: BusinessDraft;
  agents: PersonRow[];
  /** Shops typed but not yet created. Created shops come from the server's branch list. */
  shops: ShopRow[];
  /** Which draft shop card is open for editing. */
  activeShopId: string;
  team: PersonRow[];
  /** Homeworker commission as typed. */
  commission: string;
  /** A parsed spreadsheet waiting to be checked (not saved in the draft). */
  review: ReviewState | null;
  /** Lower-cased emails already invited from the tables (survives reloads, so nobody is invited twice). */
  sentEmails: string[];
  /** Lower-cased manager emails already invited when their shop was created. */
  managerInvited: string[];
}

/** The part of the wizard that survives a reload. */
export interface WizardDraft {
  version: 1;
  step: Step;
  business: BusinessDraft;
  agents: PersonRow[];
  shops: ShopRow[];
  activeShopId: string;
  team: PersonRow[];
  commission: string;
  sentEmails: string[];
  managerInvited: string[];
}

export const STEPS: readonly Step[] = [
  "business",
  "agents",
  "agents-review",
  "shops",
  "shops-review",
  "team",
  "team-review",
  "done",
];

export function initialState(): WizardState {
  const business: BusinessDraft = {
    businessType: "single",
    businessName: "",
    phone: "",
    address: "",
    website: "",
    email: "",
    hasBranchManager: true,
    agentCount: "5",
  };
  const firstShop = blankShop();
  return {
    step: "business",
    business,
    agents: seedAgents(business),
    shops: [firstShop],
    activeShopId: firstShop.id,
    team: [blankPerson(), blankPerson(), blankPerson()],
    commission: "",
    review: null,
    sentEmails: [],
    managerInvited: [],
  };
}

/** Keep a restored step consistent with the business type (single shops have no shops/team screens). */
export function normaliseStep(step: Step, businessType: BusinessDraft["businessType"]): Step {
  // A review screen without its parsed file has nothing to show, so fall back to its origin.
  const s = reviewOrigin(step);
  if (businessType === "single" && (s === "shops" || s === "team")) return "agents";
  if (businessType === "multi" && s === "agents") return "shops";
  return s;
}

/**
 * Fill the form from what the server has saved. Saved values win; blanks keep whatever
 * is in the draft. The owner's email is the fallback for the main business email.
 */
export function mergeServerBusiness(draft: BusinessDraft, server: OnboardingState): BusinessDraft {
  const pick = (saved: string | null | undefined, local: string): string => (saved && saved.trim() ? saved : local);
  return {
    ...draft,
    businessType: server.businessType ?? draft.businessType,
    businessName: pick(server.business.name, draft.businessName),
    phone: pick(server.business.phone, draft.phone),
    address: pick(server.business.address, draft.address),
    website: pick(server.business.website, draft.website),
    email: pick(server.business.email, pick(server.owner.email, draft.email)),
  };
}

/** Start from a saved draft (if any), then lay the server's saved business details over it. */
export function startState(draft: WizardDraft | null, server: OnboardingState): WizardState {
  const base = initialState();
  const merged: WizardState = draft
    ? {
        ...base,
        step: draft.step,
        business: draft.business,
        agents: draft.agents,
        shops: draft.shops,
        activeShopId: draft.activeShopId,
        team: draft.team,
        commission: draft.commission,
        sentEmails: Array.isArray(draft.sentEmails) ? draft.sentEmails : [],
        managerInvited: Array.isArray(draft.managerInvited) ? draft.managerInvited : [],
      }
    : base;
  const business = mergeServerBusiness(merged.business, server);
  const commission =
    merged.commission === "" && server.homeworkerCommission !== null ? String(server.homeworkerCommission) : merged.commission;
  return {
    ...merged,
    business,
    commission,
    step: normaliseStep(merged.step, business.businessType),
  };
}

export type WizardAction = { type: "patch"; patch: Partial<WizardState> };

export function reducer(state: WizardState, action: WizardAction): WizardState {
  switch (action.type) {
    case "patch":
      return { ...state, ...action.patch };
  }
}

export function toDraft(state: WizardState): WizardDraft {
  return {
    version: 1,
    step: state.step,
    business: state.business,
    agents: state.agents,
    shops: state.shops,
    activeShopId: state.activeShopId,
    team: state.team,
    commission: state.commission,
    sentEmails: state.sentEmails,
    managerInvited: state.managerInvited,
  };
}

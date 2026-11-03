import { create } from "zustand";
import type { InviteRow } from "../lib/invite-rows";

export interface InviteDraft {
  rows: InviteRow[];
  fileName: string;
}

interface InviteDraftState {
  draft: InviteDraft | null;
  setDraft: (draft: InviteDraft | null) => void;
}

export const useInviteDraftStore = create<InviteDraftState>((set) => ({
  draft: null,
  setDraft: (draft) => set({ draft }),
}));

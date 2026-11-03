import type { TransactionNote } from "@/features/quote/types";

export interface GroupedNotes {
  /** Top-level notes, including orphaned replies (parent missing), in input order. */
  topLevel: TransactionNote[];
  /** Replies keyed by parent note id, oldest first. Always one level deep. */
  repliesByParent: Map<string, TransactionNote[]>;
}

/**
 * Splits a flat note list into top-level notes and replies.
 *
 * - A reply whose parent is not in the list (deleted / out of scope) is
 *   promoted to top level so it never vanishes.
 * - A reply to a reply is flattened onto the root note's thread (one level).
 */
export function groupNotesByParent(notes: TransactionNote[]): GroupedNotes {
  const byId = new Map(notes.map((n) => [n.id, n]));

  const resolveRootId = (note: TransactionNote): string | null => {
    const seen = new Set<string>([note.id]);
    let parentId = note.parent_id;
    while (parentId) {
      const parent = byId.get(parentId);
      if (!parent) return null;
      if (!parent.parent_id) return parent.id;
      if (seen.has(parent.id)) return null;
      seen.add(parent.id);
      parentId = parent.parent_id;
    }
    return null;
  };

  const topLevel: TransactionNote[] = [];
  const repliesByParent = new Map<string, TransactionNote[]>();
  for (const note of notes) {
    const rootId = note.parent_id ? resolveRootId(note) : null;
    if (!rootId) {
      topLevel.push(note);
      continue;
    }
    const list = repliesByParent.get(rootId) ?? [];
    list.push(note);
    repliesByParent.set(rootId, list);
  }
  for (const list of repliesByParent.values()) {
    list.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
  }
  return { topLevel, repliesByParent };
}

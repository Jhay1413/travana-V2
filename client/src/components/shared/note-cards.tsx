import { useState } from "react";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

export interface NoteCardItem {
  id: string;
  text: string;
  by: string | null;
  when: string | null;
}

export interface NoteCardsProps {
  notes: NoteCardItem[];
  onSave?: (text: string) => Promise<void> | void;
  saving?: boolean;
  placeholder?: string;
  emptyText?: string;
  limit?: number;
  bare?: boolean;
  testIdPrefix?: string;
}

/** Strips HTML tags to plain text. */
export function stripHtml(html: string): string {
  return html.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
}

const HTML_ESCAPES: Record<string, string> = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };

/** Escapes plain text and wraps each non-empty line in a paragraph, for notes that are stored and rendered as HTML. */
export function plainTextToNoteHtml(text: string): string {
  return text
    .split(/\r\n|\r|\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .map((line) => `<p>${line.replace(/[&<>"']/g, (c) => HTML_ESCAPES[c])}</p>`)
    .join("");
}

interface RawNote {
  id: string;
  content?: string | null;
  description?: string | null;
  author_name?: string | null;
  createdAt?: string | null;
}

/** Maps raw notes to cards: plain text, newest first, empty notes dropped. */
export function toNoteCardItems(
  notes: RawNote[],
  formatWhen: (value: string | null | undefined) => string | null,
): NoteCardItem[] {
  return [...notes]
    .sort((a, b) => new Date(b.createdAt ?? 0).getTime() - new Date(a.createdAt ?? 0).getTime())
    .map((n) => ({
      id: n.id,
      text: stripHtml(n.content || n.description || ""),
      by: n.author_name || null,
      when: formatWhen(n.createdAt),
    }))
    .filter((n) => n.text.length > 0);
}

/** Inbox-style notes list: amber cards, newest first, inline add form and a "+N more" toggle. */
export function NoteCards({
  notes,
  onSave,
  saving = false,
  placeholder = "Add a note…",
  emptyText = "No notes yet",
  limit,
  bare = false,
  testIdPrefix = "note-cards",
}: NoteCardsProps) {
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState("");
  const [showAll, setShowAll] = useState(false);

  const canTruncate = limit !== undefined && notes.length > limit;
  const visible = canTruncate && !showAll ? notes.slice(0, limit) : notes;
  const hidden = canTruncate ? notes.length - (limit ?? 0) : 0;

  const save = async () => {
    const text = draft.trim();
    if (!text || !onSave) return;
    try {
      await onSave(text);
      setDraft("");
      setAdding(false);
    } catch {
      // The caller surfaces the error; keep the draft so nothing is lost.
    }
  };

  return (
    <div className={cn(!bare && "rounded-xl border border-social-border p-3")} data-testid={`${testIdPrefix}-list`}>
      {onSave && (
        <div className="mb-2 flex justify-end">
          <button
            type="button"
            className="text-[13px] font-medium text-social-orange-text hover:underline"
            onClick={() => setAdding((v) => !v)}
            data-testid={`${testIdPrefix}-toggle`}
          >
            {adding ? "Cancel" : "Add"}
          </button>
        </div>
      )}
      {adding && onSave && (
        <div className="mb-3 space-y-2">
          <Textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder={placeholder}
            rows={3}
            className="min-h-0 text-[13px]"
            data-testid={`${testIdPrefix}-input`}
          />
          <div className="flex justify-end">
            <button
              type="button"
              onClick={save}
              disabled={!draft.trim() || saving}
              className="h-[34px] rounded-[10px] bg-social-orange px-3.5 text-[13px] font-semibold text-slate-900 disabled:opacity-50"
              data-testid={`${testIdPrefix}-save`}
            >
              Save note
            </button>
          </div>
        </div>
      )}
      {notes.length === 0 ? (
        <p className="text-[13px] text-social-muted">{emptyText}</p>
      ) : (
        <div>
          {visible.map((n) => (
            <div key={n.id} className="mb-2 rounded-[10px] bg-ticket-amber-bg px-3 py-2.5 text-[13px] leading-[1.55]">
              <p className="whitespace-pre-wrap">{n.text}</p>
              <div className="text-[12px] text-social-muted">{[n.by || "Note", n.when].filter(Boolean).join(" · ")}</div>
            </div>
          ))}
          {canTruncate && (
            <button
              type="button"
              className="text-[13px] font-medium text-social-orange-text hover:underline"
              onClick={() => setShowAll((v) => !v)}
              data-testid={`${testIdPrefix}-more`}
            >
              {showAll ? "Show less" : `+${hidden} more`}
            </button>
          )}
        </div>
      )}
    </div>
  );
}

import { useState } from "react";
import type { EmployeeDetail } from "@/features/hr";
import { HomeCard } from "@/features/agent-overview";
import { CARD_BUTTON, CardHead, StatusPill } from "@/features/admin-dashboard";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useAddHrNote } from "@/hooks/mutations";
import { useToast } from "@/hooks/use-toast";
import { dayKeyOf, formatDay } from "../../lib/dates";
import { EmptyBlock } from "../shared/profile-bits";

/** 1-2-1 notes from the HR record; there are no goals because the app does not store them. */
export function NotesCard({ userId, employee, className }: { userId: string; employee: EmployeeDetail; className?: string }) {
  const { toast } = useToast();
  const add = useAddHrNote();
  const [adding, setAdding] = useState(false);
  const [body, setBody] = useState("");
  const notes = [...employee.notes].sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));

  const save = () => {
    const text = body.trim();
    if (!text) return;
    add.mutate(
      { userId, body: text },
      {
        onSuccess: () => {
          setBody("");
          setAdding(false);
        },
        onError: (err: Error) => toast({ title: "Could not save the note", description: err.message, variant: "destructive" }),
      },
    );
  };

  return (
    <HomeCard className={className} testId="hr-notes-card">
      <CardHead
        id="notes-title"
        title="1-2-1 notes"
        pill={<StatusPill tone="plain">Private to managers</StatusPill>}
        right={
          !adding && (
            <button type="button" className={CARD_BUTTON} onClick={() => setAdding(true)} data-testid="button-hr-add-note">
              Add a 1-2-1 note
            </button>
          )
        }
      />
      {adding && (
        <div className="mb-4 flex flex-col gap-2" data-testid="hr-note-form">
          <label htmlFor="hr-note-body" className="text-[12px] text-social-muted xl:text-[13px]">
            Note
          </label>
          <Textarea id="hr-note-body" value={body} onChange={(e) => setBody(e.target.value)} rows={3} autoFocus />
          <div className="flex gap-2">
            <Button size="sm" onClick={save} disabled={!body.trim() || add.isPending} data-testid="button-hr-save-note">
              Save note
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                setAdding(false);
                setBody("");
              }}
              disabled={add.isPending}
            >
              Cancel
            </Button>
          </div>
        </div>
      )}
      {notes.length === 0 ? (
        <EmptyBlock title="No notes yet">Notes from one-to-ones will be listed here.</EmptyBlock>
      ) : (
        <ul className="m-0 list-none divide-y divide-social-border p-0">
          {notes.map((n) => (
            <li key={n.id} className="flex flex-col gap-1 py-3 text-[13px] first:pt-0 last:pb-0 xl:text-[14px]">
              <span className="text-[12px] text-social-muted xl:text-[13px]">
                {formatDay(dayKeyOf(n.createdAt))} · {n.author}
              </span>
              <span className="whitespace-pre-wrap break-words">{n.body}</span>
            </li>
          ))}
        </ul>
      )}
    </HomeCard>
  );
}

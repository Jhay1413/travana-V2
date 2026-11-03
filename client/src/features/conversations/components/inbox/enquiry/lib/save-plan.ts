import { tomorrowAtTen, type EnquiryForm } from "./enquiry-form";
import { readCreated, type CreatedIds } from "./read-created";

export interface SaveOptions {
  form: EnquiryForm;
  assigneeId: string;
  followUp: boolean;
  keepLinked: boolean;
}

export interface SavePlanContext {
  conversationId: string;
  firstName: string;
  now: Date;
}

export interface FollowUpTask {
  title: string;
  description: null;
  dueDate: Date;
  userId: string;
  completed: false;
  notified: false;
  entityType: "enquiry";
  entityId: string;
}

export interface ChatNote {
  conversation_id: string;
  text: string;
}

/** What to do once the create call answered: the optional task and note, or "unreadable". */
export type SavePlan =
  | { kind: "unreadable" }
  | { kind: "created"; created: CreatedIds; title: string; task: FollowUpTask | null; note: ChatNote | null };

/** Decides the follow-up steps from the create response and the agent's toggles. */
export function planSaveSteps(response: unknown, opts: SaveOptions, ctx: SavePlanContext): SavePlan {
  const created = readCreated(response);
  if (!created) return { kind: "unreadable" };
  const title = opts.form.title.trim();
  return {
    kind: "created",
    created,
    title,
    task: opts.followUp
      ? {
          title: `Call ${ctx.firstName} to confirm the details`,
          description: null,
          dueDate: tomorrowAtTen(ctx.now),
          userId: opts.assigneeId,
          completed: false,
          notified: false,
          entityType: "enquiry",
          entityId: created.enquiryId,
        }
      : null,
    note: opts.keepLinked
      ? { conversation_id: ctx.conversationId, text: `Created an enquiry from this chat: ${title}` }
      : null,
  };
}

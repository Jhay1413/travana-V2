import { CalendarCheck, FileText, ListTodo, MessageSquare, Ticket, UserPlus, type LucideIcon } from "lucide-react";

export type CreateKind = "client" | "enquiry" | "quote" | "booking" | "task" | "ticket";

/** The kinds that are deals: they need a client before their form can open. */
export type CreateDealKind = Extract<CreateKind, "enquiry" | "quote" | "booking">;

export interface CreateMenuItem {
  kind: CreateKind;
  label: string;
  icon: LucideIcon;
  /** Draw a separator above this item (start of a new group). */
  groupStart: boolean;
}

/** Groups: [New client] | [Enquiry, Quote, Booking] | [Task, Ticket]. */
export const CREATE_MENU_ITEMS: readonly CreateMenuItem[] = [
  { kind: "client", label: "New client", icon: UserPlus, groupStart: false },
  { kind: "enquiry", label: "Enquiry", icon: MessageSquare, groupStart: true },
  { kind: "quote", label: "Quote", icon: FileText, groupStart: false },
  { kind: "booking", label: "Booking", icon: CalendarCheck, groupStart: false },
  { kind: "task", label: "Task", icon: ListTodo, groupStart: true },
  { kind: "ticket", label: "Ticket", icon: Ticket, groupStart: false },
];

export type CreateRoute = "client-form" | "caller" | "built-in";

/** Who handles a menu pick: a new client always uses the built-in form, the rest
 *  go to the caller's `onCreate` when there is one, else the built-in flow. */
export function resolveCreateRoute(kind: CreateKind, hasOnCreate: boolean): CreateRoute {
  if (kind === "client") return "client-form";
  return hasOnCreate ? "caller" : "built-in";
}

export function isDealKind(kind: CreateKind): kind is CreateDealKind {
  return kind === "enquiry" || kind === "quote" || kind === "booking";
}

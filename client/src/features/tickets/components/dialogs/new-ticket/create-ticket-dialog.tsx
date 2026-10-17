import { useRef } from "react";
import { Loader2, Paperclip, Plus, TicketIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Segmented } from "@/components/ui/segmented";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RichTextEditor } from "@/components/shared/rich-text-editor";
import { useUsers } from "@/hooks/queries";
import { PRIMARY_ACTION, OUTLINE_ACTION } from "@/features/pipeline/shared/button-styles";
import { useNow } from "../../../state/use-now";
import { TICKET_PRIORITIES, TICKET_STATUSES, TICKET_TYPES } from "../../../types";
import type { Ticket, TicketPriorityValue, TicketStatusValue, TicketTypeValue } from "../../../types";
import { DueDateTimeField } from "../../shared/due-date-time-field";
import { KindIcon } from "../../shared/kind-tag";
import { PendingFileChips } from "../../shared/pending-file-chips";
import { LinkToSearch } from "./link-to-search";
import { NewTicketPreview } from "./new-ticket-preview";
import { useNewTicketForm } from "./use-new-ticket-form";

const LABEL = "mb-1.5 text-[13px] text-social-muted";
const CONTROL = "h-10 rounded-[10px] border-social-border bg-card text-[13px]";

interface CreateTicketDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated?: (ticket: Ticket) => void;
  initialClientId?: string;
  initialStatus?: TicketStatusValue;
}

export function CreateTicketDialog({ open, onOpenChange, onCreated, initialClientId, initialStatus }: CreateTicketDialogProps) {
  const now = useNow();
  const { data: users } = useUsers();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { form, patch, setType, pickClient, attachments, submit, isBusy } = useNewTicketForm({
    open,
    initialClientId,
    initialStatus,
    onClose: () => onOpenChange(false),
    onCreated,
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="flex max-h-[calc(100vh-3rem)] w-[calc(100vw-2rem)] max-w-[1120px] flex-col gap-0 overflow-hidden rounded-2xl border-social-border p-0 sm:rounded-2xl"
        data-testid="create-ticket-dialog"
      >
        <div className="flex flex-none items-center gap-3.5 border-b border-social-border px-5 py-4 pr-14 sm:px-7">
          <span className="grid h-11 w-11 flex-none place-items-center rounded-xl bg-social-navy-ink text-white">
            <TicketIcon className="h-[22px] w-[22px]" strokeWidth={2} />
          </span>
          <div className="min-w-0">
            <DialogTitle className="text-[20px] font-semibold leading-tight">New ticket</DialogTitle>
            <DialogDescription className="text-[12px] text-social-muted">
              Link it to a client so everyone sees the full picture.
            </DialogDescription>
          </div>
        </div>

        <div className="flex min-h-0 flex-1">
          <div className="min-w-0 flex-1 overflow-y-auto px-5 py-4 sm:px-7">
            {form.type !== "Build" && (
              <div className="mb-4">
                <div className={LABEL}>Link to <span className="text-status-failed-fg">*</span></div>
                <LinkToSearch client={form.client} onPick={pickClient} transactionId={form.transactionId} onTransactionChange={(transactionId) => patch({ transactionId })} />
              </div>
            )}

            <div className={LABEL}>What kind of ticket?</div>
            <div data-testid="select-type">
              <Segmented<TicketTypeValue>
                label="Kind of ticket"
                variant="black"
                height={42}
                className="w-full"
                itemClassName="flex-1"
                value={form.type}
                onChange={setType}
                items={TICKET_TYPES.map((t) => ({ value: t, label: t, icon: <KindIcon type={t} className="h-4 w-4" />, testId: `select-type-${t}` }))}
              />
            </div>

            <div className="mt-4">
              <div className={LABEL}>Subject <span className="text-status-failed-fg">*</span></div>
              <Input
                data-testid="input-subject"
                value={form.subject}
                onChange={(e) => patch({ subject: e.target.value })}
                placeholder="Brief summary of the issue"
                className={`${CONTROL} h-11 w-full text-[14px]`}
              />
            </div>

            <div className="mt-4">
              <div className={LABEL}>Description</div>
              <div data-testid="input-description">
                <RichTextEditor content={form.description} onChange={(description) => patch({ description })} placeholder="Detailed description of the ticket" />
              </div>
              <div className="mt-2.5 flex flex-wrap items-center gap-2.5">
                <PendingFileChips files={attachments.files} onRemove={attachments.removeFile} testIdPrefix="attachment-file" showSize />
                <input
                  ref={fileInputRef}
                  type="file"
                  multiple
                  accept="image/jpeg,image/png,image/gif,image/webp,application/pdf"
                  hidden
                  onChange={(e) => {
                    if (e.target.files) attachments.addFiles(e.target.files);
                    e.target.value = "";
                  }}
                  data-testid="input-file-attachment"
                />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="inline-flex items-center gap-1.5 rounded-[10px] border-[1.5px] border-dashed border-ticket-dashed px-3.5 py-2 text-[13px] text-social-muted hover:bg-muted"
                  data-testid="button-add-attachment"
                >
                  <Paperclip className="h-3.5 w-3.5" />
                  Add file
                  <span className="text-[11px]">(images or PDF, max 10MB)</span>
                </button>
              </div>
            </div>

            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <div className={LABEL}>Priority</div>
                <div data-testid="select-priority">
                  <Segmented<TicketPriorityValue>
                    label="Priority"
                    variant="black"
                    height={42}
                    className="w-full"
                    itemClassName="flex-1"
                    value={form.priority}
                    onChange={(priority) => patch({ priority })}
                    items={TICKET_PRIORITIES.map((p) => ({ value: p, label: p, testId: `select-priority-${p}` }))}
                  />
                </div>
              </div>
              <div>
                <div className={LABEL}>Assigned to <span className="text-status-failed-fg">*</span></div>
                <Select value={form.assigneeId} onValueChange={(assigneeId) => patch({ assigneeId })}>
                  <SelectTrigger data-testid="select-user" className={CONTROL}>
                    <SelectValue placeholder="Select user" />
                  </SelectTrigger>
                  <SelectContent className="z-[600] max-h-72">
                    {users?.map((u) => (
                      <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <div className={LABEL}>Status</div>
                <Select value={form.status} onValueChange={(status) => patch({ status: status as TicketStatusValue })}>
                  <SelectTrigger data-testid="select-status" className={CONTROL}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="z-[600]">
                    {TICKET_STATUSES.map((s) => (
                      <SelectItem key={s} value={s}>{s}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="sm:col-span-2">
                <div className={LABEL}>Reply due</div>
                <DueDateTimeField value={form.dueDate} onChange={(dueDate) => patch({ dueDate })} testIdPrefix="input-due-date" />
              </div>
            </div>
          </div>
          <NewTicketPreview form={form} now={now} />
        </div>

        <div className="flex flex-none items-center gap-3 border-t border-social-border px-5 py-3 sm:px-7 sm:py-4">
          <span className="hidden flex-1 text-[12px] text-social-muted sm:block">You can change everything later from the ticket.</span>
          <span className="flex-1 sm:hidden" />
          <Button type="button" variant="outline" className={OUTLINE_ACTION} onClick={() => onOpenChange(false)} data-testid="button-cancel-ticket">
            Cancel
          </Button>
          <Button type="button" className={PRIMARY_ACTION} onClick={submit} disabled={isBusy} data-testid="button-create-ticket">
            {isBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
            Create ticket
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

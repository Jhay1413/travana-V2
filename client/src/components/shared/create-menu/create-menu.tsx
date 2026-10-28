import { Fragment, useState, type ReactNode } from "react";
import { useLocation } from "wouter";
import { Plus } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useRole } from "@/hooks/use-role";
import { cn } from "@/lib/utils";
import { ClientFormDrawer, isClientReadOnly, useClientCreateForm } from "@/features/client";
import { CreateFlow, type AfterCreate } from "./create-flows";
import { CREATE_MENU_ITEMS, resolveCreateRoute, type CreateKind } from "./create-kind";

/** The round blue "+" used on every create entry point (same look as the holiday rail). */
const BLUE_TRIGGER =
  "grid size-10 shrink-0 place-items-center rounded-full bg-primary text-primary-foreground transition hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:opacity-50";

const HEADER_TRIGGER =
  "grid h-9 w-9 place-items-center rounded-full border border-white/25 bg-white/5 text-white transition-colors hover:bg-white/15";

interface CreateMenuProps {
  /** Pre-selects the client for every client-bound kind (skips the picker). */
  clientId?: string;
  /** Holiday to pre-select on a ticket. */
  transactionId?: string;
  /** After a successful enquiry / quote / booking: open the new record ("navigate") or stay put. */
  afterCreate?: AfterCreate;
  /** When given, the caller owns the dialogs for every kind except "client". */
  onCreate?: (kind: CreateKind) => void;
  /** "blue" = round blue "+", "header" = outline "+" for the dark app header, or any node. */
  trigger?: "blue" | "header" | ReactNode;
  /** Pixel size of the blue trigger. */
  size?: 36 | 40;
  align?: "start" | "end";
  testId?: string;
}

/** The one standard "+" menu: New client, Enquiry, Quote, Booking, Task, Ticket. */
export function CreateMenu({ clientId, transactionId, afterCreate = "stay", onCreate, trigger = "blue", size = 40, align = "end", testId = "create-menu" }: CreateMenuProps) {
  const [, navigate] = useLocation();
  const { orgRole } = useRole();
  const [active, setActive] = useState<CreateKind | null>(null);
  const [open, setOpen] = useState(false);
  // Bumped on every pick so each flow starts fresh while the previous one may still be finishing a save.
  const [session, setSession] = useState(0);
  const createForm = useClientCreateForm((newClient) => navigate(`/clients/${newClient.id}`));

  if (isClientReadOnly(orgRole)) return null;

  const pick = (kind: CreateKind) => {
    const route = resolveCreateRoute(kind, !!onCreate);
    if (route === "client-form") createForm.openCreateDialog();
    else if (route === "caller") onCreate?.(kind);
    else {
      setActive(kind);
      setOpen(true);
      setSession((s) => s + 1);
    }
  };

  const triggerNode =
    trigger === "header" ? (
      <button type="button" aria-label="Create" title="Create" className={HEADER_TRIGGER} data-testid={testId}>
        <Plus className="h-4 w-4" />
      </button>
    ) : trigger === "blue" ? (
      <button
        type="button"
        aria-label="Create"
        title="Create"
        className={cn(BLUE_TRIGGER, size === 36 && "size-9")}
        data-testid={testId}
      >
        <Plus className="size-[18px]" />
      </button>
    ) : (
      trigger
    );

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>{triggerNode}</DropdownMenuTrigger>
        <DropdownMenuContent align={align} sideOffset={trigger === "header" ? 12 : 4} className="z-[200] w-48 rounded-[10px]">
          {CREATE_MENU_ITEMS.map(({ kind, label, icon: Icon, groupStart }) => (
            <Fragment key={kind}>
              {groupStart && <DropdownMenuSeparator />}
              <DropdownMenuItem onClick={() => pick(kind)} className="gap-2 rounded-[10px] text-sm" data-testid={`${testId}-${kind}`}>
                <Icon className="size-4" /> {label}
              </DropdownMenuItem>
            </Fragment>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>

      <ClientFormDrawer
        mode="add"
        presentation="drawer"
        open={createForm.showNewClient}
        onOpenChange={createForm.setShowNewClient}
        form={createForm.form}
        setForm={createForm.setForm}
        showAddressSection={createForm.showAddressSection}
        setShowAddressSection={createForm.setShowAddressSection}
        postcodeSearch={createForm.postcodeSearch}
        setPostcodeSearch={createForm.setPostcodeSearch}
        postcodeLoading={createForm.postcodeLoading}
        postcodeError={createForm.postcodeError}
        onLookupPostcode={createForm.lookupPostcode}
        onSubmit={createForm.handleCreateClient}
        isPending={createForm.isPending}
      />

      <CreateFlow
        key={session}
        kind={active}
        open={open}
        clientId={clientId}
        transactionId={transactionId}
        afterCreate={afterCreate}
        onOpenChange={setOpen}
      />
    </>
  );
}

import { useState } from "react";
import { useLocation } from "wouter";
import {
  AlertCircle,
  ClipboardList,
  FileText,
  Plus,
  Search,
  Sparkles,
  Ticket,
  UserRound,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { useNeonClients } from "@/hooks/queries";
import { ClientFormDrawer } from "@/features/client/components/modals/ClientFormDrawer";
import { useClientCreateForm } from "@/features/client/components/hooks";

type Intent = "enquiry" | "quote" | "booking" | "task" | "ticket";

export function HeaderCreateMenu() {
  const [, navigate] = useLocation();

  const [showSelectClientDialog, setShowSelectClientDialog] = useState(false);
  const [intent, setIntent] = useState<Intent | null>(null);
  const [selectClientSearch, setSelectClientSearch] = useState("");
  const [selectClientId, setSelectClientId] = useState<string | null>(null);
  const { data: selectClientResults } = useNeonClients({
    page: 1,
    limit: 20,
    search: selectClientSearch.trim() || undefined,
  });

  const createForm = useClientCreateForm((newClient) => navigate(`/clients/${newClient.id}`));

  const openSelectClient = (i: Intent) => {
    setIntent(i);
    setSelectClientSearch("");
    setSelectClientId(null);
    setShowSelectClientDialog(true);
  };

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            aria-label="Create"
            className="grid h-9 w-9 place-items-center rounded-full border border-white/25 bg-white/5 text-white transition-colors hover:bg-white/15"
            data-testid="button-primary-action"
          >
            <Plus className="h-4 w-4" />
          </button>
        </DropdownMenuTrigger>
        {/* Dark navy panel, plain text items — matches the header design. The
            trigger's bottom edge is 10px above the header's (h-14 header, h-9
            button), so 10px would butt the panel against the header edge; 12px
            sits it just below the edge with a 2px gap. */}
        <DropdownMenuContent
          align="start"
          sideOffset={12}
          className="z-[200] w-56 rounded-lg border-0 bg-[#2E3D50] p-3 text-white shadow-xl"
        >
          {(
            [
              { label: "New Client", testid: "menu-item-new-client", onClick: createForm.openCreateDialog },
              { label: "Enquiry", testid: "menu-item-enquiry", onClick: () => openSelectClient("enquiry") },
              { label: "Quote", testid: "menu-item-quote", onClick: () => openSelectClient("quote") },
              { label: "Booking", testid: "menu-item-booking", onClick: () => openSelectClient("booking") },
              { label: "Task", testid: "menu-item-task", onClick: () => openSelectClient("task") },
              { label: "Ticket", testid: "menu-item-ticket", onClick: () => openSelectClient("ticket") },
            ] as const
          ).map((item) => (
            <DropdownMenuItem
              key={item.label}
              className="cursor-pointer rounded-md px-3 py-2 text-[15px] text-white focus:bg-white/10 focus:text-white"
              data-testid={item.testid}
              onClick={item.onClick}
            >
              {item.label}
            </DropdownMenuItem>
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

      <Dialog open={showSelectClientDialog} onOpenChange={setShowSelectClientDialog}>
        <DialogContent className="sm:max-w-[480px] rounded-2xl z-[300]">
          <DialogHeader>
            <DialogTitle>
              Select Client for {intent ? intent.charAt(0).toUpperCase() + intent.slice(1) : ""}
            </DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-black/40 dark:text-white/50" />
              <Input
                value={selectClientSearch}
                onChange={(e) => setSelectClientSearch(e.target.value)}
                placeholder="Search clients…"
                className="h-10 rounded-xl pl-10"
                autoFocus
              />
            </div>
            <div className="max-h-64 overflow-y-auto rounded-xl border border-black/10 dark:border-white/10">
              {selectClientResults?.clients && selectClientResults.clients.length > 0 ? (
                selectClientResults.clients.map((client: any) => (
                  <button
                    key={client.id}
                    onClick={() => setSelectClientId(client.id)}
                    className={cn(
                      "w-full px-4 py-3 text-left border-b border-black/5 dark:border-white/5 last:border-b-0 transition-colors",
                      selectClientId === client.id
                        ? "bg-[#3b82f6]/10 text-[#3b82f6]"
                        : "hover:bg-black/5 dark:hover:bg-white/5"
                    )}
                  >
                    <div className="font-medium text-sm">
                      {client.firstName} {client.surename}
                    </div>
                    <div className="text-xs text-black/50 dark:text-white/50">{client.phoneNumber}</div>
                  </button>
                ))
              ) : (
                <div className="p-4 text-sm text-center text-black/50 dark:text-white/50">
                  {selectClientSearch.trim() ? "No clients found" : "Start typing to search clients"}
                </div>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowSelectClientDialog(false)}
              className="rounded-xl"
            >
              Cancel
            </Button>
            <Button
              disabled={!selectClientId}
              onClick={() => {
                if (selectClientId && intent) {
                  setShowSelectClientDialog(false);
                  navigate(`/clients/${selectClientId}?create=${intent}`);
                }
              }}
              className="rounded-xl bg-[#3b82f6] text-white hover:bg-[#3b82f6]/90"
            >
              Continue
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

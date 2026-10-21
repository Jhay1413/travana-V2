import { useState } from "react";
import { Check } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandInput, CommandList, CommandEmpty, CommandGroup, CommandItem } from "@/components/ui/command";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Spinner } from "@/components/ui/spinner";
import { cn } from "@/lib/utils";
import { useUsers } from "@/hooks/queries";
import { useUpdateTransaction } from "@/hooks/mutations";
import { useToast } from "@/hooks/use-toast";
import type { User } from "@/features/user/types";

// ─── Assigned agent avatar + reallocate popover ─────────────────────────────
// A round avatar with a "live" status dot; clicking it opens a searchable list
// of sales agents (same pattern as UserReassignSelect) to reassign the deal's
// owning transaction to someone else.

export function AssignedAgentButton({
  transactionId,
  userId,
  onReallocated,
}: {
  transactionId: string;
  userId?: string | null;
  onReallocated: () => void;
}) {
  const [open, setOpen] = useState(false);
  const { toast } = useToast();
  const { data: users } = useUsers({ salesAgentsOnly: true });
  const updateTransactionMutation = useUpdateTransaction();

  const currentAgent = users?.find((u) => u.id === userId);
  const avatarUrl = currentAgent?.image ?? currentAgent?.profileImageUrl ?? currentAgent?.avatar ?? null;
  const initial = currentAgent?.name?.charAt(0).toUpperCase() ?? "?";

  function handleSelect(agent: User) {
    setOpen(false);
    if (agent.id === userId || updateTransactionMutation.isPending) return;
    updateTransactionMutation.mutate(
      { id: transactionId, data: { user_id: agent.id } },
      {
        onSuccess: () => {
          toast({ title: `Reallocated to ${agent.name}` });
          onReallocated();
        },
        onError: () => toast({ title: "Failed to reallocate", variant: "destructive" }),
      },
    );
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <Tooltip>
        <TooltipTrigger asChild>
          <PopoverTrigger asChild>
            <button
              type="button"
              className="relative h-9 w-9 shrink-0 rounded-full"
              aria-label="Reallocate deal"
              data-testid="client-header-agent"
            >
              {avatarUrl ? (
                <img src={avatarUrl} alt="" className="h-9 w-9 rounded-full object-cover" />
              ) : (
                <span className="grid h-9 w-9 place-items-center rounded-full bg-avatar-blue-bg text-xs font-bold text-avatar-blue-fg">
                  {initial}
                </span>
              )}
              <span className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-white bg-emerald-500" />
              {updateTransactionMutation.isPending && (
                <span className="absolute inset-0 grid place-items-center rounded-full bg-white/70 dark:bg-black/50">
                  <Spinner className="h-4 w-4" />
                </span>
              )}
            </button>
          </PopoverTrigger>
        </TooltipTrigger>
        <TooltipContent>
          Assigned to {currentAgent?.name ?? "Unassigned"} · click to reallocate
        </TooltipContent>
      </Tooltip>
      <PopoverContent align="end" className="w-64 p-0">
        <Command>
          <CommandInput placeholder="Search agents…" />
          <CommandList>
            <CommandEmpty>No agents found.</CommandEmpty>
            <CommandGroup>
              {users?.map((user) => (
                <CommandItem key={user.id} value={user.name} onSelect={() => handleSelect(user)}>
                  <Check className={cn("mr-2 h-4 w-4", user.id === userId ? "opacity-100" : "opacity-0")} />
                  <div className="flex flex-col">
                    <span className="font-medium">{user.name}</span>
                    <span className="text-xs text-muted-foreground">{user.role}</span>
                  </div>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

import { useState } from "react";
import { Check, ChevronsUpDown, User as UserIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Command,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandGroup,
  CommandItem,
} from "@/components/ui/command";
import { useUsers } from "@/hooks/queries";
import { Spinner } from "@/components/ui/spinner";

interface UserReassignSelectProps {
  value: string;
  onValueChange: (userId: string) => void;
  className?: string;
  "data-testid"?: string;
  /** If true, prepends an "All Agents" option (value = "all") */
  allowAll?: boolean;
  /** Label shown when allowAll is true and value === "all" */
  allLabel?: string;
}

export function UserReassignSelect({
  value,
  onValueChange,
  className,
  "data-testid": dataTestId,
  allowAll = false,
  allLabel = "All Agents",
}: UserReassignSelectProps) {
  const [open, setOpen] = useState(false);
  const { data: users, isLoading } = useUsers();

  const isAll = allowAll && value === "all";
  const selectedUser = isAll ? null : users?.find((user) => user.id === value);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          role="combobox"
          aria-expanded={open}
          className={cn(
            "inline-flex w-full flex-row-reverse items-center justify-end gap-2 rounded-full border border-black/10 bg-white/70 px-1.5 py-1 text-[11px] font-semibold text-black/70 transition hover:bg-black/[0.03]",
            !value && "text-muted-foreground",
            className
          )}
          data-testid={dataTestId}
        >
          <span
            className="relative grid h-6 w-6 shrink-0 overflow-hidden rounded-full border border-black/10 bg-white/70 shadow-[0_10px_22px_-18px_rgba(0,0,0,0.35)]"
            aria-hidden
          >
            {isAll ? (
              <UserIcon className="h-full w-full p-0.5 text-black/40" />
            ) : (
              <>
                <img
                  src="/attached_assets/Avatar3_1769960371403.png"
                  alt=""
                  className="h-full w-full object-cover"
                />
                <span className="pointer-events-none absolute inset-0 ring-1 ring-white/40" aria-hidden />
              </>
            )}
          </span>

          <span className="flex flex-1 flex-col items-end leading-tight">
            <span className="whitespace-nowrap">
              {isAll ? allLabel : selectedUser ? selectedUser.name : "Select user..."}
            </span>
            {selectedUser && !isAll && (
              <span className="whitespace-nowrap text-[10px] font-semibold text-black/50">{selectedUser.role}</span>
            )}
          </span>
        </button>
      </PopoverTrigger>
      <PopoverContent className="z-[500] w-[--radix-popover-trigger-width] p-0" align="start">
        <Command>
          <CommandInput placeholder="Search users..." />
          <CommandList>
            {isLoading ? (
              <div className="flex items-center justify-center py-6">
                <Spinner className="h-5 w-5" />
              </div>
            ) : (
              <>
                <CommandEmpty>No users found.</CommandEmpty>
                <CommandGroup>
                  {allowAll && (
                    <CommandItem
                      value="__all__"
                      onSelect={() => {
                        onValueChange("all");
                        setOpen(false);
                      }}
                    >
                      <Check
                        className={cn("mr-2 h-4 w-4", value === "all" ? "opacity-100" : "opacity-0")}
                      />
                      <div className="flex flex-col">
                        <span className="font-medium">{allLabel}</span>
                      </div>
                    </CommandItem>
                  )}
                  {users?.map((user) => (
                    <CommandItem
                      key={user.id}
                      value={user.name}
                      onSelect={() => {
                        onValueChange(user.id);
                        setOpen(false);
                      }}
                    >
                      <Check
                        className={cn(
                          "mr-2 h-4 w-4",
                          value === user.id ? "opacity-100" : "opacity-0"
                        )}
                      />
                      <div className="flex flex-col">
                        <span className="font-medium">{user.name}</span>
                        <span className="text-xs text-muted-foreground">{user.role}</span>
                      </div>
                    </CommandItem>
                  ))}
                </CommandGroup>
              </>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

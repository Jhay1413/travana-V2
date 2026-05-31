import { useState } from "react";
import { useLocation } from "wouter";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  AlertCircle,
  ChevronDown,
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
import { Label } from "@/components/ui/label";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { neonClientApi } from "@/api";
import { useNeonClients } from "@/hooks/queries";

type Intent = "enquiry" | "quote" | "booking" | "task" | "ticket";

const EMPTY_FORM = {
  clientType: "New Client",
  title: "",
  firstName: "",
  lastName: "",
  phone: "",
  email: "",
  houseNumber: "",
  street: "",
  city: "",
  country: "",
  postcode: "",
};

export function HeaderCreateMenu() {
  const [, navigate] = useLocation();
  const queryClient = useQueryClient();

  const [showNewClientDialog, setShowNewClientDialog] = useState(false);
  const [showSelectClientDialog, setShowSelectClientDialog] = useState(false);
  const [intent, setIntent] = useState<Intent | null>(null);
  const [selectClientSearch, setSelectClientSearch] = useState("");
  const [selectClientId, setSelectClientId] = useState<string | null>(null);
  const { data: selectClientResults } = useNeonClients({
    page: 1,
    limit: 20,
    search: selectClientSearch.trim() || undefined,
  });

  const [newClientForm, setNewClientForm] = useState(EMPTY_FORM);
  const [showAddressSection, setShowAddressSection] = useState(false);
  const [postcodeSearch, setPostcodeSearch] = useState("");
  const [postcodeLoading, setPostcodeLoading] = useState(false);
  const [postcodeError, setPostcodeError] = useState("");

  const createNeonClientMutation = useMutation({
    mutationFn: (data: Record<string, any>) => neonClientApi.create(data as any),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["neon-clients"] });
    },
  });

  const lookupPostcode = async () => {
    if (!postcodeSearch.trim()) return;
    setPostcodeLoading(true);
    setPostcodeError("");
    try {
      const response = await fetch(
        `https://api.postcodes.io/postcodes/${encodeURIComponent(postcodeSearch.trim())}`
      );
      const data = await response.json();
      if (data.status === 200 && data.result) {
        const result = data.result;
        setNewClientForm((f) => ({
          ...f,
          city: result.admin_district || result.primary_care_trust || result.admin_county || "",
          country: result.country || "United Kingdom",
          postcode: result.postcode || postcodeSearch.trim(),
        }));
        setPostcodeError("Postcode found! Please enter house number and street manually.");
      } else {
        setPostcodeError("Postcode not found. Please enter address manually.");
      }
    } catch {
      setPostcodeError("Failed to lookup postcode. Please enter address manually.");
    } finally {
      setPostcodeLoading(false);
    }
  };

  const handleCreateClient = () => {
    if (!newClientForm.firstName || !newClientForm.lastName || !newClientForm.phone) return;
    createNeonClientMutation.mutate(
      {
        firstName: newClientForm.firstName,
        surename: newClientForm.lastName,
        phoneNumber: newClientForm.phone,
        title: newClientForm.title || undefined,
        email: newClientForm.email || undefined,
        badge: newClientForm.clientType || undefined,
        houseNumber: newClientForm.houseNumber || undefined,
        street: newClientForm.street || undefined,
        city: newClientForm.city || undefined,
        country: newClientForm.country || undefined,
        post_code: newClientForm.postcode || undefined,
      },
      {
        onSuccess: (newClient: any) => {
          setShowNewClientDialog(false);
          setNewClientForm(EMPTY_FORM);
          setPostcodeSearch("");
          setShowAddressSection(false);
          setPostcodeError("");
          navigate(`/clients/${newClient.id}`);
        },
      }
    );
  };

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
          <Button
            className="flex h-8 items-center gap-1.5 rounded-full bg-[#3b82f6] px-3 text-[11px] font-semibold text-white hover:bg-[#3b82f6]/90"
            data-testid="button-primary-action"
          >
            <Plus className="h-3.5 w-3.5" />
            Create
            <ChevronDown className="h-3.5 w-3.5" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-48 rounded-xl z-[200]">
          <DropdownMenuItem
            className="cursor-pointer"
            data-testid="menu-item-new-client"
            onClick={() => {
              setShowAddressSection(false);
              setShowNewClientDialog(true);
            }}
          >
            <UserRound className="mr-2 h-4 w-4" />
            New Client
          </DropdownMenuItem>
          <DropdownMenuItem
            className="cursor-pointer"
            data-testid="menu-item-enquiry"
            onClick={() => openSelectClient("enquiry")}
          >
            <Sparkles className="mr-2 h-4 w-4" />
            Enquiry
          </DropdownMenuItem>
          <DropdownMenuItem
            className="cursor-pointer"
            data-testid="menu-item-quote"
            onClick={() => openSelectClient("quote")}
          >
            <FileText className="mr-2 h-4 w-4" />
            Quote
          </DropdownMenuItem>
          <DropdownMenuItem
            className="cursor-pointer"
            data-testid="menu-item-booking"
            onClick={() => openSelectClient("booking")}
          >
            <Ticket className="mr-2 h-4 w-4" />
            Booking
          </DropdownMenuItem>
          <DropdownMenuItem
            className="cursor-pointer"
            data-testid="menu-item-task"
            onClick={() => openSelectClient("task")}
          >
            <ClipboardList className="mr-2 h-4 w-4" />
            Task
          </DropdownMenuItem>
          <DropdownMenuItem
            className="cursor-pointer"
            data-testid="menu-item-ticket"
            onClick={() => openSelectClient("ticket")}
          >
            <AlertCircle className="mr-2 h-4 w-4" />
            Ticket
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={showNewClientDialog} onOpenChange={setShowNewClientDialog}>
        <DialogContent className="sm:max-w-[500px] rounded-2xl z-[300]">
          <DialogHeader>
            <DialogTitle>New Client</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="clientType">Client Type</Label>
              <Select
                value={newClientForm.clientType}
                onValueChange={(value) => setNewClientForm({ ...newClientForm, clientType: value })}
              >
                <SelectTrigger id="clientType" className="rounded-xl" data-testid="select-client-type">
                  <SelectValue placeholder="Select client type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Time Waster">Time Waster</SelectItem>
                  <SelectItem value="New Client">New Client</SelectItem>
                  <SelectItem value="Repeat Client">Repeat Client</SelectItem>
                  <SelectItem value="VIP Client">VIP Client</SelectItem>
                  <SelectItem value="Family Member">Family Member</SelectItem>
                  <SelectItem value="Banned">Banned</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="title">Title</Label>
              <Select
                value={newClientForm.title}
                onValueChange={(value) => setNewClientForm({ ...newClientForm, title: value })}
              >
                <SelectTrigger id="title" className="rounded-xl" data-testid="select-title">
                  <SelectValue placeholder="Select title" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Mr.">Mr.</SelectItem>
                  <SelectItem value="Mrs">Mrs</SelectItem>
                  <SelectItem value="Ms">Ms</SelectItem>
                  <SelectItem value="Miss">Miss</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="firstName">First Name *</Label>
                <Input
                  id="firstName"
                  value={newClientForm.firstName}
                  onChange={(e) => setNewClientForm({ ...newClientForm, firstName: e.target.value })}
                  className="rounded-xl"
                  data-testid="input-first-name"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="lastName">Last Name *</Label>
                <Input
                  id="lastName"
                  value={newClientForm.lastName}
                  onChange={(e) => setNewClientForm({ ...newClientForm, lastName: e.target.value })}
                  className="rounded-xl"
                  data-testid="input-last-name"
                />
              </div>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="phone">Phone Number *</Label>
              <Input
                id="phone"
                value={newClientForm.phone}
                onChange={(e) => setNewClientForm({ ...newClientForm, phone: e.target.value })}
                className="rounded-xl"
                data-testid="input-phone"
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="email">Email (optional)</Label>
              <Input
                id="email"
                type="email"
                value={newClientForm.email}
                onChange={(e) => setNewClientForm({ ...newClientForm, email: e.target.value })}
                className="rounded-xl"
                data-testid="input-email"
              />
            </div>

            <button
              type="button"
              onClick={() => setShowAddressSection(!showAddressSection)}
              className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors py-1"
              data-testid="button-toggle-address"
            >
              <ChevronDown
                className={`h-4 w-4 transition-transform ${showAddressSection ? "rotate-0" : "-rotate-90"}`}
              />
              Address (optional)
            </button>

            {showAddressSection && (
              <div className="grid gap-2">
                <div className="grid gap-4">
                  <div className="grid gap-2">
                    <Label htmlFor="postcodeSearch" className="text-xs">Postcode Search</Label>
                    <div className="flex gap-2">
                      <Input
                        id="postcodeSearch"
                        value={postcodeSearch}
                        onChange={(e) => setPostcodeSearch(e.target.value.toUpperCase())}
                        onKeyDown={(e) =>
                          e.key === "Enter" && (e.preventDefault(), lookupPostcode())
                        }
                        placeholder="Enter postcode (e.g. SW1A 1AA)"
                        className="rounded-xl flex-1"
                        data-testid="input-postcode-search"
                      />
                      <Button
                        type="button"
                        onClick={lookupPostcode}
                        disabled={postcodeLoading || !postcodeSearch.trim()}
                        className="rounded-xl bg-[#3b82f6] text-white hover:bg-[#3b82f6]/90"
                        data-testid="button-lookup-postcode"
                      >
                        {postcodeLoading ? (
                          <span className="flex items-center gap-2">
                            <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                            Looking up...
                          </span>
                        ) : (
                          <>
                            <Search className="mr-2 h-4 w-4" />
                            Find
                          </>
                        )}
                      </Button>
                    </div>
                    {postcodeError && (
                      <p
                        className={`text-xs ${
                          postcodeError.includes("found!") ? "text-green-600" : "text-red-500"
                        }`}
                      >
                        {postcodeError}
                      </p>
                    )}
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="grid gap-2">
                      <Label htmlFor="houseNumber" className="text-xs">House Number</Label>
                      <Input
                        id="houseNumber"
                        value={newClientForm.houseNumber}
                        onChange={(e) => setNewClientForm({ ...newClientForm, houseNumber: e.target.value })}
                        className="rounded-xl"
                        data-testid="input-house-number"
                      />
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="street" className="text-xs">Street</Label>
                      <Input
                        id="street"
                        value={newClientForm.street}
                        onChange={(e) => setNewClientForm({ ...newClientForm, street: e.target.value })}
                        className="rounded-xl"
                        data-testid="input-street"
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="grid gap-2">
                      <Label htmlFor="city" className="text-xs">City</Label>
                      <Input
                        id="city"
                        value={newClientForm.city}
                        onChange={(e) => setNewClientForm({ ...newClientForm, city: e.target.value })}
                        className="rounded-xl"
                        data-testid="input-city"
                      />
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="country" className="text-xs">Country</Label>
                      <Input
                        id="country"
                        value={newClientForm.country}
                        onChange={(e) => setNewClientForm({ ...newClientForm, country: e.target.value })}
                        className="rounded-xl"
                        data-testid="input-country"
                      />
                    </div>
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="postcode" className="text-xs">Postcode</Label>
                    <Input
                      id="postcode"
                      value={newClientForm.postcode}
                      onChange={(e) => setNewClientForm({ ...newClientForm, postcode: e.target.value })}
                      className="rounded-xl w-1/2"
                      data-testid="input-postcode"
                    />
                  </div>
                </div>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowNewClientDialog(false)}
              className="rounded-xl"
              data-testid="button-cancel-client"
            >
              Cancel
            </Button>
            <Button
              onClick={handleCreateClient}
              disabled={
                !newClientForm.firstName ||
                !newClientForm.lastName ||
                !newClientForm.phone ||
                createNeonClientMutation.isPending
              }
              className="rounded-xl bg-[#3b82f6] text-white hover:bg-[#3b82f6]/90"
              data-testid="button-save-client"
            >
              {createNeonClientMutation.isPending ? "Creating..." : "Create Client"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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

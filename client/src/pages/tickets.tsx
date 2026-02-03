import { useState } from "react";
import { motion } from "framer-motion";
import { Link } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { CommandCenterShell, type Role } from "@/components/command-center-shell";
import {
  AlertCircle,
  Calendar,
  ChevronRight,
  Filter,
  LifeBuoy,
  Plus,
  Search,
  User,
  Users,
  X,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { fetchTickets, fetchClients, fetchUsers, createTicket, updateTicket, deleteTicket, type Ticket, type Client, type User as ApiUser } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";

const TICKET_TYPES = ["Admin", "Build", "Sales"] as const;
const TICKET_STATUSES = ["Open", "In Progress", "Resolved", "Closed"] as const;
const TICKET_PRIORITIES = ["Low", "Medium", "High", "Urgent"] as const;

function formatDate(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

function typePill(type: string) {
  switch (type) {
    case "Admin":
      return "border-violet-500/25 bg-violet-500/10 text-violet-700";
    case "Build":
      return "border-sky-500/25 bg-sky-500/10 text-sky-700";
    case "Sales":
      return "border-emerald-500/25 bg-emerald-500/10 text-emerald-700";
    default:
      return "border-black/10 bg-black/[0.03] text-black/70";
  }
}

function statusPill(status: string) {
  switch (status) {
    case "Open":
      return "border-red-500/25 bg-red-500/10 text-red-700";
    case "In Progress":
      return "border-amber-500/25 bg-amber-500/10 text-amber-700";
    case "Resolved":
      return "border-emerald-500/25 bg-emerald-500/10 text-emerald-700";
    case "Closed":
      return "border-black/10 bg-black/[0.03] text-black/70";
    default:
      return "border-black/10 bg-black/[0.03] text-black/70";
  }
}

function priorityPill(priority: string) {
  switch (priority) {
    case "Urgent":
      return "border-red-600/30 bg-red-600/15 text-red-700";
    case "High":
      return "border-orange-500/25 bg-orange-500/10 text-orange-700";
    case "Medium":
      return "border-amber-500/25 bg-amber-500/10 text-amber-700";
    case "Low":
      return "border-slate-500/25 bg-slate-500/10 text-slate-600";
    default:
      return "border-black/10 bg-black/[0.03] text-black/70";
  }
}

export default function TicketsPage() {
  const [role, setRole] = useState<Role>("Agent");
  const [query, setQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [priorityFilter, setPriorityFilter] = useState<string>("all");
  const [showFilters, setShowFilters] = useState(false);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [editingTicket, setEditingTicket] = useState<Ticket | null>(null);
  const [formData, setFormData] = useState({
    clientId: "",
    userId: "",
    type: "Sales" as string,
    status: "Open" as string,
    priority: "Medium" as string,
    subject: "",
    description: "",
  });

  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: tickets, isLoading: ticketsLoading } = useQuery({
    queryKey: ["tickets"],
    queryFn: fetchTickets,
  });

  const { data: clients } = useQuery({
    queryKey: ["clients"],
    queryFn: fetchClients,
  });

  const { data: users } = useQuery({
    queryKey: ["users"],
    queryFn: fetchUsers,
  });

  const createMutation = useMutation({
    mutationFn: createTicket,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tickets"] });
      setShowCreateDialog(false);
      resetForm();
      toast({ title: "Ticket created successfully" });
    },
    onError: () => {
      toast({ title: "Failed to create ticket", variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<Ticket> }) => updateTicket(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tickets"] });
      setEditingTicket(null);
      resetForm();
      toast({ title: "Ticket updated successfully" });
    },
    onError: () => {
      toast({ title: "Failed to update ticket", variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: deleteTicket,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tickets"] });
      setEditingTicket(null);
      toast({ title: "Ticket deleted successfully" });
    },
    onError: () => {
      toast({ title: "Failed to delete ticket", variant: "destructive" });
    },
  });

  const resetForm = () => {
    setFormData({
      clientId: "",
      userId: "",
      type: "Sales",
      status: "Open",
      priority: "Medium",
      subject: "",
      description: "",
    });
  };

  const handleCreate = () => {
    if (!formData.clientId || !formData.userId || !formData.subject) {
      toast({ title: "Please fill in all required fields", variant: "destructive" });
      return;
    }
    createMutation.mutate({
      clientId: formData.clientId,
      userId: formData.userId,
      type: formData.type,
      status: formData.status,
      priority: formData.priority,
      subject: formData.subject,
      description: formData.description || null,
    });
  };

  const handleUpdate = () => {
    if (!editingTicket) return;
    updateMutation.mutate({
      id: editingTicket.id,
      data: {
        type: formData.type,
        status: formData.status,
        priority: formData.priority,
        subject: formData.subject,
        description: formData.description || null,
      },
    });
  };

  const handleDelete = () => {
    if (!editingTicket) return;
    deleteMutation.mutate(editingTicket.id);
  };

  const openEditDialog = (ticket: Ticket) => {
    setFormData({
      clientId: ticket.clientId,
      userId: ticket.userId,
      type: ticket.type,
      status: ticket.status,
      priority: ticket.priority,
      subject: ticket.subject,
      description: ticket.description || "",
    });
    setEditingTicket(ticket);
  };

  const filteredTickets = tickets?.filter((ticket) => {
    const matchesQuery =
      query === "" ||
      ticket.subject.toLowerCase().includes(query.toLowerCase()) ||
      ticket.description?.toLowerCase().includes(query.toLowerCase());
    const matchesType = typeFilter === "all" || ticket.type === typeFilter;
    const matchesStatus = statusFilter === "all" || ticket.status === statusFilter;
    const matchesPriority = priorityFilter === "all" || ticket.priority === priorityFilter;
    return matchesQuery && matchesType && matchesStatus && matchesPriority;
  });

  const getClientName = (clientId: string) => {
    const client = clients?.find((c) => c.id === clientId);
    return client?.name || "Unknown Client";
  };

  const getUserName = (userId: string) => {
    const user = users?.find((u) => u.id === userId);
    return user?.name || "Unassigned";
  };

  const activeFiltersCount = [typeFilter, statusFilter, priorityFilter].filter((f) => f !== "all").length;

  return (
    <CommandCenterShell
      active="tickets"
      title="Tickets"
      subtitle="Support tickets and tasks"
      query={query}
      onQuery={setQuery}
      role={role}
      onRoleChange={setRole}
    >
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="space-y-4"
      >
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-2 flex-1">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-black/40" />
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search tickets..."
                className="pl-10 rounded-2xl border-black/10 bg-white/60"
                data-testid="input-search-tickets"
              />
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowFilters(!showFilters)}
              className={`rounded-2xl gap-2 ${activeFiltersCount > 0 ? "border-blue-500 bg-blue-50" : ""}`}
              data-testid="button-toggle-filters"
            >
              <Filter className="h-4 w-4" />
              Filters
              {activeFiltersCount > 0 && (
                <Badge className="bg-blue-500 text-white text-xs px-1.5">{activeFiltersCount}</Badge>
              )}
            </Button>
          </div>
          <Button
            onClick={() => {
              resetForm();
              setShowCreateDialog(true);
            }}
            className="rounded-2xl gap-2 bg-black text-white hover:bg-black/80"
            data-testid="button-create-ticket"
          >
            <Plus className="h-4 w-4" />
            New Ticket
          </Button>
        </div>

        {showFilters && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="flex items-center gap-3 flex-wrap"
          >
            <Select value={typeFilter} onValueChange={setTypeFilter}>
              <SelectTrigger className="w-[140px] rounded-2xl" data-testid="select-type-filter">
                <SelectValue placeholder="Type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                {TICKET_TYPES.map((type) => (
                  <SelectItem key={type} value={type}>
                    {type}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[160px] rounded-2xl" data-testid="select-status-filter">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                {TICKET_STATUSES.map((status) => (
                  <SelectItem key={status} value={status}>
                    {status}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={priorityFilter} onValueChange={setPriorityFilter}>
              <SelectTrigger className="w-[140px] rounded-2xl" data-testid="select-priority-filter">
                <SelectValue placeholder="Priority" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Priorities</SelectItem>
                {TICKET_PRIORITIES.map((priority) => (
                  <SelectItem key={priority} value={priority}>
                    {priority}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {activeFiltersCount > 0 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setTypeFilter("all");
                  setStatusFilter("all");
                  setPriorityFilter("all");
                }}
                className="text-black/50 hover:text-black"
                data-testid="button-clear-filters"
              >
                <X className="h-4 w-4 mr-1" />
                Clear
              </Button>
            )}
          </motion.div>
        )}

        {ticketsLoading ? (
          <div className="flex justify-center py-12">
            <Spinner />
          </div>
        ) : !filteredTickets?.length ? (
          <Card className="glass ringed grain rounded-3xl p-8 text-center">
            <LifeBuoy className="h-12 w-12 mx-auto text-black/20 mb-4" />
            <h3 className="text-lg font-medium text-black/70 mb-2">No tickets found</h3>
            <p className="text-sm text-black/50 mb-4">
              {query || activeFiltersCount > 0
                ? "Try adjusting your search or filters"
                : "Create your first ticket to get started"}
            </p>
            {!(query || activeFiltersCount > 0) && (
              <Button
                onClick={() => {
                  resetForm();
                  setShowCreateDialog(true);
                }}
                className="rounded-2xl"
                data-testid="button-create-first-ticket"
              >
                <Plus className="h-4 w-4 mr-2" />
                Create Ticket
              </Button>
            )}
          </Card>
        ) : (
          <div className="grid gap-3">
            {filteredTickets.map((ticket) => (
              <motion.div
                key={ticket.id}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                whileHover={{ scale: 1.005 }}
                className="cursor-pointer"
                onClick={() => openEditDialog(ticket)}
                data-testid={`card-ticket-${ticket.id}`}
              >
                <Card className="glass ringed grain rounded-2xl p-4 hover:shadow-lg transition-shadow">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-2 flex-wrap">
                        <Badge className={`rounded-full text-xs ${typePill(ticket.type)}`}>
                          {ticket.type}
                        </Badge>
                        <Badge className={`rounded-full text-xs ${statusPill(ticket.status)}`}>
                          {ticket.status}
                        </Badge>
                        <Badge className={`rounded-full text-xs ${priorityPill(ticket.priority)}`}>
                          {ticket.priority}
                        </Badge>
                      </div>
                      <h3 className="font-medium text-black/90 truncate" data-testid={`text-subject-${ticket.id}`}>
                        {ticket.subject}
                      </h3>
                      {ticket.description && (
                        <p className="text-sm text-black/50 line-clamp-2 mt-1">{ticket.description}</p>
                      )}
                      <div className="flex items-center gap-4 mt-3 text-xs text-black/50">
                        <span className="flex items-center gap-1">
                          <Users className="h-3.5 w-3.5" />
                          {getClientName(ticket.clientId)}
                        </span>
                        <span className="flex items-center gap-1">
                          <User className="h-3.5 w-3.5" />
                          {getUserName(ticket.userId)}
                        </span>
                        <span className="flex items-center gap-1">
                          <Calendar className="h-3.5 w-3.5" />
                          {formatDate(ticket.createdAt)}
                        </span>
                      </div>
                    </div>
                    <ChevronRight className="h-5 w-5 text-black/30 flex-shrink-0" />
                  </div>
                </Card>
              </motion.div>
            ))}
          </div>
        )}
      </motion.div>

      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Create New Ticket</DialogTitle>
            <DialogDescription>Create a support ticket for a client</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="client">Customer *</Label>
              <Select value={formData.clientId} onValueChange={(v) => setFormData({ ...formData, clientId: v })}>
                <SelectTrigger data-testid="select-client">
                  <SelectValue placeholder="Select customer" />
                </SelectTrigger>
                <SelectContent>
                  {clients?.map((client) => (
                    <SelectItem key={client.id} value={client.id}>
                      {client.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="user">Assigned To *</Label>
              <Select value={formData.userId} onValueChange={(v) => setFormData({ ...formData, userId: v })}>
                <SelectTrigger data-testid="select-user">
                  <SelectValue placeholder="Select user" />
                </SelectTrigger>
                <SelectContent>
                  {users?.map((user) => (
                    <SelectItem key={user.id} value={user.id}>
                      {user.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div className="grid gap-2">
                <Label>Type</Label>
                <Select value={formData.type} onValueChange={(v) => setFormData({ ...formData, type: v })}>
                  <SelectTrigger data-testid="select-type">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {TICKET_TYPES.map((type) => (
                      <SelectItem key={type} value={type}>
                        {type}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label>Status</Label>
                <Select value={formData.status} onValueChange={(v) => setFormData({ ...formData, status: v })}>
                  <SelectTrigger data-testid="select-status">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {TICKET_STATUSES.map((status) => (
                      <SelectItem key={status} value={status}>
                        {status}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label>Priority</Label>
                <Select value={formData.priority} onValueChange={(v) => setFormData({ ...formData, priority: v })}>
                  <SelectTrigger data-testid="select-priority">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {TICKET_PRIORITIES.map((priority) => (
                      <SelectItem key={priority} value={priority}>
                        {priority}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="subject">Subject *</Label>
              <Input
                id="subject"
                value={formData.subject}
                onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
                placeholder="Brief summary of the issue"
                data-testid="input-subject"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Detailed description of the ticket"
                rows={4}
                data-testid="input-description"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreateDialog(false)} data-testid="button-cancel">
              Cancel
            </Button>
            <Button
              onClick={handleCreate}
              disabled={createMutation.isPending}
              data-testid="button-submit-create"
            >
              {createMutation.isPending ? "Creating..." : "Create Ticket"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!editingTicket} onOpenChange={() => setEditingTicket(null)}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Edit Ticket</DialogTitle>
            <DialogDescription>Update ticket details</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label>Customer</Label>
              <div className="text-sm text-black/70 bg-black/5 px-3 py-2 rounded-lg">
                {editingTicket && getClientName(editingTicket.clientId)}
              </div>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div className="grid gap-2">
                <Label>Type</Label>
                <Select value={formData.type} onValueChange={(v) => setFormData({ ...formData, type: v })}>
                  <SelectTrigger data-testid="edit-select-type">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {TICKET_TYPES.map((type) => (
                      <SelectItem key={type} value={type}>
                        {type}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label>Status</Label>
                <Select value={formData.status} onValueChange={(v) => setFormData({ ...formData, status: v })}>
                  <SelectTrigger data-testid="edit-select-status">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {TICKET_STATUSES.map((status) => (
                      <SelectItem key={status} value={status}>
                        {status}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label>Priority</Label>
                <Select value={formData.priority} onValueChange={(v) => setFormData({ ...formData, priority: v })}>
                  <SelectTrigger data-testid="edit-select-priority">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {TICKET_PRIORITIES.map((priority) => (
                      <SelectItem key={priority} value={priority}>
                        {priority}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="edit-subject">Subject *</Label>
              <Input
                id="edit-subject"
                value={formData.subject}
                onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
                placeholder="Brief summary of the issue"
                data-testid="edit-input-subject"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="edit-description">Description</Label>
              <Textarea
                id="edit-description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Detailed description of the ticket"
                rows={4}
                data-testid="edit-input-description"
              />
            </div>
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={deleteMutation.isPending}
              className="mr-auto"
              data-testid="button-delete-ticket"
            >
              {deleteMutation.isPending ? "Deleting..." : "Delete"}
            </Button>
            <Button variant="outline" onClick={() => setEditingTicket(null)} data-testid="button-cancel-edit">
              Cancel
            </Button>
            <Button
              onClick={handleUpdate}
              disabled={updateMutation.isPending}
              data-testid="button-submit-update"
            >
              {updateMutation.isPending ? "Saving..." : "Save Changes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </CommandCenterShell>
  );
}

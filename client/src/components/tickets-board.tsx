import { useState, useRef, useEffect } from "react";
import { motion } from "framer-motion";
import { Link } from "wouter";
import {
  Calendar,
  ChevronRight,
  FileText,
  Filter,
  Image,
  LifeBuoy,
  Paperclip,
  Plus,
  Search,
  Upload,
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
import { useTickets, useNeonClients, useUsers, useCurrentUser } from "@/hooks/queries";
import { useCreateTicket } from "@/hooks/mutations";
import { useToast } from "@/hooks/use-toast";
import { attachmentApi } from "@/api";

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

export default function TicketsBoard() {
  const [query, setQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("active");
  const [priorityFilter, setPriorityFilter] = useState<string>("all");
  const [agentFilter, setAgentFilter] = useState<string>("me");
  const [showFilters, setShowFilters] = useState(true);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [customerSearch, setCustomerSearch] = useState("");
  const [showCustomerDropdown, setShowCustomerDropdown] = useState(false);
  const [selectedCustomerName, setSelectedCustomerName] = useState("");
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const customerDropdownRef = useRef<HTMLDivElement>(null);
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

  const { data: tickets, isLoading: ticketsLoading } = useTickets();

  const { data: neonClientsData } = useNeonClients({ page: 1, limit: 20, search: customerSearch });

  const { data: users } = useUsers();
  const { data: currentUser } = useCurrentUser();

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (customerDropdownRef.current && !customerDropdownRef.current.contains(e.target as Node)) {
        setShowCustomerDropdown(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const createTicketMutation = useCreateTicket();

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
    setCustomerSearch("");
    setSelectedCustomerName("");
    setShowCustomerDropdown(false);
    setPendingFiles([]);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;
    const allowed = ["image/jpeg", "image/png", "image/gif", "image/webp", "application/pdf"];
    const maxSize = 10 * 1024 * 1024;
    const newFiles: File[] = [];
    for (let i = 0; i < files.length; i++) {
      const f = files[i];
      if (!allowed.includes(f.type)) {
        toast({ title: `${f.name}: Only images and PDFs are allowed`, variant: "destructive" });
        continue;
      }
      if (f.size > maxSize) {
        toast({ title: `${f.name}: File too large (max 10MB)`, variant: "destructive" });
        continue;
      }
      newFiles.push(f);
    }
    setPendingFiles((prev) => [...prev, ...newFiles]);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const removePendingFile = (index: number) => {
    setPendingFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const getFileIcon = (type: string) => {
    if (type.startsWith("image/")) return <Image className="h-4 w-4 text-blue-500" />;
    return <FileText className="h-4 w-4 text-red-500" />;
  };

  const handleCreate = () => {
    const needsClient = formData.type !== "Build";
    if ((needsClient && !formData.clientId) || !formData.userId || !formData.subject) {
      toast({ title: "Please fill in all required fields", variant: "destructive" });
      return;
    }
    setIsUploading(true);
    createTicketMutation.mutate({
      clientId: formData.type === "Build" ? null : formData.clientId,
      userId: currentUser?.id || formData.userId,
      assignedTo: formData.userId,
      type: formData.type,
      status: formData.status,
      priority: formData.priority,
      subject: formData.subject,
      description: formData.description || null,
    }, {
      onSuccess: async (data: any) => {
        const ticketId = data?.id;
        if (ticketId && pendingFiles.length > 0) {
          let uploaded = 0;
          let failed = 0;
          for (const file of pendingFiles) {
            try {
              await attachmentApi.upload(ticketId, file);
              uploaded++;
            } catch {
              failed++;
            }
          }
          if (failed > 0) {
            toast({ title: `Ticket created. ${uploaded} file(s) uploaded, ${failed} failed.`, variant: "destructive" });
          } else {
            toast({ title: `Ticket created with ${uploaded} attachment(s)` });
          }
        } else {
          toast({ title: "Ticket created successfully" });
        }
        setShowCreateDialog(false);
        resetForm();
        setIsUploading(false);
      },
      onError: () => {
        toast({ title: "Failed to create ticket", variant: "destructive" });
        setIsUploading(false);
      },
    });
  };

  const filteredTickets = tickets?.filter((ticket) => {
    const matchesQuery =
      query === "" ||
      ticket.subject.toLowerCase().includes(query.toLowerCase()) ||
      ticket.description?.toLowerCase().includes(query.toLowerCase());
    const matchesType = typeFilter === "all" || ticket.type === typeFilter;
    const matchesStatus = statusFilter === "all" || (statusFilter === "active" ? (ticket.status !== "Resolved" && ticket.status !== "Closed") : ticket.status === statusFilter);
    const matchesPriority = priorityFilter === "all" || ticket.priority === priorityFilter;
    const myId = currentUser?.id;
    let matchesAgent = true;
    if (agentFilter === "me") {
      const assignedToMe = ticket.assignedTo === myId || (!ticket.assignedTo && ticket.userId === myId);
      const iCreatedAndReassigned = ticket.userId === myId && ticket.assignedTo && ticket.assignedTo !== myId && (ticket.replyCount || 0) > 0;
      matchesAgent = assignedToMe || !!iCreatedAndReassigned;
    } else if (agentFilter !== "all") {
      matchesAgent = ticket.assignedTo === agentFilter || ticket.userId === agentFilter;
    }
    return matchesQuery && matchesType && matchesStatus && matchesPriority && matchesAgent;
  });

  const getClientName = (ticket: { clientName?: string | null; clientId: string }) => {
    const name = ticket.clientName?.trim();
    return name && name !== "null" ? name : "Unknown Client";
  };

  const getUserName = (ticket: { userName?: string | null; userId: string; assignedTo?: string | null; assignedToName?: string | null }) => {
    if (ticket.assignedToName) return ticket.assignedToName;
    if (ticket.assignedTo) {
      const assignee = users?.find((u) => u.id === ticket.assignedTo);
      if (assignee?.name) return assignee.name;
    }
    if (ticket.userName) return ticket.userName;
    const u = users?.find((usr) => usr.id === ticket.userId);
    return u?.name || "Unassigned";
  };

  const activeFiltersCount = [typeFilter, priorityFilter].filter((f) => f !== "all").length + (statusFilter !== "active" && statusFilter !== "all" ? 1 : 0) + (agentFilter !== "me" && agentFilter !== "all" ? 1 : 0);

  return (
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
          className="rounded-2xl gap-2 bg-[#3b82f6] text-white hover:bg-[#3b82f6]/80"
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
              <SelectItem value="active">Active (Open & In Progress)</SelectItem>
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
          <Select value={agentFilter} onValueChange={setAgentFilter}>
            <SelectTrigger className="w-[160px] rounded-2xl" data-testid="select-agent-filter">
              <SelectValue placeholder="Agent" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="me">My Tickets</SelectItem>
              <SelectItem value="all">All Agents</SelectItem>
              {users?.map((user) => (
                <SelectItem key={user.id} value={user.id}>
                  {user.name}
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
                setStatusFilter("active");
                setPriorityFilter("all");
                setAgentFilter("me");
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
            <Link key={ticket.id} href={`/tickets/${ticket.id}`}>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              whileHover={{ scale: 1.005 }}
              className="cursor-pointer"
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
                        {getClientName(ticket)}
                      </span>
                      <span className="flex items-center gap-1">
                        <User className="h-3.5 w-3.5" />
                        {getUserName(ticket)}
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
            </Link>
          ))}
        </div>
      )}

      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Create New Ticket</DialogTitle>
            <DialogDescription>Create a support ticket for a client</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            {formData.type !== "Build" && (
            <div className="grid gap-2">
              <Label htmlFor="client">Customer *</Label>
              <div className="relative" ref={customerDropdownRef}>
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  data-testid="select-client"
                  placeholder="Search customers..."
                  value={selectedCustomerName || customerSearch}
                  onChange={(e) => {
                    setCustomerSearch(e.target.value);
                    setSelectedCustomerName("");
                    setFormData({ ...formData, clientId: "" });
                    setShowCustomerDropdown(true);
                  }}
                  onFocus={() => setShowCustomerDropdown(true)}
                  className="pl-9"
                />
                {showCustomerDropdown && customerSearch.length >= 1 && (
                  <div className="absolute z-50 mt-1 max-h-48 w-full overflow-y-auto rounded-xl border border-black/10 bg-white shadow-lg">
                    {neonClientsData?.clients && neonClientsData.clients.length > 0 ? (
                      neonClientsData.clients.map((c) => (
                        <button
                          key={c.id}
                          type="button"
                          className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-black/5"
                          data-testid={`customer-option-${c.id}`}
                          onClick={() => {
                            const displayName = `${c.title && c.title !== "NULL" ? c.title + " " : ""}${c.firstName || ""} ${c.surename || ""}`.trim();
                            setFormData({ ...formData, clientId: c.id });
                            setSelectedCustomerName(displayName);
                            setCustomerSearch("");
                            setShowCustomerDropdown(false);
                          }}
                        >
                          <User className="h-3.5 w-3.5 text-muted-foreground" />
                          <span>{c.title && c.title !== "NULL" ? c.title + " " : ""}{c.firstName} {c.surename}</span>
                          {c.phoneNumber && <span className="ml-auto text-xs text-muted-foreground">{c.phoneNumber}</span>}
                        </button>
                      ))
                    ) : (
                      <div className="px-3 py-2 text-sm text-muted-foreground">No customers found</div>
                    )}
                  </div>
                )}
              </div>
            </div>
            )}
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
                <Select value={formData.type} onValueChange={(v) => {
                    const updates: any = { type: v };
                    if (v === "Build") { updates.clientId = ""; }
                    setFormData({ ...formData, ...updates });
                    if (v === "Build") { setSelectedCustomerName(""); setCustomerSearch(""); }
                  }}>
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
            <div className="grid gap-2">
              <Label>Attachments</Label>
              <input
                ref={fileInputRef}
                type="file"
                multiple
                accept="image/jpeg,image/png,image/gif,image/webp,application/pdf"
                onChange={handleFileSelect}
                className="hidden"
                data-testid="input-file-attachment"
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="rounded-xl border-2 border-dashed border-black/20 bg-black/[0.02] p-4 text-center hover:border-black/40 hover:bg-black/[0.04] transition-colors cursor-pointer"
                data-testid="button-add-attachment"
              >
                <Upload className="h-5 w-5 mx-auto text-black/40 mb-1" />
                <p className="text-sm text-black/60 font-medium">Click to attach files</p>
                <p className="text-xs text-black/40 mt-0.5">Images (JPG, PNG, GIF, WebP) and PDF - max 10MB each</p>
              </button>
              {pendingFiles.length > 0 && (
                <div className="space-y-1.5 mt-1">
                  {pendingFiles.map((file, index) => (
                    <div
                      key={`${file.name}-${index}`}
                      className="flex items-center gap-2 rounded-lg border border-black/10 bg-black/[0.02] px-3 py-2"
                      data-testid={`attachment-file-${index}`}
                    >
                      {getFileIcon(file.type)}
                      <span className="text-sm text-black/70 flex-1 truncate">{file.name}</span>
                      <span className="text-xs text-black/40">{formatFileSize(file.size)}</span>
                      <button
                        type="button"
                        onClick={() => removePendingFile(index)}
                        className="text-black/30 hover:text-red-500 transition-colors"
                        data-testid={`button-remove-file-${index}`}
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreateDialog(false)} data-testid="button-cancel">
              Cancel
            </Button>
            <Button
              onClick={handleCreate}
              disabled={createTicketMutation.isPending || isUploading}
              data-testid="button-submit-create"
            >
              {isUploading ? "Uploading files..." : createTicketMutation.isPending ? "Creating..." : "Create Ticket"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </motion.div>
  );
}

import React, { useState } from 'react';
import { 
  Search, 
  Plus, 
  MoreVertical, 
  MessageSquare, 
  Paperclip, 
  Send,
  Calendar,
  User,
  Tag,
  Clock,
  Edit3
} from 'lucide-react';

type Priority = 'Urgent' | 'High' | 'Medium' | 'Low';
type Status = 'Open' | 'In Progress' | 'Resolved' | 'Closed';

interface Reply {
  id: string;
  author: string;
  date: string;
  message: string;
}

interface Ticket {
  id: string;
  subject: string;
  type: string;
  status: Status;
  priority: Priority;
  assignedTo: string;
  client: string;
  created: string;
  description: string;
  replies: Reply[];
}

const mockTickets: Ticket[] = [
  {
    id: 't-1',
    subject: "Social Posts",
    type: "Build",
    status: "Open",
    priority: "Urgent",
    assignedTo: "Jhon",
    client: "Tina",
    created: "14/03/2026",
    description: "On social posts we need a filter by what has been scheduled or posted rather than all the quotes. The default should be posted or scheduled.",
    replies: [
      { id: 'r-1', author: 'Jhon', date: '14/03/2026 10:30', message: "I'll look into adding the filter options this week." },
      { id: 'r-2', author: 'James', date: '14/03/2026 11:15', message: "Great, make sure it also shows the date scheduled." }
    ]
  },
  {
    id: 't-2',
    subject: "Flight rebooking for Smiths",
    type: "Sales",
    status: "Open",
    priority: "High",
    assignedTo: "James",
    client: "Mr Smith",
    created: "15/03/2026",
    description: "The Smiths need their outbound flight changed from Manchester to Newcastle due to road closures. TUI booking ref TUI-8832.",
    replies: []
  },
  {
    id: 't-3',
    subject: "Commission report error",
    type: "Admin",
    status: "In Progress",
    priority: "Medium",
    assignedTo: "Jhon",
    client: "N/A",
    created: "13/03/2026",
    description: "The monthly commission report is showing incorrect figures for March. The Jet2 bookings seem to be duplicated.",
    replies: [
      { id: 'r-3', author: 'Jhon', date: '13/03/2026 09:00', message: "Found the issue - duplicate entries in the import." },
      { id: 'r-4', author: 'James', date: '13/03/2026 09:30', message: "Can you fix and regenerate?" },
      { id: 'r-5', author: 'Jhon', date: '13/03/2026 10:45', message: "Done, regenerating now." }
    ]
  },
  {
    id: 't-4',
    subject: "Hotel upgrade request",
    type: "Sales",
    status: "In Progress",
    priority: "High",
    assignedTo: "James",
    client: "Mrs Johnson",
    created: "16/03/2026",
    description: "Mrs Johnson has requested an upgrade to a sea-view room at the Riu Palace. Currently booked standard room.",
    replies: [
      { id: 'r-6', author: 'James', date: '16/03/2026 14:20', message: "Contacted Riu, waiting on availability." }
    ]
  },
  {
    id: 't-5',
    subject: "Website banner update",
    type: "Build",
    status: "In Progress",
    priority: "Low",
    assignedTo: "Jhon",
    client: "Tina",
    created: "12/03/2026",
    description: "Update the homepage banner to feature the new summer holiday deals.",
    replies: []
  },
  {
    id: 't-6',
    subject: "Refund processed - Garcia",
    type: "Sales",
    status: "Resolved",
    priority: "Medium",
    assignedTo: "James",
    client: "Mr Garcia",
    created: "10/03/2026",
    description: "Refund for the cancelled excursion has been processed.",
    replies: []
  },
  {
    id: 't-7',
    subject: "Email templates updated",
    type: "Build",
    status: "Resolved",
    priority: "Low",
    assignedTo: "Jhon",
    client: "Tina",
    created: "11/03/2026",
    description: "Updated the booking confirmation email templates with new branding.",
    replies: []
  },
  {
    id: 't-8',
    subject: "Old booking query",
    type: "Sales",
    status: "Closed",
    priority: "Low",
    assignedTo: "James",
    client: "Mrs Taylor",
    created: "05/03/2026",
    description: "Query regarding a booking from last year. Resolved over the phone.",
    replies: []
  }
];

const getPriorityColor = (priority: Priority) => {
  switch (priority) {
    case 'Urgent': return 'bg-red-500';
    case 'High': return 'bg-orange-500';
    case 'Medium': return 'bg-yellow-500';
    case 'Low': return 'bg-blue-400';
    default: return 'bg-gray-400';
  }
};

const getStatusBadge = (status: Status) => {
  switch (status) {
    case 'Open': return 'bg-blue-100 text-blue-700 border-blue-200';
    case 'In Progress': return 'bg-purple-100 text-purple-700 border-purple-200';
    case 'Resolved': return 'bg-green-100 text-green-700 border-green-200';
    case 'Closed': return 'bg-gray-100 text-gray-700 border-gray-200';
    default: return 'bg-gray-100 text-gray-700 border-gray-200';
  }
};

const getInitials = (name: string) => {
  return name.substring(0, 2).toUpperCase();
};

export function SplitPanel() {
  const [selectedTicketId, setSelectedTicketId] = useState<string | null>(mockTickets[0].id);
  const [activeTab, setActiveTab] = useState<string>('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [replyText, setReplyText] = useState('');

  const selectedTicket = mockTickets.find(t => t.id === selectedTicketId);

  const filteredTickets = mockTickets.filter(ticket => {
    if (activeTab !== 'All' && ticket.status !== activeTab) return false;
    if (searchQuery && !ticket.subject.toLowerCase().includes(searchQuery.toLowerCase())) return false;
    return true;
  });

  return (
    <div className="flex flex-col h-screen min-h-screen bg-slate-50 font-sans text-slate-800 overflow-hidden">
      {/* Top Navigation Bar */}
      <header className="flex-none bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between z-10">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">Tickets</h1>
        </div>
        <div>
          <button className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md font-medium text-sm transition-colors">
            <Plus className="w-4 h-4" />
            New Ticket
          </button>
        </div>
      </header>

      {/* Main Split Area */}
      <div className="flex flex-1 overflow-hidden">
        
        {/* Left Panel - List */}
        <div className="w-[35%] flex-none bg-white border-r border-slate-200 flex flex-col min-w-[320px] max-w-[450px]">
          {/* Search & Filters */}
          <div className="p-4 border-b border-slate-100 flex-none space-y-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input 
                type="text" 
                placeholder="Search tickets..." 
                className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            
            <div className="flex gap-1 overflow-x-auto pb-1 no-scrollbar">
              {['All', 'Open', 'In Progress', 'Resolved'].map(tab => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-colors ${
                    activeTab === tab 
                      ? 'bg-slate-800 text-white' 
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  {tab}
                </button>
              ))}
            </div>
          </div>

          {/* Ticket List */}
          <div className="flex-1 overflow-y-auto">
            {filteredTickets.length > 0 ? (
              <div className="divide-y divide-slate-100">
                {filteredTickets.map(ticket => {
                  const isSelected = selectedTicketId === ticket.id;
                  
                  return (
                    <div 
                      key={ticket.id}
                      onClick={() => setSelectedTicketId(ticket.id)}
                      className={`p-4 cursor-pointer transition-colors border-l-4 ${
                        isSelected 
                          ? 'border-blue-500 bg-blue-50/60' 
                          : 'border-transparent hover:bg-slate-50'
                      }`}
                    >
                      <div className="flex items-start justify-between mb-1 gap-2">
                        <div className="flex items-center gap-2 flex-1 min-w-0">
                          <div className={`w-2 h-2 rounded-full flex-none ${getPriorityColor(ticket.priority)}`} />
                          <h3 className={`text-sm font-semibold truncate ${isSelected ? 'text-blue-900' : 'text-slate-900'}`}>
                            {ticket.subject}
                          </h3>
                        </div>
                        <span className="text-xs text-slate-500 flex-none">{ticket.created}</span>
                      </div>
                      
                      <div className="flex items-center justify-between mt-2">
                        <div className="flex items-center gap-3 text-xs text-slate-500">
                          <span className="flex items-center gap-1">
                            <User className="w-3 h-3" />
                            {ticket.client}
                          </span>
                          <span className="flex items-center gap-1">
                            <Tag className="w-3 h-3" />
                            {ticket.type}
                          </span>
                        </div>
                        
                        <div className="flex items-center gap-2">
                          {ticket.replies.length > 0 && (
                            <span className="flex items-center gap-1 text-xs text-slate-400">
                              <MessageSquare className="w-3 h-3" />
                              {ticket.replies.length}
                            </span>
                          )}
                          <div className="w-5 h-5 rounded-full bg-slate-200 flex items-center justify-center text-[10px] font-medium text-slate-600" title={`Assigned to ${ticket.assignedTo}`}>
                            {getInitials(ticket.assignedTo)}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="p-8 text-center text-slate-500 text-sm">
                No tickets found matching your criteria.
              </div>
            )}
          </div>
        </div>

        {/* Right Panel - Detail View */}
        <div className="flex-1 flex flex-col bg-slate-50 overflow-hidden relative">
          {selectedTicket ? (
            <>
              {/* Detail Header */}
              <div className="flex-none bg-white border-b border-slate-200 p-6 shadow-sm z-10">
                <div className="flex items-start justify-between gap-4 mb-4">
                  <h2 className="text-2xl font-bold text-slate-900 leading-tight">
                    {selectedTicket.subject}
                  </h2>
                  <div className="flex gap-2 flex-none">
                    <button className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-md transition-colors">
                      <Edit3 className="w-4 h-4" />
                    </button>
                    <button className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-md transition-colors">
                      <MoreVertical className="w-4 h-4" />
                    </button>
                  </div>
                </div>
                
                <div className="flex flex-wrap items-center gap-2 mb-6">
                  <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium border ${getStatusBadge(selectedTicket.status)}`}>
                    {selectedTicket.status}
                  </span>
                  <span className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-700 border border-slate-200">
                    <div className={`w-1.5 h-1.5 rounded-full ${getPriorityColor(selectedTicket.priority)}`} />
                    {selectedTicket.priority} Priority
                  </span>
                  <span className="px-2.5 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-700 border border-slate-200">
                    {selectedTicket.type}
                  </span>
                </div>
                
                {/* Info Grid */}
                <div className="grid grid-cols-2 gap-y-4 gap-x-8 text-sm">
                  <div>
                    <span className="text-slate-500 block mb-1">Client</span>
                    <span className="font-medium text-slate-900 flex items-center gap-2">
                      <div className="w-6 h-6 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center text-xs">
                        {getInitials(selectedTicket.client !== 'N/A' ? selectedTicket.client : 'NA')}
                      </div>
                      {selectedTicket.client}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-500 block mb-1">Assigned To</span>
                    <span className="font-medium text-slate-900 flex items-center gap-2">
                      <div className="w-6 h-6 rounded-full bg-slate-200 text-slate-700 flex items-center justify-center text-xs">
                        {getInitials(selectedTicket.assignedTo)}
                      </div>
                      {selectedTicket.assignedTo}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-500 block mb-1 flex items-center gap-1">
                      <Calendar className="w-3.5 h-3.5" /> Created Date
                    </span>
                    <span className="font-medium text-slate-900">{selectedTicket.created}</span>
                  </div>
                  <div>
                    <span className="text-slate-500 block mb-1 flex items-center gap-1">
                      <Clock className="w-3.5 h-3.5" /> Last Updated
                    </span>
                    <span className="font-medium text-slate-900">{selectedTicket.created}</span>
                  </div>
                </div>
              </div>

              {/* Scrollable Content */}
              <div className="flex-1 overflow-y-auto p-6 space-y-8">
                {/* Description */}
                <div>
                  <h3 className="text-sm font-semibold text-slate-900 mb-3 uppercase tracking-wider">Description</h3>
                  <div className="bg-white p-5 rounded-lg border border-slate-200 shadow-sm text-sm text-slate-700 leading-relaxed whitespace-pre-wrap">
                    {selectedTicket.description}
                  </div>
                </div>

                {/* Activity/Replies */}
                <div>
                  <h3 className="text-sm font-semibold text-slate-900 mb-4 uppercase tracking-wider flex items-center gap-2">
                    Activity <span className="bg-slate-200 text-slate-600 px-2 py-0.5 rounded-full text-xs">{selectedTicket.replies.length}</span>
                  </h3>
                  
                  <div className="space-y-6">
                    {selectedTicket.replies.length > 0 ? (
                      selectedTicket.replies.map((reply, idx) => (
                        <div key={reply.id} className="flex gap-4">
                          <div className="w-8 h-8 rounded-full bg-indigo-100 text-indigo-700 flex-none flex items-center justify-center text-xs font-semibold mt-1">
                            {getInitials(reply.author)}
                          </div>
                          <div className="flex-1 bg-white p-4 rounded-lg rounded-tl-none border border-slate-200 shadow-sm relative">
                            {/* Speech bubble pointer */}
                            <div className="absolute top-4 -left-2 w-2 h-2 bg-white border-l border-b border-slate-200 transform rotate-45"></div>
                            
                            <div className="flex items-baseline justify-between mb-2">
                              <span className="font-medium text-sm text-slate-900">{reply.author}</span>
                              <span className="text-xs text-slate-400">{reply.date}</span>
                            </div>
                            <div className="text-sm text-slate-700">
                              {reply.message}
                            </div>
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="text-center py-6 text-sm text-slate-500 italic bg-white rounded-lg border border-slate-200 border-dashed">
                        No replies yet. Be the first to respond.
                      </div>
                    )}
                  </div>
                </div>
                
                {/* Spacing for sticky input */}
                <div className="h-4"></div>
              </div>

              {/* Reply Input (Sticky Bottom) */}
              <div className="flex-none bg-white border-t border-slate-200 p-4">
                <div className="max-w-4xl mx-auto flex items-end gap-2 bg-slate-50 rounded-lg border border-slate-200 p-2 focus-within:ring-2 focus-within:ring-blue-500/20 focus-within:border-blue-500 transition-all">
                  <div className="flex-1">
                    <textarea 
                      placeholder="Type a reply..." 
                      className="w-full bg-transparent border-0 focus:ring-0 p-2 text-sm resize-none min-h-[44px] max-h-[120px]"
                      rows={1}
                      value={replyText}
                      onChange={(e) => setReplyText(e.target.value)}
                    />
                  </div>
                  <div className="flex gap-1 pb-1">
                    <button className="p-2 text-slate-400 hover:text-slate-600 rounded-md transition-colors">
                      <Paperclip className="w-4 h-4" />
                    </button>
                    <button 
                      className={`p-2 rounded-md transition-colors ${replyText.trim() ? 'bg-blue-600 text-white hover:bg-blue-700' : 'bg-slate-200 text-slate-400 cursor-not-allowed'}`}
                      disabled={!replyText.trim()}
                    >
                      <Send className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            </>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-slate-400 p-8">
              <MessageSquare className="w-12 h-12 mb-4 text-slate-300" />
              <p className="text-lg font-medium text-slate-500 mb-1">No ticket selected</p>
              <p className="text-sm">Select a ticket from the list to view details</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

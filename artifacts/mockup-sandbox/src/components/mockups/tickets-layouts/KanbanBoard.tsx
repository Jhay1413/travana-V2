import React, { useState } from 'react';
import { 
  Search, 
  Plus, 
  Filter, 
  MessageSquare, 
  MoreHorizontal, 
  Clock,
  User,
  Ticket,
  ChevronDown
} from 'lucide-react';

// Type definitions
type Priority = 'Urgent' | 'High' | 'Medium' | 'Low';
type Status = 'Open' | 'In Progress' | 'Resolved' | 'Closed';
type TicketType = 'Build' | 'Sales' | 'Admin';

interface TicketData {
  id: string;
  subject: string;
  description: string;
  type: TicketType;
  status: Status;
  priority: Priority;
  agent: string;
  client: string;
  replies: number;
  date: string;
}

// Mock Data
const MOCK_TICKETS: TicketData[] = [
  { 
    id: 'TKT-001', 
    subject: 'Social Posts', 
    description: 'Need to create and schedule social media posts for the upcoming summer campaign across all platforms.',
    type: 'Build', 
    status: 'Open', 
    priority: 'Urgent', 
    agent: 'Jhon', 
    client: 'Tina', 
    replies: 2, 
    date: 'Today, 09:30 AM' 
  },
  { 
    id: 'TKT-002', 
    subject: 'Flight rebooking for Smiths', 
    description: 'The Smith family needs to reschedule their outbound flight to Paris due to a medical emergency.',
    type: 'Sales', 
    status: 'Open', 
    priority: 'High', 
    agent: 'James', 
    client: 'Mr Smith', 
    replies: 0, 
    date: 'Today, 10:15 AM' 
  },
  { 
    id: 'TKT-003', 
    subject: 'Commission report error', 
    description: 'Discrepancy found in the Q3 commission reports for the European tours team.',
    type: 'Admin', 
    status: 'In Progress', 
    priority: 'Medium', 
    agent: 'Jhon', 
    client: 'N/A', 
    replies: 3, 
    date: 'Yesterday, 02:45 PM' 
  },
  { 
    id: 'TKT-004', 
    subject: 'Hotel upgrade request', 
    description: 'Mrs Johnson is requesting a complimentary upgrade to an ocean view suite for her anniversary trip.',
    type: 'Sales', 
    status: 'In Progress', 
    priority: 'High', 
    agent: 'James', 
    client: 'Mrs Johnson', 
    replies: 1, 
    date: 'Yesterday, 04:20 PM' 
  },
  { 
    id: 'TKT-005', 
    subject: 'Website banner update', 
    description: 'Update the homepage hero banner to feature the new winter holiday packages.',
    type: 'Build', 
    status: 'In Progress', 
    priority: 'Low', 
    agent: 'Jhon', 
    client: 'Tina', 
    replies: 0, 
    date: 'Oct 12, 11:00 AM' 
  },
  { 
    id: 'TKT-006', 
    subject: 'Refund processed - Garcia', 
    description: 'Processed the cancellation and refund for the Garcia family booking (REF: TRV-8921).',
    type: 'Sales', 
    status: 'Resolved', 
    priority: 'Medium', 
    agent: 'James', 
    client: 'Mr Garcia', 
    replies: 4, 
    date: 'Oct 11, 09:15 AM' 
  },
  { 
    id: 'TKT-007', 
    subject: 'Email templates updated', 
    description: 'All automated booking confirmation emails have been updated with the new branding.',
    type: 'Build', 
    status: 'Resolved', 
    priority: 'Low', 
    agent: 'Jhon', 
    client: 'Tina', 
    replies: 2, 
    date: 'Oct 10, 03:30 PM' 
  },
  { 
    id: 'TKT-008', 
    subject: 'Old booking query', 
    description: 'Customer requesting details about a trip they took to Italy in 2022 for insurance purposes.',
    type: 'Sales', 
    status: 'Closed', 
    priority: 'Low', 
    agent: 'James', 
    client: 'Mrs Taylor', 
    replies: 1, 
    date: 'Oct 05, 10:00 AM' 
  },
];

const STATUSES: { id: Status; label: string; bgClass: string; headerColor: string; badgeClass: string }[] = [
  { id: 'Open', label: 'Open', bgClass: 'bg-red-50/50', headerColor: 'text-red-700', badgeClass: 'bg-red-100 text-red-700 border-red-200' },
  { id: 'In Progress', label: 'In Progress', bgClass: 'bg-amber-50/50', headerColor: 'text-amber-700', badgeClass: 'bg-amber-100 text-amber-700 border-amber-200' },
  { id: 'Resolved', label: 'Resolved', bgClass: 'bg-emerald-50/50', headerColor: 'text-emerald-700', badgeClass: 'bg-emerald-100 text-emerald-700 border-emerald-200' },
  { id: 'Closed', label: 'Closed', bgClass: 'bg-slate-100/50', headerColor: 'text-slate-700', badgeClass: 'bg-slate-200 text-slate-700 border-slate-300' },
];

const PRIORITY_COLORS: Record<Priority, string> = {
  Urgent: 'border-l-red-500',
  High: 'border-l-orange-500',
  Medium: 'border-l-amber-500',
  Low: 'border-l-slate-400'
};

const TYPE_BADGES: Record<TicketType, string> = {
  Admin: 'bg-violet-100 text-violet-700 border-violet-200',
  Build: 'bg-sky-100 text-sky-700 border-sky-200',
  Sales: 'bg-emerald-100 text-emerald-700 border-emerald-200'
};

const AGENT_AVATARS: Record<string, string> = {
  'Jhon': 'https://i.pravatar.cc/150?u=jhon',
  'James': 'https://i.pravatar.cc/150?u=james'
};

export const KanbanBoard = () => {
  const [tickets] = useState<TicketData[]>(MOCK_TICKETS);
  const [searchQuery, setSearchQuery] = useState('');

  const filteredTickets = tickets.filter(t => 
    t.subject.toLowerCase().includes(searchQuery.toLowerCase()) || 
    t.client.toLowerCase().includes(searchQuery.toLowerCase()) ||
    t.description.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 px-6 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 sticky top-0 z-10">
        <div className="flex items-center gap-3">
          <div className="bg-blue-600 p-2 rounded-lg text-white shadow-sm">
            <Ticket className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-900 leading-tight">Tickets</h1>
            <p className="text-sm text-slate-500 font-medium">Tina's Travel Deals</p>
          </div>
        </div>

        <div className="flex flex-1 flex-wrap items-center gap-3 justify-end">
          <div className="relative w-full max-w-xs hidden md:block">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input 
              type="text" 
              placeholder="Search tickets..." 
              className="w-full pl-9 pr-4 py-2 bg-slate-100 border-transparent focus:bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-200 rounded-lg text-sm transition-all outline-none"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          
          <div className="hidden lg:flex items-center gap-2">
            <button className="flex items-center gap-2 px-3 py-2 bg-white border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 text-sm font-medium shadow-sm transition-colors">
              <span>Type</span>
              <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
            </button>
            <button className="flex items-center gap-2 px-3 py-2 bg-white border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 text-sm font-medium shadow-sm transition-colors">
              <span>Priority</span>
              <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
            </button>
            <button className="flex items-center gap-2 px-3 py-2 bg-white border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 text-sm font-medium shadow-sm transition-colors">
              <span>Agent</span>
              <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
            </button>
          </div>
          
          <button className="lg:hidden flex items-center gap-2 px-3 py-2 bg-white border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 text-sm font-medium shadow-sm transition-colors whitespace-nowrap">
            <Filter className="w-4 h-4" />
            <span>Filters</span>
          </button>
          
          <button className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium shadow-sm transition-colors whitespace-nowrap">
            <Plus className="w-4 h-4" />
            <span>New Ticket</span>
          </button>
        </div>
      </header>

      {/* Board Area */}
      <main className="flex-1 overflow-x-auto p-6">
        <div className="flex gap-6 h-full min-w-max items-start">
          {STATUSES.map(status => {
            const columnTickets = filteredTickets.filter(t => t.status === status.id);
            
            return (
              <div key={status.id} className={`w-[340px] flex flex-col rounded-xl border border-slate-200/80 overflow-hidden h-[calc(100vh-120px)] shadow-sm ${status.bgClass}`}>
                {/* Column Header */}
                <div className="px-4 py-3 bg-white/60 backdrop-blur-md border-b border-slate-200/50 flex items-center justify-between sticky top-0 z-10">
                  <h2 className={`font-semibold text-sm flex items-center gap-2 ${status.headerColor}`}>
                    {status.label}
                    <span className={`px-2 py-0.5 rounded-full text-xs font-bold border ${status.badgeClass}`}>
                      {columnTickets.length}
                    </span>
                  </h2>
                  <button className="text-slate-400 hover:text-slate-600 p-1 rounded transition-colors">
                    <MoreHorizontal className="w-4 h-4" />
                  </button>
                </div>

                {/* Column Content */}
                <div className="flex-1 overflow-y-auto p-3 space-y-3 custom-scrollbar">
                  {columnTickets.map(ticket => (
                    <div 
                      key={ticket.id} 
                      className={`bg-white/80 backdrop-blur-sm border border-slate-200/80 rounded-xl p-4 shadow-sm hover:shadow-md transition-all cursor-pointer group border-l-4 ${PRIORITY_COLORS[ticket.priority]}`}
                    >
                      <div className="flex justify-between items-start mb-2">
                        <span className={`text-[10px] uppercase tracking-wider font-bold px-2 py-0.5 rounded-md border ${TYPE_BADGES[ticket.type]}`}>
                          {ticket.type}
                        </span>
                        <div className="flex items-center gap-2">
                          <span className="text-[11px] font-medium text-slate-400">
                            {ticket.id}
                          </span>
                        </div>
                      </div>
                      
                      <h3 className="font-semibold text-slate-800 text-sm leading-snug mb-1.5 group-hover:text-blue-600 transition-colors">
                        {ticket.subject}
                      </h3>
                      
                      <p className="text-xs text-slate-500 line-clamp-2 mb-3 leading-relaxed">
                        {ticket.description}
                      </p>
                      
                      <div className="text-[11px] text-slate-500 mb-4 flex items-center gap-1.5 bg-slate-50 w-fit px-2 py-1 rounded-md border border-slate-100">
                        <User className="w-3.5 h-3.5 text-slate-400" />
                        <span className="font-medium">{ticket.client !== 'N/A' ? ticket.client : 'Internal'}</span>
                      </div>

                      <div className="flex items-center justify-between mt-auto pt-3 border-t border-slate-100">
                        <div className="flex items-center gap-2">
                          <img 
                            src={AGENT_AVATARS[ticket.agent]} 
                            alt={ticket.agent} 
                            className="w-6 h-6 rounded-full border-2 border-white shadow-sm"
                            title={`Assigned to ${ticket.agent}`}
                          />
                          <span className="text-xs font-medium text-slate-600">{ticket.agent}</span>
                        </div>
                        
                        <div className="flex items-center gap-3 text-slate-400">
                          {ticket.replies > 0 && (
                            <div className="flex items-center gap-1 text-xs font-medium bg-slate-100 px-1.5 py-0.5 rounded text-slate-500" title={`${ticket.replies} replies`}>
                              <MessageSquare className="w-3 h-3" />
                              <span>{ticket.replies}</span>
                            </div>
                          )}
                          <div className="flex items-center gap-1 text-[11px] font-medium" title={ticket.date}>
                            <Clock className="w-3 h-3" />
                            <span>{ticket.date.split(',')[0]}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                  
                  {columnTickets.length === 0 && (
                    <div className="h-24 flex flex-col items-center justify-center text-sm text-slate-400 border-2 border-dashed border-slate-300/50 rounded-xl bg-white/30 backdrop-blur-sm">
                      <Ticket className="w-6 h-6 mb-2 text-slate-300" />
                      No tickets
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </main>

      <style dangerouslySetInnerHTML={{__html: `
        .custom-scrollbar::-webkit-scrollbar {
          width: 6px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: transparent;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background-color: rgba(148, 163, 184, 0.3);
          border-radius: 20px;
        }
        .custom-scrollbar:hover::-webkit-scrollbar-thumb {
          background-color: rgba(148, 163, 184, 0.5);
        }
      `}} />
    </div>
  );
};

export default KanbanBoard;

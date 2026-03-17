import React, { useState } from 'react';
import { 
  Search, 
  Plus, 
  MessageSquare, 
  ArrowUpDown,
  Circle,
  MoreHorizontal
} from 'lucide-react';

// --- Mock Data ---
type Priority = 'Urgent' | 'High' | 'Medium' | 'Low';
type Status = 'Open' | 'In Progress' | 'Resolved' | 'Closed';
type TicketType = 'Build' | 'Sales' | 'Admin';

interface Ticket {
  id: string;
  subject: string;
  type: TicketType;
  status: Status;
  priority: Priority;
  assignedTo: string;
  client: string;
  replies: number;
  date: string;
}

const MOCK_TICKETS: Ticket[] = [
  { id: 'TKT-001', subject: 'Social Posts', type: 'Build', status: 'Open', priority: 'Urgent', assignedTo: 'Jhon', client: 'Tina', replies: 2, date: '14/03/2026' },
  { id: 'TKT-002', subject: 'Flight rebooking for Smiths', type: 'Sales', status: 'Open', priority: 'High', assignedTo: 'James', client: 'Mr Smith', replies: 0, date: '15/03/2026' },
  { id: 'TKT-003', subject: 'Commission report error', type: 'Admin', status: 'In Progress', priority: 'Medium', assignedTo: 'Jhon', client: 'N/A', replies: 3, date: '13/03/2026' },
  { id: 'TKT-004', subject: 'Hotel upgrade request', type: 'Sales', status: 'In Progress', priority: 'High', assignedTo: 'James', client: 'Mrs Johnson', replies: 1, date: '16/03/2026' },
  { id: 'TKT-005', subject: 'Website banner update', type: 'Build', status: 'In Progress', priority: 'Low', assignedTo: 'Jhon', client: 'Tina', replies: 0, date: '12/03/2026' },
  { id: 'TKT-006', subject: 'Refund processed - Garcia', type: 'Sales', status: 'Resolved', priority: 'Medium', assignedTo: 'James', client: 'Mr Garcia', replies: 4, date: '10/03/2026' },
  { id: 'TKT-007', subject: 'Email templates updated', type: 'Build', status: 'Resolved', priority: 'Low', assignedTo: 'Jhon', client: 'Tina', replies: 2, date: '11/03/2026' },
  { id: 'TKT-008', subject: 'Old booking query', type: 'Sales', status: 'Closed', priority: 'Low', assignedTo: 'James', client: 'Mrs Taylor', replies: 1, date: '05/03/2026' },
];

const PRIORITY_COLORS: Record<Priority, string> = {
  Urgent: 'text-red-500',
  High: 'text-orange-500',
  Medium: 'text-amber-500',
  Low: 'text-slate-400',
};

const STATUS_COLORS: Record<Status, string> = {
  Open: 'bg-red-50 text-red-700 border-red-200',
  'In Progress': 'bg-amber-50 text-amber-700 border-amber-200',
  Resolved: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  Closed: 'bg-slate-50 text-slate-600 border-slate-200',
};

const TYPE_COLORS: Record<TicketType, string> = {
  Admin: 'bg-violet-100 text-violet-700',
  Build: 'bg-sky-100 text-sky-700',
  Sales: 'bg-emerald-100 text-emerald-700',
};

export function DenseTable() {
  const [activeFilter, setActiveFilter] = useState<Status | 'Total'>('Total');
  const [selectedRowId, setSelectedRowId] = useState<string | null>(null);

  // Compute stats
  const stats = {
    Total: MOCK_TICKETS.length,
    Open: MOCK_TICKETS.filter(t => t.status === 'Open').length,
    'In Progress': MOCK_TICKETS.filter(t => t.status === 'In Progress').length,
    Resolved: MOCK_TICKETS.filter(t => t.status === 'Resolved').length,
    Closed: MOCK_TICKETS.filter(t => t.status === 'Closed').length,
  };

  const filteredTickets = activeFilter === 'Total' 
    ? MOCK_TICKETS 
    : MOCK_TICKETS.filter(t => t.status === activeFilter);

  return (
    <div className="min-h-screen bg-slate-50 p-6 flex flex-col font-sans text-sm">
      <div className="max-w-[1400px] mx-auto w-full space-y-4 flex-1 flex flex-col">
        
        {/* Header Bar */}
        <div className="flex items-center justify-between gap-4">
          <h1 className="text-2xl font-semibold text-slate-900 tracking-tight">Tickets</h1>
          
          <div className="flex-1 max-w-xl relative ml-8">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input 
              type="text" 
              placeholder="Search tickets, clients, or subjects..." 
              className="w-full pl-9 pr-4 py-2 bg-white border border-slate-200 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-shadow"
            />
          </div>

          <button className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md font-medium shadow-sm transition-colors">
            <Plus className="w-4 h-4" />
            New Ticket
          </button>
        </div>

        {/* Filter/Summary Bar */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1">
          {(Object.entries(stats) as [Status | 'Total', number][]).map(([status, count]) => (
            <button
              key={status}
              onClick={() => setActiveFilter(status)}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-full border transition-all ${
                activeFilter === status 
                  ? 'bg-blue-50 border-blue-200 text-blue-700 font-medium shadow-sm' 
                  : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
              }`}
            >
              <span>{count} {status}</span>
            </button>
          ))}
        </div>

        {/* Table Card */}
        <div className="bg-white rounded-lg border border-slate-200 shadow-sm flex-1 overflow-hidden flex flex-col">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 font-medium">
                  <th className="px-4 py-3 w-10">
                    <span className="sr-only">Priority</span>
                  </th>
                  <th className="px-4 py-3 group cursor-pointer hover:text-slate-700 transition-colors">
                    <div className="flex items-center gap-1">
                      Subject
                      <ArrowUpDown className="w-3.5 h-3.5 opacity-0 group-hover:opacity-100 transition-opacity" />
                    </div>
                  </th>
                  <th className="px-4 py-3 group cursor-pointer hover:text-slate-700 transition-colors">
                    <div className="flex items-center gap-1">
                      Client
                      <ArrowUpDown className="w-3.5 h-3.5 opacity-0 group-hover:opacity-100 transition-opacity" />
                    </div>
                  </th>
                  <th className="px-4 py-3 group cursor-pointer hover:text-slate-700 transition-colors">
                    <div className="flex items-center gap-1">
                      Assigned To
                      <ArrowUpDown className="w-3.5 h-3.5 opacity-0 group-hover:opacity-100 transition-opacity" />
                    </div>
                  </th>
                  <th className="px-4 py-3 group cursor-pointer hover:text-slate-700 transition-colors">
                    <div className="flex items-center gap-1">
                      Status
                      <ArrowUpDown className="w-3.5 h-3.5 opacity-0 group-hover:opacity-100 transition-opacity" />
                    </div>
                  </th>
                  <th className="px-4 py-3 group cursor-pointer hover:text-slate-700 transition-colors">
                    <div className="flex items-center gap-1">
                      Date
                      <ArrowUpDown className="w-3.5 h-3.5 opacity-0 group-hover:opacity-100 transition-opacity" />
                    </div>
                  </th>
                  <th className="px-4 py-3 text-right group cursor-pointer hover:text-slate-700 transition-colors">
                    <div className="flex items-center justify-end gap-1">
                      Replies
                      <ArrowUpDown className="w-3.5 h-3.5 opacity-0 group-hover:opacity-100 transition-opacity" />
                    </div>
                  </th>
                  <th className="px-4 py-3 w-10"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredTickets.map((ticket, i) => {
                  const isSelected = selectedRowId === ticket.id;
                  
                  return (
                    <tr 
                      key={ticket.id}
                      onClick={() => setSelectedRowId(ticket.id === selectedRowId ? null : ticket.id)}
                      className={`
                        group cursor-pointer transition-colors
                        ${isSelected ? 'bg-blue-50/50 hover:bg-blue-50/80' : i % 2 === 0 ? 'bg-white hover:bg-slate-50' : 'bg-slate-50/30 hover:bg-slate-50'}
                      `}
                    >
                      <td className="px-4 py-2.5 whitespace-nowrap">
                        <Circle className={`w-2.5 h-2.5 fill-current ${PRIORITY_COLORS[ticket.priority]}`} />
                      </td>
                      <td className="px-4 py-2.5 font-medium text-slate-900 truncate max-w-[300px]">
                        <div className="flex items-center gap-2">
                          <span className={`text-[10px] uppercase tracking-wider font-bold px-1.5 py-0.5 rounded-sm ${TYPE_COLORS[ticket.type]}`}>
                            {ticket.type}
                          </span>
                          <span className="truncate" title={ticket.subject}>{ticket.subject}</span>
                        </div>
                      </td>
                      <td className="px-4 py-2.5 text-slate-600 whitespace-nowrap">
                        {ticket.client}
                      </td>
                      <td className="px-4 py-2.5 whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          <div className="w-5 h-5 rounded-full bg-slate-200 text-[10px] font-bold text-slate-600 flex items-center justify-center border border-slate-300">
                            {ticket.assignedTo.charAt(0)}
                          </div>
                          <span className="text-slate-700">{ticket.assignedTo}</span>
                        </div>
                      </td>
                      <td className="px-4 py-2.5 whitespace-nowrap">
                        <span className={`text-xs px-2 py-0.5 rounded-full border font-medium ${STATUS_COLORS[ticket.status]}`}>
                          {ticket.status}
                        </span>
                      </td>
                      <td className="px-4 py-2.5 text-slate-500 tabular-nums whitespace-nowrap text-xs">
                        {ticket.date}
                      </td>
                      <td className="px-4 py-2.5 text-right whitespace-nowrap tabular-nums">
                        <div className="flex items-center justify-end gap-1.5 text-slate-500">
                          {ticket.replies > 0 ? (
                            <span className="font-medium text-slate-700">{ticket.replies}</span>
                          ) : (
                            <span className="text-slate-300">-</span>
                          )}
                          <MessageSquare className={`w-3.5 h-3.5 ${ticket.replies > 0 ? 'text-slate-400' : 'text-slate-300'}`} />
                        </div>
                      </td>
                      <td className="px-4 py-2.5 text-right whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity">
                        <button className="p-1 hover:bg-slate-200 rounded text-slate-400 hover:text-slate-700 transition-colors">
                          <MoreHorizontal className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            
            {filteredTickets.length === 0 && (
              <div className="py-12 text-center text-slate-500">
                No tickets found for this filter.
              </div>
            )}
          </div>
        </div>

      </div>
    </div>
  );
}

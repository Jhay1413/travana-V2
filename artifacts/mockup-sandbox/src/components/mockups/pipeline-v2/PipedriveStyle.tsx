import { useState, useRef } from "react";
import {
  Search, Plus, Filter, ChevronDown, MoreHorizontal, Phone, Mail,
  Plane, Calendar, Users, PoundSterling, ArrowRight, GripVertical,
  Eye, Edit, Trash2, Copy, MessageSquare, Clock, TrendingUp,
  Star, StarOff, MapPin, Building2, ChevronRight, SlidersHorizontal,
  Download, BarChart3, Layers
} from "lucide-react";

const STAGES = [
  { id: "enquiry", label: "Enquiry", color: "#3B82F6", bgLight: "#EFF6FF", count: 12, value: 48750 },
  { id: "quoted", label: "Quoted", color: "#F59E0B", bgLight: "#FFFBEB", count: 8, value: 67200 },
  { id: "in_play", label: "In Play", color: "#8B5CF6", bgLight: "#F5F3FF", count: 5, value: 42300 },
  { id: "booked", label: "Booked", color: "#10B981", bgLight: "#ECFDF5", count: 15, value: 128400 },
];

type Deal = {
  id: string;
  client: string;
  destination: string;
  value: number;
  profit: number;
  travelDate: string;
  pax: string;
  agent: string;
  agentAvatar: string;
  starred: boolean;
  lastActivity: string;
  tourOp: string;
  quoteCount?: number;
  notes?: string;
  country?: string;
  status?: string;
};

const DEALS: Record<string, Deal[]> = {
  enquiry: [
    { id: "E001", client: "James & Sarah Mitchell", destination: "Maldives", country: "Maldives", value: 8500, profit: 1275, travelDate: "15 Jun 2026", pax: "2A", agent: "Tina", agentAvatar: "T", starred: true, lastActivity: "2h ago", tourOp: "Kuoni", notes: "Honeymoon — interested in water villa" },
    { id: "E002", client: "The Robinson Family", destination: "Orlando, FL", country: "USA", value: 12400, profit: 1860, travelDate: "22 Jul 2026", pax: "2A 2C", agent: "Sarah", agentAvatar: "S", starred: false, lastActivity: "5h ago", tourOp: "Virgin Holidays", notes: "Want Disney + Universal combo" },
    { id: "E003", client: "David Thompson", destination: "Santorini", country: "Greece", value: 3200, profit: 480, travelDate: "10 Sep 2026", pax: "2A", agent: "Tina", agentAvatar: "T", starred: false, lastActivity: "1d ago", tourOp: "Jet2 Holidays", notes: "Anniversary trip, cave hotel" },
    { id: "E004", client: "Claire Watson", destination: "Barbados", country: "Caribbean", value: 6800, profit: 1020, travelDate: "18 Dec 2026", pax: "2A 1C", agent: "Mark", agentAvatar: "M", starred: true, lastActivity: "3h ago", tourOp: "British Airways Holidays" },
    { id: "E005", client: "Peter & Linda Grant", destination: "Lake Como", country: "Italy", value: 4500, profit: 675, travelDate: "05 May 2026", pax: "2A", agent: "Tina", agentAvatar: "T", starred: false, lastActivity: "2d ago", tourOp: "Sovereign" },
  ],
  quoted: [
    { id: "Q001", client: "Michael & Emma Harris", destination: "Mauritius", country: "Mauritius", value: 11200, profit: 1680, travelDate: "03 Aug 2026", pax: "2A 1C", agent: "Tina", agentAvatar: "T", starred: true, lastActivity: "1h ago", tourOp: "Beachcomber", quoteCount: 3, status: "AWAITING_DECISION", notes: "Sent 3 resort options" },
    { id: "Q002", client: "Sophie Turner", destination: "Bali", country: "Indonesia", value: 7800, profit: 1170, travelDate: "14 Oct 2026", pax: "2A", agent: "Sarah", agentAvatar: "S", starred: false, lastActivity: "4h ago", tourOp: "Kuoni", quoteCount: 2, status: "QUOTE_READY" },
    { id: "Q003", client: "Richard & Anne Price", destination: "Cancún", country: "Mexico", value: 9400, profit: 1410, travelDate: "20 Nov 2026", pax: "2A 2C", agent: "Mark", agentAvatar: "M", starred: false, lastActivity: "1d ago", tourOp: "TUI", quoteCount: 1, status: "QUOTE_IN_PROGRESS" },
    { id: "Q004", client: "Tom Baker", destination: "Dubai", country: "UAE", value: 5600, profit: 840, travelDate: "28 Jan 2027", pax: "2A", agent: "Tina", agentAvatar: "T", starred: true, lastActivity: "6h ago", tourOp: "Emirates Holidays", quoteCount: 2, status: "AWAITING_DECISION" },
  ],
  in_play: [
    { id: "P001", client: "Andrew & Jessica Cole", destination: "Sri Lanka", country: "Sri Lanka", value: 8900, profit: 1335, travelDate: "09 Sep 2026", pax: "2A", agent: "Tina", agentAvatar: "T", starred: true, lastActivity: "30m ago", tourOp: "Kuoni", quoteCount: 2, notes: "Client comparing with another agency" },
    { id: "P002", client: "Hannah Lewis", destination: "Thailand", country: "Thailand", value: 6200, profit: 930, travelDate: "12 Dec 2026", pax: "2A 1C", agent: "Sarah", agentAvatar: "S", starred: false, lastActivity: "2h ago", tourOp: "Sovereign", notes: "Wants to add Koh Samui extension" },
    { id: "P003", client: "The Patel Family", destination: "Disney Cruise", country: "Caribbean", value: 15800, profit: 2370, travelDate: "01 Apr 2027", pax: "2A 3C", agent: "Mark", agentAvatar: "M", starred: true, lastActivity: "5h ago", tourOp: "Disney", quoteCount: 1 },
  ],
  booked: [
    { id: "B001", client: "Robert & Karen Young", destination: "Maldives", country: "Maldives", value: 14200, profit: 2130, travelDate: "20 May 2026", pax: "2A", agent: "Tina", agentAvatar: "T", starred: false, lastActivity: "1d ago", tourOp: "Kuoni" },
    { id: "B002", client: "Laura Stevens", destination: "New York", country: "USA", value: 4800, profit: 720, travelDate: "15 Jun 2026", pax: "2A", agent: "Sarah", agentAvatar: "S", starred: false, lastActivity: "3d ago", tourOp: "Virgin Atlantic" },
    { id: "B003", client: "Chris & Amy Shaw", destination: "Riviera Maya", country: "Mexico", value: 8600, profit: 1290, travelDate: "08 Aug 2026", pax: "2A 2C", agent: "Tina", agentAvatar: "T", starred: true, lastActivity: "12h ago", tourOp: "TUI" },
    { id: "B004", client: "Natalie Wright", destination: "Seychelles", country: "Seychelles", value: 9200, profit: 1380, travelDate: "30 Sep 2026", pax: "2A", agent: "Mark", agentAvatar: "M", starred: false, lastActivity: "2d ago", tourOp: "British Airways Holidays" },
  ],
};

function formatGBP(v: number) {
  return new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP", maximumFractionDigits: 0 }).format(v);
}

function DealCard({ deal, stageColor, onDragStart }: { deal: Deal; stageColor: string; onDragStart: (e: React.DragEvent, id: string) => void }) {
  const [starred, setStarred] = useState(deal.starred);
  const [showActions, setShowActions] = useState(false);

  return (
    <div
      draggable
      onDragStart={(e) => onDragStart(e, deal.id)}
      className="group bg-white rounded-xl border border-gray-100 hover:border-gray-200 shadow-sm hover:shadow-md transition-all duration-200 cursor-grab active:cursor-grabbing active:shadow-lg active:scale-[1.02] relative"
      onMouseEnter={() => setShowActions(true)}
      onMouseLeave={() => setShowActions(false)}
    >
      <div className="absolute left-0 top-3 bottom-3 w-[3px] rounded-full" style={{ backgroundColor: stageColor }} />

      <div className="p-3.5 pl-4">
        <div className="flex items-start justify-between mb-2">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5">
              <h4 className="font-semibold text-[13px] text-gray-900 truncate">{deal.client}</h4>
              <button onClick={() => setStarred(!starred)} className="flex-shrink-0">
                {starred ? <Star className="w-3.5 h-3.5 text-amber-400 fill-amber-400" /> : <StarOff className="w-3.5 h-3.5 text-gray-300 opacity-0 group-hover:opacity-100 transition-opacity" />}
              </button>
            </div>
            <div className="flex items-center gap-1 mt-0.5">
              <MapPin className="w-3 h-3 text-gray-400" />
              <span className="text-[12px] text-gray-500">{deal.destination}</span>
              {deal.country && deal.country !== deal.destination && (
                <span className="text-[11px] text-gray-400">· {deal.country}</span>
              )}
            </div>
          </div>

          <div className={`flex items-center gap-0.5 transition-opacity ${showActions ? "opacity-100" : "opacity-0"}`}>
            <button className="p-1 rounded-md hover:bg-gray-100"><Eye className="w-3.5 h-3.5 text-gray-400" /></button>
            <button className="p-1 rounded-md hover:bg-gray-100"><Edit className="w-3.5 h-3.5 text-gray-400" /></button>
            <button className="p-1 rounded-md hover:bg-gray-100"><MoreHorizontal className="w-3.5 h-3.5 text-gray-400" /></button>
          </div>
        </div>

        <div className="flex items-center gap-3 mb-2">
          <div className="flex items-center gap-1">
            <PoundSterling className="w-3 h-3 text-gray-400" />
            <span className="font-semibold text-[13px] text-gray-900">{formatGBP(deal.value)}</span>
          </div>
          <div className="flex items-center gap-1">
            <TrendingUp className="w-3 h-3 text-emerald-500" />
            <span className="text-[12px] text-emerald-600 font-medium">{formatGBP(deal.profit)}</span>
          </div>
        </div>

        <div className="flex items-center gap-2 mb-2 flex-wrap">
          <span className="inline-flex items-center gap-1 text-[11px] text-gray-500 bg-gray-50 px-1.5 py-0.5 rounded-md">
            <Calendar className="w-3 h-3" />{deal.travelDate}
          </span>
          <span className="inline-flex items-center gap-1 text-[11px] text-gray-500 bg-gray-50 px-1.5 py-0.5 rounded-md">
            <Users className="w-3 h-3" />{deal.pax}
          </span>
          {deal.tourOp && (
            <span className="inline-flex items-center gap-1 text-[11px] text-gray-500 bg-gray-50 px-1.5 py-0.5 rounded-md">
              <Building2 className="w-3 h-3" />{deal.tourOp}
            </span>
          )}
        </div>

        {deal.quoteCount && deal.quoteCount > 0 && (
          <div className="flex items-center gap-1 mb-2">
            <Layers className="w-3 h-3 text-gray-400" />
            <span className="text-[11px] text-gray-500">{deal.quoteCount} quote{deal.quoteCount > 1 ? "s" : ""}</span>
            {deal.status && (
              <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${
                deal.status === "AWAITING_DECISION" ? "bg-amber-50 text-amber-600" :
                deal.status === "QUOTE_READY" ? "bg-blue-50 text-blue-600" :
                "bg-gray-50 text-gray-500"
              }`}>{deal.status.replace(/_/g, " ")}</span>
            )}
          </div>
        )}

        {deal.notes && (
          <p className="text-[11px] text-gray-400 italic truncate mb-2">"{deal.notes}"</p>
        )}

        <div className="flex items-center justify-between pt-2 border-t border-gray-50">
          <div className="flex items-center gap-1.5">
            <div className="w-5 h-5 rounded-full bg-gradient-to-br from-gray-700 to-gray-900 flex items-center justify-center">
              <span className="text-[10px] text-white font-medium">{deal.agentAvatar}</span>
            </div>
            <span className="text-[11px] text-gray-500">{deal.agent}</span>
          </div>
          <div className="flex items-center gap-1">
            <Clock className="w-3 h-3 text-gray-300" />
            <span className="text-[11px] text-gray-400">{deal.lastActivity}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

function StageColumn({ stage, deals, onDragOver, onDrop }: {
  stage: typeof STAGES[0];
  deals: Deal[];
  onDragOver: (e: React.DragEvent) => void;
  onDrop: (e: React.DragEvent, stageId: string) => void;
}) {
  const totalValue = deals.reduce((s, d) => s + d.value, 0);
  const totalProfit = deals.reduce((s, d) => s + d.profit, 0);
  const progressWidth = (deals.length / 15) * 100;

  const handleDragStart = (e: React.DragEvent, id: string) => {
    e.dataTransfer.setData("text/plain", id);
    e.dataTransfer.effectAllowed = "move";
  };

  return (
    <div
      className="flex flex-col min-w-[280px] max-w-[320px] flex-1"
      onDragOver={onDragOver}
      onDrop={(e) => onDrop(e, stage.id)}
    >
      <div className="mb-3">
        <div className="flex items-center justify-between mb-1.5">
          <div className="flex items-center gap-2">
            <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: stage.color }} />
            <h3 className="font-semibold text-sm text-gray-800">{stage.label}</h3>
            <span className="text-xs text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded-full font-medium">{deals.length}</span>
          </div>
          <button className="p-1 rounded-md hover:bg-gray-100">
            <Plus className="w-4 h-4 text-gray-400" />
          </button>
        </div>

        <div className="h-1 bg-gray-100 rounded-full overflow-hidden mb-2">
          <div className="h-full rounded-full transition-all duration-500" style={{ width: `${Math.min(progressWidth, 100)}%`, backgroundColor: stage.color }} />
        </div>

        <div className="flex items-center justify-between">
          <span className="text-[12px] font-semibold text-gray-700">{formatGBP(totalValue)}</span>
          <span className="text-[11px] text-emerald-600 font-medium">Profit: {formatGBP(totalProfit)}</span>
        </div>
      </div>

      <div className="flex-1 space-y-2.5 overflow-y-auto pb-4 pr-1" style={{ maxHeight: "calc(100vh - 180px)" }}>
        {deals.map((deal) => (
          <DealCard key={deal.id} deal={deal} stageColor={stage.color} onDragStart={handleDragStart} />
        ))}

        <button className="w-full py-2.5 border border-dashed border-gray-200 rounded-xl text-[12px] text-gray-400 hover:text-gray-600 hover:border-gray-300 hover:bg-gray-50 transition-all flex items-center justify-center gap-1.5">
          <Plus className="w-3.5 h-3.5" />
          Add deal
        </button>
      </div>
    </div>
  );
}

export function PipedriveStyle() {
  const [activeFilter, setActiveFilter] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [deals, setDeals] = useState(DEALS);

  const totalValue = Object.values(deals).flat().reduce((s, d) => s + d.value, 0);
  const totalDeals = Object.values(deals).flat().length;
  const totalProfit = Object.values(deals).flat().reduce((s, d) => s + d.profit, 0);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
  };

  const handleDrop = (e: React.DragEvent, targetStage: string) => {
    e.preventDefault();
    const dealId = e.dataTransfer.getData("text/plain");
    const newDeals = { ...deals };
    let movedDeal: Deal | undefined;

    for (const stage of Object.keys(newDeals)) {
      const idx = newDeals[stage].findIndex((d) => d.id === dealId);
      if (idx !== -1) {
        movedDeal = newDeals[stage].splice(idx, 1)[0];
        break;
      }
    }

    if (movedDeal) {
      newDeals[targetStage] = [movedDeal, ...newDeals[targetStage]];
      setDeals({ ...newDeals });
    }
  };

  return (
    <div className="min-h-screen bg-[#FAFBFC] font-['Inter',system-ui,sans-serif]">
      <div className="border-b border-gray-200 bg-white">
        <div className="px-6 py-3">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-3">
              <h1 className="text-xl font-bold text-gray-900">Pipeline</h1>
              <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-0.5">
                <button className="px-3 py-1.5 rounded-md text-xs font-medium bg-white text-gray-900 shadow-sm">Board</button>
                <button className="px-3 py-1.5 rounded-md text-xs font-medium text-gray-500 hover:text-gray-700">List</button>
                <button className="px-3 py-1.5 rounded-md text-xs font-medium text-gray-500 hover:text-gray-700">Forecast</button>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search deals..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-8 pr-3 py-1.5 text-sm border border-gray-200 rounded-lg w-56 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 bg-gray-50 placeholder:text-gray-400"
                />
              </div>
              <button className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50">
                <SlidersHorizontal className="w-3.5 h-3.5" />
                Filters
              </button>
              <button className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50">
                <BarChart3 className="w-3.5 h-3.5" />
                Reports
              </button>
              <button className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 shadow-sm">
                <Plus className="w-4 h-4" />
                New Deal
              </button>
            </div>
          </div>

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                {["all", "mine", "starred"].map((f) => (
                  <button
                    key={f}
                    onClick={() => setActiveFilter(f)}
                    className={`px-3 py-1 text-xs rounded-full font-medium transition-all ${
                      activeFilter === f
                        ? "bg-gray-900 text-white"
                        : "text-gray-500 hover:bg-gray-100"
                    }`}
                  >
                    {f === "all" ? "All Deals" : f === "mine" ? "My Deals" : "Starred"}
                  </button>
                ))}
              </div>
              <span className="text-[11px] text-gray-400">|</span>
              <div className="flex items-center gap-1.5">
                <span className="text-[12px] text-gray-500">Agent:</span>
                <button className="flex items-center gap-1 px-2 py-0.5 text-[12px] text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200">
                  All Agents <ChevronDown className="w-3 h-3" />
                </button>
              </div>
            </div>

            <div className="flex items-center gap-4 text-[12px]">
              <div className="flex items-center gap-1.5">
                <span className="text-gray-400">Deals:</span>
                <span className="font-semibold text-gray-700">{totalDeals}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="text-gray-400">Total Value:</span>
                <span className="font-semibold text-gray-700">{formatGBP(totalValue)}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="text-gray-400">Total Profit:</span>
                <span className="font-semibold text-emerald-600">{formatGBP(totalProfit)}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="flex gap-4 p-5 overflow-x-auto">
        {STAGES.map((stage) => (
          <StageColumn
            key={stage.id}
            stage={stage}
            deals={deals[stage.id] || []}
            onDragOver={handleDragOver}
            onDrop={handleDrop}
          />
        ))}
      </div>
    </div>
  );
}

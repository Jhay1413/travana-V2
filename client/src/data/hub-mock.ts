export type HubRole = "Owner" | "Senior Agent" | "Trainee";

export interface KpiCard {
  id: string;
  title: string;
  value: string;
  change?: string;
  trend?: "up" | "down" | "neutral";
  icon: string;
}

export interface ActivityItem {
  id: string;
  user: string;
  avatar: string;
  action: string;
  time: string;
}

export interface TrainingModule {
  id: string;
  title: string;
  section: string;
  duration: string;
  level: "Beginner" | "Intermediate" | "Advanced";
  progress: number;
  description: string;
  takeaways: string[];
  resources: string[];
}

export interface DestinationIntel {
  id: string;
  name: string;
  country: string;
  summary: string;
  mostQuotedHotels: string[];
  avgSellingPrice: string;
  commonBoardBasis: string;
  topDepartureAirports: string[];
  peakMonths: string[];
  commonObjections: string[];
  trendingHotels: { name: string; bookings: number }[];
  pricingTrends: { month: string; price: number }[];
  agentNotes: { author: string; note: string; date: string }[];
}

export interface KnowledgeEntry {
  id: string;
  title: string;
  category: "Destination Guides" | "Hotel Insights" | "Sales Playbooks" | "Supplier Notes" | "Blogs";
  author: string;
  date: string;
  likes: number;
  tags: string[];
  excerpt: string;
  saved: boolean;
}

export interface DealWin {
  id: string;
  agentName: string;
  avatar: string;
  destination: string;
  saleValue: string;
  summary: string;
  objectionHandled: string;
  date: string;
}

export interface LeaderboardEntry {
  name: string;
  avatar: string;
  value: string;
}

export interface NewsPost {
  id: string;
  author: string;
  avatar: string;
  role: string;
  content: string;
  category: "Supplier" | "Target" | "Incentive" | "Training";
  date: string;
  pinned: boolean;
  comments: { author: string; text: string; date: string }[];
}

export interface AgentProfile {
  id: string;
  name: string;
  avatar: string;
  bio: string;
  role: HubRole;
  skills: { name: string; level: number }[];
  contributions: number;
  dealWins: number;
  reputationScore: number;
  pinnedPosts: string[];
  trainingProgress: number;
}

export const dashboardKpis: KpiCard[] = [
  { id: "1", title: "Training Progress", value: "72%", change: "+8%", trend: "up", icon: "GraduationCap" },
  { id: "2", title: "Knowledge Contributions", value: "14", change: "+3", trend: "up", icon: "BookOpen" },
  { id: "3", title: "Focus Destination", value: "Antalya", icon: "MapPin" },
  { id: "4", title: "Recent Deal Wins", value: "£28,400", change: "+£4,200", trend: "up", icon: "Trophy" },
  { id: "5", title: "Trending Destination", value: "Maldives", change: "AI Pick", trend: "up", icon: "Sparkles" },
  { id: "6", title: "Announcements", value: "3 New", icon: "Megaphone" },
];

export const activityFeed: ActivityItem[] = [
  { id: "1", user: "Sarah Mitchell", avatar: "SM", action: "added new Antalya hotel notes", time: "2 mins ago" },
  { id: "2", user: "James Cooper", avatar: "JC", action: "closed £4,200 Tenerife deal", time: "15 mins ago" },
  { id: "3", user: "Admin", avatar: "AD", action: "New training module added: Closing on First Call", time: "1 hour ago" },
  { id: "4", user: "Emma Davis", avatar: "ED", action: "shared Cruise Mastery playbook", time: "2 hours ago" },
  { id: "5", user: "Tom Blake", avatar: "TB", action: "completed Advanced Closing module", time: "3 hours ago" },
  { id: "6", user: "Lisa Hart", avatar: "LH", action: "booked £6,800 Maldives package", time: "4 hours ago" },
  { id: "7", user: "Ryan Foster", avatar: "RF", action: "added Lanzarote destination guide", time: "5 hours ago" },
];

export const trainingModules: TrainingModule[] = [
  {
    id: "1", title: "Closing on First Call", section: "Sales Skills", duration: "45 min",
    level: "Advanced", progress: 0, description: "Master the art of closing sales on the first customer interaction.",
    takeaways: ["Build urgency naturally", "Handle price objections", "Create emotional connection", "Use assumptive close technique"],
    resources: ["Closing Cheat Sheet.pdf", "Role Play Scripts.docx"],
  },
  {
    id: "2", title: "Antalya Deep Dive", section: "Destination Knowledge", duration: "30 min",
    level: "Beginner", progress: 65, description: "Everything you need to know to sell Antalya with confidence.",
    takeaways: ["Top 10 hotels by category", "Best months to travel", "Common customer questions", "Transfer logistics"],
    resources: ["Antalya Fact Sheet.pdf", "Hotel Comparison Guide.xlsx"],
  },
  {
    id: "3", title: "Mediterranean Cruises 101", section: "Cruise Mastery", duration: "60 min",
    level: "Intermediate", progress: 30, description: "Navigate the Mediterranean cruise market like a pro.",
    takeaways: ["MSC vs Royal Caribbean positioning", "Cabin category upselling", "Shore excursion add-ons", "Drinks package value"],
    resources: ["Cruise Line Comparison.pdf"],
  },
  {
    id: "4", title: "Overcoming Price Objections", section: "Objection Handling", duration: "25 min",
    level: "Intermediate", progress: 100, description: "Turn 'too expensive' into 'take my money'.",
    takeaways: ["Value framing technique", "Payment plan positioning", "Competitor comparison", "Anchoring strategy"],
    resources: ["Objection Scripts.pdf", "Price vs Value Worksheet.docx"],
  },
  {
    id: "5", title: "The Assumptive Close", section: "Advanced Closing", duration: "35 min",
    level: "Advanced", progress: 45, description: "Learn the most powerful closing technique in travel sales.",
    takeaways: ["When to use assumptive close", "Language patterns", "Body language cues", "Follow-up sequence"],
    resources: ["Assumptive Close Playbook.pdf"],
  },
  {
    id: "6", title: "Building Customer Rapport", section: "Sales Skills", duration: "20 min",
    level: "Beginner", progress: 85, description: "Create instant connection with every customer.",
    takeaways: ["Active listening techniques", "Mirroring and matching", "Finding common ground", "Personal touch points"],
    resources: ["Rapport Building Guide.pdf"],
  },
];

export const trainingSections = ["Sales Skills", "Destination Knowledge", "Cruise Mastery", "Objection Handling", "Advanced Closing"];

export const destinations: DestinationIntel[] = [
  {
    id: "1", name: "Antalya", country: "Turkey",
    summary: "Antalya continues to be one of the most popular destinations for UK package holidays. With excellent value for money, diverse hotel options, and reliable weather, it's a staple in every agent's toolkit.",
    mostQuotedHotels: ["Titanic Mardan Palace", "Rixos Sungate", "Liberty Hotels Lara", "Regnum Carya", "Calista Luxury Resort"],
    avgSellingPrice: "£1,850", commonBoardBasis: "All Inclusive",
    topDepartureAirports: ["Manchester", "Gatwick", "Birmingham", "Bristol"],
    peakMonths: ["June", "July", "August", "September"],
    commonObjections: ["Is it safe?", "Too far for families", "Food quality concerns", "Will it be too hot?"],
    trendingHotels: [
      { name: "Titanic Mardan Palace", bookings: 42 },
      { name: "Rixos Sungate", bookings: 38 },
      { name: "Liberty Hotels Lara", bookings: 31 },
      { name: "Regnum Carya", bookings: 27 },
    ],
    pricingTrends: [
      { month: "Jan", price: 1200 }, { month: "Feb", price: 1250 }, { month: "Mar", price: 1400 },
      { month: "Apr", price: 1600 }, { month: "May", price: 1750 }, { month: "Jun", price: 1900 },
      { month: "Jul", price: 2100 }, { month: "Aug", price: 2200 }, { month: "Sep", price: 1800 },
      { month: "Oct", price: 1500 }, { month: "Nov", price: 1300 }, { month: "Dec", price: 1250 },
    ],
    agentNotes: [
      { author: "Sarah Mitchell", note: "Titanic Mardan always impresses families. The kids club is outstanding.", date: "2 days ago" },
      { author: "James Cooper", note: "Avoid Belek transfers during peak season — can take 90 mins from airport.", date: "1 week ago" },
    ],
  },
  {
    id: "2", name: "Tenerife", country: "Spain",
    summary: "Year-round sunshine makes Tenerife a reliable option for all seasons. Strong appeal for both families and couples with diverse resort options.",
    mostQuotedHotels: ["Bahia del Duque", "Hard Rock Hotel", "Ritz-Carlton Abama", "Royal Hideaway Corales", "GF Victoria"],
    avgSellingPrice: "£2,100", commonBoardBasis: "Half Board",
    topDepartureAirports: ["Manchester", "Gatwick", "Edinburgh", "East Midlands"],
    peakMonths: ["February", "March", "October", "November"],
    commonObjections: ["Same as last year", "Prefer long haul", "Too touristy", "Weather guarantee?"],
    trendingHotels: [
      { name: "Bahia del Duque", bookings: 35 },
      { name: "Hard Rock Hotel", bookings: 28 },
      { name: "Ritz-Carlton Abama", bookings: 22 },
    ],
    pricingTrends: [
      { month: "Jan", price: 1800 }, { month: "Feb", price: 1900 }, { month: "Mar", price: 1850 },
      { month: "Apr", price: 1700 }, { month: "May", price: 1650 }, { month: "Jun", price: 1900 },
      { month: "Jul", price: 2200 }, { month: "Aug", price: 2400 }, { month: "Sep", price: 2000 },
      { month: "Oct", price: 1900 }, { month: "Nov", price: 1800 }, { month: "Dec", price: 2100 },
    ],
    agentNotes: [
      { author: "Emma Davis", note: "Bahia del Duque is worth the premium — guests always come back.", date: "3 days ago" },
    ],
  },
  {
    id: "3", name: "Maldives", country: "Maldives",
    summary: "The ultimate luxury destination. High-value bookings with excellent commission potential. Honeymoon and anniversary market is strong.",
    mostQuotedHotels: ["Soneva Fushi", "Baros Maldives", "Lily Beach", "Kandima", "Sun Siyam Iru Fushi"],
    avgSellingPrice: "£4,500", commonBoardBasis: "Full Board Plus",
    topDepartureAirports: ["Heathrow", "Manchester", "Gatwick"],
    peakMonths: ["December", "January", "February", "March"],
    commonObjections: ["Too expensive", "Long flight", "Nothing to do", "Worried about rain"],
    trendingHotels: [
      { name: "Soneva Fushi", bookings: 18 },
      { name: "Lily Beach", bookings: 15 },
      { name: "Baros Maldives", bookings: 12 },
    ],
    pricingTrends: [
      { month: "Jan", price: 5200 }, { month: "Feb", price: 5000 }, { month: "Mar", price: 4800 },
      { month: "Apr", price: 3800 }, { month: "May", price: 3200 }, { month: "Jun", price: 3000 },
      { month: "Jul", price: 3100 }, { month: "Aug", price: 3300 }, { month: "Sep", price: 3000 },
      { month: "Oct", price: 3500 }, { month: "Nov", price: 4200 }, { month: "Dec", price: 5500 },
    ],
    agentNotes: [
      { author: "Lisa Hart", note: "Lily Beach is the best all-inclusive value in the Maldives right now.", date: "1 day ago" },
    ],
  },
];

export const knowledgeEntries: KnowledgeEntry[] = [
  { id: "1", title: "Complete Guide to Selling Antalya", category: "Destination Guides", author: "Sarah Mitchell", date: "Dec 15, 2025", likes: 24, tags: ["Turkey", "Package", "Family"], excerpt: "Everything from hotel selection to handling common objections about Turkey.", saved: false },
  { id: "2", title: "Titanic Mardan Palace — Agent Review", category: "Hotel Insights", author: "James Cooper", date: "Dec 12, 2025", likes: 18, tags: ["Turkey", "Luxury", "5-Star"], excerpt: "A detailed agent review after a recent FAM trip to the iconic Mardan Palace.", saved: true },
  { id: "3", title: "The Ultimate Closing Playbook", category: "Sales Playbooks", author: "Admin", date: "Dec 10, 2025", likes: 42, tags: ["Sales", "Closing", "Scripts"], excerpt: "Proven scripts and techniques for closing travel deals on the first call.", saved: false },
  { id: "4", title: "TUI Commission Changes 2026", category: "Supplier Notes", author: "Admin", date: "Dec 8, 2025", likes: 31, tags: ["TUI", "Commission", "Updates"], excerpt: "Key changes to TUI's commission structure effective January 2026.", saved: false },
  { id: "5", title: "Why Maldives Sells Itself", category: "Blogs", author: "Lisa Hart", date: "Dec 5, 2025", likes: 15, tags: ["Maldives", "Luxury", "Honeymoon"], excerpt: "How to position the Maldives as attainable luxury for mid-range budgets.", saved: true },
  { id: "6", title: "Cruise Upselling Techniques", category: "Sales Playbooks", author: "Tom Blake", date: "Dec 1, 2025", likes: 22, tags: ["Cruise", "Upselling", "MSC"], excerpt: "How to move customers from inside cabins to balcony suites.", saved: false },
  { id: "7", title: "Tenerife Year-Round Weather Guide", category: "Destination Guides", author: "Emma Davis", date: "Nov 28, 2025", likes: 12, tags: ["Canary Islands", "Weather", "Year-Round"], excerpt: "Month-by-month weather breakdown to help position Tenerife in every season.", saved: false },
  { id: "8", title: "Jet2 vs TUI: Package Comparison", category: "Supplier Notes", author: "Ryan Foster", date: "Nov 25, 2025", likes: 28, tags: ["Jet2", "TUI", "Comparison"], excerpt: "An honest comparison of Jet2 and TUI packages from an agent's perspective.", saved: false },
];

export const dealWins: DealWin[] = [
  { id: "1", agentName: "James Cooper", avatar: "JC", destination: "Tenerife", saleValue: "£4,200", summary: "Family of 4, 10 nights at Hard Rock Hotel. Customer initially wanted self-catering but was upsold to half board.", objectionHandled: "\"We can cook ourselves for cheaper\"", date: "Today" },
  { id: "2", agentName: "Lisa Hart", avatar: "LH", destination: "Maldives", saleValue: "£6,800", summary: "Honeymoon couple, 7 nights at Baros Maldives. Upgraded from Lily Beach after showing the overwater villa photos.", objectionHandled: "\"Is it worth the extra money?\"", date: "Yesterday" },
  { id: "3", agentName: "Sarah Mitchell", avatar: "SM", destination: "Antalya", saleValue: "£3,400", summary: "Repeat customer, 14 nights all inclusive at Titanic Mardan Palace. Closed within 20 minutes.", objectionHandled: "\"We went last year, want something different\"", date: "2 days ago" },
  { id: "4", agentName: "Tom Blake", avatar: "TB", destination: "Mediterranean Cruise", saleValue: "£5,200", summary: "Retired couple, 14-night MSC cruise with balcony cabin. Added drinks and excursion package.", objectionHandled: "\"We've never cruised before\"", date: "3 days ago" },
  { id: "5", agentName: "Emma Davis", avatar: "ED", destination: "Lanzarote", saleValue: "£2,800", summary: "Young couple, 7 nights at Princesa Yaiza. First-time bookers converted from online browsing.", objectionHandled: "\"Found it cheaper online\"", date: "4 days ago" },
  { id: "6", agentName: "Ryan Foster", avatar: "RF", destination: "Dubai", saleValue: "£6,000", summary: "Birthday trip, 5 nights at Atlantis The Palm. Multi-generational booking for 6 guests.", objectionHandled: "\"Dubai is too commercial\"", date: "5 days ago" },
];

export const leaderboard = {
  topSeller: { name: "Lisa Hart", avatar: "LH", value: "£18,400" } as LeaderboardEntry,
  topContributor: { name: "Sarah Mitchell", avatar: "SM", value: "12 articles" } as LeaderboardEntry,
  mostImproved: { name: "Ryan Foster", avatar: "RF", value: "+34% close rate" } as LeaderboardEntry,
};

export const newsPosts: NewsPost[] = [
  {
    id: "1", author: "Admin", avatar: "AD", role: "Owner", pinned: true,
    content: "This month's focus destination is Antalya! All agents should complete the Antalya Deep Dive training module and familiarise themselves with the latest hotel updates. Commission bonus of 2% on all Antalya bookings this month.",
    category: "Incentive", date: "1 hour ago",
    comments: [
      { author: "Sarah Mitchell", text: "Great incentive! Already seeing more Turkey enquiries.", date: "45 mins ago" },
      { author: "James Cooper", text: "Will the bonus apply to existing quotes too?", date: "30 mins ago" },
    ],
  },
  {
    id: "2", author: "Admin", avatar: "AD", role: "Owner", pinned: false,
    content: "TUI have updated their Late Deals programme for January departures. Check the Supplier Notes in Knowledge Vault for the full breakdown. Some excellent margins available on Canary Islands packages.",
    category: "Supplier", date: "3 hours ago", comments: [],
  },
  {
    id: "3", author: "Admin", avatar: "AD", role: "Owner", pinned: false,
    content: "New training module released: 'Closing on First Call'. This is mandatory for all Trainee-level agents. Senior agents — please review and provide feedback.",
    category: "Training", date: "Yesterday",
    comments: [
      { author: "Tom Blake", text: "Just completed it — excellent content on assumptive closing.", date: "6 hours ago" },
    ],
  },
  {
    id: "4", author: "Admin", avatar: "AD", role: "Owner", pinned: false,
    content: "Q1 targets have been set. Individual targets are available in your Profile page. Team target: £120,000 in confirmed bookings. Let's smash it!",
    category: "Target", date: "2 days ago", comments: [],
  },
];

export const agentProfiles: AgentProfile[] = [
  {
    id: "1", name: "Sarah Mitchell", avatar: "SM", bio: "Senior travel consultant with 8 years experience specialising in Turkey and Mediterranean destinations.",
    role: "Senior Agent",
    skills: [
      { name: "Turkey", level: 95 }, { name: "Spain", level: 80 }, { name: "Cruise", level: 60 },
      { name: "Closing", level: 85 }, { name: "Upselling", level: 90 }, { name: "Rapport", level: 92 },
    ],
    contributions: 12, dealWins: 8, reputationScore: 840, pinnedPosts: ["Complete Guide to Selling Antalya"],
    trainingProgress: 78,
  },
  {
    id: "2", name: "James Cooper", avatar: "JC", bio: "Top performer in package holidays with a knack for closing deals on first contact.",
    role: "Senior Agent",
    skills: [
      { name: "Canaries", level: 88 }, { name: "Turkey", level: 75 }, { name: "Closing", level: 95 },
      { name: "Objections", level: 90 }, { name: "Upselling", level: 82 }, { name: "Cruise", level: 45 },
    ],
    contributions: 8, dealWins: 12, reputationScore: 920, pinnedPosts: ["Titanic Mardan Palace — Agent Review"],
    trainingProgress: 65,
  },
];

export const adminStats = {
  pendingApprovals: 3,
  activeModules: 6,
  totalAgents: 8,
  avgTrainingCompletion: 68,
  skillGaps: [
    { skill: "Cruise Knowledge", gap: 42 },
    { skill: "Long Haul Destinations", gap: 38 },
    { skill: "Luxury Positioning", gap: 25 },
    { skill: "Digital Marketing", gap: 55 },
  ],
};

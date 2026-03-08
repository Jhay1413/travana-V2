import { useState, useMemo } from "react";
import {
  Thermometer, Plane, Clock, MapPin, Star, ChevronDown, ChevronUp,
  ExternalLink, Globe, Camera, Utensils, Mountain, Waves,
  TreePine, Landmark, Music, ShoppingBag, Sparkles, Sun, CloudRain,
  Snowflake, Wind, X
} from "lucide-react";
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  BarChart, Bar, Cell
} from "recharts";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

type MonthTemp = { month: string; avgHigh: number; avgLow: number; rainfall: number };

type MustDoItem = {
  rank: number;
  name: string;
  category: string;
  shortDesc: string;
  websiteUrl?: string;
  price?: string;
  openingHours?: string;
  tips?: string;
  bestFor?: string;
  duration?: string;
  address?: string;
};

export type DestinationGuruData = {
  destination: string;
  country: string;
  heroEmoji: string;
  tagline: string;
  bestTimeToVisit: {
    months: string;
    reason: string;
    peakSeason: string;
    budgetSeason: string;
  };
  flightTimesFromUK: {
    directHours: string;
    airports: string[];
    airlines: string[];
    tips: string;
  };
  travelInfo: {
    currency: string;
    language: string;
    timezone: string;
    visaRequired: string;
    waterSafety: string;
    plugType: string;
    summary: string;
  };
  temperatures: MonthTemp[];
  mustDo: MustDoItem[];
};

const SAMPLE_DATA: Record<string, DestinationGuruData> = {
  "Corfu": {
    destination: "Corfu",
    country: "Greece",
    heroEmoji: "🏛️",
    tagline: "The Emerald Isle of the Ionian Sea",
    bestTimeToVisit: {
      months: "May – October",
      reason: "Warm temperatures, clear skies, and calm seas make this the ideal window for beach holidays and sightseeing.",
      peakSeason: "July & August (busiest, hottest)",
      budgetSeason: "May & October (fewer crowds, lower prices)",
    },
    flightTimesFromUK: {
      directHours: "3h 15m",
      airports: ["Manchester", "Newcastle", "London Gatwick", "Birmingham", "Bristol", "Edinburgh"],
      airlines: ["TUI", "Jet2", "easyJet", "Ryanair", "British Airways"],
      tips: "Direct seasonal flights run May–October. Off-season requires a connection via Athens (add ~2–3 hours).",
    },
    travelInfo: {
      currency: "Euro (€)",
      language: "Greek (English widely spoken)",
      timezone: "EET (UTC+2) / EEST (UTC+3 summer)",
      visaRequired: "No (UK passport holders – 90 days visa-free)",
      waterSafety: "Tap water safe in most areas; bottled water recommended in rural villages",
      plugType: "Type C/F (European 2-pin) – UK adapter needed",
      summary: "Corfu is one of the greenest Greek islands, famous for its Venetian Old Town (UNESCO World Heritage), stunning beaches, and lush countryside. The island offers a perfect mix of culture, relaxation, and adventure. Expect excellent Greek cuisine, friendly locals, and gorgeous sunsets. The road network is good but mountain roads can be narrow.",
    },
    temperatures: [
      { month: "Jan", avgHigh: 14, avgLow: 5, rainfall: 132 },
      { month: "Feb", avgHigh: 14, avgLow: 5, rainfall: 119 },
      { month: "Mar", avgHigh: 16, avgLow: 7, rainfall: 86 },
      { month: "Apr", avgHigh: 19, avgLow: 10, rainfall: 56 },
      { month: "May", avgHigh: 24, avgLow: 14, rainfall: 34 },
      { month: "Jun", avgHigh: 28, avgLow: 17, rainfall: 12 },
      { month: "Jul", avgHigh: 31, avgLow: 20, rainfall: 6 },
      { month: "Aug", avgHigh: 31, avgLow: 20, rainfall: 14 },
      { month: "Sep", avgHigh: 28, avgLow: 17, rainfall: 49 },
      { month: "Oct", avgHigh: 23, avgLow: 14, rainfall: 112 },
      { month: "Nov", avgHigh: 19, avgLow: 10, rainfall: 148 },
      { month: "Dec", avgHigh: 15, avgLow: 7, rainfall: 157 },
    ],
    mustDo: [
      {
        rank: 1, name: "Paleokastritsa", category: "Beach & Nature",
        shortDesc: "Crystal-clear turquoise bays surrounded by dramatic cliffs and olive groves. The jewel of Corfu.",
        websiteUrl: "https://www.visitgreece.gr/islands/ionian-islands/corfu/",
        price: "Free (boat tours from €15pp)", openingHours: "Open 24/7",
        tips: "Arrive early (before 10am) to claim a good spot. Take a glass-bottom boat tour to explore hidden caves.",
        bestFor: "Couples, Families", duration: "Half day", address: "Paleokastritsa, Corfu 491 83"
      },
      {
        rank: 2, name: "Corfu Old Town (UNESCO)", category: "Culture & History",
        shortDesc: "A stunning blend of Venetian, French, and British architecture with narrow cobbled streets (kantounia).",
        websiteUrl: "https://whc.unesco.org/en/list/978",
        price: "Free to explore", openingHours: "Always accessible",
        tips: "Visit the Liston promenade for coffee. Evening strolls are magical when the buildings are lit up.",
        bestFor: "Everyone", duration: "3–4 hours", address: "Kerkyra Old Town, Corfu 491 00"
      },
      {
        rank: 3, name: "Canal d'Amour (Sidari)", category: "Natural Wonder",
        shortDesc: "Unique sandstone rock formations creating narrow channels of crystal water. Legend says couples who swim through will marry.",
        price: "Free", openingHours: "Open 24/7",
        tips: "Best visited in the morning for photos. Water shoes recommended for the rocky entry.",
        bestFor: "Couples, Instagram lovers", duration: "2–3 hours"
      },
      {
        rank: 4, name: "Achilleion Palace", category: "Historical Site",
        shortDesc: "Empress Sisi of Austria's neoclassical palace with breathtaking gardens and panoramic sea views.",
        websiteUrl: "https://achillion-corfu.gr/",
        price: "€10 adults, €5 children", openingHours: "8:00 – 19:00 (summer)",
        tips: "Don't miss the stunning terrace overlooking the sea. The gardens are full of mythological statues.",
        bestFor: "History buffs, Families", duration: "1.5–2 hours", address: "Gastouri, Corfu 490 84"
      },
      {
        rank: 5, name: "Mount Pantokrator", category: "Adventure",
        shortDesc: "Corfu's highest peak (906m) offering 360° views of the island, Albania, and mainland Greece.",
        price: "Free (jeep tours from €45pp)", openingHours: "Daylight hours",
        tips: "Drive or hike. Visit the monastery at the summit. Sunset trips are spectacular.",
        bestFor: "Adventure seekers", duration: "Half day"
      },
      {
        rank: 6, name: "Corfu Donkey Rescue", category: "Family Activity",
        shortDesc: "A heartwarming sanctuary where rescued donkeys roam free. Children can feed and pet them.",
        websiteUrl: "https://corfudonkeyrescue.com/",
        price: "Free (donations welcome)", openingHours: "10:00 – 13:00 (Tue, Thu, Sat)",
        tips: "Bring carrots! The donkeys love treats. Great for young children.",
        bestFor: "Families with kids", duration: "1–2 hours", address: "Doukades, Corfu"
      },
      {
        rank: 7, name: "Boat Trip to Paxos & Antipaxos", category: "Day Trip",
        shortDesc: "Visit the stunning blue caves and swim in the Carribean-like waters of Antipaxos's Voutoumi Beach.",
        price: "€30–€55pp", openingHours: "Departs ~9:00, returns ~18:00",
        tips: "Book in advance during peak season. Bring waterproof camera for the Blue Caves.",
        bestFor: "Everyone", duration: "Full day"
      },
      {
        rank: 8, name: "Aqualand Waterpark", category: "Family Fun",
        shortDesc: "One of the top waterparks in Europe with over 36 slides and attractions for all ages.",
        websiteUrl: "https://aqualand-corfu.com/",
        price: "€28 adults, €19 children", openingHours: "10:00 – 18:00 (May–Oct)",
        tips: "Go on a weekday to avoid long queues. The Kamikaze slide is a must-try for thrill seekers.",
        bestFor: "Families, Teens", duration: "Full day"
      },
      {
        rank: 9, name: "Spianada Square & Cricket", category: "Culture",
        shortDesc: "The largest square in Greece and the only place in the country where cricket is played — a British legacy.",
        price: "Free", openingHours: "Always open",
        tips: "Grab a ginger beer (Tsitsibira) — a local specialty from the British era. Cricket matches on weekends.",
        bestFor: "Everyone", duration: "1–2 hours"
      },
      {
        rank: 10, name: "Traditional Greek Cooking Class", category: "Food & Drink",
        shortDesc: "Learn to make moussaka, pastitsada (Corfu's signature dish), and baklava with a local chef.",
        price: "€55–€80pp", openingHours: "Usually 10:00 – 14:00",
        tips: "Book small-group classes for a more personal experience. You'll eat everything you cook!",
        bestFor: "Foodies, Couples", duration: "4 hours"
      },
    ],
  },
  "Sharm El Sheikh": {
    destination: "Sharm El Sheikh",
    country: "Egypt",
    heroEmoji: "🏜️",
    tagline: "The City of Peace on the Red Sea",
    bestTimeToVisit: {
      months: "October – April",
      reason: "Comfortable temperatures for diving, snorkelling, and desert excursions. Summer (Jun–Sep) exceeds 40°C.",
      peakSeason: "December – February (UK half-term & Christmas)",
      budgetSeason: "November & March (shoulder season, great deals)",
    },
    flightTimesFromUK: {
      directHours: "5h 30m",
      airports: ["Manchester", "London Gatwick", "Newcastle", "Birmingham"],
      airlines: ["TUI", "easyJet", "Wizz Air"],
      tips: "Direct flights run year-round from most UK airports. Flight time is similar from all UK departure points.",
    },
    travelInfo: {
      currency: "Egyptian Pound (EGP) – USD widely accepted",
      language: "Arabic (English widely spoken in tourist areas)",
      timezone: "EET (UTC+2)",
      visaRequired: "Yes – Visa on arrival £25 / can be purchased at airport",
      waterSafety: "Only drink bottled water. Avoid ice in drinks outside main hotels.",
      plugType: "Type C (European 2-pin) – UK adapter needed",
      summary: "Sharm El Sheikh sits at the southern tip of the Sinai Peninsula where the desert meets the Red Sea. World-class coral reefs make it a premier diving destination. The Naama Bay strip is the main tourist hub with restaurants, shops, and nightlife. Very safe resort area with strong security presence. All-inclusive resorts dominate the hotel scene.",
    },
    temperatures: [
      { month: "Jan", avgHigh: 22, avgLow: 12, rainfall: 3 },
      { month: "Feb", avgHigh: 23, avgLow: 13, rainfall: 2 },
      { month: "Mar", avgHigh: 26, avgLow: 15, rainfall: 2 },
      { month: "Apr", avgHigh: 31, avgLow: 19, rainfall: 1 },
      { month: "May", avgHigh: 35, avgLow: 23, rainfall: 0 },
      { month: "Jun", avgHigh: 38, avgLow: 26, rainfall: 0 },
      { month: "Jul", avgHigh: 40, avgLow: 28, rainfall: 0 },
      { month: "Aug", avgHigh: 40, avgLow: 28, rainfall: 0 },
      { month: "Sep", avgHigh: 37, avgLow: 25, rainfall: 0 },
      { month: "Oct", avgHigh: 33, avgLow: 22, rainfall: 2 },
      { month: "Nov", avgHigh: 27, avgLow: 17, rainfall: 3 },
      { month: "Dec", avgHigh: 23, avgLow: 13, rainfall: 3 },
    ],
    mustDo: [
      {
        rank: 1, name: "Ras Mohammed National Park", category: "Nature & Diving",
        shortDesc: "One of the world's top 10 dive sites with stunning coral walls, shipwrecks, and marine life.",
        price: "Park entry $5 + dive from $60pp", openingHours: "8:00 – 17:00",
        tips: "Snorkellers can see incredible reefs from the shore. Bring underwater camera.",
        bestFor: "Divers, Nature lovers", duration: "Full day"
      },
      {
        rank: 2, name: "Naama Bay", category: "Shopping & Nightlife",
        shortDesc: "The vibrant heart of Sharm with restaurants, shisha bars, and the famous Hard Rock Cafe.",
        price: "Free to explore", openingHours: "Shops open 10:00 – late",
        tips: "Haggling is expected in the bazaar. Evening atmosphere is electric.",
        bestFor: "Everyone", duration: "Evening"
      },
      {
        rank: 3, name: "Mount Sinai Sunrise Trek", category: "Adventure",
        shortDesc: "Trek to the summit of the biblical mountain for a breathtaking sunrise over the desert.",
        price: "From £45pp (guided tour)", openingHours: "Depart ~1:00 AM, return ~10:00 AM",
        tips: "Bring warm layers — it's freezing at the top. Camel rides available for part of the ascent.",
        bestFor: "Adventure seekers", duration: "Overnight"
      },
      {
        rank: 4, name: "Quad Biking in the Desert", category: "Adventure",
        shortDesc: "Race across the Sinai desert dunes with a Bedouin tea stop under the stars.",
        price: "From £30pp", openingHours: "Morning or sunset departures",
        tips: "Wear closed shoes and a bandana for dust. Sunset trips include stargazing.",
        bestFor: "Couples, Thrill seekers", duration: "3–4 hours"
      },
      {
        rank: 5, name: "Tiran Island Snorkelling", category: "Marine Life",
        shortDesc: "Crystal-clear waters around four coral reefs teeming with tropical fish and sea turtles.",
        price: "Boat trip from £25pp", openingHours: "Departs ~9:30",
        tips: "Non-swimmers can use the glass-bottom boat option. Reef shoes essential.",
        bestFor: "Families, Snorkellers", duration: "Full day"
      },
      {
        rank: 6, name: "Old Market (Sharm El Maya)", category: "Culture",
        shortDesc: "Authentic Egyptian bazaar with spices, perfumes, papyrus art, and traditional crafts.",
        price: "Free entry", openingHours: "10:00 – 23:00",
        tips: "Start at 50% of the asking price when haggling. Evening visits are cooler.",
        bestFor: "Culture lovers", duration: "2–3 hours"
      },
      {
        rank: 7, name: "Blue Hole (Dahab Day Trip)", category: "Diving",
        shortDesc: "The world-famous underwater sinkhole — a bucket-list dive site just 1 hour from Sharm.",
        price: "Day trip from £55pp", openingHours: "Daylight hours",
        tips: "Snorkelling from the edge is just as spectacular. Visit the chilled-out town of Dahab for lunch.",
        bestFor: "Divers, Day trippers", duration: "Full day"
      },
      {
        rank: 8, name: "Glass Bottom Boat Tour", category: "Family Activity",
        shortDesc: "See the coral reefs without getting wet — perfect for non-swimmers and young children.",
        price: "From £15pp", openingHours: "Morning departures",
        tips: "Choose a boat with swimming stops included for the best value.",
        bestFor: "Families, Non-swimmers", duration: "2–3 hours"
      },
      {
        rank: 9, name: "Bedouin Dinner & Stargazing", category: "Cultural Experience",
        shortDesc: "Traditional Bedouin feast in the desert followed by stargazing with zero light pollution.",
        price: "From £35pp", openingHours: "Evening (18:00 – 22:00)",
        tips: "The Milky Way is clearly visible. Bring a light jacket for the desert evening chill.",
        bestFor: "Couples, Families", duration: "Evening"
      },
      {
        rank: 10, name: "Soho Square", category: "Entertainment",
        shortDesc: "Modern entertainment complex with ice rink, bowling, dancing fountains, and restaurants.",
        price: "Free entry (activities priced individually)", openingHours: "16:00 – midnight",
        tips: "The dancing fountain show (free) runs every evening. Great for families after dark.",
        bestFor: "Families, Teens", duration: "Evening"
      },
    ],
  },
};

const CATEGORY_ICONS: Record<string, React.ReactNode> = {
  "Beach & Nature": <Waves className="h-3.5 w-3.5" />,
  "Culture & History": <Landmark className="h-3.5 w-3.5" />,
  "Natural Wonder": <Mountain className="h-3.5 w-3.5" />,
  "Historical Site": <Landmark className="h-3.5 w-3.5" />,
  "Adventure": <Mountain className="h-3.5 w-3.5" />,
  "Family Activity": <Star className="h-3.5 w-3.5" />,
  "Family Fun": <Star className="h-3.5 w-3.5" />,
  "Day Trip": <Plane className="h-3.5 w-3.5" />,
  "Culture": <Landmark className="h-3.5 w-3.5" />,
  "Food & Drink": <Utensils className="h-3.5 w-3.5" />,
  "Nature & Diving": <Waves className="h-3.5 w-3.5" />,
  "Shopping & Nightlife": <ShoppingBag className="h-3.5 w-3.5" />,
  "Marine Life": <Waves className="h-3.5 w-3.5" />,
  "Diving": <Waves className="h-3.5 w-3.5" />,
  "Cultural Experience": <Music className="h-3.5 w-3.5" />,
  "Entertainment": <Music className="h-3.5 w-3.5" />,
};

function getSeasonIcon(month: string) {
  const hot = ["Jun", "Jul", "Aug"];
  const cold = ["Dec", "Jan", "Feb"];
  const rainy = ["Nov", "Mar"];
  if (hot.includes(month)) return <Sun className="h-3 w-3 text-amber-500" />;
  if (cold.includes(month)) return <Snowflake className="h-3 w-3 text-sky-400" />;
  if (rainy.includes(month)) return <CloudRain className="h-3 w-3 text-slate-400" />;
  return <Wind className="h-3 w-3 text-emerald-400" />;
}

function getBarColor(temp: number) {
  if (temp >= 35) return "#ef4444";
  if (temp >= 30) return "#f97316";
  if (temp >= 25) return "#eab308";
  if (temp >= 20) return "#22c55e";
  if (temp >= 15) return "#06b6d4";
  return "#3b82f6";
}

export function DestinationGuru({
  destination,
  compact = false,
  onClose,
}: {
  destination: string;
  compact?: boolean;
  onClose?: () => void;
}) {
  const [expandedItem, setExpandedItem] = useState<number | null>(null);

  const data = useMemo(() => {
    const key = Object.keys(SAMPLE_DATA).find(
      (k) => k.toLowerCase() === destination?.toLowerCase()
    );
    return key ? SAMPLE_DATA[key] : SAMPLE_DATA["Corfu"];
  }, [destination]);

  const resolvedDest = data.destination;

  return (
    <div className={`${compact ? "" : "max-w-5xl mx-auto"}`} data-testid="destination-guru">
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-sky-600 via-blue-700 to-indigo-800 p-6 md:p-8 mb-5" data-testid="guru-hero">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,rgba(255,255,255,0.15),transparent_70%)]" />
        <div className="absolute -right-10 -top-10 text-[120px] opacity-20 select-none">{data.heroEmoji}</div>
        <div className="relative z-10 flex items-start justify-between">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Sparkles className="h-4 w-4 text-amber-300" />
              <span className="text-xs font-semibold uppercase tracking-widest text-white/70">Destination Guru</span>
            </div>
            <h2 className="text-2xl md:text-3xl font-bold text-white" data-testid="guru-destination-name">
              {resolvedDest}, {data.country}
            </h2>
            <p className="mt-1 text-sm text-white/70">{data.tagline}</p>
          </div>
          {onClose && (
            <Button size="icon" variant="ghost" onClick={onClose} className="text-white/70 hover:text-white hover:bg-white/10 rounded-full" data-testid="button-guru-close">
              <X className="h-5 w-5" />
            </Button>
          )}
        </div>
      </div>

      <div className={`grid gap-4 ${compact ? "grid-cols-1" : "md:grid-cols-2 lg:grid-cols-3"} mb-5`}>
        <Card className="rounded-2xl border-black/10 bg-white/80 dark:bg-white/5 dark:border-white/10 p-4 backdrop-blur-sm" data-testid="card-best-time">
          <div className="flex items-center gap-2 mb-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-amber-500/10">
              <Sun className="h-4 w-4 text-amber-600" />
            </div>
            <h3 className="font-semibold text-sm">Best Time to Visit</h3>
          </div>
          <div className="space-y-2">
            <div className="rounded-xl bg-amber-50 dark:bg-amber-500/10 p-3">
              <div className="text-lg font-bold text-amber-700 dark:text-amber-400" data-testid="text-best-months">{data.bestTimeToVisit.months}</div>
              <p className="text-xs text-black/60 dark:text-white/60 mt-1">{data.bestTimeToVisit.reason}</p>
            </div>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="rounded-lg bg-red-50 dark:bg-red-500/10 p-2">
                <span className="font-semibold text-red-600 dark:text-red-400">Peak</span>
                <p className="text-black/55 dark:text-white/55 mt-0.5">{data.bestTimeToVisit.peakSeason}</p>
              </div>
              <div className="rounded-lg bg-green-50 dark:bg-green-500/10 p-2">
                <span className="font-semibold text-green-600 dark:text-green-400">Budget</span>
                <p className="text-black/55 dark:text-white/55 mt-0.5">{data.bestTimeToVisit.budgetSeason}</p>
              </div>
            </div>
          </div>
        </Card>

        <Card className="rounded-2xl border-black/10 bg-white/80 dark:bg-white/5 dark:border-white/10 p-4 backdrop-blur-sm" data-testid="card-flight-times">
          <div className="flex items-center gap-2 mb-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-sky-500/10">
              <Plane className="h-4 w-4 text-sky-600" />
            </div>
            <h3 className="font-semibold text-sm">Flights from UK</h3>
          </div>
          <div className="space-y-2">
            <div className="rounded-xl bg-sky-50 dark:bg-sky-500/10 p-3 flex items-center gap-3">
              <div>
                <div className="text-lg font-bold text-sky-700 dark:text-sky-400" data-testid="text-flight-time">{data.flightTimesFromUK.directHours}</div>
                <span className="text-[10px] uppercase tracking-wider text-black/40 dark:text-white/40">Direct flight</span>
              </div>
            </div>
            <div className="text-xs">
              <p className="font-medium text-black/70 dark:text-white/70 mb-1">UK Airports:</p>
              <div className="flex flex-wrap gap-1">
                {data.flightTimesFromUK.airports.map((a) => (
                  <span key={a} className="rounded-full bg-black/5 dark:bg-white/10 px-2 py-0.5 text-[10px]">{a}</span>
                ))}
              </div>
            </div>
            <div className="text-xs">
              <p className="font-medium text-black/70 dark:text-white/70 mb-1">Airlines:</p>
              <div className="flex flex-wrap gap-1">
                {data.flightTimesFromUK.airlines.map((a) => (
                  <span key={a} className="rounded-full bg-sky-500/10 text-sky-700 dark:text-sky-300 px-2 py-0.5 text-[10px] font-medium">{a}</span>
                ))}
              </div>
            </div>
            <p className="text-[11px] text-black/45 dark:text-white/45 italic">{data.flightTimesFromUK.tips}</p>
          </div>
        </Card>

        <Card className="rounded-2xl border-black/10 bg-white/80 dark:bg-white/5 dark:border-white/10 p-4 backdrop-blur-sm md:col-span-2 lg:col-span-1" data-testid="card-travel-info">
          <div className="flex items-center gap-2 mb-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-violet-500/10">
              <Globe className="h-4 w-4 text-violet-600" />
            </div>
            <h3 className="font-semibold text-sm">Travel Info</h3>
          </div>
          <div className="space-y-1.5 text-xs">
            {[
              { label: "Currency", value: data.travelInfo.currency },
              { label: "Language", value: data.travelInfo.language },
              { label: "Timezone", value: data.travelInfo.timezone },
              { label: "Visa", value: data.travelInfo.visaRequired },
              { label: "Water", value: data.travelInfo.waterSafety },
              { label: "Plugs", value: data.travelInfo.plugType },
            ].map((item) => (
              <div key={item.label} className="flex gap-2">
                <span className="font-medium text-black/50 dark:text-white/50 w-16 shrink-0">{item.label}</span>
                <span className="text-black/80 dark:text-white/80">{item.value}</span>
              </div>
            ))}
          </div>
          <p className="mt-3 text-[11px] text-black/50 dark:text-white/50 leading-relaxed border-t border-black/5 dark:border-white/5 pt-2">{data.travelInfo.summary}</p>
        </Card>
      </div>

      <Card className="rounded-2xl border-black/10 bg-white/80 dark:bg-white/5 dark:border-white/10 p-4 backdrop-blur-sm mb-5" data-testid="card-temperature-chart">
        <div className="flex items-center gap-2 mb-4">
          <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-orange-500/10">
            <Thermometer className="h-4 w-4 text-orange-600" />
          </div>
          <h3 className="font-semibold text-sm">Average Monthly Temperatures (°C)</h3>
        </div>
        <div className="h-[220px]" data-testid="chart-temperatures">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data.temperatures} margin={{ top: 5, right: 10, left: -15, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.06)" vertical={false} />
              <XAxis dataKey="month" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
              <YAxis tick={{ fontSize: 11 }} tickLine={false} axisLine={false} domain={[0, 'auto']} unit="°" />
              <Tooltip
                contentStyle={{ borderRadius: 12, border: '1px solid rgba(0,0,0,0.1)', boxShadow: '0 4px 20px -4px rgba(0,0,0,0.1)', fontSize: 12 }}
                formatter={(value: number, name: string) => [`${value}°C`, name === 'avgHigh' ? 'High' : name === 'avgLow' ? 'Low' : 'Rainfall (mm)']}
                labelFormatter={(label) => `${label}`}
              />
              <Bar dataKey="avgHigh" radius={[6, 6, 0, 0]} name="avgHigh">
                {data.temperatures.map((entry, i) => (
                  <Cell key={i} fill={getBarColor(entry.avgHigh)} fillOpacity={0.85} />
                ))}
              </Bar>
              <Bar dataKey="avgLow" radius={[6, 6, 0, 0]} fill="#93c5fd" fillOpacity={0.5} name="avgLow" />
            </BarChart>
          </ResponsiveContainer>
        </div>
        <div className="flex items-center justify-center gap-4 mt-2 text-[10px] text-black/50 dark:text-white/50">
          <div className="flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-sm bg-orange-400 inline-block" /> Avg High</div>
          <div className="flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-sm bg-blue-300 inline-block" /> Avg Low</div>
        </div>
      </Card>

      <div className="mb-5" data-testid="section-must-do">
        <div className="flex items-center gap-2 mb-4">
          <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-rose-500/10">
            <Camera className="h-4 w-4 text-rose-600" />
          </div>
          <h3 className="font-semibold text-sm">Top 10 Must-Do in {resolvedDest}</h3>
        </div>
        <div className="space-y-2">
          {data.mustDo.map((item) => {
            const isExpanded = expandedItem === item.rank;
            return (
              <Card
                key={item.rank}
                className={`rounded-2xl border-black/10 dark:border-white/10 backdrop-blur-sm transition-all duration-200 ${isExpanded ? "bg-white dark:bg-white/10 shadow-lg" : "bg-white/70 dark:bg-white/5 hover:bg-white dark:hover:bg-white/8"}`}
                data-testid={`card-must-do-${item.rank}`}
              >
                <button
                  type="button"
                  className="w-full p-4 text-left"
                  onClick={() => setExpandedItem(isExpanded ? null : item.rank)}
                  data-testid={`button-must-do-toggle-${item.rank}`}
                >
                  <div className="flex items-start gap-3">
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-rose-500 to-pink-600 text-white text-xs font-bold shadow-sm">
                      {item.rank}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h4 className="font-semibold text-sm">{item.name}</h4>
                        <span className="inline-flex items-center gap-1 rounded-full bg-black/5 dark:bg-white/10 px-2 py-0.5 text-[10px] font-medium text-black/55 dark:text-white/55">
                          {CATEGORY_ICONS[item.category] || <MapPin className="h-3 w-3" />}
                          {item.category}
                        </span>
                      </div>
                      <p className="mt-1 text-xs text-black/55 dark:text-white/55 leading-relaxed">{item.shortDesc}</p>
                    </div>
                    <div className="shrink-0 mt-1">
                      {isExpanded ? (
                        <ChevronUp className="h-4 w-4 text-black/30 dark:text-white/30" />
                      ) : (
                        <ChevronDown className="h-4 w-4 text-black/30 dark:text-white/30" />
                      )}
                    </div>
                  </div>
                </button>

                {isExpanded && (
                  <div className="px-4 pb-4 pt-0 border-t border-black/5 dark:border-white/5 mt-0" data-testid={`details-must-do-${item.rank}`}>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-2 mt-3">
                      {item.price && (
                        <div className="rounded-xl bg-emerald-50 dark:bg-emerald-500/10 p-2.5">
                          <span className="text-[10px] uppercase tracking-wider text-black/40 dark:text-white/40 font-semibold">Price</span>
                          <p className="text-xs font-medium text-emerald-700 dark:text-emerald-400 mt-0.5">{item.price}</p>
                        </div>
                      )}
                      {item.openingHours && (
                        <div className="rounded-xl bg-blue-50 dark:bg-blue-500/10 p-2.5">
                          <span className="text-[10px] uppercase tracking-wider text-black/40 dark:text-white/40 font-semibold">Hours</span>
                          <p className="text-xs font-medium text-blue-700 dark:text-blue-400 mt-0.5">{item.openingHours}</p>
                        </div>
                      )}
                      {item.duration && (
                        <div className="rounded-xl bg-violet-50 dark:bg-violet-500/10 p-2.5">
                          <span className="text-[10px] uppercase tracking-wider text-black/40 dark:text-white/40 font-semibold">Duration</span>
                          <p className="text-xs font-medium text-violet-700 dark:text-violet-400 mt-0.5">{item.duration}</p>
                        </div>
                      )}
                      {item.bestFor && (
                        <div className="rounded-xl bg-pink-50 dark:bg-pink-500/10 p-2.5">
                          <span className="text-[10px] uppercase tracking-wider text-black/40 dark:text-white/40 font-semibold">Best For</span>
                          <p className="text-xs font-medium text-pink-700 dark:text-pink-400 mt-0.5">{item.bestFor}</p>
                        </div>
                      )}
                      {item.address && (
                        <div className="rounded-xl bg-slate-50 dark:bg-slate-500/10 p-2.5 col-span-2">
                          <span className="text-[10px] uppercase tracking-wider text-black/40 dark:text-white/40 font-semibold">Address</span>
                          <p className="text-xs font-medium text-black/70 dark:text-white/70 mt-0.5">{item.address}</p>
                        </div>
                      )}
                    </div>
                    {item.tips && (
                      <div className="mt-2 rounded-xl bg-amber-50 dark:bg-amber-500/10 p-2.5">
                        <span className="text-[10px] uppercase tracking-wider text-black/40 dark:text-white/40 font-semibold">💡 Agent Tip</span>
                        <p className="text-xs text-amber-800 dark:text-amber-300 mt-0.5">{item.tips}</p>
                      </div>
                    )}
                    {item.websiteUrl && (
                      <a
                        href={item.websiteUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="mt-2 inline-flex items-center gap-1.5 text-xs font-medium text-sky-600 hover:text-sky-700 dark:text-sky-400 dark:hover:text-sky-300 transition-colors"
                        data-testid={`link-must-do-website-${item.rank}`}
                      >
                        <ExternalLink className="h-3 w-3" />
                        Visit Website
                      </a>
                    )}
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      </div>

      <div className="rounded-2xl border border-dashed border-black/10 dark:border-white/10 bg-black/[0.02] dark:bg-white/[0.02] p-4 text-center" data-testid="guru-ai-notice">
        <Sparkles className="h-4 w-4 text-amber-500 mx-auto mb-1" />
        <p className="text-[11px] text-black/40 dark:text-white/40">
          AI-generated destination intelligence — data will be refreshed automatically when quotes are created
        </p>
      </div>
    </div>
  );
}

export function DestinationGuruCard({
  destination,
  country,
  onClick,
}: {
  destination: string;
  country: string;
  onClick: () => void;
}) {
  const data = SAMPLE_DATA[destination];
  const maxTemp = data ? Math.max(...data.temperatures.map(t => t.avgHigh)) : 0;
  const bestMonths = data?.bestTimeToVisit.months || "";

  return (
    <button
      type="button"
      onClick={onClick}
      className="group w-full text-left rounded-2xl border border-black/10 dark:border-white/10 bg-white/80 dark:bg-white/5 backdrop-blur-sm overflow-hidden transition-all hover:shadow-lg hover:border-black/15 dark:hover:border-white/15 hover:-translate-y-0.5"
      data-testid={`card-guru-destination-${destination.toLowerCase().replace(/\s+/g, '-')}`}
    >
      <div className="h-24 bg-gradient-to-br from-sky-500 via-blue-600 to-indigo-700 relative overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,rgba(255,255,255,0.2),transparent_70%)]" />
        <div className="absolute right-3 top-2 text-[48px] opacity-30 select-none">{data?.heroEmoji || "🌍"}</div>
        <div className="absolute bottom-3 left-4">
          <h3 className="text-lg font-bold text-white">{destination}</h3>
          <p className="text-xs text-white/70">{country}</p>
        </div>
      </div>
      <div className="p-3">
        <div className="flex items-center justify-between text-xs">
          <span className="text-black/50 dark:text-white/50">{bestMonths}</span>
          <span className="font-semibold text-orange-600">↑ {maxTemp}°C</span>
        </div>
        <div className="mt-2 flex gap-0.5">
          {(data?.temperatures || []).map((t, i) => (
            <div
              key={i}
              className="flex-1 rounded-sm"
              style={{ height: `${Math.max(4, t.avgHigh * 0.8)}px`, backgroundColor: getBarColor(t.avgHigh), opacity: 0.7 }}
            />
          ))}
        </div>
        <div className="mt-2 flex items-center gap-1 text-[10px] text-sky-600 dark:text-sky-400 font-medium group-hover:text-sky-700 transition-colors">
          <Sparkles className="h-3 w-3" /> View destination intelligence
        </div>
      </div>
    </button>
  );
}

export { SAMPLE_DATA };

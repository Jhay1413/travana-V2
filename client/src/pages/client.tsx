import { useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";
import { useLocation, useRoute } from "wouter";
import { CommandCenterShell } from "@/components/command-center-shell";
import { useRole } from "@/hooks/use-role";
import {
  BadgeCheck,
  Calendar,
  ChevronLeft,
  ChevronRight,
  Clock,
  FileText,
  Filter,
  Globe,
  Home,
  Mail,
  MapPin,
  Pencil,
  Phone,
  Plane,
  Search,
  Sparkles,
  Ticket,
  ImagePlus,
  TrendingUp,
  Trash2,
  UserRound,
  X,
  Pin,
  PinOff,
  Anchor,
  PawPrint,
  Hotel,
  Plus,
  ArrowRightLeft,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Spinner } from "@/components/ui/spinner";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { Switch } from "@/components/ui/switch";
import { useNeonClient, useTransactions, useTicketsByClient, useUsers, useCurrentUser, useCountries, useDestinations, useResorts, useAccommodations, useBoardBasis, useParks, useLodges, useCottages, useAirports, useTourOperators, usePackageTypes, useRoomTypes } from "@/hooks/queries";
import { useUpdateClient, useUpdateNeonClient, useCreateQuote, useCreateTicket, useUpdateTicket, useCreateEnquiry, useUpdateEnquiry, useDeleteEnquiry, useCreateTransaction } from "@/hooks/mutations";
import { useFavorites } from "@/hooks/queries/use-favorite-queries";
import { useToggleFavorite } from "@/hooks/mutations/use-favorite-mutations";
import type { Favorite } from "@/api/endpoints/favorite.api";
import type { Client as ApiClient } from "@/types/client";
import type { NeonClient } from "@/types/neon-client";
import type { Ticket as ApiTicket } from "@/types/ticket";
import type { CreateQuoteData, Transaction, EnquiryTable, Quote as ApiQuote, Booking, DealImage } from "@/types/quote";
import type { Enquiry } from "@/types/enquiry";
import type { LookupPackageType, LookupCountry, LookupDestination, LookupResort, LookupAccommodation, LookupBoardBasis, LookupPark, LookupLodge } from "@/api/endpoints/lookup.api";
import type { Airport } from "@/types/airport";
import type { TourOperator } from "@/types/tour-operator";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import { EnquiryWizard } from "@/components/enquiry-wizard";
import { DatePicker } from "@/components/ui/date-picker";

type QuoteWithJoins = ApiQuote & { holiday_type_name?: string };
type BookingWithJoins = Booking & { images?: DealImage[]; holiday_type_name?: string };

type Stage = "Enquiry" | "Quote" | "Booked";

type ClientTier = "Platinum" | "Gold" | "Standard";

type Client = {
  id: string;
  name: string;
  tier: ClientTier;
  stage: Stage;
  location: string;
  nextTrip: string;
  value: number;
  lastTouch: string;
  email: string;
  phone: string;
  tags: string[];
};

type TicketItem = {
  id: string;
  subject: string;
  type: string;
  status: string;
  priority: string;
  description: string | null;
  createdAt: string;
  updatedAt: string | null;
  userId: string;
};

type FileItem = {
  id: string;
  name: string;
  type: "PDF" | "DOC" | "IMG";
  updated: string;
};

const currency = new Intl.NumberFormat("en-GB", {
  style: "currency",
  currency: "GBP",
  maximumFractionDigits: 0,
});

function tierPill(tier: ClientTier) {
  switch (tier) {
    case "Platinum":
      return "border-violet-500/25 bg-violet-500/10 text-violet-700";
    case "Gold":
      return "border-amber-500/25 bg-amber-500/10 text-amber-800";
    default:
      return "border-black/10 bg-black/[0.03] text-black/70";
  }
}

function stagePill(stage: Stage) {
  switch (stage) {
    case "Booked":
      return "border-emerald-500/25 bg-emerald-500/10 text-emerald-800";
    case "Quote":
      return "border-sky-500/25 bg-sky-500/10 text-sky-800";
    default:
      return "border-fuchsia-500/25 bg-fuchsia-500/10 text-fuchsia-800";
  }
}

function transformClientData(apiData: ApiClient): Client {
  return {
    id: apiData.id,
    name: apiData.name,
    tier: apiData.tier as ClientTier,
    stage: apiData.stage as Stage,
    location: apiData.location || "",
    nextTrip: apiData.nextTrip || "",
    value: parseFloat(apiData.value || "0"),
    lastTouch: apiData.lastTouch || "",
    email: apiData.email ?? "",
    phone: apiData.phone ?? "",
    tags: apiData.tags,
  };
}

function transformNeonClientData(apiData: NeonClient): Client {
  return {
    id: apiData.id,
    name: [apiData.firstName, apiData.surename].filter(Boolean).join(" ") || "Unknown",
    tier: "Standard" as ClientTier,
    stage: "Enquiry" as Stage,
    location: [apiData.city, apiData.country].filter(Boolean).join(", "),
    nextTrip: "",
    value: 0,
    lastTouch: "",
    email: apiData.email || "",
    phone: apiData.phoneNumber || "",
    tags: apiData.badge ? [apiData.badge] : [],
  };
}

function transformTicket(ticket: ApiTicket): TicketItem {
  return {
    id: ticket.id,
    subject: ticket.subject,
    type: ticket.type,
    status: ticket.status,
    priority: ticket.priority,
    description: ticket.description,
    createdAt: ticket.createdAt,
    updatedAt: ticket.updatedAt,
    userId: ticket.userId,
  };
}

function formatTicketDate(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  
  if (diffDays === 0) return "Today";
  if (diffDays === 1) return "Yesterday";
  if (diffDays < 7) return `${diffDays}d ago`;
  if (diffDays < 30) return `${Math.floor(diffDays / 7)}w ago`;
  return date.toLocaleDateString("en-GB", { day: "2-digit", month: "2-digit", year: "numeric" });
}

function ticketStatusPill(status: string) {
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

function ticketTypePill(type: string) {
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

function filesFor(clientId: string): FileItem[] {
  return [
    { id: `${clientId}-F1`, name: "Passport scan", type: "IMG", updated: "Today" },
    { id: `${clientId}-F2`, name: "Quote v3", type: "PDF", updated: "2d" },
    { id: `${clientId}-F3`, name: "Itinerary draft", type: "DOC", updated: "6d" },
  ];
}

type QuotePassenger = {
  adults: number;
  children: number;
  infants: number;
  childAges: number[];
};

type QuoteFlightLeg = {
  departAirport: string;
  departCity: string;
  departDate: string;
  departTime: string;
  arriveAirport: string;
  arriveCity: string;
  arriveDate: string;
  arriveTime: string;
};

type QuoteCommission = {
  tourOperator: string;
  sales: number;
  price: number;
  commission: number;
  discount: number;
  serviceCharge: number;
  pricePerPerson: number;
};

type Quote = {
  id: string;
  packageType: string;
  quoteTitle: string;
  quoteLink: string;
  images: { id: string; label: string }[];
  travelDate: string;
  passengers: QuotePassenger;
  country: string;
  destination: string;
  resort: string;
  accommodation: string;
  checkInDate: string;
  checkInTime: string;
  nights: number;
  boardBasis: string;
  roomType: string;
  transferType: string;
  preBookedSeats: string;
  flightMeals: string;
  flights: {
    outbound: QuoteFlightLeg;
    inbound: QuoteFlightLeg;
  };
  commissions: QuoteCommission;
  jsonPayload: string;
};

function safeJsonParse(value: string): { ok: true; data: unknown } | { ok: false; error: string } {
  try {
    const data = JSON.parse(value);
    return { ok: true, data };
  } catch (e: unknown) {
    return { ok: false, error: e instanceof Error ? e.message : "Invalid JSON" };
  }
}

function formatPax(p: QuotePassenger) {
  const parts: string[] = [];
  parts.push(`${p.adults} adult${p.adults === 1 ? "" : "s"}`);
  if (p.children > 0) parts.push(`${p.children} child${p.children === 1 ? "" : "ren"}`);
  if (p.infants > 0) parts.push(`${p.infants} infant${p.infants === 1 ? "" : "s"}`);
  return parts.join(" · ");
}

function computePaxTotal(p: QuotePassenger) {
  return p.adults + p.children + p.infants;
}

function formatUKDate(value: string) {
  const m = /^([0-9]{4})-([0-9]{2})-([0-9]{2})$/.exec(value.trim());
  if (!m) return value;
  return `${m[3]}/${m[2]}/${m[1]}`;
}

const seedQuote: Quote = {
  id: "Q-00038",
  packageType: "Package (Flight + Hotel)",
  quoteTitle: "Maldives — Overwater Villa, 9 nights",
  quoteLink: "https://example.com/quotes/Q-00038",
  images: [
    { id: "img-hero", label: "Resort hero" },
    { id: "img-room", label: "Room" },
    { id: "img-beach", label: "Beach" },
  ],
  travelDate: "2026-04-12",
  passengers: { adults: 2, children: 1, infants: 0, childAges: [7] },
  country: "United Kingdom",
  destination: "Maldives",
  resort: "North Malé Atoll",
  accommodation: "Azure Overwater Resort",
  checkInDate: "2026-04-12",
  checkInTime: "15:00",
  nights: 9,
  boardBasis: "Half Board",
  roomType: "Overwater Villa",
  transferType: "Seaplane",
  preBookedSeats: "Extra legroom (row 12)",
  flightMeals: "Standard + child meal",
  flights: {
    outbound: {
      departAirport: "LHR",
      departCity: "London Heathrow",
      departDate: "2026-04-12",
      departTime: "21:10",
      arriveAirport: "MLE",
      arriveCity: "Malé",
      arriveDate: "2026-04-13",
      arriveTime: "11:55",
    },
    inbound: {
      departAirport: "MLE",
      departCity: "Malé",
      departDate: "2026-04-22",
      departTime: "09:15",
      arriveAirport: "LHR",
      arriveCity: "London Heathrow",
      arriveDate: "2026-04-22",
      arriveTime: "18:05",
    },
  },
  commissions: {
    tourOperator: "Luxury Escapes UK",
    sales: 18450,
    price: 18450,
    commission: 1380,
    discount: 250,
    serviceCharge: 120,
    pricePerPerson: 6150,
  },
  jsonPayload: JSON.stringify(
    {
      quoteId: "Q-00038",
      packageType: "Package (Flight + Hotel)",
      destination: "Maldives",
      pax: { adults: 2, children: [{ age: 7 }], infants: 0 },
      room: { type: "Overwater Villa", board: "Half Board" },
      transfers: "Seaplane",
    },
    null,
    2,
  ),
};

export default function ClientPage() {
  const [, navigate] = useLocation();
  const [, params] = useRoute("/clients/:clientId");
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { role, setRole } = useRole();
  const [active] = useState<string>("clients");
  const [q, setQ] = useState("");
  type ClientTab = "overview" | "enquiries" | "quotes" | "booked" | "files" | "tickets";
  const [tab, setTab] = useState<ClientTab>("overview");
  const [showEditClient, setShowEditClient] = useState(false);
  const [editForm, setEditForm] = useState({
    title: "",
    firstName: "",
    surename: "",
    phoneNumber: "",
    email: "",
    DOB: "",
    houseNumber: "",
    street: "",
    city: "",
    country: "",
    post_code: "",
    badge: "",
  });
  const [showNewQuoteModal, setShowNewQuoteModal] = useState(false);
  const [newQuoteIsBooking, setNewQuoteIsBooking] = useState(false);
  const [convertingFromEnquiryTxnId, setConvertingFromEnquiryTxnId] = useState<string | null>(null);
  const [convertingEnquiryId, setConvertingEnquiryId] = useState<string | null>(null);
  const [showUploadFileModal, setShowUploadFileModal] = useState(false);
  const [uploadFile, setUploadFile] = useState<{
    file: File | null;
    title: string;
    fileType: string;
    allocationType: string;
    allocationId: string;
  }>({
    file: null,
    title: "",
    fileType: "",
    allocationType: "",
    allocationId: "",
  });
  const [uploadedFiles, setUploadedFiles] = useState<{
    id: string;
    name: string;
    title: string;
    type: string;
    category: string;
    allocationType: string;
    allocationId: string;
    updated: string;
    url: string;
  }[]>([]);
  const newQuoteDefaults = {
    packageType: "",
    quoteTitle: "",
    quoteLink: "",
    jsonPayload: "",
    travelDate: "",
    passengersAdults: 2,
    passengersChildren: 0,
    passengersInfants: 0,
    childAges: [] as number[],
    country: "",
    destination: "",
    resort: "",
    accommodation: "",
    checkInDate: "",
    checkInTime: "",
    nights: 7,
    boardBasis: "",
    roomType: "",
    transferType: "",
    preBookedSeats: "",
    flightMeals: "",
    leadSource: "",
    outboundDepartAirport: "",
    outboundDepartDate: "",
    outboundDepartTime: "",
    outboundArriveAirport: "",
    outboundArriveDate: "",
    outboundArriveTime: "",
    inboundDepartAirport: "",
    inboundDepartDate: "",
    inboundDepartTime: "",
    inboundArriveAirport: "",
    inboundArriveDate: "",
    inboundArriveTime: "",
    tourOperator: "",
    sales: 0,
    price: 0,
    commission: 0,
    discount: 0,
    serviceCharge: 0,
    pricePerPerson: 0,
    returnDate: "",
    haysReference: "",
    tourReference: "",
    cruiseTitle: "",
    cruiseLine: "",
    shipName: "",
    cruiseDate: "",
    cabinType: "",
    embarkation: "",
    debarkation: "",
    cruiseExtras: "",
    cruiseOnly: false,
    lodgeCode: "",
    parkName: "",
    pets: false,
  };
  const [newQuote, setNewQuote] = useState(newQuoteDefaults);
  const [quoteImageFiles, setQuoteImageFiles] = useState<File[]>([]);
  const [quoteImageUrls, setQuoteImageUrls] = useState<string[]>([]);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const clientId = params?.clientId ?? "";

  const { data: clientData, isLoading: isLoadingClient } = useNeonClient(clientId);

  const { data: transactionsData, isLoading: isLoadingTransactions } = useTransactions({ clientId });

  const { data: ticketsData, isLoading: isLoadingTickets } = useTicketsByClient(clientId);

  const { data: usersData } = useUsers();

  const { data: currentUser } = useCurrentUser();

  const { data: countriesData } = useCountries();
  const { data: destinationsData } = useDestinations(newQuote.country);
  const { data: resortsData } = useResorts(newQuote.destination);
  const { data: accommodationsData } = useAccommodations(newQuote.resort);
  const { data: boardBasisData } = useBoardBasis();
  const { data: roomTypeData } = useRoomTypes();
  const { data: airportsData } = useAirports();
  const { data: tourOperatorsData } = useTourOperators();
  const { data: packageTypesData } = usePackageTypes();
  const packageTypeName = useMemo(() => {
    if (!newQuote.packageType || !packageTypesData) return "";
    const pt = packageTypesData?.find((p) => p.id === newQuote.packageType);
    return pt?.name || "";
  }, [newQuote.packageType, packageTypesData]);
  const { data: parksData } = useParks();
  const { data: lodgesData } = useLodges(newQuote.parkName);
  const { data: userFavorites } = useFavorites();
  const toggleFavoriteMutation = useToggleFavorite();
  const isClientPinned = useMemo(() => {
    if (!userFavorites || !clientId) return false;
    return userFavorites.some((f: Favorite) => f.itemType === "client" && f.itemId === clientId);
  }, [userFavorites, clientId]);

  const updateClientMutationHook = useUpdateClient();
  const updateClientMutation = {
    mutate: (args: { id: string; data: Partial<ApiClient> }) => {
      updateClientMutationHook.mutate(args, {
        onSuccess: () => {
          toast({ title: "Client updated" });
        },
        onError: () => {
          toast({ title: "Failed to update client", variant: "destructive" });
        },
      });
    },
  };

  const updateNeonClientMutation = useUpdateNeonClient();

  const openEditDialog = () => {
    if (clientData) {
      setEditForm({
        title: clientData.title || "",
        firstName: clientData.firstName || "",
        surename: clientData.surename || "",
        phoneNumber: clientData.phoneNumber || "",
        email: clientData.email || "",
        DOB: clientData.DOB || "",
        houseNumber: clientData.houseNumber || "",
        street: clientData.street || "",
        city: clientData.city || "",
        country: clientData.country || "",
        post_code: clientData.post_code || "",
        badge: clientData.badge || "",
      });
      setShowEditClient(true);
    }
  };

  const handleSaveClient = () => {
    const updates: Record<string, string | boolean | null> = {};
    if (editForm.title) updates.title = editForm.title;
    if (editForm.firstName) updates.firstName = editForm.firstName;
    if (editForm.surename) updates.surename = editForm.surename;
    updates.phoneNumber = editForm.phoneNumber;
    updates.email = editForm.email || null;
    updates.DOB = editForm.DOB || null;
    updates.houseNumber = editForm.houseNumber || null;
    updates.street = editForm.street || null;
    updates.city = editForm.city || null;
    updates.country = editForm.country || null;
    updates.post_code = editForm.post_code || null;
    updates.badge = editForm.badge || null;

    updateNeonClientMutation.mutate(
      { id: clientId, data: updates },
      {
        onSuccess: () => {
          setShowEditClient(false);
          toast({ title: "Client updated successfully" });
        },
        onError: () => {
          toast({ title: "Failed to update client", variant: "destructive" });
        },
      }
    );
  };

  const createQuoteMutationHook = useCreateQuote();
  const createQuoteMutation = {
    mutate: async (data: CreateQuoteData) => {
      createQuoteMutationHook.mutate(data, {
        onSuccess: (createdQuote) => {
          if (quoteImageFiles.length > 0 || quoteImageUrls.length > 0) {
            queryClient.invalidateQueries({ queryKey: ["quotes"] });
          }
          setQuoteImageFiles([]);
          setQuoteImageUrls([]);
          const wasBooking = newQuoteIsBooking;
          setShowNewQuoteModal(false);
          setNewQuoteIsBooking(false);
          setNewQuote(newQuoteDefaults);
          toast({ title: wasBooking ? "Booking created successfully" : "Quote created successfully" });
          if (wasBooking) {
            navigate(`/clients/${clientId}/bookings/${createdQuote.id}`);
          }
        },
        onError: (error: Error) => {
          toast({ title: error.message || "Failed to create quote", variant: "destructive" });
        },
      });
    },
  };

  const [showEnquiryWizard, setShowEnquiryWizard] = useState(false);
  const [editingEnquiry, setEditingEnquiry] = useState<EnquiryTable | null>(null);
  const createEnquiryMutation = useCreateEnquiry();
  const updateEnquiryMutation = useUpdateEnquiry();
  const deleteEnquiryMutation = useDeleteEnquiry();
  const createTransactionMutation = useCreateTransaction();

  const handleEnquirySubmit = (data: Partial<EnquiryTable> & Record<string, unknown>) => {
    if (editingEnquiry) {
      updateEnquiryMutation.mutate(
        { id: editingEnquiry.id, data: data as Partial<EnquiryTable> },
        {
          onSuccess: () => {
            setShowEnquiryWizard(false);
            setEditingEnquiry(null);
            toast({ title: "Enquiry updated successfully" });
          },
          onError: () => {
            toast({ title: "Failed to update enquiry", variant: "destructive" });
          },
        }
      );
    } else {
      createTransactionMutation.mutate(
        {
          client_id: clientId,
          user_id: currentUser?.id || "",
          lead_source: undefined,
          enquiry: {
            title: data.enquiryTitle || data.title || "",
            holiday_type_id: data.holidayType || data.holiday_type_id || "",
            travel_date: data.travelDate || data.travel_date || undefined,
            adults: data.passengersAdults || data.adults || undefined,
            children: data.passengersChildren || data.children || undefined,
            infants: data.passengersInfants || data.infants || undefined,
            no_of_nights: data.nights || data.no_of_nights || undefined,
            budget: data.budget || undefined,
            max_budget: data.max_budget || undefined,
            budget_type: data.budgetType || data.budget_type || undefined,
            cabin_type: data.cabinType || data.cabin_type || undefined,
            accom_min_star_rating: data.accom_min_star_rating || undefined,
            flexibility_date: data.flexibility_date || undefined,
            flexible_date: data.flexible_date || undefined,
            weekend_lodge: data.weekend_lodge || undefined,
            no_of_guests: data.no_of_guests || undefined,
            no_of_pets: data.no_of_pets || undefined,
            accomodation_type_id: data.accomodation_type_id || undefined,
            pre_cruise_stay: data.pre_cruise_stay || undefined,
            post_cruise_stay: data.post_cruise_stay || undefined,
            status: "ACTIVE",
            destinations: data.destinations || undefined,
            resorts: data.resorts || undefined,
            boardBases: data.boardBases || undefined,
            departureAirports: data.departureAirports || undefined,
          },
        },
        {
          onSuccess: () => {
            setShowEnquiryWizard(false);
            toast({ title: "Enquiry created successfully" });
          },
          onError: () => {
            toast({ title: "Failed to create enquiry", variant: "destructive" });
          },
        }
      );
    }
  };

  const handleDeleteEnquiry = (id: string) => {
    deleteEnquiryMutation.mutate(id, {
      onSuccess: () => {
        toast({ title: "Enquiry deleted" });
      },
      onError: () => {
        toast({ title: "Failed to delete enquiry", variant: "destructive" });
      },
    });
  };

  const handleConvertEnquiryToQuote = (enq: EnquiryTable) => {
    const firstDestination = enq.destinations?.[0];
    const firstResort = enq.resorts?.[0];
    const firstAirport = enq.airports?.[0];
    const firstBoardBasis = enq.boardBases?.[0];

    setNewQuote({
      ...newQuoteDefaults,
      packageType: enq.holiday_type_id || "",
      quoteTitle: enq.title || "",
      travelDate: enq.travel_date || "",
      passengersAdults: enq.adults || 2,
      passengersChildren: enq.children || 0,
      passengersInfants: enq.infants || 0,
      nights: enq.no_of_nights || 7,
      destination: firstDestination?.destination_id || "",
      resort: firstResort?.resort_id || "",
      boardBasis: firstBoardBasis?.board_basis_id || "",
      outboundDepartAirport: firstAirport?.airport_id || "",
      cabinType: enq.cabin_type || "",
      pets: (enq.no_of_pets && enq.no_of_pets > 0) ? true : false,
    });
    setConvertingFromEnquiryTxnId(enq.transaction_id);
    setConvertingEnquiryId(enq.id);
    setShowNewQuoteModal(true);
  };

  const client = useMemo(() => {
    if (!clientData) return null;
    return transformNeonClientData(clientData);
  }, [clientData]);

  const transactions = useMemo(() => transactionsData || [], [transactionsData]);
  const quotes = useMemo(() => transactions.flatMap((t: Transaction) => t.quotes || []), [transactions]);
  const enquiries = useMemo(() => transactions.map((t: Transaction) => t.enquiry).filter(Boolean) as EnquiryTable[], [transactions]);
  const bookings = useMemo(() => transactions.map((t: Transaction) => t.booking).filter((b): b is NonNullable<Transaction["booking"]> => Boolean(b)), [transactions]);

  const tickets = useMemo(() => (ticketsData ? ticketsData.map(transformTicket) : []), [ticketsData]);
  const files = useMemo(() => (client ? filesFor(client.id) : []), [client]);

  const getUserName = (userId: string) => {
    const user = usersData?.find((u) => u.id === userId);
    return user?.name || "Unassigned";
  };

  const filteredTickets = useMemo(() => {
    const query = q.trim().toLowerCase();
    if (!query) return tickets;
    return tickets.filter((t) =>
      `${t.id} ${t.subject} ${t.status} ${t.type} ${t.priority}`.toLowerCase().includes(query),
    );
  }, [q, tickets]);

  const filteredFiles = useMemo(() => {
    const query = q.trim().toLowerCase();
    if (!query) return files;
    return files.filter((f) => `${f.id} ${f.name} ${f.type} ${f.updated}`.toLowerCase().includes(query));
  }, [q, files]);

  if (isLoadingClient) {
    return (
      <CommandCenterShell
        role={role}
        onRoleChange={setRole}
        active={active}
        title="Client"
        query={q}
        onQuery={setQ}
        theme="light"
        onToggleTheme={() => {}}
      >
        <div className="flex h-[calc(100vh-56px)] items-center justify-center" data-testid="loading-client">
          <Spinner className="h-8 w-8" />
        </div>
      </CommandCenterShell>
    );
  }

  if (!client) {
    return (
      <CommandCenterShell
        role={role}
        onRoleChange={setRole}
        active={active}
        title="Client"
        query={q}
        onQuery={setQ}
        theme="light"
        onToggleTheme={() => {}}
      >
        <div className="flex h-[calc(100vh-56px)] items-center justify-center" data-testid="error-client">
          <div className="text-center">
            <p className="text-sm text-black/70">Client not found</p>
            <Button
              size="sm"
              variant="outline"
              className="mt-4"
              onClick={() => navigate("/clients")}
            >
              Back to Clients
            </Button>
          </div>
        </div>
      </CommandCenterShell>
    );
  }

  return (
    <CommandCenterShell
      role={role}
      onRoleChange={setRole}
      active={active}
      title={client.name}
      query={q}
      onQuery={setQ}
      theme="light"
      onToggleTheme={() => {}}
      headerExtra={
        <Select
          value={clientData?.badge || "New Client"}
          onValueChange={(value) => {
            if (clientId) {
              updateNeonClientMutation.mutate(
                { id: clientId, data: { badge: value } },
                {
                  onSuccess: () => {
                    toast({ title: "Client type updated" });
                  },
                  onError: () => {
                    toast({ title: "Failed to update client type", variant: "destructive" });
                  },
                }
              );
            }
          }}
        >
          <SelectTrigger
            className="h-auto w-auto rounded-full border-[#3b82f6]/30 bg-[#3b82f6]/10 px-3 py-1 text-xs font-semibold text-[#3b82f6] hover:bg-[#3b82f6]/20"
            data-testid="select-client-type-header"
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent className="z-[400]">
            <SelectItem value="New Client">New Client</SelectItem>
            <SelectItem value="Repeat Client">Repeat Client</SelectItem>
            <SelectItem value="VIP Client">VIP Client</SelectItem>
            <SelectItem value="Family Member">Family Member</SelectItem>
            <SelectItem value="Time Waster">Time Waster</SelectItem>
            <SelectItem value="Banned">Banned</SelectItem>
          </SelectContent>
        </Select>
      }
    >
      <div className="relative min-h-[calc(100vh-56px)] w-full px-4 pb-6 md:px-6 md:pb-8">
        <div className="relative mt-6 grid gap-3 lg:grid-cols-12" data-testid="layout-client-page">
          <Card className="glass ringed grain rounded-3xl border-black/10 bg-white/60 p-4 lg:col-span-4">
            <div className="flex items-center justify-between gap-3">
              <button
                type="button"
                onClick={() => navigate("/clients")}
                className="inline-flex items-center gap-2 rounded-2xl border border-black/10 bg-white/70 px-3 py-2 text-xs font-semibold text-black/75 transition hover:bg-black/[0.03]"
                data-testid="button-back-clients"
              >
                <ChevronLeft className="h-4 w-4" />
                Back
              </button>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    const clientName = client?.name || "Client";
                    const subtitle = client?.phone || client?.email || "";
                    toggleFavoriteMutation.mutate(
                      { itemType: "client", itemId: clientId, label: clientName, subtitle },
                      { onSuccess: (data: { favorited?: boolean; favorite?: Favorite }) => { toast({ title: data?.favorited ? "Pinned to dashboard" : "Unpinned from dashboard" }); } }
                    );
                  }}
                  className={`inline-flex items-center gap-2 rounded-2xl border px-3 py-2 text-xs font-semibold transition ${isClientPinned ? "border-amber-500/30 bg-amber-500/10 text-amber-700 hover:bg-amber-500/15" : "border-black/10 bg-white/70 text-black/75 hover:bg-black/[0.03]"}`}
                  data-testid="button-pin-client"
                >
                  {isClientPinned ? <PinOff className="h-4 w-4" /> : <Pin className="h-4 w-4" />}
                  {isClientPinned ? "Unpin" : "Pin"}
                </button>
                <button
                  type="button"
                  onClick={openEditDialog}
                  className="inline-flex items-center gap-2 rounded-2xl border border-black/10 bg-white/70 px-3 py-2 text-xs font-semibold text-black/75 transition hover:bg-black/[0.03]"
                  data-testid="button-edit-client"
                >
                  <Pencil className="h-4 w-4" />
                  Edit
                </button>
              </div>
            </div>

            <div className="mt-4 rounded-3xl border border-black/10 bg-white/70 p-4" data-testid="card-client-summary">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-baseline gap-3" data-testid="text-client-name">
                    <span className="text-lg font-semibold">{client ? client.name : "Client"}</span>
                    {client?.phone && (
                      <a
                        href={`tel:${client.phone.replace(/\s/g, '')}`}
                        className="inline-flex items-center gap-1 text-sm font-bold text-[#000000c4] hover:text-[#3b82f6] transition-colors"
                        data-testid="text-client-phone-header"
                      >
                        <Phone className="h-3.5 w-3.5" />
                        {client.phone}
                      </a>
                    )}
                  </div>
                  {client ? (
                    <div className="mt-3 flex flex-wrap items-center gap-2">
                      <Select
                        value={clientData?.badge || "New Client"}
                        onValueChange={(value) => {
                          if (clientId) {
                            updateClientMutation.mutate({ id: clientId, data: { clientType: value } });
                          }
                        }}
                      >
                        <SelectTrigger
                          className="h-auto w-auto rounded-full border-[#3b82f6]/30 bg-[#3b82f6]/10 px-2.5 py-0.5 text-xs font-semibold text-[#3b82f6] hover:bg-[#3b82f6]/20"
                          data-testid="select-client-type"
                        >
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="z-[400]">
                          <SelectItem value="New Client">New Client</SelectItem>
                          <SelectItem value="Repeat Client">Repeat Client</SelectItem>
                          <SelectItem value="VIP Client">VIP Client</SelectItem>
                          <SelectItem value="Family Member">Family Member</SelectItem>
                          <SelectItem value="Time Waster">Time Waster</SelectItem>
                          <SelectItem value="Banned">Banned</SelectItem>
                        </SelectContent>
                      </Select>
                      <Badge
                        variant="outline"
                        className={`rounded-full ${tierPill(client.tier)}`}
                        data-testid="pill-client-tier"
                      >
                        {client.tier}
                      </Badge>
                    </div>
                  ) : null}
                </div>
                <div
                  className="inline-flex h-10 w-10 items-center justify-center rounded-2xl border border-black/10 bg-black/[0.03]"
                  aria-hidden
                  data-testid="avatar-client"
                >
                  <UserRound className="h-5 w-5 text-black/70" />
                </div>
              </div>

              {client ? (
                <div className="mt-4 grid gap-2" data-testid="grid-client-kpis">
                  <div className="rounded-2xl border border-black/10 bg-black/[0.03] px-3 py-2">
                    <div className="text-[11px] font-semibold text-black/55" data-testid="label-client-email">
                      Email
                    </div>
                    <div className="mt-0.5 truncate text-sm text-black/85" data-testid="value-client-email-kpi">
                      {client.email || "—"}
                    </div>
                  </div>
                  <div className="rounded-2xl border border-black/10 bg-black/[0.03] px-3 py-2">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <div className="text-[11px] font-semibold text-black/55" data-testid="label-client-last-touch">
                          Last touch
                        </div>
                        <div className="mt-0.5 text-sm text-black/85" data-testid="value-client-last-touch">
                          {client.lastTouch}
                        </div>
                      </div>
                      <ChevronRight className="h-4 w-4 text-black/35" aria-hidden />
                    </div>
                  </div>
                </div>
              ) : null}

            </div>

            <div className="mt-3 rounded-3xl border border-black/10 bg-white/60 p-2" data-testid="tabs-client-sections">
              <Tabs value={tab} onValueChange={(v) => setTab(v as ClientTab)}>
                <TabsList className="grid w-full grid-cols-3 rounded-2xl border border-black/10 bg-white/70">
                  <TabsTrigger value="overview" className="rounded-xl" data-testid="tab-client-overview">
                    Overview
                  </TabsTrigger>
                  <TabsTrigger value="tickets" className="rounded-xl" data-testid="tab-client-tickets">
                    Tickets
                  </TabsTrigger>
                  <TabsTrigger value="files" className="rounded-xl" data-testid="tab-client-files">
                    Files
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="overview" className="mt-3">
                  <div className="grid gap-2" data-testid="panel-client-overview">
                    <div className="rounded-2xl border border-black/10 bg-white/70 p-3">
                      <div className="text-xs font-semibold" data-testid="text-client-stage-title">
                        Pipeline status
                      </div>
                      <div className="mt-2 flex flex-wrap gap-2" data-testid="list-client-stage-chips">
                        {(["Enquiry", "Quote", "Booked"] as const).map((s) => (
                          <span
                            key={s}
                            className={
                              "inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-semibold " +
                              (client?.stage === s
                                ? "border-[#3b82f6]/30 bg-[#3b82f6] text-white"
                                : "border-black/10 bg-black/[0.03] text-black/70")
                            }
                            data-testid={`pill-client-stage-${s.toLowerCase()}`}
                          >
                            {s}
                          </span>
                        ))}
                      </div>
                    </div>

                    <div className="rounded-2xl border border-black/10 bg-white/70 p-3">
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <div className="text-xs font-semibold" data-testid="text-client-tags-title">
                            Tags
                          </div>
                          <div className="mt-1 text-[11px] text-black/55" data-testid="text-client-tags-subtitle">
                            High-signal labels used across the CRM
                          </div>
                        </div>
                        <Button
                          size="sm"
                          variant="secondary"
                          className="h-9 rounded-2xl border border-black/10 bg-black/[0.03] px-3 text-black hover:bg-black/[0.05]"
                          data-testid="button-client-edit-tags"
                          onClick={() => {}}
                        >
                          <BadgeCheck className="mr-2 h-4 w-4" />
                          Edit
                        </Button>
                      </div>
                      <div className="mt-3 flex flex-wrap gap-2" data-testid="list-client-tags">
                        {(client?.tags ?? []).map((t, i) => (
                          <span
                            key={t + i}
                            className="inline-flex items-center rounded-full border border-black/10 bg-black/[0.03] px-2 py-0.5 text-[11px] font-semibold text-black/70"
                            data-testid={`pill-client-tag-${i}`}
                          >
                            {t}
                          </span>
                        ))}
                      </div>
                    </div>

                    <div className="rounded-2xl border border-black/10 bg-white/70 p-3">
                      <div className="text-xs font-semibold" data-testid="text-client-quick-links-title">
                        Quick links
                      </div>
                      <div className="mt-2 grid gap-2">
                        <button
                          type="button"
                          className="group rounded-2xl border border-black/10 bg-white/70 px-3 py-2 text-left transition hover:bg-black/[0.03]"
                          data-testid="button-client-open-enquiries"
                          onClick={() => setTab("enquiries")}
                        >
                          <div className="flex items-center justify-between gap-3">
                            <span className="inline-flex items-center gap-2 text-xs font-semibold text-black/80">
                              <Sparkles className="h-4 w-4" />
                              Enquiries
                            </span>
                            <ChevronRight className="h-4 w-4 text-black/45 transition group-hover:translate-x-0.5" />
                          </div>
                          <div className="mt-1 text-[11px] text-black/55" data-testid="text-client-enquiries-hint">
                            {enquiries.length} enquir{enquiries.length === 1 ? "y" : "ies"} captured
                          </div>
                        </button>

                        <button
                          type="button"
                          className="group rounded-2xl border border-black/10 bg-white/70 px-3 py-2 text-left transition hover:bg-black/[0.03]"
                          data-testid="button-client-open-quotes"
                          onClick={() => setTab("quotes")}
                        >
                          <div className="flex items-center justify-between gap-3">
                            <span className="inline-flex items-center gap-2 text-xs font-semibold text-black/80">
                              <FileText className="h-4 w-4" />
                              Quotes
                            </span>
                            <ChevronRight className="h-4 w-4 text-black/45 transition group-hover:translate-x-0.5" />
                          </div>
                          <div className="mt-1 text-[11px] text-black/55" data-testid="text-client-quotes-hint">
                            Working versions, revisions, approvals
                          </div>
                        </button>

                        <button
                          type="button"
                          className="group rounded-2xl border border-black/10 bg-white/70 px-3 py-2 text-left transition hover:bg-black/[0.03]"
                          data-testid="button-client-open-booked"
                          onClick={() => setTab("booked")}
                        >
                          <div className="flex items-center justify-between gap-3">
                            <span className="inline-flex items-center gap-2 text-xs font-semibold text-black/80">
                              <Ticket className="h-4 w-4" />
                              Booked
                            </span>
                            <ChevronRight className="h-4 w-4 text-black/45 transition group-hover:translate-x-0.5" />
                          </div>
                          <div className="mt-1 text-[11px] text-black/55" data-testid="text-client-booked-hint">
                            Confirmations, vouchers, timelines
                          </div>
                        </button>
                      </div>
                    </div>
                  </div>
                </TabsContent>

                <TabsContent value="files" className="mt-3">
                  <div className="space-y-2" data-testid="panel-client-files">
                    {filteredFiles.map((f) => (
                      <div
                        key={f.id}
                        className="flex items-center justify-between gap-3 rounded-2xl border border-black/10 bg-white/70 px-3 py-2"
                        data-testid={`row-file-${f.id}`}
                      >
                        <div className="min-w-0">
                          <div className="truncate text-xs font-semibold" data-testid={`text-file-name-${f.id}`}>
                            {f.name}
                          </div>
                          <div className="mt-1 text-[11px] text-black/55" data-testid={`text-file-meta-${f.id}`}>
                            {f.type} · Updated {f.updated}
                          </div>
                        </div>
                        <ChevronRight className="h-4 w-4 text-black/35" aria-hidden />
                      </div>
                    ))}
                  </div>
                </TabsContent>

                <TabsContent value="tickets" className="mt-3">
                  <div className="space-y-2" data-testid="panel-client-tickets">
                    {filteredTickets.length === 0 ? (
                      <div className="rounded-2xl border border-black/10 bg-white/60 p-4 text-center">
                        <div className="text-sm text-black/55">No tickets for this client.</div>
                      </div>
                    ) : (
                      filteredTickets.map((t) => (
                        <div
                          key={t.id}
                          className="rounded-2xl border border-black/10 bg-white/70 p-3"
                          data-testid={`card-ticket-${t.id}`}
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <div className="flex items-center gap-2 mb-1">
                                <span className={`inline-flex items-center rounded-full border px-1.5 py-0.5 text-[10px] font-medium ${ticketTypePill(t.type)}`}>
                                  {t.type}
                                </span>
                                <span className={`inline-flex items-center rounded-full border px-1.5 py-0.5 text-[10px] font-medium ${ticketStatusPill(t.status)}`}>
                                  {t.status}
                                </span>
                              </div>
                              <div className="text-xs font-semibold" data-testid={`text-ticket-title-${t.id}`}>
                                {t.subject}
                              </div>
                              <div className="mt-1 text-[11px] text-black/55" data-testid={`text-ticket-meta-${t.id}`}>
                                {getUserName(t.userId)} · {formatTicketDate(t.createdAt)}
                              </div>
                            </div>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </TabsContent>
              </Tabs>
            </div>
          </Card>

          <Card className="glass ringed grain rounded-3xl border-black/10 bg-white/60 p-4 lg:col-span-8">
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div>
                <div className="text-sm font-semibold" data-testid="text-client-right-title">
                  Client workspace
                </div>
                <div className="mt-1 text-xs text-black/55" data-testid="text-client-right-subtitle">Knowing you client is the key to Rapport</div>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Button
                  size="sm"
                  className="h-9 rounded-2xl bg-[#ff2f00e6] px-3 text-white hover:bg-[#ff2f00e6]/90"
                  data-testid="button-client-new-task"
                  onClick={() => {}}
                >
                  <Calendar className="mr-2 h-4 w-4" />
                  Add task
                </Button>
                <Button
                  size="sm"
                  className="h-9 rounded-2xl bg-black px-3 text-white hover:bg-black/90"
                  data-testid="button-client-new-item"
                  onClick={() => {}}
                >
                  <Sparkles className="mr-2 h-4 w-4" />
                  New
                </Button>
              </div>
            </div>

            <div className="mt-4 rounded-3xl border border-black/10 bg-white/60 p-2" data-testid="tabs-client-workspace">
              <Tabs value={tab} onValueChange={(v) => setTab(v as ClientTab)}>
                <TabsList className="grid w-full grid-cols-6 rounded-2xl border border-black/10 bg-white/70">
                  <TabsTrigger value="overview" className="rounded-xl" data-testid="tab-overview">
                    Overview
                  </TabsTrigger>
                  <TabsTrigger value="enquiries" className="rounded-xl" data-testid="tab-enquiries">
                    Enquiries
                  </TabsTrigger>
                  <TabsTrigger value="quotes" className="rounded-xl" data-testid="tab-quotes">
                    Quotes
                  </TabsTrigger>
                  <TabsTrigger value="booked" className="rounded-xl" data-testid="tab-booked">
                    Booked
                  </TabsTrigger>
                  <TabsTrigger value="files" className="rounded-xl" data-testid="tab-files">
                    Files
                  </TabsTrigger>
                  <TabsTrigger value="tickets" className="rounded-xl" data-testid="tab-tickets">
                    Tickets
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="overview" className="mt-3">
                  <div className="grid gap-3" data-testid="panel-overview">
                    <div className="grid grid-cols-2 gap-2 sm:grid-cols-4" data-testid="overview-stats">
                      <div className="rounded-2xl border border-black/10 bg-white/70 p-3 text-center" data-testid="stat-enquiries">
                        <div className="text-2xl font-bold text-black/85">{enquiries.length}</div>
                        <div className="mt-0.5 text-[11px] font-semibold text-black/50">Enquiries</div>
                      </div>
                      <div className="rounded-2xl border border-black/10 bg-white/70 p-3 text-center" data-testid="stat-quotes">
                        <div className="text-2xl font-bold text-black/85">{quotes.length}</div>
                        <div className="mt-0.5 text-[11px] font-semibold text-black/50">Quotes</div>
                      </div>
                      <div className="rounded-2xl border border-black/10 bg-white/70 p-3 text-center" data-testid="stat-bookings">
                        <div className="text-2xl font-bold text-emerald-600">{bookings.length}</div>
                        <div className="mt-0.5 text-[11px] font-semibold text-black/50">Bookings</div>
                      </div>
                      <div className="rounded-2xl border border-black/10 bg-white/70 p-3 text-center" data-testid="stat-total-value">
                        <div className="text-2xl font-bold text-black/85">
                          {currency.format(
                            quotes.reduce((sum: number, q: QuoteWithJoins) => sum + parseFloat(q.sales_price || "0"), 0) +
                            bookings.reduce((sum: number, b: BookingWithJoins) => sum + parseFloat(b.sales_price || "0"), 0)
                          )}
                        </div>
                        <div className="mt-0.5 text-[11px] font-semibold text-black/50">Total Value</div>
                      </div>
                    </div>

                    <div className="grid gap-2 md:grid-cols-2" data-testid="overview-details">
                      <div className="rounded-2xl border border-black/10 bg-white/70 p-4" data-testid="overview-contact">
                        <div className="mb-3 text-xs font-semibold text-black/80">Contact Details</div>
                        <div className="grid gap-2.5">
                          <div className="flex items-center gap-2.5">
                            <div className="grid h-7 w-7 shrink-0 place-items-center rounded-full border border-black/10 bg-black/[0.03]">
                              <UserRound className="h-3.5 w-3.5 text-black/50" />
                            </div>
                            <div className="min-w-0">
                              <div className="text-[10px] font-semibold text-black/45">Full Name</div>
                              <div className="truncate text-sm text-black/85" data-testid="overview-name">
                                {[clientData?.title, clientData?.firstName, clientData?.surename].filter(Boolean).join(" ") || "—"}
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center gap-2.5">
                            <div className="grid h-7 w-7 shrink-0 place-items-center rounded-full border border-black/10 bg-black/[0.03]">
                              <Phone className="h-3.5 w-3.5 text-black/50" />
                            </div>
                            <div className="min-w-0">
                              <div className="text-[10px] font-semibold text-black/45">Phone</div>
                              <div className="truncate text-sm text-black/85" data-testid="overview-phone">
                                {clientData?.phoneNumber || "—"}
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center gap-2.5">
                            <div className="grid h-7 w-7 shrink-0 place-items-center rounded-full border border-black/10 bg-black/[0.03]">
                              <Mail className="h-3.5 w-3.5 text-black/50" />
                            </div>
                            <div className="min-w-0">
                              <div className="text-[10px] font-semibold text-black/45">Email</div>
                              <div className="truncate text-sm text-black/85" data-testid="overview-email">
                                {clientData?.email || "—"}
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center gap-2.5">
                            <div className="grid h-7 w-7 shrink-0 place-items-center rounded-full border border-black/10 bg-black/[0.03]">
                              <Calendar className="h-3.5 w-3.5 text-black/50" />
                            </div>
                            <div className="min-w-0">
                              <div className="text-[10px] font-semibold text-black/45">Date of Birth</div>
                              <div className="truncate text-sm text-black/85" data-testid="overview-dob">
                                {clientData?.DOB ? new Date(clientData.DOB).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" }) : "—"}
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>

                      <div className="rounded-2xl border border-black/10 bg-white/70 p-4" data-testid="overview-address">
                        <div className="mb-3 text-xs font-semibold text-black/80">Address</div>
                        <div className="grid gap-2.5">
                          <div className="flex items-center gap-2.5">
                            <div className="grid h-7 w-7 shrink-0 place-items-center rounded-full border border-black/10 bg-black/[0.03]">
                              <Home className="h-3.5 w-3.5 text-black/50" />
                            </div>
                            <div className="min-w-0">
                              <div className="text-[10px] font-semibold text-black/45">Street</div>
                              <div className="truncate text-sm text-black/85" data-testid="overview-street">
                                {[clientData?.houseNumber, clientData?.street].filter(Boolean).join(" ") || "—"}
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center gap-2.5">
                            <div className="grid h-7 w-7 shrink-0 place-items-center rounded-full border border-black/10 bg-black/[0.03]">
                              <MapPin className="h-3.5 w-3.5 text-black/50" />
                            </div>
                            <div className="min-w-0">
                              <div className="text-[10px] font-semibold text-black/45">City</div>
                              <div className="truncate text-sm text-black/85" data-testid="overview-city">
                                {clientData?.city || "—"}
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center gap-2.5">
                            <div className="grid h-7 w-7 shrink-0 place-items-center rounded-full border border-black/10 bg-black/[0.03]">
                              <Globe className="h-3.5 w-3.5 text-black/50" />
                            </div>
                            <div className="min-w-0">
                              <div className="text-[10px] font-semibold text-black/45">Country</div>
                              <div className="truncate text-sm text-black/85" data-testid="overview-country">
                                {clientData?.country || "—"}
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center gap-2.5">
                            <div className="grid h-7 w-7 shrink-0 place-items-center rounded-full border border-black/10 bg-black/[0.03]">
                              <Mail className="h-3.5 w-3.5 text-black/50" />
                            </div>
                            <div className="min-w-0">
                              <div className="text-[10px] font-semibold text-black/45">Postcode</div>
                              <div className="truncate text-sm text-black/85" data-testid="overview-postcode">
                                {clientData?.post_code || "—"}
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="rounded-2xl border border-black/10 bg-white/70 p-4" data-testid="overview-upcoming">
                      <div className="mb-3 flex items-center gap-2">
                        <Plane className="h-4 w-4 text-black/50" />
                        <div className="text-xs font-semibold text-black/80">Upcoming Trips</div>
                      </div>
                      {(() => {
                        const upcomingItems: Array<{ id: string; title: string; type: string; travelDate: string; status: string; isBooking: boolean }> = [];
                        quotes.forEach((q: QuoteWithJoins) => {
                          if (!q.travel_date) return;
                          const td = new Date(q.travel_date);
                          if (td >= new Date() && !["LOST", "ARCHIVED", "INACTIVE", "EXPIRED"].includes(q.quote_status || "")) {
                            upcomingItems.push({ id: q.id, title: q.title || q.holiday_type_name || "Trip", type: q.holiday_type_name || q.quote_type || "—", travelDate: q.travel_date, status: (q.quote_status || "NEW_LEAD").replace(/_/g, " "), isBooking: false });
                          }
                        });
                        bookings.forEach((b: BookingWithJoins) => {
                          if (!b.travel_date) return;
                          const td = new Date(b.travel_date);
                          if (td >= new Date()) {
                            upcomingItems.push({ id: b.id, title: b.title || b.holiday_type_name || "Booking", type: b.holiday_type_name || "—", travelDate: b.travel_date, status: "BOOKED", isBooking: true });
                          }
                        });
                        upcomingItems.sort((a, b) => new Date(a.travelDate).getTime() - new Date(b.travelDate).getTime());
                        const upcoming = upcomingItems.slice(0, 3);
                        if (upcoming.length === 0) {
                          return (
                            <div className="rounded-2xl border border-dashed border-black/10 bg-white/40 p-4 text-center text-xs text-black/45" data-testid="empty-upcoming">
                              No upcoming trips scheduled
                            </div>
                          );
                        }
                        return (
                          <div className="grid gap-2">
                            {upcoming.map((item) => (
                              <button
                                key={item.id}
                                type="button"
                                className="group flex items-center justify-between gap-3 rounded-2xl border border-black/10 bg-white/60 p-3 text-left transition hover:bg-black/[0.03]"
                                data-testid={`upcoming-trip-${item.id}`}
                                onClick={() => navigate(`/clients/${clientId}/${item.isBooking ? "bookings" : "quotes"}/${item.id}`)}
                              >
                                <div className="flex items-center gap-3">
                                  <div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl border border-black/10 bg-black/[0.03]">
                                    <Plane className="h-4 w-4 text-black/50" />
                                  </div>
                                  <div className="min-w-0">
                                    <div className="truncate text-sm font-semibold text-black/85" data-testid={`upcoming-title-${item.id}`}>
                                      {item.title}
                                    </div>
                                    <div className="mt-0.5 flex items-center gap-2 text-xs text-black/55">
                                      <span>{item.type}</span>
                                      <span className="text-black/25">&middot;</span>
                                      <span>{new Date(item.travelDate).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}</span>
                                    </div>
                                  </div>
                                </div>
                                <div className="flex items-center gap-2">
                                  <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold ${item.isBooking ? "border-emerald-500/25 bg-emerald-500/10 text-emerald-700" : "border-amber-500/25 bg-amber-500/10 text-amber-700"}`}>
                                    {item.status}
                                  </span>
                                  <ChevronRight className="h-4 w-4 text-black/30 transition group-hover:translate-x-0.5" />
                                </div>
                              </button>
                            ))}
                          </div>
                        );
                      })()}
                    </div>

                    <div className="rounded-2xl border border-black/10 bg-white/70 p-4" data-testid="overview-activity">
                      <div className="mb-3 flex items-center gap-2">
                        <Clock className="h-4 w-4 text-black/50" />
                        <div className="text-xs font-semibold text-black/80">Recent Activity</div>
                      </div>
                      {(() => {
                        const activities: Array<{ id: string; type: string; title: string; date: string; status?: string; link: string }> = [];
                        enquiries.slice(0, 3).forEach((e: EnquiryTable) => {
                          activities.push({ id: `e-${e.id}`, type: "Enquiry", title: e.title || "Enquiry", date: e.date_created || "", status: e.status, link: `/clients/${clientId}/enquiries/${e.id}` });
                        });
                        quotes.slice(0, 3).forEach((q: QuoteWithJoins) => {
                          activities.push({ id: `q-${q.id}`, type: "Quote", title: q.title || q.holiday_type_name || "Trip", date: q.date_created || "", status: (q.quote_status || "NEW_LEAD").replace(/_/g, " "), link: `/clients/${clientId}/quotes/${q.id}` });
                        });
                        bookings.slice(0, 3).forEach((b: BookingWithJoins) => {
                          activities.push({ id: `b-${b.id}`, type: "Booking", title: b.title || b.holiday_type_name || "Booking", date: b.date_created || "", status: b.booking_status || "BOOKED", link: `/clients/${clientId}/bookings/${b.id}` });
                        });
                        tickets.slice(0, 2).forEach((t: TicketItem) => {
                          activities.push({ id: `t-${t.id}`, type: "Ticket", title: t.subject, date: t.createdAt || "", status: t.status, link: "#" });
                        });
                        activities.sort((a, b) => {
                          if (!a.date) return 1;
                          if (!b.date) return -1;
                          return new Date(b.date).getTime() - new Date(a.date).getTime();
                        });
                        const recent = activities.slice(0, 5);
                        if (recent.length === 0) {
                          return (
                            <div className="rounded-2xl border border-dashed border-black/10 bg-white/40 p-4 text-center text-xs text-black/45" data-testid="empty-activity">
                              No activity yet
                            </div>
                          );
                        }
                        return (
                          <div className="grid gap-1.5">
                            {recent.map((a) => (
                              <button
                                key={a.id}
                                type="button"
                                className="group flex items-center justify-between gap-3 rounded-xl px-2 py-1.5 text-left transition hover:bg-black/[0.03]"
                                data-testid={`activity-${a.id}`}
                                onClick={() => { if (a.link !== "#") navigate(a.link); }}
                              >
                                <div className="flex items-center gap-2 min-w-0">
                                  <span className={`inline-flex shrink-0 items-center rounded-full border px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider ${
                                    a.type === "Enquiry" ? "border-violet-500/25 bg-violet-500/10 text-violet-700" :
                                    a.type === "Quote" ? "border-sky-500/25 bg-sky-500/10 text-sky-700" :
                                    a.type === "Booking" ? "border-emerald-500/25 bg-emerald-500/10 text-emerald-700" :
                                    "border-amber-500/25 bg-amber-500/10 text-amber-700"
                                  }`}>
                                    {a.type}
                                  </span>
                                  <span className="truncate text-xs font-medium text-black/75">{a.title}</span>
                                </div>
                                <span className="shrink-0 text-[10px] text-black/40">
                                  {a.date ? formatTicketDate(a.date) : ""}
                                </span>
                              </button>
                            ))}
                          </div>
                        );
                      })()}
                    </div>

                    <div className="grid gap-2 md:grid-cols-2">
                      <div className="rounded-2xl border border-black/10 bg-white/70 p-4" data-testid="overview-preferences">
                        <div className="mb-3 flex items-center gap-2">
                          <TrendingUp className="h-4 w-4 text-black/50" />
                          <div className="text-xs font-semibold text-black/80">Commission Summary</div>
                        </div>
                        <div className="grid gap-2">
                          <div className="flex items-center justify-between rounded-xl border border-black/10 bg-black/[0.02] px-3 py-2">
                            <span className="text-xs text-black/60">In Play value</span>
                            <span className="text-xs font-semibold text-black/85" data-testid="overview-inplay-value">
                              {currency.format(quotes.filter((q: QuoteWithJoins) => q.quote_status && !["WON", "LOST", "ARCHIVED", "INACTIVE", "EXPIRED"].includes(q.quote_status)).reduce((sum: number, q: QuoteWithJoins) => sum + parseFloat(q.sales_price || "0"), 0))}
                            </span>
                          </div>
                          <div className="flex items-center justify-between rounded-xl border border-black/10 bg-black/[0.02] px-3 py-2">
                            <span className="text-xs text-black/60">Won value</span>
                            <span className="text-xs font-semibold text-black/85" data-testid="overview-won-value">
                              {currency.format(quotes.filter((q: QuoteWithJoins) => q.quote_status === "WON").reduce((sum: number, q: QuoteWithJoins) => sum + parseFloat(q.sales_price || "0"), 0))}
                            </span>
                          </div>
                          <div className="flex items-center justify-between rounded-xl border border-emerald-500/20 bg-emerald-500/5 px-3 py-2">
                            <span className="text-xs font-medium text-emerald-700">Booked value</span>
                            <span className="text-xs font-bold text-emerald-700" data-testid="overview-booked-value">
                              {currency.format(bookings.reduce((sum: number, b: BookingWithJoins) => sum + parseFloat(b.sales_price || "0"), 0))}
                            </span>
                          </div>
                        </div>
                      </div>

                      <div className="rounded-2xl border border-black/10 bg-white/70 p-4" data-testid="overview-tags-section">
                        <div className="mb-3 flex items-center gap-2">
                          <BadgeCheck className="h-4 w-4 text-black/50" />
                          <div className="text-xs font-semibold text-black/80">Tags &amp; Status</div>
                        </div>
                        <div className="grid gap-3">
                          <div>
                            <div className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-black/40">Client Type</div>
                            <span className="inline-flex items-center rounded-full border border-[#3b82f6]/30 bg-[#3b82f6]/10 px-2.5 py-0.5 text-xs font-semibold text-[#3b82f6]" data-testid="overview-client-type">
                              {clientData?.badge || "New Client"}
                            </span>
                          </div>
                          {(client?.tags ?? []).length > 0 && (
                            <div>
                              <div className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-black/40">Tags</div>
                              <div className="flex flex-wrap gap-1.5" data-testid="overview-tags-list">
                                {(client?.tags ?? []).map((t, i) => (
                                  <span
                                    key={t + i}
                                    className="inline-flex items-center rounded-full border border-black/10 bg-black/[0.03] px-2 py-0.5 text-[11px] font-semibold text-black/70"
                                    data-testid={`overview-tag-${i}`}
                                  >
                                    {t}
                                  </span>
                                ))}
                              </div>
                            </div>
                          )}
                          <div>
                            <div className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-black/40">Open Tickets</div>
                            <span className="text-sm font-semibold text-black/85" data-testid="overview-open-tickets">
                              {tickets.filter((t) => t.status === "Open" || t.status === "In Progress").length}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </TabsContent>

                <TabsContent value="enquiries" className="mt-3">
                  <div className="grid gap-3" data-testid="list-enquiries">
                    <div className="flex items-center justify-between">
                      <div className="text-sm font-semibold">Enquiries</div>
                      <Button
                        size="sm"
                        className="h-9 rounded-2xl bg-black px-3 text-white hover:bg-black/90"
                        data-testid="button-new-enquiry"
                        onClick={() => {
                          setEditingEnquiry(null);
                          setShowEnquiryWizard(true);
                        }}
                      >
                        <Sparkles className="mr-2 h-4 w-4" />
                        New Enquiry
                      </Button>
                    </div>
                    {isLoadingTransactions ? (
                      <div className="flex justify-center py-8"><Spinner /></div>
                    ) : enquiries.length === 0 ? (
                      <div className="rounded-3xl border border-dashed border-black/10 bg-white/40 p-8 text-center text-sm text-black/50" data-testid="empty-enquiries">
                        No enquiries yet. Create one to get started.
                      </div>
                    ) : (
                      enquiries.map((enq: EnquiryTable, idx: number) => (
                        <motion.div
                          key={enq.id}
                          className="group cursor-pointer rounded-3xl border border-black/10 bg-white/70 p-4 transition hover:bg-black/[0.02] active:scale-[0.99]"
                          data-testid={`card-enquiry-${idx}`}
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ duration: 0.2, delay: Math.min(idx * 0.03, 0.18) }}
                          onClick={() => navigate(`/clients/${clientId}/enquiries/${enq.id}`)}
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-2">
                                <div className="text-sm font-semibold" data-testid={`text-enquiry-title-${idx}`}>
                                  {enq.title}
                                </div>
                                {enq.status === "Converted" && (
                                  <span className="inline-flex items-center rounded-full border border-emerald-500/25 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-semibold text-emerald-700">Converted</span>
                                )}
                              </div>
                              <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-black/55" data-testid={`text-enquiry-meta-${idx}`}>
                                <span className="inline-flex items-center rounded-full border border-black/10 bg-white/70 px-2 py-0.5 text-[10px] font-semibold text-black/70">
                                  {enq.holiday_type_name || enq.holiday_type_id}
                                </span>
                                {enq.destinations?.[0] && <span>{enq.destinations[0]?.name || enq.destinations[0]?.destination_id || "—"}</span>}
                                {enq.travel_date && <span>· {new Date(enq.travel_date).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}</span>}
                                <span>· {enq.adults || 0}A{(enq.children || 0) > 0 ? ` ${enq.children}C` : ""}{(enq.infants || 0) > 0 ? ` ${enq.infants}I` : ""}</span>
                                {enq.no_of_nights && <span>· {enq.no_of_nights}N</span>}
                                {enq.budget && <span>· £{parseFloat(enq.budget).toLocaleString()} {enq.budget_type?.toLowerCase()}</span>}
                              </div>
                            </div>
                            <div className="flex shrink-0 items-center gap-1">
                              <span
                                role="button"
                                tabIndex={0}
                                className={`grid h-7 w-7 place-items-center rounded-full transition ${userFavorites?.some((f: Favorite) => f.itemType === "enquiry" && f.itemId === enq.id) ? "text-amber-600 hover:bg-amber-50" : "text-black/40 hover:bg-black/[0.05] hover:text-black/70"}`}
                                data-testid={`button-pin-enquiry-${idx}`}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  toggleFavoriteMutation.mutate({ itemType: "enquiry", itemId: enq.id, label: enq.title || "", subtitle: `${client?.name || ""}${enq.destinations?.[0] ? " · " + (enq.destinations[0]?.name || enq.destinations[0]?.destination_id) : enq.holiday_type_name ? " · " + enq.holiday_type_name : ""}` });
                                }}
                                title={userFavorites?.some((f: Favorite) => f.itemType === "enquiry" && f.itemId === enq.id) ? "Unpin" : "Pin to dashboard"}
                              >
                                <Pin className="h-3.5 w-3.5" />
                              </span>
                              {enq.status !== "Converted" && (
                                <button
                                  type="button"
                                  className="grid h-7 w-7 place-items-center rounded-full text-black/40 transition hover:bg-emerald-50 hover:text-emerald-600"
                                  data-testid={`button-convert-enquiry-${idx}`}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    e.preventDefault();
                                    handleConvertEnquiryToQuote(enq);
                                  }}
                                  title="Convert to Quote"
                                >
                                  <ArrowRightLeft className="h-3.5 w-3.5" />
                                </button>
                              )}
                              <button
                                type="button"
                                className="grid h-7 w-7 place-items-center rounded-full text-black/40 transition hover:bg-black/[0.05] hover:text-black/70"
                                data-testid={`button-edit-enquiry-${idx}`}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setEditingEnquiry(enq);
                                  setShowEnquiryWizard(true);
                                }}
                                title="Edit enquiry"
                              >
                                <Pencil className="h-3.5 w-3.5" />
                              </button>
                              <button
                                type="button"
                                className="grid h-7 w-7 place-items-center rounded-full text-black/40 transition hover:bg-red-50 hover:text-red-500"
                                data-testid={`button-delete-enquiry-${idx}`}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleDeleteEnquiry(enq.id);
                                }}
                                title="Delete enquiry"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                              <ChevronRight className="ml-1 h-4 w-4 text-black/30 transition group-hover:translate-x-0.5" />
                            </div>
                          </div>
                        </motion.div>
                      ))
                    )}
                  </div>
                </TabsContent>

                <TabsContent value="quotes" className="mt-3">
                  <div className="grid gap-3" data-testid="layout-quotes">
                    <Card className="glass ringed grain rounded-3xl border-black/10 bg-white/70 p-4" data-testid="card-quotes-list">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className="text-sm font-semibold" data-testid="text-quotes-title">
                            Quotes
                          </div>
                          <div className="mt-1 text-xs text-black/55" data-testid="text-quotes-subtitle">
                            Quick view of recent quotes for this client.
                          </div>
                        </div>
                        <Button
                          size="sm"
                          className="h-9 rounded-2xl bg-black px-3 text-white hover:bg-black/90"
                          data-testid="button-quotes-new"
                          onClick={() => setShowNewQuoteModal(true)}
                        >
                          <Sparkles className="mr-2 h-4 w-4" />
                          New quote
                        </Button>
                      </div>

                      <div className="mt-4 space-y-2" data-testid="section-quotes-groups">
                        {[
                          {
                            id: "in-play",
                            title: "In Play",
                            rows: quotes
                              .filter((q: QuoteWithJoins) => !q.quote_status || !["WON", "LOST", "ARCHIVED", "INACTIVE", "EXPIRED"].includes(q.quote_status))
                              .map((q: QuoteWithJoins) => ({
                                id: q.id,
                                title: q.title || q.holiday_type_name || "Trip",
                                destination: q.holiday_type_name || q.quote_type || "—",
                                travelDate: q.travel_date,
                                createdAt: q.date_created ? new Date(q.date_created).toLocaleDateString("en-GB") : "—",
                                status: q.quote_status || "NEW_LEAD",
                                totalCost: parseFloat(q.sales_price || "0"),
                                pricePerPerson: parseFloat(q.price_per_person || "0"),
                                imageUrl: q.images?.find((img: DealImage) => img.isPrimary)?.image_url || q.images?.[0]?.image_url || null,
                                pax: `${q.adult || 0}A${(q.child || 0) > 0 ? ` ${q.child}C` : ""}${(q.infant || 0) > 0 ? ` ${q.infant}I` : ""}`,
                                nights: q.num_of_nights || 0,
                              })),
                          },
                          {
                            id: "won",
                            title: "Won",
                            rows: quotes
                              .filter((q: QuoteWithJoins) => q.quote_status === "WON")
                              .map((q: QuoteWithJoins) => ({
                                id: q.id,
                                title: q.title || q.holiday_type_name || "Trip",
                                destination: q.holiday_type_name || q.quote_type || "—",
                                travelDate: q.travel_date,
                                createdAt: q.date_created ? new Date(q.date_created).toLocaleDateString("en-GB") : "—",
                                status: q.quote_status,
                                totalCost: parseFloat(q.sales_price || "0"),
                                pricePerPerson: parseFloat(q.price_per_person || "0"),
                                imageUrl: q.images?.find((img: DealImage) => img.isPrimary)?.image_url || q.images?.[0]?.image_url || null,
                                pax: `${q.adult || 0}A${(q.child || 0) > 0 ? ` ${q.child}C` : ""}${(q.infant || 0) > 0 ? ` ${q.infant}I` : ""}`,
                                nights: q.num_of_nights || 0,
                              })),
                          },
                          {
                            id: "lost",
                            title: "Lost",
                            rows: quotes
                              .filter((q: QuoteWithJoins) => q.quote_status === "LOST")
                              .map((q: QuoteWithJoins) => ({
                                id: q.id,
                                title: q.title || q.holiday_type_name || "Trip",
                                destination: q.holiday_type_name || q.quote_type || "—",
                                travelDate: q.travel_date,
                                createdAt: q.date_created ? new Date(q.date_created).toLocaleDateString("en-GB") : "—",
                                status: q.quote_status,
                                totalCost: parseFloat(q.sales_price || "0"),
                                pricePerPerson: parseFloat(q.price_per_person || "0"),
                                imageUrl: q.images?.find((img: DealImage) => img.isPrimary)?.image_url || q.images?.[0]?.image_url || null,
                                pax: `${q.adult || 0}A${(q.child || 0) > 0 ? ` ${q.child}C` : ""}${(q.infant || 0) > 0 ? ` ${q.infant}I` : ""}`,
                                nights: q.num_of_nights || 0,
                              })),
                          },
                        ].map((group) => (
                          <div key={group.id} className="rounded-3xl border border-black/10 bg-white/60 p-2" data-testid={`group-quotes-${group.id}`}>
                            <div className="flex items-center justify-between gap-3 px-2 py-2" data-testid={`row-quotes-group-header-${group.id}`}>
                              <div className="flex items-center gap-2">
                                <div className="text-xs font-semibold text-black/80" data-testid={`text-quotes-group-title-${group.id}`}>
                                  {group.title}
                                </div>
                                <span
                                  className="rounded-full border border-black/10 bg-black/[0.03] px-2 py-0.5 text-[11px] font-semibold text-black/60"
                                  data-testid={`pill-quotes-group-count-${group.id}`}
                                >
                                  {group.rows.length}
                                </span>
                              </div>
                            </div>

                            <div className="grid gap-2" data-testid={`list-quotes-${group.id}`}>
                              {group.rows.map((q) => (
                                <button
                                  key={q.id}
                                  type="button"
                                  className="group w-full rounded-3xl border border-black/10 bg-white/70 p-3 text-left transition hover:bg-black/[0.03] active:scale-[0.99]"
                                  data-testid={`card-quote-intro-${q.id}`}
                                  onClick={() => navigate(`/clients/${clientId}/quotes/${q.id}`)}
                                >
                                  <div className="flex items-start gap-3">
                                    <div
                                      className="relative h-[72px] w-[96px] shrink-0 overflow-hidden rounded-2xl border border-black/10 bg-gradient-to-br from-black/[0.05] via-white/30 to-transparent"
                                      data-testid={`img-quote-${q.id}`}
                                      aria-hidden
                                    >
                                      {q.imageUrl ? (
                                        <img
                                          src={q.imageUrl}
                                          alt=""
                                          className="absolute inset-0 h-full w-full object-cover"
                                          data-testid={`img-quote-photo-${q.id}`}
                                        />
                                      ) : (
                                        <div className="flex h-full w-full items-center justify-center text-black/20">
                                          <ImagePlus className="h-6 w-6" />
                                        </div>
                                      )}
                                    </div>

                                    <div className="min-w-0 flex-1">
                                      <div className="flex items-start justify-between gap-3">
                                        <div className="min-w-0">
                                          <div className="truncate text-sm font-semibold" data-testid={`text-quote-title-${q.id}`}>
                                            {q.title}
                                          </div>
                                          <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-black/60">
                                            <span data-testid={`text-quote-destination-${q.id}`}>{q.destination || "—"}</span>
                                            <span className="text-black/25">•</span>
                                            <span data-testid={`text-quote-traveldate-${q.id}`}>{formatUKDate(q.travelDate)}</span>
                                            <span className="text-black/25">•</span>
                                            <span data-testid={`text-quote-created-${q.id}`}>Created {q.createdAt || "—"}</span>
                                          </div>
                                          <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-black/60">
                                            <span data-testid={`text-quote-pax-${q.id}`}>{q.pax}</span>
                                            {q.nights > 0 && (
                                              <>
                                                <span className="text-black/25">•</span>
                                                <span data-testid={`text-quote-nights-${q.id}`}>{q.nights}N</span>
                                              </>
                                            )}
                                            <span className="text-black/25">•</span>
                                            <span className="inline-flex items-center rounded-full border border-black/10 bg-white/70 px-1.5 py-0.5 text-[10px] font-semibold text-black/60" data-testid={`text-quote-status-${q.id}`}>
                                              {(q.status || "").replace(/_/g, " ")}
                                            </span>
                                          </div>
                                        </div>

                                        <div className="shrink-0 text-right">
                                          <div className="text-xs font-semibold text-black/85" data-testid={`text-quote-total-${q.id}`}>
                                            {q.pricePerPerson > 0 && (
                                              <span data-testid={`text-quote-pp-${q.id}`} className="font-normal">{currency.format(q.pricePerPerson)} pp / </span>
                                            )}
                                            {currency.format(q.totalCost)}
                                          </div>
                                        </div>
                                        <div className="flex items-end justify-between gap-3">
                                          <div></div>
                                          <div className="flex items-center gap-1">
                                            <span
                                              role="button"
                                              tabIndex={0}
                                              className={`grid h-7 w-7 place-items-center rounded-full transition ${userFavorites?.some((f: Favorite) => f.itemType === "quote" && f.itemId === q.id) ? "text-amber-600 hover:bg-amber-50" : "text-black/40 hover:bg-black/[0.05] hover:text-black/70"}`}
                                              data-testid={`button-pin-quote-${q.id}`}
                                              onClick={(e) => {
                                                e.stopPropagation();
                                                e.preventDefault();
                                                toggleFavoriteMutation.mutate({ itemType: "quote", itemId: q.id, label: q.title || "Quote", subtitle: `${client?.name || ""}${q.destination ? " · " + q.destination : ""}` });
                                              }}
                                              title={userFavorites?.some((f: Favorite) => f.itemType === "quote" && f.itemId === q.id) ? "Unpin" : "Pin to dashboard"}
                                            >
                                              <Pin className="h-3.5 w-3.5" />
                                            </span>
                                            <div className="inline-flex items-center gap-1 text-[11px] font-semibold text-black/60" data-testid={`button-view-quote-${q.id}`}>
                                              View
                                              <ChevronRight className="h-4 w-4 transition group-hover:translate-x-0.5" />
                                            </div>
                                          </div>
                                        </div>
                                      </div>
                                    </div>
                                  </div>
                                </button>
                              ))}

                              {group.rows.length === 0 ? (
                                <div className="rounded-3xl border border-black/10 bg-white/70 p-4" data-testid={`empty-quotes-${group.id}`}>
                                  <div className="text-sm font-semibold" data-testid={`text-empty-quotes-title-${group.id}`}>
                                    No quotes
                                  </div>
                                  <div className="mt-1 text-xs text-black/55" data-testid={`text-empty-quotes-subtitle-${group.id}`}>
                                    Nothing in {group.title.toLowerCase()} yet.
                                  </div>
                                </div>
                              ) : null}
                            </div>
                          </div>
                        ))}
                      </div>
                    </Card>

                  </div>
                </TabsContent>

                <TabsContent value="booked" className="mt-3">
                  <div className="grid gap-3" data-testid="list-booked">
                    <Card className="glass ringed grain rounded-3xl border-black/10 bg-white/70 p-4" data-testid="card-bookings-list">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className="text-sm font-semibold" data-testid="text-bookings-title">
                            Booked Packages
                          </div>
                          <div className="mt-1 text-xs text-black/55" data-testid="text-bookings-subtitle">
                            Confirmed bookings for this client.
                          </div>
                        </div>
                        <Button
                          size="sm"
                          className="h-9 rounded-2xl bg-black px-3 text-white hover:bg-black/90"
                          data-testid="button-add-booking"
                          onClick={() => {
                            setNewQuoteIsBooking(true);
                            setShowNewQuoteModal(true);
                          }}
                        >
                          <Plus className="mr-2 h-4 w-4" />
                          Add Booking
                        </Button>
                      </div>

                      <div className="mt-4 grid gap-2" data-testid="section-bookings">
                        {bookings.length === 0 ? (
                          <div className="rounded-3xl border border-dashed border-black/10 bg-white/40 p-8 text-center text-sm text-black/50" data-testid="empty-bookings">
                            No bookings yet. Add a booking or convert a quote.
                          </div>
                        ) : (
                          bookings.map((b: BookingWithJoins) => (
                              <button
                                key={b.id}
                                type="button"
                                className="group w-full rounded-3xl border border-black/10 bg-white/70 p-3 text-left transition hover:bg-black/[0.03] active:scale-[0.99]"
                                data-testid={`card-booking-${b.id}`}
                                onClick={() => navigate(`/clients/${clientId}/bookings/${b.id}`)}
                              >
                                <div className="flex items-start gap-3">
                                  <div
                                    className="relative h-[72px] w-[96px] shrink-0 overflow-hidden rounded-2xl border border-black/10 bg-gradient-to-br from-black/[0.05] via-white/30 to-transparent"
                                    aria-hidden
                                  >
                                    {b.images?.find((img: DealImage) => img.isPrimary)?.image_url || b.images?.[0]?.image_url ? (
                                      <img
                                        src={b.images?.find((img: DealImage) => img.isPrimary)?.image_url || b.images?.[0]?.image_url}
                                        alt=""
                                        className="absolute inset-0 h-full w-full object-cover"
                                      />
                                    ) : (
                                      <div className="flex h-full w-full items-center justify-center text-black/20">
                                        <ImagePlus className="h-6 w-6" />
                                      </div>
                                    )}
                                  </div>

                                  <div className="min-w-0 flex-1">
                                    <div className="flex items-start justify-between gap-3">
                                      <div className="min-w-0">
                                        <div className="flex items-center gap-2">
                                          <div className="truncate text-sm font-semibold" data-testid={`text-booking-title-${b.id}`}>
                                            {b.title || b.holiday_type_name || "Booking"}
                                          </div>
                                          <span className="inline-flex items-center rounded-full border border-emerald-500/25 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-semibold text-emerald-700">
                                            {b.booking_status || "BOOKED"}
                                          </span>
                                        </div>
                                        <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-black/60">
                                          <span data-testid={`text-booking-type-${b.id}`}>{b.holiday_type_name || "—"}</span>
                                          <span className="text-black/25">•</span>
                                          <span data-testid={`text-booking-traveldate-${b.id}`}>{formatUKDate(b.travel_date)}</span>
                                          <span className="text-black/25">•</span>
                                          <span data-testid={`text-booking-created-${b.id}`}>Created {b.date_created ? new Date(b.date_created).toLocaleDateString("en-GB") : "—"}</span>
                                        </div>
                                        <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-black/60">
                                          <span data-testid={`text-booking-pax-${b.id}`}>{b.adult || 0}A{(b.child || 0) > 0 ? ` ${b.child}C` : ""}{(b.infant || 0) > 0 ? ` ${b.infant}I` : ""}</span>
                                          {b.num_of_nights > 0 && (
                                            <>
                                              <span className="text-black/25">•</span>
                                              <span data-testid={`text-booking-nights-${b.id}`}>{b.num_of_nights}N</span>
                                            </>
                                          )}
                                        </div>
                                        <div className="mt-1 flex flex-wrap items-center gap-3 text-xs text-black/60">
                                          {b.hays_ref && (
                                            <span data-testid={`text-booking-hays-${b.id}`}>
                                              HAYS Ref: <span className="font-semibold text-black/80">{b.hays_ref}</span>
                                            </span>
                                          )}
                                          {b.supplier_ref && (
                                            <span data-testid={`text-booking-supplier-${b.id}`}>
                                              Supplier Ref: <span className="font-semibold text-black/80">{b.supplier_ref}</span>
                                            </span>
                                          )}
                                        </div>
                                      </div>

                                      <div className="shrink-0 text-right">
                                        <div className="text-xs font-semibold text-black/85" data-testid={`text-booking-total-${b.id}`}>
                                          {b.sales_price && parseFloat(b.sales_price) > 0 ? currency.format(parseFloat(b.sales_price)) : "—"}
                                        </div>
                                      </div>
                                    </div>
                                    <div className="mt-1 flex items-end justify-end gap-3">
                                      <div className="flex items-center gap-1">
                                        <span
                                          role="button"
                                          tabIndex={0}
                                          className={`grid h-7 w-7 place-items-center rounded-full transition ${userFavorites?.some((f: Favorite) => f.itemType === "booking" && f.itemId === b.id) ? "text-amber-600 hover:bg-amber-50" : "text-black/40 hover:bg-black/[0.05] hover:text-black/70"}`}
                                          data-testid={`button-pin-booking-${b.id}`}
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            e.preventDefault();
                                            toggleFavoriteMutation.mutate({ itemType: "booking", itemId: b.id, label: b.title || "Booking", subtitle: `${client?.name || ""}` });
                                          }}
                                          title={userFavorites?.some((f: Favorite) => f.itemType === "booking" && f.itemId === b.id) ? "Unpin" : "Pin to dashboard"}
                                        >
                                          <Pin className="h-3.5 w-3.5" />
                                        </span>
                                        <div className="inline-flex items-center gap-1 text-[11px] font-semibold text-black/60" data-testid={`button-view-booking-${b.id}`}>
                                          View
                                          <ChevronRight className="h-4 w-4 transition group-hover:translate-x-0.5" />
                                        </div>
                                      </div>
                                    </div>
                                  </div>
                                </div>
                              </button>
                            ))
                        )}
                      </div>
                    </Card>
                  </div>
                </TabsContent>

                <TabsContent value="files" className="mt-3">
                  <Card className="rounded-3xl border-black/10 bg-white/70 p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="text-sm font-semibold" data-testid="text-files-title">
                          Files
                        </div>
                        <div className="mt-1 text-xs text-black/55" data-testid="text-files-subtitle">
                          Upload and manage client documents.
                        </div>
                      </div>
                      <Button
                        size="sm"
                        className="h-9 rounded-2xl bg-black px-3 text-white hover:bg-black/90"
                        data-testid="button-files-upload"
                        onClick={() => setShowUploadFileModal(true)}
                      >
                        <FileText className="mr-2 h-4 w-4" />
                        Upload File
                      </Button>
                    </div>

                    <div className="mt-4 grid gap-3" data-testid="list-files">
                      {uploadedFiles.map((f) => (
                        <div
                          key={f.id}
                          className="flex w-full items-center justify-between gap-3 rounded-2xl border border-black/10 bg-white/60 p-3 text-left transition hover:bg-black/[0.03]"
                          data-testid={`row-file-uploaded-${f.id}`}
                        >
                          <button
                            type="button"
                            onClick={() => window.open(f.url, '_blank')}
                            className="min-w-0 flex-1 text-left"
                          >
                            <div className="flex items-center gap-2">
                              <div className="truncate text-sm font-semibold" data-testid={`text-file-uploaded-name-${f.id}`}>
                                {f.title}
                              </div>
                              <span className="shrink-0 rounded-full border border-emerald-500/25 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-semibold text-emerald-700">
                                {f.category}
                              </span>
                            </div>
                            <div className="mt-1 text-xs text-black/55" data-testid={`text-file-uploaded-meta-${f.id}`}>
                              {f.type} · {f.name} · {f.allocationType !== "None" ? `${f.allocationType}` : "Client level"} · {f.updated}
                            </div>
                          </button>
                          <div className="flex items-center gap-2">
                            {role === "Admin" && (
                              <button
                                type="button"
                                onClick={() => setUploadedFiles((prev) => prev.filter((file) => file.id !== f.id))}
                                className="rounded-xl border border-red-500/20 bg-red-500/10 p-1.5 text-red-600 transition hover:bg-red-500/20"
                                data-testid={`button-delete-file-${f.id}`}
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            )}
                            <ChevronRight className="h-4 w-4 text-black/35" aria-hidden />
                          </div>
                        </div>
                      ))}
                      {filteredFiles.map((f) => (
                        <div
                          key={f.id}
                          className="flex items-center justify-between gap-3 rounded-2xl border border-black/10 bg-white/60 p-3"
                          data-testid={`row-file-wide-${f.id}`}
                        >
                          <div className="min-w-0">
                            <div className="truncate text-sm font-semibold" data-testid={`text-file-wide-name-${f.id}`}>
                              {f.name}
                            </div>
                            <div className="mt-1 text-xs text-black/55" data-testid={`text-file-wide-meta-${f.id}`}>
                              {f.type} · Updated {f.updated}
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            {role === "Admin" && (
                              <button
                                type="button"
                                onClick={() => {}}
                                className="rounded-xl border border-red-500/20 bg-red-500/10 p-1.5 text-red-600 transition hover:bg-red-500/20"
                                data-testid={`button-delete-file-wide-${f.id}`}
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            )}
                            <ChevronRight className="h-4 w-4 text-black/35" aria-hidden />
                          </div>
                        </div>
                      ))}
                      {filteredFiles.length === 0 && uploadedFiles.length === 0 && (
                        <div className="rounded-2xl border border-black/10 bg-white/60 p-4 text-center">
                          <div className="text-sm text-black/55">No files uploaded yet.</div>
                        </div>
                      )}
                    </div>
                  </Card>
                </TabsContent>

                <TabsContent value="tickets" className="mt-3">
                  <div className="grid gap-3" data-testid="list-tickets">
                    {filteredTickets.length === 0 ? (
                      <div className="rounded-3xl border border-black/10 bg-white/60 p-6 text-center">
                        <div className="text-sm text-black/55">No tickets for this client.</div>
                        <p className="text-xs text-black/40 mt-1">Create a ticket from the Tickets page.</p>
                      </div>
                    ) : (
                      filteredTickets.map((t) => (
                        <div
                          key={t.id}
                          className="rounded-3xl border border-black/10 bg-white/70 p-4"
                          data-testid={`card-ticket-wide-${t.id}`}
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-2 flex-wrap">
                                <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium ${ticketTypePill(t.type)}`}>
                                  {t.type}
                                </span>
                                <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium ${ticketStatusPill(t.status)}`}>
                                  {t.status}
                                </span>
                                <span className="inline-flex items-center rounded-full border border-black/10 bg-black/[0.03] px-2 py-0.5 text-[11px] font-medium text-black/60">
                                  {t.priority}
                                </span>
                              </div>
                              <div className="text-sm font-semibold truncate" data-testid={`text-ticket-wide-title-${t.id}`}>
                                {t.subject}
                              </div>
                              {t.description && (
                                <div className="mt-1 text-xs text-black/60 line-clamp-2">{t.description}</div>
                              )}
                              <div className="mt-2 text-xs text-black/50" data-testid={`text-ticket-wide-meta-${t.id}`}>
                                Assigned to {getUserName(t.userId)} · {formatTicketDate(t.createdAt)}
                              </div>
                            </div>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </TabsContent>

              </Tabs>
            </div>
          </Card>
        </div>
      </div>
      <Dialog open={showNewQuoteModal} onOpenChange={(open) => { setShowNewQuoteModal(open); if (!open) { setNewQuoteIsBooking(false); setNewQuote(newQuoteDefaults); setQuoteImageFiles([]); setQuoteImageUrls([]); setConvertingFromEnquiryTxnId(null); setConvertingEnquiryId(null); } }}>
        <DialogContent className="max-h-[90vh] max-w-4xl overflow-y-auto rounded-3xl border-black/10 bg-white/95 backdrop-blur-xl">
          <DialogHeader>
            <DialogTitle className="text-lg font-semibold">{convertingFromEnquiryTxnId ? "Convert Enquiry to Quote" : newQuoteIsBooking ? "New Booking" : "New Quote"}</DialogTitle>
            <DialogDescription className="text-sm text-black/55">
              {convertingFromEnquiryTxnId ? "Review and adjust the details from the enquiry, then create the quote." : newQuoteIsBooking ? "Create a new booking" : "Create a new quote"} for {client?.name || "this client"}.
            </DialogDescription>
          </DialogHeader>

          <div className="mt-4 grid gap-6">
            <div className="rounded-2xl border border-black/10 bg-white/70 p-4">
              <div className="mb-3 text-sm font-semibold">Package Details</div>
              <div className="grid gap-3 md:grid-cols-2">
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium text-black/60">Package Type</Label>
                  <SearchableSelect
                    value={newQuote.packageType}
                    onValueChange={(v) => setNewQuote({ ...newQuote, packageType: v })}
                    options={(packageTypesData || []).map((pt: LookupPackageType) => ({ value: pt.id, label: pt.name }))}
                    placeholder="Select type..."
                    searchPlaceholder="Search types..."
                    emptyMessage="No types found."
                    data-testid="select-package-type"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium text-black/60">Quote Title</Label>
                  <Input
                    placeholder="e.g. Maldives — Overwater Villa, 9 nights"
                    value={newQuote.quoteTitle}
                    onChange={(e) => setNewQuote({ ...newQuote, quoteTitle: e.target.value })}
                    className="h-9 rounded-xl border-black/10 bg-white/70"
                    data-testid="input-quote-title"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium text-black/60">Quote Link</Label>
                  <Input
                    placeholder="https://..."
                    value={newQuote.quoteLink}
                    onChange={(e) => setNewQuote({ ...newQuote, quoteLink: e.target.value })}
                    className="h-9 rounded-xl border-black/10 bg-white/70"
                    data-testid="input-quote-link"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium text-black/60">Lead Source</Label>
                  <Select value={newQuote.leadSource} onValueChange={(v) => setNewQuote({ ...newQuote, leadSource: v })}>
                    <SelectTrigger className="h-9 rounded-xl border-black/10 bg-white/70" data-testid="select-lead-source">
                      <SelectValue placeholder="Select source..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="SHOP">Shop</SelectItem>
                      <SelectItem value="FACEBOOK">Facebook</SelectItem>
                      <SelectItem value="WHATSAPP">WhatsApp</SelectItem>
                      <SelectItem value="INSTAGRAM">Instagram</SelectItem>
                      <SelectItem value="PHONE_ENQUIRY">Phone Enquiry</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                {newQuoteIsBooking && (
                  <>
                    <div className="space-y-1.5">
                      <Label className="text-xs font-medium text-black/60">HAYS Reference</Label>
                      <Input
                        placeholder="e.g. HAYS-12345"
                        value={newQuote.haysReference}
                        onChange={(e) => setNewQuote({ ...newQuote, haysReference: e.target.value })}
                        className="h-9 rounded-xl border-black/10 bg-white/70"
                        data-testid="input-booking-hays-ref"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs font-medium text-black/60">Tour Reference</Label>
                      <Input
                        placeholder="e.g. TOUR-67890"
                        value={newQuote.tourReference}
                        onChange={(e) => setNewQuote({ ...newQuote, tourReference: e.target.value })}
                        className="h-9 rounded-xl border-black/10 bg-white/70"
                        data-testid="input-booking-tour-ref"
                      />
                    </div>
                  </>
                )}
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium text-black/60">JSON Upload</Label>
                  <Input
                    type="file"
                    accept=".json"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) {
                        const reader = new FileReader();
                        reader.onload = async (ev) => {
                          const content = ev.target?.result as string || "";
                          const toIsoDate = (d: string | undefined): string => {
                            if (!d) return "";
                            const match = d.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})$/);
                            if (match) {
                              const [, day, month, year] = match;
                              return `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
                            }
                            return d;
                          };
                          try {
                            const data = JSON.parse(content);

                            const isScraperFormat = Array.isArray(data.flights) || data.sales_price !== undefined || data.departure_airport !== undefined;

                            const idOnlyFields = new Set([
                              'country', 'destination', 'resort', 'accommodation',
                              'boardBasis', 'tourOperator', 'roomType',
                              'outboundDepartAirport', 'outboundArriveAirport',
                              'inboundDepartAirport', 'inboundArriveAirport',
                            ]);

                            const applyMappedIds = async (textFields: Record<string, string | undefined>) => {
                              try {
                                const { jsonMapperApi } = await import("@/api/endpoints/json-mapper.api");
                                const idMapping = await jsonMapperApi.mapToIds(textFields);
                                setNewQuote((prev) => {
                                  const updated = { ...prev };
                                  if (idMapping.countryId) updated.country = idMapping.countryId;
                                  if (idMapping.destinationId) updated.destination = idMapping.destinationId;
                                  if (idMapping.resortId) updated.resort = idMapping.resortId;
                                  if (idMapping.accommodationId) updated.accommodation = idMapping.accommodationId;
                                  if (idMapping.boardBasisId) updated.boardBasis = idMapping.boardBasisId;
                                  if (idMapping.tourOperatorId) updated.tourOperator = idMapping.tourOperatorId;
                                  if (idMapping.outboundDepartAirportId) updated.outboundDepartAirport = idMapping.outboundDepartAirportId;
                                  if (idMapping.outboundArriveAirportId) updated.outboundArriveAirport = idMapping.outboundArriveAirportId;
                                  if (idMapping.inboundDepartAirportId) updated.inboundDepartAirport = idMapping.inboundDepartAirportId;
                                  if (idMapping.inboundArriveAirportId) updated.inboundArriveAirport = idMapping.inboundArriveAirportId;
                                  if (idMapping.roomTypeId) updated.roomType = idMapping.roomTypeId;
                                  return updated;
                                });
                                if (idMapping.warnings?.length > 0) {
                                  toast({ title: "Some values need attention", description: idMapping.warnings.join(", ") });
                                }
                              } catch (err) {
                                console.error("ID mapping failed:", err);
                              }
                            };

                            if (isScraperFormat) {
                              const { mapScraperJsonToFormFields } = await import("@/lib/scraper-json-parser");
                              const result = mapScraperJsonToFormFields(data);
                              setNewQuote((prev) => {
                                const updated = { ...prev, jsonPayload: content };
                                for (const [k, v] of Object.entries(result.fields)) {
                                  if (v !== "" && v !== null && v !== undefined && !idOnlyFields.has(k)) {
                                    (updated as Record<string, unknown>)[k] = v;
                                  }
                                }
                                return updated;
                              });
                              if (result.images.length > 0) {
                                setQuoteImageUrls((prev) => [...prev, ...result.images.filter((u: string) => !prev.includes(u))]);
                              }
                              await applyMappedIds({
                                country: result.fields.country,
                                destination: result.fields.destination,
                                resort: result.fields.resort,
                                accommodation: result.fields.accommodation,
                                boardBasis: result.fields.boardBasis,
                                tourOperator: result.fields.tourOperator,
                                outboundDepartAirport: result.fields.outboundDepartAirport,
                                outboundArriveAirport: result.fields.outboundArriveAirport,
                                inboundDepartAirport: result.fields.inboundDepartAirport,
                                inboundArriveAirport: result.fields.inboundArriveAirport,
                                roomType: result.fields.roomType,
                              });
                              return;
                            }

                            const textCountry = data.country || "";
                            const textDestination = data.destination || "";
                            const textResort = data.resort || "";
                            const textAccommodation = data.accommodation || data.hotel || data.property || "";
                            const textBoardBasis = data.boardBasis || data.board_basis || data.board || "";
                            const textTourOperator = data.commissions?.tourOperator || data.tourOperator || data.tour_operator || data.operator || "";
                            const textRoomType = data.roomType || data.room_type || data.room || "";
                            const textOutboundDepart = data.flights?.outbound?.departAirport || data.outbound?.from || data.departureAirport || "";
                            const textOutboundArrive = data.flights?.outbound?.arriveAirport || data.outbound?.to || data.arrivalAirport || "";
                            const textInboundDepart = data.flights?.inbound?.departAirport || data.inbound?.from || "";
                            const textInboundArrive = data.flights?.inbound?.arriveAirport || data.inbound?.to || "";

                            setNewQuote((prev) => ({
                              ...prev,
                              jsonPayload: content,
                              packageType: data.packageType || data.package_type || prev.packageType,
                              quoteTitle: data.quoteTitle || data.quote_title || data.title || prev.quoteTitle,
                              quoteLink: data.quoteLink || data.quote_link || data.link || prev.quoteLink,
                              travelDate: toIsoDate(data.travelDate || data.travel_date || data.departureDate) || prev.travelDate,
                              passengersAdults: data.passengers?.adults || data.adults || data.passengersAdults || prev.passengersAdults,
                              passengersChildren: data.passengers?.children || data.children || data.passengersChildren || prev.passengersChildren,
                              passengersInfants: data.passengers?.infants || data.infants || data.passengersInfants || prev.passengersInfants,
                              childAges: data.childAges || data.child_ages || data.passengers?.childAges || prev.childAges,
                              checkInDate: toIsoDate(data.checkInDate || data.check_in_date || data.checkin) || prev.checkInDate,
                              checkInTime: data.checkInTime || data.check_in_time || prev.checkInTime,
                              nights: data.nights || data.duration || prev.nights,
                              transferType: data.transferType || data.transfer_type || data.transfers || prev.transferType,
                              preBookedSeats: data.preBookedSeats || data.pre_booked_seats || data.seats || prev.preBookedSeats,
                              flightMeals: data.flightMeals || data.flight_meals || data.meals || prev.flightMeals,
                              outboundDepartDate: toIsoDate(data.flights?.outbound?.departDate || data.outbound?.date) || prev.outboundDepartDate,
                              outboundDepartTime: data.flights?.outbound?.departTime || data.outbound?.time || prev.outboundDepartTime,
                              outboundArriveDate: toIsoDate(data.flights?.outbound?.arriveDate) || prev.outboundArriveDate,
                              outboundArriveTime: data.flights?.outbound?.arriveTime || prev.outboundArriveTime,
                              inboundDepartDate: toIsoDate(data.flights?.inbound?.departDate || data.inbound?.date) || prev.inboundDepartDate,
                              inboundDepartTime: data.flights?.inbound?.departTime || data.inbound?.time || prev.inboundDepartTime,
                              inboundArriveDate: toIsoDate(data.flights?.inbound?.arriveDate) || prev.inboundArriveDate,
                              inboundArriveTime: data.flights?.inbound?.arriveTime || prev.inboundArriveTime,
                              sales: data.commissions?.sales || data.sales || prev.sales,
                              price: data.commissions?.price || data.price || data.total || prev.price,
                              commission: data.commissions?.commission || data.commission || prev.commission,
                              discount: data.commissions?.discount || data.discount || prev.discount,
                              serviceCharge: data.commissions?.serviceCharge || data.serviceCharge || data.service_charge || prev.serviceCharge,
                              pricePerPerson: data.commissions?.pricePerPerson || data.pricePerPerson || data.price_per_person || data.ppp || prev.pricePerPerson,
                            }));

                            await applyMappedIds({
                              country: textCountry,
                              destination: textDestination,
                              resort: textResort,
                              accommodation: textAccommodation,
                              boardBasis: textBoardBasis,
                              tourOperator: textTourOperator,
                              outboundDepartAirport: textOutboundDepart,
                              outboundArriveAirport: textOutboundArrive,
                              inboundDepartAirport: textInboundDepart,
                              inboundArriveAirport: textInboundArrive,
                              roomType: textRoomType,
                            });
                            const extractedImages: string[] = [];
                            const imageFields = [
                              data.images, data.image, data.photos, data.photo,
                              data.imageUrl, data.image_url, data.imageUrls, data.image_urls,
                              data.thumbnails, data.thumbnail, data.gallery,
                              data.accommodation?.image, data.accommodation?.imageUrl,
                              data.hotel?.image, data.hotel?.imageUrl,
                            ];
                            for (const field of imageFields) {
                              if (typeof field === "string" && field.startsWith("http")) {
                                extractedImages.push(field);
                              } else if (Array.isArray(field)) {
                                for (const item of field) {
                                  if (typeof item === "string" && item.startsWith("http")) {
                                    extractedImages.push(item);
                                  } else if (item?.url && typeof item.url === "string") {
                                    extractedImages.push(item.url);
                                  }
                                }
                              }
                            }
                            if (extractedImages.length > 0) {
                              setQuoteImageUrls((prev) => [...prev, ...extractedImages.filter((u) => !prev.includes(u))]);
                            }
                          } catch {
                            setNewQuote((prev) => ({ ...prev, jsonPayload: content }));
                          }
                        };
                        reader.readAsText(file);
                      }
                    }}
                    className="h-9 rounded-xl border-black/10 bg-white/70"
                    data-testid="input-json-upload"
                  />
                </div>
              </div>
            </div>

            <div className="rounded-2xl border border-black/10 bg-white/70 p-4">
              <div className="mb-3 flex items-center gap-2 text-sm font-semibold">
                <ImagePlus className="h-4 w-4" />
                Quote Images
              </div>
              <div className="space-y-3">
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium text-black/60">Upload Images</Label>
                  <input
                    ref={imageInputRef}
                    type="file"
                    accept="image/jpeg,image/png,image/gif,image/webp"
                    multiple
                    onChange={(e) => {
                      const files = Array.from(e.target.files || []);
                      if (files.length > 0) {
                        setQuoteImageFiles((prev) => [...prev, ...files]);
                      }
                      if (imageInputRef.current) imageInputRef.current.value = "";
                    }}
                    className="hidden"
                    data-testid="input-quote-images"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    className="h-9 w-full rounded-xl border-black/10 bg-white/70 text-sm"
                    onClick={() => imageInputRef.current?.click()}
                    data-testid="button-add-images"
                  >
                    <ImagePlus className="mr-2 h-4 w-4" />
                    Add images
                  </Button>
                </div>

                {(quoteImageFiles.length > 0 || quoteImageUrls.length > 0) && (
                  <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-5">
                    {quoteImageFiles.map((file, idx) => (
                      <div key={`file-${idx}`} className="group relative overflow-hidden rounded-xl border border-black/10">
                        <img
                          src={URL.createObjectURL(file)}
                          alt={file.name}
                          className="h-20 w-full object-cover"
                          data-testid={`img-quote-preview-file-${idx}`}
                        />
                        <button
                          type="button"
                          onClick={() => setQuoteImageFiles((prev) => prev.filter((_, i) => i !== idx))}
                          className="absolute right-1 top-1 rounded-full bg-black/60 p-0.5 text-white opacity-0 transition group-hover:opacity-100"
                          data-testid={`button-remove-image-file-${idx}`}
                        >
                          <X className="h-3 w-3" />
                        </button>
                        <div className="absolute bottom-0 left-0 right-0 bg-black/50 px-1 py-0.5 text-[9px] text-white truncate">
                          {file.name}
                        </div>
                      </div>
                    ))}
                    {quoteImageUrls.map((url, idx) => (
                      <div key={`url-${idx}`} className="group relative overflow-hidden rounded-xl border border-black/10">
                        <img
                          src={url}
                          alt={`Image ${idx + 1}`}
                          className="h-20 w-full object-cover"
                          data-testid={`img-quote-preview-url-${idx}`}
                          onError={(e) => {
                            (e.target as HTMLImageElement).src = "";
                            (e.target as HTMLImageElement).alt = "Failed to load";
                          }}
                        />
                        <button
                          type="button"
                          onClick={() => setQuoteImageUrls((prev) => prev.filter((_, i) => i !== idx))}
                          className="absolute right-1 top-1 rounded-full bg-black/60 p-0.5 text-white opacity-0 transition group-hover:opacity-100"
                          data-testid={`button-remove-image-url-${idx}`}
                        >
                          <X className="h-3 w-3" />
                        </button>
                        <div className="absolute bottom-0 left-0 right-0 bg-black/50 px-1 py-0.5 text-[9px] text-white">
                          From JSON
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {packageTypeName === "Hot Tub Break" ? (
              <div className="rounded-2xl border border-black/10 bg-white/70 p-4" data-testid="new-section-travel-date-only">
                <div className="mb-3 text-sm font-semibold">Travel Details</div>
                <div className="grid gap-3 md:grid-cols-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium text-black/60">Travel Date</Label>
                    <DatePicker
                      value={newQuote.travelDate}
                      onChange={(v) => setNewQuote({ ...newQuote, travelDate: v })}
                      placeholder="Pick a date"
                      data-testid="input-travel-date"
                    />
                  </div>
                </div>
              </div>
            ) : (
              <div className="rounded-2xl border border-black/10 bg-white/70 p-4" data-testid="new-section-travel-details">
                <div className="mb-3 text-sm font-semibold">Travel Details</div>
                <div className="grid gap-3 md:grid-cols-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium text-black/60">Travel Date</Label>
                    <DatePicker
                      value={newQuote.travelDate}
                      onChange={(v) => setNewQuote({ ...newQuote, travelDate: v })}
                      placeholder="Pick a date"
                      data-testid="input-travel-date"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium text-black/60">Adults</Label>
                    <Input
                      type="number"
                      min={1}
                      value={newQuote.passengersAdults}
                      onChange={(e) => setNewQuote({ ...newQuote, passengersAdults: parseInt(e.target.value) || 1 })}
                      className="h-9 rounded-xl border-black/10 bg-white/70"
                      data-testid="input-adults"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium text-black/60">Children</Label>
                    <Input
                      type="number"
                      min={0}
                      value={newQuote.passengersChildren}
                      onChange={(e) => {
                        const count = parseInt(e.target.value) || 0;
                        setNewQuote({ ...newQuote, passengersChildren: count, childAges: Array(count).fill(0) });
                      }}
                      className="h-9 rounded-xl border-black/10 bg-white/70"
                      data-testid="input-children"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium text-black/60">Infants</Label>
                    <Input
                      type="number"
                      min={0}
                      value={newQuote.passengersInfants}
                      onChange={(e) => setNewQuote({ ...newQuote, passengersInfants: parseInt(e.target.value) || 0 })}
                      className="h-9 rounded-xl border-black/10 bg-white/70"
                      data-testid="input-infants"
                    />
                  </div>
                  {newQuote.passengersChildren > 0 && (
                    <div className="space-y-1.5 md:col-span-2">
                      <Label className="text-xs font-medium text-black/60">Children's Ages</Label>
                      <div className="flex flex-wrap gap-2">
                        {newQuote.childAges.map((age, idx) => (
                          <Input
                            key={idx}
                            type="number"
                            min={0}
                            max={17}
                            value={age}
                            onChange={(e) => {
                              const ages = [...newQuote.childAges];
                              ages[idx] = parseInt(e.target.value) || 0;
                              setNewQuote({ ...newQuote, childAges: ages });
                            }}
                            className="h-9 w-16 rounded-xl border-black/10 bg-white/70"
                            data-testid={`input-child-age-${idx}`}
                            placeholder={`Child ${idx + 1}`}
                          />
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {packageTypeName === "Cruise Package" ? (
              <div className="rounded-2xl border border-black/10 bg-white/70 p-4" data-testid="new-section-cruise-cabin">
                <div className="mb-3 flex items-center gap-2 text-sm font-semibold">
                  <Anchor className="h-4 w-4" />
                  Cruise & Cabin
                </div>
                <div className="grid gap-3 md:grid-cols-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium text-black/60">Cruise Title</Label>
                    <Input
                      placeholder="e.g. Western Mediterranean"
                      value={newQuote.cruiseTitle}
                      onChange={(e) => setNewQuote({ ...newQuote, cruiseTitle: e.target.value })}
                      className="h-9 rounded-xl border-black/10 bg-white/70"
                      data-testid="input-cruise-title"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium text-black/60">Cruise Line</Label>
                    <Input
                      placeholder="e.g. Royal Caribbean"
                      value={newQuote.cruiseLine}
                      onChange={(e) => setNewQuote({ ...newQuote, cruiseLine: e.target.value })}
                      className="h-9 rounded-xl border-black/10 bg-white/70"
                      data-testid="input-cruise-line"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium text-black/60">Ship Name</Label>
                    <Input
                      placeholder="e.g. Harmony of the Seas"
                      value={newQuote.shipName}
                      onChange={(e) => setNewQuote({ ...newQuote, shipName: e.target.value })}
                      className="h-9 rounded-xl border-black/10 bg-white/70"
                      data-testid="input-ship-name"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium text-black/60">Cruise Date</Label>
                    <DatePicker
                      value={newQuote.cruiseDate}
                      onChange={(v) => setNewQuote({ ...newQuote, cruiseDate: v })}
                      placeholder="Pick a date"
                      data-testid="input-cruise-date"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium text-black/60">Cabin Type</Label>
                    <Select value={newQuote.cabinType} onValueChange={(v) => setNewQuote({ ...newQuote, cabinType: v })}>
                      <SelectTrigger className="h-9 rounded-xl border-black/10 bg-white/70" data-testid="select-cabin-type">
                        <SelectValue placeholder="Select..." />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Inside">Inside</SelectItem>
                        <SelectItem value="Outside">Outside</SelectItem>
                        <SelectItem value="Balcony">Balcony</SelectItem>
                        <SelectItem value="Suite">Suite</SelectItem>
                        <SelectItem value="Mini Suite">Mini Suite</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium text-black/60">Embarkation</Label>
                    <Input
                      placeholder="e.g. Southampton"
                      value={newQuote.embarkation}
                      onChange={(e) => setNewQuote({ ...newQuote, embarkation: e.target.value })}
                      className="h-9 rounded-xl border-black/10 bg-white/70"
                      data-testid="input-embarkation"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium text-black/60">Debarkation</Label>
                    <Input
                      placeholder="e.g. Barcelona"
                      value={newQuote.debarkation}
                      onChange={(e) => setNewQuote({ ...newQuote, debarkation: e.target.value })}
                      className="h-9 rounded-xl border-black/10 bg-white/70"
                      data-testid="input-debarkation"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium text-black/60">Cruise Extras Included</Label>
                    <Input
                      placeholder="e.g. Drinks package, WiFi"
                      value={newQuote.cruiseExtras}
                      onChange={(e) => setNewQuote({ ...newQuote, cruiseExtras: e.target.value })}
                      className="h-9 rounded-xl border-black/10 bg-white/70"
                      data-testid="input-cruise-extras"
                    />
                  </div>
                  <div className="flex items-end gap-3 pb-1">
                    <div className="space-y-1.5">
                      <Label className="text-xs font-medium text-black/60">Cruise Only</Label>
                      <div className="flex items-center gap-2">
                        <Switch
                          checked={newQuote.cruiseOnly}
                          onCheckedChange={(v) => setNewQuote({ ...newQuote, cruiseOnly: v })}
                          data-testid="switch-cruise-only"
                        />
                        <span className="text-xs text-black/55">{newQuote.cruiseOnly ? "Yes" : "No"}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ) : packageTypeName === "Hot Tub Break" ? (
              <div className="rounded-2xl border border-black/10 bg-white/70 p-4" data-testid="new-section-lodge-details">
                <div className="mb-3 flex items-center gap-2 text-sm font-semibold">
                  <Hotel className="h-4 w-4" />
                  Lodge Details
                </div>
                <div className="grid gap-3 md:grid-cols-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium text-black/60">Park Name</Label>
                    <Select value={newQuote.parkName} onValueChange={(v) => setNewQuote({ ...newQuote, parkName: v, lodgeCode: "" })}>
                      <SelectTrigger className="h-9 rounded-xl border-black/10 bg-white/70" data-testid="select-park-name">
                        <SelectValue placeholder="Select park..." />
                      </SelectTrigger>
                      <SelectContent>
                        {(parksData || []).map((park: LookupPark) => (
                          <SelectItem key={park.id} value={park.id}>{park.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium text-black/60">Lodge Code</Label>
                    <Select value={newQuote.lodgeCode} onValueChange={(v) => setNewQuote({ ...newQuote, lodgeCode: v })} disabled={!newQuote.parkName}>
                      <SelectTrigger className="h-9 rounded-xl border-black/10 bg-white/70" data-testid="select-lodge-code">
                        <SelectValue placeholder="Select lodge..." />
                      </SelectTrigger>
                      <SelectContent>
                        {(lodgesData || []).map((lodge: LookupLodge) => (
                          <SelectItem key={lodge.id} value={lodge.id}>{lodge.lodge_name}{lodge.lodge_code ? ` (${lodge.lodge_code})` : ""}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium text-black/60">Number of Nights</Label>
                    <Input
                      type="number"
                      min={1}
                      value={newQuote.nights}
                      onChange={(e) => setNewQuote({ ...newQuote, nights: parseInt(e.target.value) || 1 })}
                      className="h-9 rounded-xl border-black/10 bg-white/70"
                      data-testid="input-lodge-nights"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium text-black/60">Check-in Date</Label>
                    <DatePicker
                      value={newQuote.checkInDate}
                      onChange={(v) => setNewQuote({ ...newQuote, checkInDate: v })}
                      placeholder="Pick a date"
                      data-testid="input-lodge-checkin"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium text-black/60">Adults</Label>
                    <Input
                      type="number"
                      min={1}
                      value={newQuote.passengersAdults}
                      onChange={(e) => setNewQuote({ ...newQuote, passengersAdults: parseInt(e.target.value) || 1 })}
                      className="h-9 rounded-xl border-black/10 bg-white/70"
                      data-testid="input-lodge-adults"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium text-black/60">Children</Label>
                    <Input
                      type="number"
                      min={0}
                      value={newQuote.passengersChildren}
                      onChange={(e) => {
                        const count = parseInt(e.target.value) || 0;
                        setNewQuote({ ...newQuote, passengersChildren: count, childAges: Array(count).fill(0) });
                      }}
                      className="h-9 rounded-xl border-black/10 bg-white/70"
                      data-testid="input-lodge-children"
                    />
                  </div>
                  {newQuote.passengersChildren > 0 && (
                    <div className="space-y-1.5 md:col-span-3">
                      <Label className="text-xs font-medium text-black/60">Children's Ages</Label>
                      <div className="flex flex-wrap gap-2">
                        {newQuote.childAges.map((age, idx) => (
                          <Input
                            key={idx}
                            type="number"
                            min={0}
                            max={17}
                            value={age}
                            onChange={(e) => {
                              const ages = [...newQuote.childAges];
                              ages[idx] = parseInt(e.target.value) || 0;
                              setNewQuote({ ...newQuote, childAges: ages });
                            }}
                            className="h-9 w-16 rounded-xl border-black/10 bg-white/70"
                            data-testid={`input-lodge-child-age-${idx}`}
                            placeholder={`Child ${idx + 1}`}
                          />
                        ))}
                      </div>
                    </div>
                  )}
                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium text-black/60">Infants</Label>
                    <Input
                      type="number"
                      min={0}
                      value={newQuote.passengersInfants}
                      onChange={(e) => setNewQuote({ ...newQuote, passengersInfants: parseInt(e.target.value) || 0 })}
                      className="h-9 rounded-xl border-black/10 bg-white/70"
                      data-testid="input-lodge-infants"
                    />
                  </div>
                  <div className="flex items-end gap-3 pb-1">
                    <div className="space-y-1.5">
                      <Label className="text-xs font-medium text-black/60">
                        <span className="flex items-center gap-1.5">
                          <PawPrint className="h-3.5 w-3.5" />
                          Pets
                        </span>
                      </Label>
                      <div className="flex items-center gap-2">
                        <Switch
                          checked={newQuote.pets}
                          onCheckedChange={(v) => setNewQuote({ ...newQuote, pets: v })}
                          data-testid="switch-pets"
                        />
                        <span className="text-xs text-black/55">{newQuote.pets ? "Yes" : "No"}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="rounded-2xl border border-black/10 bg-white/70 p-4" data-testid="new-section-destination-accommodation">
                <div className="mb-3 text-sm font-semibold">Destination & Accommodation</div>
                <div className="grid gap-3 md:grid-cols-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium text-black/60">Country</Label>
                    <Select value={newQuote.country} onValueChange={(v) => setNewQuote({ ...newQuote, country: v, destination: "", resort: "", accommodation: "" })}>
                      <SelectTrigger className="h-9 rounded-xl border-black/10 bg-white/70" data-testid="select-country">
                        <SelectValue placeholder="Select country..." />
                      </SelectTrigger>
                      <SelectContent>
                        {(countriesData || []).map((c: LookupCountry) => (
                          <SelectItem key={c.id} value={c.id}>{c.country_name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium text-black/60">Destination</Label>
                    <Select value={newQuote.destination} onValueChange={(v) => setNewQuote({ ...newQuote, destination: v, resort: "", accommodation: "" })} disabled={!newQuote.country}>
                      <SelectTrigger className="h-9 rounded-xl border-black/10 bg-white/70" data-testid="select-destination">
                        <SelectValue placeholder="Select destination..." />
                      </SelectTrigger>
                      <SelectContent>
                        {(destinationsData || []).map((d: LookupDestination) => (
                          <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium text-black/60">Resort</Label>
                    <Select value={newQuote.resort} onValueChange={(v) => setNewQuote({ ...newQuote, resort: v, accommodation: "" })} disabled={!newQuote.destination}>
                      <SelectTrigger className="h-9 rounded-xl border-black/10 bg-white/70" data-testid="select-resort">
                        <SelectValue placeholder="Select resort..." />
                      </SelectTrigger>
                      <SelectContent>
                        {(resortsData || []).map((r: LookupResort) => (
                          <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium text-black/60">Accommodation</Label>
                    <Select value={newQuote.accommodation} onValueChange={(v) => setNewQuote({ ...newQuote, accommodation: v })} disabled={!newQuote.resort}>
                      <SelectTrigger className="h-9 rounded-xl border-black/10 bg-white/70" data-testid="select-accommodation">
                        <SelectValue placeholder="Select accommodation..." />
                      </SelectTrigger>
                      <SelectContent>
                        {(accommodationsData || []).map((a: LookupAccommodation) => (
                          <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium text-black/60">Check-in Date</Label>
                    <DatePicker
                      value={newQuote.checkInDate}
                      onChange={(v) => setNewQuote({ ...newQuote, checkInDate: v })}
                      placeholder="Pick a date"
                      data-testid="input-checkin-date"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium text-black/60">Check-in Time</Label>
                    <Input
                      type="time"
                      value={newQuote.checkInTime}
                      onChange={(e) => setNewQuote({ ...newQuote, checkInTime: e.target.value })}
                      className="h-9 rounded-xl border-black/10 bg-white/70"
                      data-testid="input-checkin-time"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium text-black/60">Number of Nights</Label>
                    <Input
                      type="number"
                      min={1}
                      value={newQuote.nights}
                      onChange={(e) => setNewQuote({ ...newQuote, nights: parseInt(e.target.value) || 1 })}
                      className="h-9 rounded-xl border-black/10 bg-white/70"
                      data-testid="input-nights"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium text-black/60">Board Basis</Label>
                    <Select value={newQuote.boardBasis} onValueChange={(v) => setNewQuote({ ...newQuote, boardBasis: v })}>
                      <SelectTrigger className="h-9 rounded-xl border-black/10 bg-white/70" data-testid="select-board-basis">
                        <SelectValue placeholder="Select..." />
                      </SelectTrigger>
                      <SelectContent>
                        {(boardBasisData || []).map((bb: LookupBoardBasis) => (
                          <SelectItem key={bb.id} value={bb.id}>{bb.type}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium text-black/60">Room Type</Label>
                    <SearchableSelect
                      value={newQuote.roomType}
                      onValueChange={(v) => setNewQuote({ ...newQuote, roomType: v })}
                      options={(roomTypeData || []).map((r: { id: string; name: string | null }) => ({ value: r.name || "", label: r.name || "Unknown" }))}
                      placeholder="Select room type..."
                      searchPlaceholder="Search..."
                      emptyMessage="No options found."
                      data-testid="select-room-type"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium text-black/60">Transfer Type</Label>
                    <Select value={newQuote.transferType} onValueChange={(v) => setNewQuote({ ...newQuote, transferType: v })}>
                      <SelectTrigger className="h-9 rounded-xl border-black/10 bg-white/70" data-testid="select-transfer-type">
                        <SelectValue placeholder="Select..." />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Private Transfer">Private Transfer</SelectItem>
                        <SelectItem value="Shared Transfer">Shared Transfer</SelectItem>
                        <SelectItem value="Seaplane">Seaplane</SelectItem>
                        <SelectItem value="Speedboat">Speedboat</SelectItem>
                        <SelectItem value="Self-drive">Self-drive</SelectItem>
                        <SelectItem value="None">None</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium text-black/60">Pre-booked Seats</Label>
                    <Input
                      placeholder="e.g. Extra legroom (row 12)"
                      value={newQuote.preBookedSeats}
                      onChange={(e) => setNewQuote({ ...newQuote, preBookedSeats: e.target.value })}
                      className="h-9 rounded-xl border-black/10 bg-white/70"
                      data-testid="input-prebooked-seats"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium text-black/60">Flight Meals</Label>
                    <Input
                      placeholder="e.g. Standard + child meal"
                      value={newQuote.flightMeals}
                      onChange={(e) => setNewQuote({ ...newQuote, flightMeals: e.target.value })}
                      className="h-9 rounded-xl border-black/10 bg-white/70"
                      data-testid="input-flight-meals"
                    />
                  </div>
                </div>
              </div>
            )}

            {packageTypeName !== "Hot Tub Break" && !(packageTypeName === "Cruise Package" && newQuote.cruiseOnly) && (
              <>
                <div className="rounded-2xl border border-black/10 bg-white/70 p-4" data-testid="new-section-outbound-flights">
                  <div className="mb-3 flex items-center gap-2 text-sm font-semibold">
                    <Plane className="h-4 w-4" />
                    Flights — Outbound
                  </div>
                  <div className="grid gap-3 md:grid-cols-3">
                    <div className="space-y-1.5">
                      <Label className="text-xs font-medium text-black/60">Departing Airport</Label>
                      <SearchableSelect
                        value={newQuote.outboundDepartAirport}
                        onValueChange={(v) => setNewQuote({ ...newQuote, outboundDepartAirport: v })}
                        options={(airportsData || []).map((a: Airport) => ({ value: a.id, label: `${a.airport_name} (${a.airport_code})` }))}
                        placeholder="Select airport..."
                        searchPlaceholder="Search airports..."
                        emptyMessage="No airports found."
                        data-testid="input-outbound-depart-airport"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs font-medium text-black/60">Departure Date</Label>
                      <DatePicker
                        value={newQuote.outboundDepartDate}
                        onChange={(v) => setNewQuote({ ...newQuote, outboundDepartDate: v })}
                        placeholder="Pick a date"
                        data-testid="input-outbound-depart-date"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs font-medium text-black/60">Departure Time</Label>
                      <Input
                        type="time"
                        value={newQuote.outboundDepartTime}
                        onChange={(e) => setNewQuote({ ...newQuote, outboundDepartTime: e.target.value })}
                        className="h-9 rounded-xl border-black/10 bg-white/70"
                        data-testid="input-outbound-depart-time"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs font-medium text-black/60">Arrival Airport</Label>
                      <SearchableSelect
                        value={newQuote.outboundArriveAirport}
                        onValueChange={(v) => setNewQuote({ ...newQuote, outboundArriveAirport: v })}
                        options={(airportsData || []).map((a: Airport) => ({ value: a.id, label: `${a.airport_name} (${a.airport_code})` }))}
                        placeholder="Select airport..."
                        searchPlaceholder="Search airports..."
                        emptyMessage="No airports found."
                        data-testid="input-outbound-arrive-airport"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs font-medium text-black/60">Arrival Date</Label>
                      <DatePicker
                        value={newQuote.outboundArriveDate}
                        onChange={(v) => setNewQuote({ ...newQuote, outboundArriveDate: v })}
                        placeholder="Pick a date"
                        data-testid="input-outbound-arrive-date"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs font-medium text-black/60">Arrival Time</Label>
                      <Input
                        type="time"
                        value={newQuote.outboundArriveTime}
                        onChange={(e) => setNewQuote({ ...newQuote, outboundArriveTime: e.target.value })}
                        className="h-9 rounded-xl border-black/10 bg-white/70"
                        data-testid="input-outbound-arrive-time"
                      />
                    </div>
                  </div>
                </div>

                <div className="rounded-2xl border border-black/10 bg-white/70 p-4" data-testid="new-section-inbound-flights">
                  <div className="mb-3 flex items-center gap-2 text-sm font-semibold">
                    <Plane className="h-4 w-4 rotate-180" />
                    Flights — Inbound
                  </div>
                  <div className="grid gap-3 md:grid-cols-3">
                    <div className="space-y-1.5">
                      <Label className="text-xs font-medium text-black/60">Departing Airport</Label>
                      <SearchableSelect
                        value={newQuote.inboundDepartAirport}
                        onValueChange={(v) => setNewQuote({ ...newQuote, inboundDepartAirport: v })}
                        options={(airportsData || []).map((a: Airport) => ({ value: a.id, label: `${a.airport_name} (${a.airport_code})` }))}
                        placeholder="Select airport..."
                        searchPlaceholder="Search airports..."
                        emptyMessage="No airports found."
                        data-testid="input-inbound-depart-airport"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs font-medium text-black/60">Departure Date</Label>
                      <DatePicker
                        value={newQuote.inboundDepartDate}
                        onChange={(v) => setNewQuote({ ...newQuote, inboundDepartDate: v })}
                        placeholder="Pick a date"
                        data-testid="input-inbound-depart-date"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs font-medium text-black/60">Departure Time</Label>
                      <Input
                        type="time"
                        value={newQuote.inboundDepartTime}
                        onChange={(e) => setNewQuote({ ...newQuote, inboundDepartTime: e.target.value })}
                        className="h-9 rounded-xl border-black/10 bg-white/70"
                        data-testid="input-inbound-depart-time"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs font-medium text-black/60">Arrival Airport</Label>
                      <SearchableSelect
                        value={newQuote.inboundArriveAirport}
                        onValueChange={(v) => setNewQuote({ ...newQuote, inboundArriveAirport: v })}
                        options={(airportsData || []).map((a: Airport) => ({ value: a.id, label: `${a.airport_name} (${a.airport_code})` }))}
                        placeholder="Select airport..."
                        searchPlaceholder="Search airports..."
                        emptyMessage="No airports found."
                        data-testid="input-inbound-arrive-airport"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs font-medium text-black/60">Arrival Date</Label>
                      <DatePicker
                        value={newQuote.inboundArriveDate}
                        onChange={(v) => setNewQuote({ ...newQuote, inboundArriveDate: v })}
                        placeholder="Pick a date"
                        data-testid="input-inbound-arrive-date"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs font-medium text-black/60">Arrival Time</Label>
                      <Input
                        type="time"
                        value={newQuote.inboundArriveTime}
                        onChange={(e) => setNewQuote({ ...newQuote, inboundArriveTime: e.target.value })}
                        className="h-9 rounded-xl border-black/10 bg-white/70"
                        data-testid="input-inbound-arrive-time"
                      />
                    </div>
                  </div>
                </div>
              </>
            )}

            <div className="rounded-2xl border border-black/10 bg-white/70 p-4">
              <div className="mb-3 text-sm font-semibold">Package Commissions</div>
              <div className="grid gap-3 md:grid-cols-3">
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium text-black/60">Tour Operator</Label>
                  <SearchableSelect
                    value={newQuote.tourOperator}
                    onValueChange={(v) => setNewQuote({ ...newQuote, tourOperator: v })}
                    options={(tourOperatorsData || []).map((t: TourOperator) => ({ value: t.id, label: t.name || "" }))}
                    placeholder="Select tour operator..."
                    searchPlaceholder="Search tour operators..."
                    emptyMessage="No tour operators found."
                    data-testid="input-tour-operator"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium text-black/60">Sales (£)</Label>
                  <Input
                    type="number"
                    min={0}
                    value={newQuote.sales}
                    onChange={(e) => setNewQuote({ ...newQuote, sales: parseFloat(e.target.value) || 0 })}
                    className="h-9 rounded-xl border-black/10 bg-white/70"
                    data-testid="input-sales"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium text-black/60">Price (£)</Label>
                  <Input
                    type="number"
                    min={0}
                    value={newQuote.price}
                    onChange={(e) => setNewQuote({ ...newQuote, price: parseFloat(e.target.value) || 0 })}
                    className="h-9 rounded-xl border-black/10 bg-white/70"
                    data-testid="input-price"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium text-black/60">Commission (£)</Label>
                  <Input
                    type="number"
                    min={0}
                    value={newQuote.commission}
                    onChange={(e) => setNewQuote({ ...newQuote, commission: parseFloat(e.target.value) || 0 })}
                    className="h-9 rounded-xl border-black/10 bg-white/70"
                    data-testid="input-commission"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium text-black/60">Discount (£)</Label>
                  <Input
                    type="number"
                    min={0}
                    value={newQuote.discount}
                    onChange={(e) => setNewQuote({ ...newQuote, discount: parseFloat(e.target.value) || 0 })}
                    className="h-9 rounded-xl border-black/10 bg-white/70"
                    data-testid="input-discount"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium text-black/60">Service Charge (£)</Label>
                  <Input
                    type="number"
                    min={0}
                    value={newQuote.serviceCharge}
                    onChange={(e) => setNewQuote({ ...newQuote, serviceCharge: parseFloat(e.target.value) || 0 })}
                    className="h-9 rounded-xl border-black/10 bg-white/70"
                    data-testid="input-service-charge"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium text-black/60">Price per Person (£)</Label>
                  <Input
                    type="number"
                    min={0}
                    value={newQuote.pricePerPerson}
                    onChange={(e) => setNewQuote({ ...newQuote, pricePerPerson: parseFloat(e.target.value) || 0 })}
                    className="h-9 rounded-xl border-black/10 bg-white/70"
                    data-testid="input-price-per-person"
                  />
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-3">
              <Button
                variant="outline"
                className="rounded-2xl border-black/10 px-4"
                onClick={() => setShowNewQuoteModal(false)}
                data-testid="button-cancel-quote"
              >
                Cancel
              </Button>
              <Button
                className="rounded-2xl bg-black px-4 text-white hover:bg-black/90"
                disabled={createTransactionMutation.isPending}
                onClick={async () => {
                  if (!clientId || !currentUser?.id) {
                    toast({ title: "Please wait, loading user info...", variant: "destructive" });
                    return;
                  }
                  if (!newQuote.packageType || !newQuote.quoteTitle || !newQuote.travelDate) {
                    toast({ title: "Please fill in Package Type, Quote Title and Travel Date", variant: "destructive" });
                    return;
                  }

                  const outboundFlight = (newQuote.outboundDepartAirport || newQuote.outboundArriveAirport) ? {
                    departing_airport_id: newQuote.outboundDepartAirport || undefined,
                    arrival_airport_id: newQuote.outboundArriveAirport || undefined,
                    departure_date_time: newQuote.outboundDepartDate && newQuote.outboundDepartTime
                      ? `${newQuote.outboundDepartDate}T${newQuote.outboundDepartTime}` : newQuote.outboundDepartDate || undefined,
                    arrival_date_time: newQuote.outboundArriveDate && newQuote.outboundArriveTime
                      ? `${newQuote.outboundArriveDate}T${newQuote.outboundArriveTime}` : newQuote.outboundArriveDate || undefined,
                    is_included_in_package: true,
                  } : undefined;
                  const inboundFlight = (newQuote.inboundDepartAirport || newQuote.inboundArriveAirport) ? {
                    departing_airport_id: newQuote.inboundDepartAirport || undefined,
                    arrival_airport_id: newQuote.inboundArriveAirport || undefined,
                    departure_date_time: newQuote.inboundDepartDate && newQuote.inboundDepartTime
                      ? `${newQuote.inboundDepartDate}T${newQuote.inboundDepartTime}` : newQuote.inboundDepartDate || undefined,
                    arrival_date_time: newQuote.inboundArriveDate && newQuote.inboundArriveTime
                      ? `${newQuote.inboundArriveDate}T${newQuote.inboundArriveTime}` : newQuote.inboundArriveDate || undefined,
                    is_included_in_package: true,
                  } : undefined;
                  const primaryAccommodation = newQuote.accommodation ? {
                    accomodation_id: newQuote.accommodation,
                    board_basis_id: newQuote.boardBasis || undefined,
                    room_type: newQuote.roomType || undefined,
                    no_of_nights: newQuote.nights || 0,
                    check_in_date_time: newQuote.checkInDate || undefined,
                    is_included_in_package: true,
                  } : undefined;

                  const quotePayload = {
                    holiday_type_id: newQuote.packageType,
                    travel_date: newQuote.travelDate,
                    quote_type: packageTypeName || newQuote.packageType,
                    num_of_nights: newQuote.nights || undefined,
                    adult: newQuote.passengersAdults,
                    child: newQuote.passengersChildren,
                    infant: newQuote.passengersInfants,
                    sales_price: newQuote.price ? String(newQuote.price) : undefined,
                    package_commission: newQuote.commission ? String(newQuote.commission) : undefined,
                    title: newQuote.quoteTitle,
                    price_per_person: newQuote.pricePerPerson ? String(newQuote.pricePerPerson) : undefined,
                    transfer_type: newQuote.transferType || undefined,
                    lodge_id: packageTypeName === "Hot Tub Break" ? (newQuote.lodgeCode || undefined) : undefined,
                    pets: packageTypeName === "Hot Tub Break" ? (newQuote.pets ? 1 : 0) : undefined,
                    main_tour_operator_id: newQuote.tourOperator || undefined,
                    outboundFlight: packageTypeName === "Package Holiday" ? outboundFlight : undefined,
                    inboundFlight: packageTypeName === "Package Holiday" ? inboundFlight : undefined,
                    primaryAccommodation: packageTypeName === "Package Holiday" ? primaryAccommodation : undefined,
                  };

                  if (newQuoteIsBooking) {
                    createTransactionMutation.mutate(
                      {
                        client_id: clientId,
                        user_id: currentUser.id,
                        lead_source: newQuote.leadSource || undefined,
                        booking: {
                          holiday_type_id: newQuote.packageType,
                          hays_ref: newQuote.haysReference || "",
                          supplier_ref: newQuote.tourReference || "",
                          travel_date: newQuote.travelDate,
                          title: newQuote.quoteTitle,
                          num_of_nights: newQuote.nights || 0,
                          adult: newQuote.passengersAdults || 0,
                          child: newQuote.passengersChildren || 0,
                          infant: newQuote.passengersInfants || 0,
                          sales_price: newQuote.price ? String(newQuote.price) : undefined,
                          package_commission: newQuote.commission ? String(newQuote.commission) : undefined,
                          discounts: newQuote.discount ? String(newQuote.discount) : undefined,
                          service_charge: newQuote.serviceCharge ? String(newQuote.serviceCharge) : undefined,
                          transfer_type: newQuote.transferType || undefined,
                          lodge_id: packageTypeName === "Hot Tub Break" ? (newQuote.lodgeCode || undefined) : undefined,
                          pets: packageTypeName === "Hot Tub Break" ? (newQuote.pets ? 1 : 0) : 0,
                          main_tour_operator_id: newQuote.tourOperator || undefined,
                          outboundFlight: packageTypeName === "Package Holiday" ? outboundFlight : undefined,
                          inboundFlight: packageTypeName === "Package Holiday" ? inboundFlight : undefined,
                          primaryAccommodation: packageTypeName === "Package Holiday" ? primaryAccommodation : undefined,
                        },
                      },
                      {
                        onSuccess: (result: { transaction?: { id: string }; booking?: { id: string } }) => {
                          setShowNewQuoteModal(false);
                          setNewQuoteIsBooking(false);
                          setNewQuote(newQuoteDefaults);
                          setQuoteImageFiles([]);
                          setQuoteImageUrls([]);
                          toast({ title: "Booking created successfully" });
                          const bookingId = result?.booking?.id;
                          if (bookingId) {
                            navigate(`/clients/${clientId}/bookings/${bookingId}`);
                          }
                        },
                        onError: () => {
                          toast({ title: "Failed to create booking", variant: "destructive" });
                        },
                      }
                    );
                  } else if (convertingFromEnquiryTxnId) {
                    const convertPayload: CreateQuoteData = {
                      transaction_id: convertingFromEnquiryTxnId,
                      holiday_type_id: quotePayload.holiday_type_id,
                      travel_date: quotePayload.travel_date,
                      quote_type: quotePayload.quote_type,
                      num_of_nights: quotePayload.num_of_nights,
                      adult: quotePayload.adult,
                      child: quotePayload.child,
                      infant: quotePayload.infant,
                      sales_price: quotePayload.sales_price,
                      package_commission: quotePayload.package_commission,
                      title: quotePayload.title,
                      price_per_person: quotePayload.price_per_person,
                      transfer_type: quotePayload.transfer_type,
                      main_tour_operator_id: quotePayload.main_tour_operator_id,
                      lodge_id: quotePayload.lodge_id,
                      pets: quotePayload.pets,
                      quote_status: "NEW_LEAD",
                    };
                    createQuoteMutationHook.mutate(
                      {
                        ...convertPayload,
                        outboundFlight: packageTypeName === "Package Holiday" ? outboundFlight : undefined,
                        inboundFlight: packageTypeName === "Package Holiday" ? inboundFlight : undefined,
                        primaryAccommodation: packageTypeName === "Package Holiday" ? primaryAccommodation : undefined,
                        images: quoteImageUrls.length > 0 ? quoteImageUrls : undefined,
                      },
                      {
                        onSuccess: () => {
                          if (convertingEnquiryId) {
                            updateEnquiryMutation.mutate({ id: convertingEnquiryId, data: { status: "Converted" } as Partial<EnquiryTable> });
                          }
                          setShowNewQuoteModal(false);
                          setNewQuoteIsBooking(false);
                          setNewQuote(newQuoteDefaults);
                          setQuoteImageFiles([]);
                          setQuoteImageUrls([]);
                          setConvertingFromEnquiryTxnId(null);
                          setConvertingEnquiryId(null);
                          toast({ title: "Enquiry converted to quote!" });
                        },
                        onError: () => {
                          toast({ title: "Failed to convert enquiry to quote", variant: "destructive" });
                        },
                      }
                    );
                  } else {
                    createTransactionMutation.mutate(
                      {
                        client_id: clientId,
                        user_id: currentUser.id,
                        lead_source: newQuote.leadSource || undefined,
                        quote: {
                          ...quotePayload,
                          quote_status: "NEW_LEAD",
                          images: quoteImageUrls.length > 0 ? quoteImageUrls : undefined,
                        },
                      },
                      {
                        onSuccess: () => {
                          setShowNewQuoteModal(false);
                          setNewQuoteIsBooking(false);
                          setNewQuote(newQuoteDefaults);
                          setQuoteImageFiles([]);
                          setQuoteImageUrls([]);
                          toast({ title: "Quote created successfully" });
                        },
                        onError: () => {
                          toast({ title: "Failed to create quote", variant: "destructive" });
                        },
                      }
                    );
                  }
                }}
                data-testid="button-save-quote"
              >
                {(createTransactionMutation.isPending || createQuoteMutationHook.isPending) ? "Creating..." : convertingFromEnquiryTxnId ? "Convert to Quote" : newQuoteIsBooking ? "Create Booking" : "Create Quote"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
      <Dialog open={showUploadFileModal} onOpenChange={setShowUploadFileModal}>
        <DialogContent className="max-w-lg rounded-3xl border-black/10 bg-white/95 backdrop-blur-xl">
          <DialogHeader>
            <DialogTitle className="text-lg font-semibold">Upload File</DialogTitle>
            <DialogDescription className="text-sm text-black/55">
              Upload a document and categorise it for {client?.name || "this client"}.
            </DialogDescription>
          </DialogHeader>

          <div className="mt-4 grid gap-4">
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-black/60">Select File</Label>
              <Input
                type="file"
                onChange={(e) => {
                  const file = e.target.files?.[0] || null;
                  setUploadFile((prev) => ({ ...prev, file }));
                }}
                className="h-10 rounded-xl border-black/10 bg-white/70"
                data-testid="input-upload-file"
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-black/60">Title</Label>
              <Input
                placeholder="e.g. Family Passport Scans"
                value={uploadFile.title}
                onChange={(e) => setUploadFile((prev) => ({ ...prev, title: e.target.value }))}
                className="h-10 rounded-xl border-black/10 bg-white/70"
                data-testid="input-upload-title"
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-black/60">File Type</Label>
              <Select
                value={uploadFile.fileType}
                onValueChange={(v) => setUploadFile((prev) => ({ ...prev, fileType: v }))}
              >
                <SelectTrigger className="h-10 rounded-xl border-black/10 bg-white/70" data-testid="select-file-type">
                  <SelectValue placeholder="Select file type..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Passport">Passport</SelectItem>
                  <SelectItem value="Tickets">Tickets</SelectItem>
                  <SelectItem value="Quote">Quote</SelectItem>
                  <SelectItem value="Invoice">Invoice</SelectItem>
                  <SelectItem value="Itinerary">Itinerary</SelectItem>
                  <SelectItem value="Insurance">Insurance</SelectItem>
                  <SelectItem value="Visa">Visa</SelectItem>
                  <SelectItem value="Other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-black/60">Allocate To</Label>
              <Select
                value={uploadFile.allocationType}
                onValueChange={(v) => setUploadFile((prev) => ({ ...prev, allocationType: v, allocationId: "" }))}
              >
                <SelectTrigger className="h-10 rounded-xl border-black/10 bg-white/70" data-testid="select-allocation-type">
                  <SelectValue placeholder="Select allocation..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Enquiry">Enquiry</SelectItem>
                  <SelectItem value="Quote">Quote</SelectItem>
                  <SelectItem value="Booking">Booking</SelectItem>
                  <SelectItem value="None">None (Client level)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {uploadFile.allocationType === "Quote" && quotes.length > 0 && (
              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-black/60">Select Quote</Label>
                <Select
                  value={uploadFile.allocationId}
                  onValueChange={(v) => setUploadFile((prev) => ({ ...prev, allocationId: v }))}
                >
                  <SelectTrigger className="h-10 rounded-xl border-black/10 bg-white/70" data-testid="select-quote-allocation">
                    <SelectValue placeholder="Select quote..." />
                  </SelectTrigger>
                  <SelectContent>
                    {quotes.map((q: QuoteWithJoins) => (
                      <SelectItem key={q.id} value={q.id}>
                        {q.title || q.quote_type || "Quote"} - {q.quote_status || "—"}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {uploadFile.allocationType === "Enquiry" && (
              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-black/60">Select Enquiry</Label>
                <Select
                  value={uploadFile.allocationId}
                  onValueChange={(v) => setUploadFile((prev) => ({ ...prev, allocationId: v }))}
                >
                  <SelectTrigger className="h-10 rounded-xl border-black/10 bg-white/70" data-testid="select-enquiry-allocation">
                    <SelectValue placeholder="Select enquiry..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="enquiry-1">Initial requirements</SelectItem>
                    <SelectItem value="enquiry-2">Budget alignment</SelectItem>
                    <SelectItem value="enquiry-3">Destination short-list</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}

            {uploadFile.allocationType === "Booking" && (
              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-black/60">Select Booking</Label>
                <Select
                  value={uploadFile.allocationId}
                  onValueChange={(v) => setUploadFile((prev) => ({ ...prev, allocationId: v }))}
                >
                  <SelectTrigger className="h-10 rounded-xl border-black/10 bg-white/70" data-testid="select-booking-allocation">
                    <SelectValue placeholder="Select booking..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="booking-1">Hotel confirmation</SelectItem>
                    <SelectItem value="booking-2">Transfers</SelectItem>
                    <SelectItem value="booking-3">Activities</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="flex justify-end gap-3 pt-2">
              <Button
                variant="outline"
                className="rounded-2xl border-black/10 px-4"
                onClick={() => {
                  setShowUploadFileModal(false);
                  setUploadFile({ file: null, title: "", fileType: "", allocationType: "", allocationId: "" });
                }}
                data-testid="button-cancel-upload"
              >
                Cancel
              </Button>
              <Button
                className="rounded-2xl bg-black px-4 text-white hover:bg-black/90"
                disabled={!uploadFile.file || !uploadFile.fileType}
                onClick={() => {
                  if (uploadFile.file) {
                    const fileExt = uploadFile.file.name.split('.').pop()?.toUpperCase() || 'FILE';
                    const fileUrl = URL.createObjectURL(uploadFile.file);
                    setUploadedFiles((prev) => [
                      {
                        id: `uploaded-${Date.now()}`,
                        name: uploadFile.file!.name,
                        title: uploadFile.title || uploadFile.file!.name,
                        type: fileExt,
                        category: uploadFile.fileType,
                        allocationType: uploadFile.allocationType || "None",
                        allocationId: uploadFile.allocationId,
                        updated: "Just now",
                        url: fileUrl,
                      },
                      ...prev,
                    ]);
                  }
                  setShowUploadFileModal(false);
                  setUploadFile({ file: null, title: "", fileType: "", allocationType: "", allocationId: "" });
                }}
                data-testid="button-upload-file"
              >
                Upload
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
      <Dialog open={showEditClient} onOpenChange={setShowEditClient}>
        <DialogContent className="max-h-[90vh] max-w-lg overflow-y-auto rounded-3xl" data-testid="dialog-edit-client">
          <DialogHeader>
            <DialogTitle>Edit Client</DialogTitle>
            <DialogDescription>Update client information below.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="edit-title">Title</Label>
                <Select
                  value={editForm.title}
                  onValueChange={(v) => setEditForm({ ...editForm, title: v })}
                >
                  <SelectTrigger id="edit-title" data-testid="select-edit-title">
                    <SelectValue placeholder="Select title" />
                  </SelectTrigger>
                  <SelectContent className="z-[500]">
                    <SelectItem value="Mr">Mr</SelectItem>
                    <SelectItem value="Mrs">Mrs</SelectItem>
                    <SelectItem value="Miss">Miss</SelectItem>
                    <SelectItem value="Ms">Ms</SelectItem>
                    <SelectItem value="Dr">Dr</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="edit-badge">Badge</Label>
                <Select
                  value={editForm.badge || "none"}
                  onValueChange={(v) => setEditForm({ ...editForm, badge: v === "none" ? "" : v })}
                >
                  <SelectTrigger id="edit-badge" data-testid="select-edit-badge">
                    <SelectValue placeholder="Select badge" />
                  </SelectTrigger>
                  <SelectContent className="z-[500]">
                    <SelectItem value="none">No Badge</SelectItem>
                    <SelectItem value="New Client">New Client</SelectItem>
                    <SelectItem value="Repeat Client">Repeat Client</SelectItem>
                    <SelectItem value="VIP Client">VIP Client</SelectItem>
                    <SelectItem value="Family Member">Family Member</SelectItem>
                    <SelectItem value="Time Waster">Time Waster</SelectItem>
                    <SelectItem value="Banned">Banned</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="edit-firstName">First Name</Label>
                <Input
                  id="edit-firstName"
                  value={editForm.firstName}
                  onChange={(e) => setEditForm({ ...editForm, firstName: e.target.value })}
                  data-testid="input-edit-firstName"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="edit-surename">Surname</Label>
                <Input
                  id="edit-surename"
                  value={editForm.surename}
                  onChange={(e) => setEditForm({ ...editForm, surename: e.target.value })}
                  data-testid="input-edit-surename"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="edit-phone">Phone Number</Label>
                <Input
                  id="edit-phone"
                  value={editForm.phoneNumber}
                  onChange={(e) => setEditForm({ ...editForm, phoneNumber: e.target.value })}
                  data-testid="input-edit-phone"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="edit-email">Email</Label>
                <Input
                  id="edit-email"
                  type="email"
                  value={editForm.email}
                  onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
                  data-testid="input-edit-email"
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="edit-dob">Date of Birth</Label>
              <DatePicker
                value={editForm.DOB}
                onChange={(v) => setEditForm({ ...editForm, DOB: v })}
                placeholder="Pick a date"
                data-testid="input-edit-dob"
              />
            </div>
            <div className="border-t border-black/10 pt-3">
              <div className="text-xs font-semibold text-black/60 mb-2">Address</div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="edit-houseNumber">House Number</Label>
                  <Input
                    id="edit-houseNumber"
                    value={editForm.houseNumber}
                    onChange={(e) => setEditForm({ ...editForm, houseNumber: e.target.value })}
                    data-testid="input-edit-houseNumber"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="edit-street">Street</Label>
                  <Input
                    id="edit-street"
                    value={editForm.street}
                    onChange={(e) => setEditForm({ ...editForm, street: e.target.value })}
                    data-testid="input-edit-street"
                  />
                </div>
              </div>
              <div className="grid grid-cols-3 gap-3 mt-3">
                <div className="space-y-1.5">
                  <Label htmlFor="edit-city">City</Label>
                  <Input
                    id="edit-city"
                    value={editForm.city}
                    onChange={(e) => setEditForm({ ...editForm, city: e.target.value })}
                    data-testid="input-edit-city"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="edit-country">Country</Label>
                  <Input
                    id="edit-country"
                    value={editForm.country}
                    onChange={(e) => setEditForm({ ...editForm, country: e.target.value })}
                    data-testid="input-edit-country"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="edit-postcode">Postcode</Label>
                  <Input
                    id="edit-postcode"
                    value={editForm.post_code}
                    onChange={(e) => setEditForm({ ...editForm, post_code: e.target.value })}
                    data-testid="input-edit-postcode"
                  />
                </div>
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button
                variant="outline"
                className="rounded-2xl"
                onClick={() => setShowEditClient(false)}
                data-testid="button-edit-cancel"
              >
                Cancel
              </Button>
              <Button
                className="rounded-2xl bg-[#3b82f6] text-white hover:bg-[#2563eb]"
                onClick={handleSaveClient}
                disabled={updateNeonClientMutation.isPending}
                data-testid="button-edit-save"
              >
                {updateNeonClientMutation.isPending ? "Saving..." : "Save Changes"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <EnquiryWizard
        open={showEnquiryWizard}
        onOpenChange={(open) => {
          setShowEnquiryWizard(open);
          if (!open) setEditingEnquiry(null);
        }}
        enquiry={editingEnquiry}
        onSubmit={handleEnquirySubmit}
        isSaving={createEnquiryMutation.isPending || updateEnquiryMutation.isPending}
      />
    </CommandCenterShell>
  );
}

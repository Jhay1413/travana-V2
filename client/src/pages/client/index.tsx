import { useState } from "react";
import { useLocation, useRoute } from "wouter";
import { useRole } from "@/hooks/use-role";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Spinner } from "@/components/ui/spinner";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import { useFavorites } from "@/hooks/queries/use-favorite-queries";
import { useToggleFavorite } from "@/hooks/mutations/use-favorite-mutations";

// Local imports
import { useClientData } from "./hooks/useClientData";
import { ClientHeader } from "./components/ClientHeader";
import { ClientOverview } from "./components/ClientOverview";
import type { ClientTab } from "./utils/types";

// TODO: Import other tab components when created
// import { ClientEnquiries } from "./components/ClientEnquiries";
// import { ClientQuotes } from "./components/ClientQuotes";
// import { ClientBookings } from "./components/ClientBookings";
// import { ClientTickets } from "./components/ClientTickets";
// import { ClientFiles } from "./components/ClientFiles";
// import { EditClientDialog } from "./components/EditClientDialog";

export default function ClientPage() {
  const [, navigate] = useLocation();
  const [, params] = useRoute("/clients/:clientId");
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { role } = useRole();

  // State
  const [tab, setTab] = useState<ClientTab>("overview");
  const [showEditClient, setShowEditClient] = useState(false);

  // Data
  const clientId = params?.clientId ?? "";
  const { client, clientData, transactions, tickets, isLoading } = useClientData(clientId);
  const { data: userFavorites } = useFavorites();
  const toggleFavoriteMutation = useToggleFavorite();

  // Derived state
  const isFavorited = userFavorites?.some((f) => f.itemId === clientId && f.itemType === "client") ?? false;

  // Handlers
  const handleBack = () => navigate("/clients");
  
  const handleEdit = () => setShowEditClient(true);
  
  const handleToggleFavorite = () => {
    if (!client) return;
    
    toggleFavoriteMutation.mutate(
      { 
        itemType: "client", 
        itemId: clientId,
        label: client.name,
        subtitle: client.email || undefined,
      },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: ["favorites"] });
          toast({ 
            title: isFavorited ? "Removed from favorites" : "Added to favorites" 
          });
        },
      }
    );
  };

  const handleTogglePin = () => {
    // TODO: Implement pin functionality
    toast({ title: "Pin functionality coming soon" });
  };

  // Loading state
  if (isLoading) {
    return (
      <div className="flex h-[calc(100vh-56px)] items-center justify-center">
        <Spinner className="h-8 w-8" />
      </div>
    );
  }

  // Error state
  if (!client) {
    return (
      <div className="flex h-[calc(100vh-56px)] items-center justify-center">
        <div className="text-center">
          <p className="text-sm text-black/70">Client not found</p>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="h-[calc(100vh-56px)] overflow-y-auto">
        <div className="mx-auto max-w-6xl p-6">
          <ClientHeader
            client={client}
            isFavorited={isFavorited}
            onBack={handleBack}
            onEdit={handleEdit}
            onToggleFavorite={handleToggleFavorite}
            onTogglePin={handleTogglePin}
          />

          <Tabs value={tab} onValueChange={(v) => setTab(v as ClientTab)}>
            <TabsList className="grid w-full grid-cols-6 rounded-2xl border border-black/10 bg-white/70 mb-6">
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
                Bookings
              </TabsTrigger>
              <TabsTrigger value="files" className="rounded-xl" data-testid="tab-files">
                Files
              </TabsTrigger>
              <TabsTrigger value="tickets" className="rounded-xl" data-testid="tab-tickets">
                Tickets {tickets.length > 0 && `(${tickets.length})`}
              </TabsTrigger>
            </TabsList>

            <TabsContent value="overview">
              <ClientOverview client={client} clientId={clientId} />
            </TabsContent>

            <TabsContent value="enquiries">
              <div className="text-center py-12 text-black/50">
                {/* TODO: Replace with ClientEnquiries component */}
                Enquiries tab - Component to be created
              </div>
            </TabsContent>

            <TabsContent value="quotes">
              <div className="text-center py-12 text-black/50">
                {/* TODO: Replace with ClientQuotes component */}
                Quotes tab - Component to be created
              </div>
            </TabsContent>

            <TabsContent value="booked">
              <div className="text-center py-12 text-black/50">
                {/* TODO: Replace with ClientBookings component */}
                Bookings tab - Component to be created
              </div>
            </TabsContent>

            <TabsContent value="tickets">
              <div className="text-center py-12 text-black/50">
                {/* TODO: Replace with ClientTickets component */}
                Tickets tab - Component to be created
              </div>
            </TabsContent>

            <TabsContent value="files">
              <div className="text-center py-12 text-black/50">
                {/* TODO: Replace with ClientFiles component */}
                Files tab - Component to be created
              </div>
            </TabsContent>
          </Tabs>

          {/* TODO: Add Edit Client Dialog */}
          {/* <EditClientDialog
            open={showEditClient}
            onOpenChange={setShowEditClient}
            clientData={clientData}
          /> */}
        </div>
      </div>
    </>
  );
}

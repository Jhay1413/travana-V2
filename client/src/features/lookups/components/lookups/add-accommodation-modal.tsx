import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useQueryClient } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Form,
  FormField,
  FormItem,
  FormLabel,
  FormControl,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { useCountries, useDestinations, useResorts } from "@/hooks/queries";
import { useToast } from "@/hooks/use-toast";
import axios from "@/api/client/axios-client";
import { AddDestinationModal } from "@/features/lookups/components/lookups/add-destination-modal";
import { AddResortModal } from "@/features/lookups/components/lookups/add-resort-modal";

const addAccommodationSchema = z.object({
  country_id: z.string().optional(),
  destination_id: z.string().optional(),
  resorts_id: z.string().min(1, "Resort is required"),
  name: z.string().min(1, "Accommodation name is required"),
});

type AddAccommodationValues = z.infer<typeof addAccommodationSchema>;

interface AddedAccommodation {
  id: string;
  name: string;
  resorts_id: string | null;
  resort_name: string | null;
  destination_id: string | null;
  destination_name: string | null;
  country_id: string | null;
}

interface AddAccommodationModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Initial name from the search term */
  initialName?: string;
  /** Pre-populate country from the parent form */
  initialCountryId?: string;
  /** Pre-populate destination from the parent form */
  initialDestinationId?: string;
  /** Display label for the pre-selected destination */
  initialDestinationName?: string;
  /** Pre-populate resort from the parent form */
  initialResortId?: string;
  /** Display label for the pre-selected resort */
  initialResortName?: string;
  /** Called with the newly created accommodation after success */
  onSuccess: (accommodation: AddedAccommodation) => void;
}

export function AddAccommodationModal({
  open,
  onOpenChange,
  initialName = "",
  initialCountryId = "",
  initialDestinationId = "",
  initialDestinationName = "",
  initialResortId = "",
  initialResortName = "",
  onSuccess,
}: AddAccommodationModalProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Nested "add new destination / resort" modals (mirrors the main quote form)
  const [showAddDestModal, setShowAddDestModal] = useState(false);
  const [showAddResortModal, setShowAddResortModal] = useState(false);
  const [destSearch, setDestSearch] = useState("");
  const [resortSearch, setResortSearch] = useState("");
  // Newly-created items so the Select can display them before the async list refreshes
  const [createdDestination, setCreatedDestination] = useState<
    { id: string; name: string; type: string | null; country_id: string | null } | null
  >(null);
  const [createdResort, setCreatedResort] = useState<
    { id: string; name: string; destination_id: string | null; destination_name: string | null; country_id: string | null } | null
  >(null);

  const form = useForm<AddAccommodationValues>({
    resolver: zodResolver(addAccommodationSchema),
    defaultValues: {
      country_id: initialCountryId,
      destination_id: initialDestinationId,
      resorts_id: initialResortId,
      name: initialName,
    },
  });

  const countryId = form.watch("country_id");
  const destinationId = form.watch("destination_id");

  // Re-populate when the modal opens with whatever the parent currently has selected
  useEffect(() => {
    if (open) {
      form.reset({
        country_id: initialCountryId,
        destination_id: initialDestinationId,
        resorts_id: initialResortId,
        name: initialName,
      });
      setCreatedDestination(null);
      setCreatedResort(null);
      setDestSearch("");
      setResortSearch("");
    }
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  const { data: countries, isLoading: countriesLoading } = useCountries();
  // Enable even without a country when we have a pre-selected destination
  const { data: destinations, isLoading: destinationsLoading } = useDestinations(countryId || initialDestinationId ? countryId || undefined : undefined);
  const { data: resorts, isLoading: resortsLoading } = useResorts(destinationId || undefined, countryId || undefined);

  // Merge pre-selected item into the options list so the Select can display it
  // even before the async data has loaded
  let destinationOptionsWithFallback: { id: string; name: string; type: string | null; country_id: string | null }[] =
    destinations || [];
  if (initialDestinationId && initialDestinationName && !destinationOptionsWithFallback.find((d) => d.id === initialDestinationId)) {
    destinationOptionsWithFallback = [{ id: initialDestinationId, name: initialDestinationName, type: null, country_id: null }, ...destinationOptionsWithFallback];
  }
  if (createdDestination && !destinationOptionsWithFallback.find((d) => d.id === createdDestination.id)) {
    destinationOptionsWithFallback = [createdDestination, ...destinationOptionsWithFallback];
  }

  let resortOptionsWithFallback: { id: string; name: string; destination_id: string | null; destination_name: string | null; country_id: string | null }[] =
    resorts || [];
  if (initialResortId && initialResortName && !resortOptionsWithFallback.find((r) => r.id === initialResortId)) {
    resortOptionsWithFallback = [{ id: initialResortId, name: initialResortName, destination_id: null, destination_name: null, country_id: null }, ...resortOptionsWithFallback];
  }
  if (createdResort && !resortOptionsWithFallback.find((r) => r.id === createdResort.id)) {
    resortOptionsWithFallback = [createdResort, ...resortOptionsWithFallback];
  }

  // Reset downstream fields when upstream changes
  const handleCountryChange = (val: string, onChange: (v: string) => void) => {
    onChange(val);
    form.setValue("destination_id", "");
    form.setValue("resorts_id", "");
    setCreatedDestination(null);
    setCreatedResort(null);
  };

  const handleDestinationChange = (val: string, onChange: (v: string) => void) => {
    onChange(val);
    form.setValue("resorts_id", "");
    setCreatedResort(null);
  };

  const handleSubmit = async (values: AddAccommodationValues) => {
    setIsSubmitting(true);
    try {
      const payload: Record<string, string> = { name: values.name };
      if (values.resorts_id) payload.resorts_id = values.resorts_id;

      const { data } = await axios.post<AddedAccommodation>("/api/v2/settings/accommodations", payload);

      // Determine display labels from the selected options (fallback lists
      // include any destination/resort that was just created inline)
      const selectedResort = resortOptionsWithFallback.find((r) => r.id === values.resorts_id);
      const selectedDestination = destinationOptionsWithFallback.find((d) => d.id === values.destination_id);
      const selectedCountry = (countries || []).find((c) => c.id === values.country_id);

      const enriched: AddedAccommodation = {
        ...data,
        resort_name: selectedResort?.name ?? null,
        destination_id: selectedDestination?.id ?? null,
        destination_name: selectedDestination?.name ?? null,
        country_id: selectedCountry?.id ?? null,
      };

      // Invalidate accommodation queries so the search refreshes
      queryClient.invalidateQueries({ queryKey: ["lookup", "accommodations"] });

      toast({ title: "Accommodation created", description: `"${values.name}" has been added.` });
      onSuccess(enriched);
      onOpenChange(false);
      form.reset({ country_id: initialCountryId, destination_id: initialDestinationId, resorts_id: initialResortId, name: "" });
    } catch {
      toast({ title: "Failed to create accommodation", variant: "destructive" });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Add Accommodation</DialogTitle>
        </DialogHeader>

        <Form {...form}>
          <form
            onSubmit={(e) => {
              // Stop the submit from bubbling up the React tree to a parent
              // form (the quote/booking form this modal is rendered inside).
              e.stopPropagation();
              form.handleSubmit(handleSubmit)(e);
            }}
            className="space-y-4"
          >
            {/* Country */}
            <FormField
              control={form.control}
              name="country_id"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-xs font-medium text-black/60">Country</FormLabel>
                  <FormControl>
                    <SearchableSelect
                      value={field.value ?? ""}
                      onValueChange={(v) => handleCountryChange(v, field.onChange)}
                      options={(countries || []).map((c) => ({ value: c.id, label: c.country_name }))}
                      placeholder="Select country..."
                      searchPlaceholder="Search countries..."
                      emptyMessage="No countries found."
                      isLoading={countriesLoading}
                      disabled={countriesLoading}
                      data-testid="select-accom-country"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Destination */}
            <FormField
              control={form.control}
              name="destination_id"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-xs font-medium text-black/60">Destination</FormLabel>
                  <FormControl>
                    <SearchableSelect
                      value={field.value ?? ""}
                      onValueChange={(v) => handleDestinationChange(v, field.onChange)}
                      options={destinationOptionsWithFallback.map((d) => ({ value: d.id, label: d.name }))}
                      placeholder={!countryId && !field.value ? "Select a country first" : "Select destination..."}
                      searchPlaceholder="Search destinations..."
                      emptyMessage="No destinations found."
                      isLoading={destinationsLoading}
                      disabled={(!countryId && !field.value) || destinationsLoading}
                      onSearchCapture={setDestSearch}
                      onAddNew={() => setShowAddDestModal(true)}
                      addNewLabel="Add Destination"
                      data-testid="select-accom-destination"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Resort */}
            <FormField
              control={form.control}
              name="resorts_id"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-xs font-medium text-black/60">
                    Resort <span className="text-red-500">*</span>
                  </FormLabel>
                  <FormControl>
                    <SearchableSelect
                      value={field.value ?? ""}
                      onValueChange={field.onChange}
                      options={resortOptionsWithFallback.map((r) => ({ value: r.id, label: r.name }))}
                      placeholder={
                        !destinationId && !countryId && !field.value
                          ? "Select a destination first"
                          : "Select resort..."
                      }
                      searchPlaceholder="Search resorts..."
                      emptyMessage="No resorts found."
                      isLoading={resortsLoading}
                      disabled={(!destinationId && !countryId && !field.value) || resortsLoading}
                      onSearchCapture={setResortSearch}
                      onAddNew={() => setShowAddResortModal(true)}
                      addNewLabel="Add Resort"
                      data-testid="select-accom-resort"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Accommodation Name */}
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-xs font-medium text-black/60">
                    Accommodation Name <span className="text-red-500">*</span>
                  </FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      placeholder="Enter accommodation name"
                      className="h-9 rounded-xl border-black/10 bg-white/70"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <DialogFooter className="pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={isSubmitting}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? "Creating..." : "Create Accommodation"}
              </Button>
            </DialogFooter>
          </form>
        </Form>

        {/* Add a new destination inline (mirrors the main quote form) */}
        <AddDestinationModal
          open={showAddDestModal}
          onOpenChange={setShowAddDestModal}
          initialName={destSearch}
          initialCountryId={countryId || ""}
          onSuccess={(dest) => {
            setCreatedDestination({ id: dest.id, name: dest.name, type: dest.type ?? null, country_id: dest.country_id ?? null });
            setCreatedResort(null);
            if (dest.country_id) form.setValue("country_id", dest.country_id);
            form.setValue("destination_id", dest.id);
            form.setValue("resorts_id", "");
            setDestSearch("");
          }}
        />

        {/* Add a new resort inline (mirrors the main quote form) */}
        <AddResortModal
          open={showAddResortModal}
          onOpenChange={setShowAddResortModal}
          initialName={resortSearch}
          initialCountryId={countryId || ""}
          initialDestinationId={destinationId || ""}
          initialDestinationName={
            destinationOptionsWithFallback.find((d) => d.id === destinationId)?.name || ""
          }
          onSuccess={(res) => {
            setCreatedResort({
              id: res.id,
              name: res.name,
              destination_id: res.destination_id ?? null,
              destination_name: res.destination_name ?? null,
              country_id: res.country_id ?? null,
            });
            if (res.destination_id) {
              setCreatedDestination({
                id: res.destination_id,
                name: res.destination_name ?? "",
                type: null,
                country_id: res.country_id ?? null,
              });
              form.setValue("destination_id", res.destination_id);
            }
            if (res.country_id) form.setValue("country_id", res.country_id);
            form.setValue("resorts_id", res.id);
            setResortSearch("");
          }}
        />
      </DialogContent>
    </Dialog>
  );
}

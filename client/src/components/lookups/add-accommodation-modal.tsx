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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useCountries, useDestinations, useResorts } from "@/hooks/queries";
import { useToast } from "@/hooks/use-toast";
import axios from "@/api/client/axios-client";

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
    }
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  const { data: countries, isLoading: countriesLoading } = useCountries();
  // Enable even without a country when we have a pre-selected destination
  const { data: destinations, isLoading: destinationsLoading } = useDestinations(countryId || initialDestinationId ? countryId || undefined : undefined);
  const { data: resorts, isLoading: resortsLoading } = useResorts(destinationId || undefined, countryId || undefined);

  // Merge pre-selected item into the options list so the Select can display it
  // even before the async data has loaded
  const destinationOptions = destinations || [];
  const destinationOptionsWithFallback =
    initialDestinationId && initialDestinationName && !destinationOptions.find((d) => d.id === initialDestinationId)
      ? [{ id: initialDestinationId, name: initialDestinationName, type: null, country_id: null }, ...destinationOptions]
      : destinationOptions;

  const resortOptions = resorts || [];
  const resortOptionsWithFallback =
    initialResortId && initialResortName && !resortOptions.find((r) => r.id === initialResortId)
      ? [{ id: initialResortId, name: initialResortName, destination_id: null, destination_name: null, country_id: null }, ...resortOptions]
      : resortOptions;

  // Reset downstream fields when upstream changes
  const handleCountryChange = (val: string, onChange: (v: string) => void) => {
    onChange(val);
    form.setValue("destination_id", "");
    form.setValue("resorts_id", "");
  };

  const handleDestinationChange = (val: string, onChange: (v: string) => void) => {
    onChange(val);
    form.setValue("resorts_id", "");
  };

  const handleSubmit = async (values: AddAccommodationValues) => {
    setIsSubmitting(true);
    try {
      const payload: Record<string, string> = { name: values.name };
      if (values.resorts_id) payload.resorts_id = values.resorts_id;

      const { data } = await axios.post<AddedAccommodation>("/api/settings/accommodation-list", payload);

      // Determine display labels from the selected options
      const selectedResort = (resorts || []).find((r) => r.id === values.resorts_id);
      const selectedDestination = (destinations || []).find((d) => d.id === values.destination_id);
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
                  <Select
                    value={field.value}
                    onValueChange={(v) => handleCountryChange(v, field.onChange)}
                    disabled={countriesLoading}
                  >
                    <FormControl>
                      <SelectTrigger className="h-9 rounded-xl border-black/10 bg-white/70">
                        <SelectValue placeholder="Select country..." />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {(countries || []).map((c) => (
                        <SelectItem key={c.id} value={c.id}>
                          {c.country_name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
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
                  <Select
                    value={field.value}
                    onValueChange={(v) => handleDestinationChange(v, field.onChange)}
                    disabled={(!countryId && !field.value) || destinationsLoading}
                  >
                    <FormControl>
                      <SelectTrigger className="h-9 rounded-xl border-black/10 bg-white/70">
                        <SelectValue placeholder={!countryId && !field.value ? "Select a country first" : "Select destination..."} />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {destinationOptionsWithFallback.map((d) => (
                        <SelectItem key={d.id} value={d.id}>
                          {d.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
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
                  <Select
                    value={field.value}
                    onValueChange={field.onChange}
                    disabled={(!destinationId && !countryId && !field.value) || resortsLoading}
                  >
                    <FormControl>
                      <SelectTrigger className="h-9 rounded-xl border-black/10 bg-white/70">
                        <SelectValue
                          placeholder={
                            !destinationId && !countryId && !field.value
                              ? "Select a destination first"
                              : "Select resort..."
                          }
                        />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {resortOptionsWithFallback.map((r) => (
                        <SelectItem key={r.id} value={r.id}>
                          {r.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
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
      </DialogContent>
    </Dialog>
  );
}

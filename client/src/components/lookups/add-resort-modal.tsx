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
import { useCountries, useDestinations } from "@/hooks/queries";
import { useToast } from "@/hooks/use-toast";
import axios from "@/api/client/axios-client";
import { lookupKeys } from "@/hooks/queries";

const addResortSchema = z.object({
  country_id: z.string().optional(),
  destination_id: z.string().optional(),
  name: z.string().min(1, "Resort name is required"),
});

type AddResortValues = z.infer<typeof addResortSchema>;

interface AddedResort {
  id: string;
  name: string;
  destination_id: string | null;
  destination_name: string | null;
  country_id: string | null;
}

interface AddResortModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialName?: string;
  initialCountryId?: string;
  initialDestinationId?: string;
  initialDestinationName?: string;
  onSuccess: (resort: AddedResort) => void;
}

export function AddResortModal({
  open,
  onOpenChange,
  initialName = "",
  initialCountryId = "",
  initialDestinationId = "",
  initialDestinationName = "",
  onSuccess,
}: AddResortModalProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const form = useForm<AddResortValues>({
    resolver: zodResolver(addResortSchema),
    defaultValues: {
      country_id: initialCountryId,
      destination_id: initialDestinationId,
      name: initialName,
    },
  });

  const countryId = form.watch("country_id");
  const destinationId = form.watch("destination_id");

  useEffect(() => {
    if (open) {
      form.reset({
        country_id: initialCountryId,
        destination_id: initialDestinationId,
        name: initialName,
      });
    }
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  const { data: countries, isLoading: countriesLoading } = useCountries();
  const { data: destinations, isLoading: destinationsLoading } = useDestinations(countryId || initialDestinationId ? countryId || undefined : undefined);

  const destinationOptions = destinations || [];
  const destinationOptionsWithFallback =
    initialDestinationId && initialDestinationName && !destinationOptions.find((d) => d.id === initialDestinationId)
      ? [{ id: initialDestinationId, name: initialDestinationName, type: null, country_id: null }, ...destinationOptions]
      : destinationOptions;

  const handleCountryChange = (val: string, onChange: (v: string) => void) => {
    onChange(val);
    form.setValue("destination_id", "");
  };

  const handleSubmit = async (values: AddResortValues) => {
    setIsSubmitting(true);
    try {
      const payload: Record<string, string> = { name: values.name };
      if (values.destination_id) payload.destination_id = values.destination_id;

      const { data } = await axios.post<{ id: string; name: string; destination_id: string | null }>("/api/settings/resorts", payload);

      const selectedDestination = (destinations || []).find((d) => d.id === (values.destination_id || destinationId));

      const enriched: AddedResort = {
        id: data.id,
        name: data.name,
        destination_id: data.destination_id,
        destination_name: selectedDestination?.name ?? null,
        country_id: selectedDestination?.country_id ?? values.country_id ?? null,
      };

      queryClient.invalidateQueries({ queryKey: lookupKeys.allResorts });
      queryClient.invalidateQueries({ queryKey: ["lookup", "resorts"] });

      toast({ title: "Resort created", description: `"${values.name}" has been added.` });
      onSuccess(enriched);
      onOpenChange(false);
    } catch {
      toast({ title: "Failed to create resort", variant: "destructive" });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Add Resort</DialogTitle>
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
                    onValueChange={field.onChange}
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

            {/* Resort Name */}
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-xs font-medium text-black/60">
                    Resort Name <span className="text-red-500">*</span>
                  </FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      placeholder="Enter resort name"
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
                {isSubmitting ? "Creating..." : "Create Resort"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

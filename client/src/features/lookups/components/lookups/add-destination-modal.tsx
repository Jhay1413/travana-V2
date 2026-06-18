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
import { useCountries } from "@/hooks/queries";
import { useToast } from "@/hooks/use-toast";
import axios from "@/api/client/axios-client";
import { lookupKeys } from "@/hooks/queries";

const addDestinationSchema = z.object({
  country_id: z.string().optional(),
  name: z.string().min(1, "Destination name is required"),
  type: z.string().optional(),
});

type AddDestinationValues = z.infer<typeof addDestinationSchema>;

interface AddedDestination {
  id: string;
  name: string;
  type: string | null;
  country_id: string | null;
}

interface AddDestinationModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialName?: string;
  initialCountryId?: string;
  onSuccess: (destination: AddedDestination) => void;
}

export function AddDestinationModal({
  open,
  onOpenChange,
  initialName = "",
  initialCountryId = "",
  onSuccess,
}: AddDestinationModalProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const form = useForm<AddDestinationValues>({
    resolver: zodResolver(addDestinationSchema),
    defaultValues: {
      country_id: initialCountryId,
      name: initialName,
      type: "",
    },
  });

  useEffect(() => {
    if (open) {
      form.reset({
        country_id: initialCountryId,
        name: initialName,
        type: "",
      });
    }
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  const { data: countries, isLoading: countriesLoading } = useCountries();

  const handleSubmit = async (values: AddDestinationValues) => {
    setIsSubmitting(true);
    try {
      const payload: Record<string, string> = { name: values.name };
      if (values.country_id) payload.country_id = values.country_id;
      if (values.type) payload.type = values.type;

      const { data } = await axios.post<AddedDestination>("/api/v2/settings/destinations", payload);

      queryClient.invalidateQueries({ queryKey: lookupKeys.allDestinations });
      queryClient.invalidateQueries({ queryKey: ["lookup", "destinations"] });

      toast({ title: "Destination created", description: `"${values.name}" has been added.` });
      onSuccess(data);
      onOpenChange(false);
    } catch {
      toast({ title: "Failed to create destination", variant: "destructive" });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Add Destination</DialogTitle>
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
                    onValueChange={field.onChange}
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

            {/* Destination Name */}
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-xs font-medium text-black/60">
                    Destination Name <span className="text-red-500">*</span>
                  </FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      placeholder="Enter destination name"
                      className="h-9 rounded-xl border-black/10 bg-white/70"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Type */}
            <FormField
              control={form.control}
              name="type"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-xs font-medium text-black/60">Type</FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      value={field.value ?? ""}
                      placeholder="e.g. Beach, City, Island..."
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
                {isSubmitting ? "Creating..." : "Create Destination"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

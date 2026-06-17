import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
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
import { useCreateAirport } from "@/hooks/mutations";
import { useToast } from "@/hooks/use-toast";
import type { Airport } from "@/types/airport";

const addAirportSchema = z.object({
  airport_name: z.string().min(1, "Airport name is required"),
  airport_code: z
    .string()
    .min(2, "Airport code is required")
    .max(4, "Use the 3-letter IATA code"),
  country_id: z.string().optional(),
});

type AddAirportValues = z.infer<typeof addAirportSchema>;

interface AddAirportModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Initial name from the search term */
  initialName?: string;
  /** Pre-populate country from the parent form */
  initialCountryId?: string;
  /** Called with the newly created airport after success */
  onSuccess: (airport: Airport) => void;
}

export function AddAirportModal({
  open,
  onOpenChange,
  initialName = "",
  initialCountryId = "",
  onSuccess,
}: AddAirportModalProps) {
  const { toast } = useToast();
  const createAirport = useCreateAirport();
  const { data: countries, isLoading: countriesLoading } = useCountries();

  const form = useForm<AddAirportValues>({
    resolver: zodResolver(addAirportSchema),
    defaultValues: {
      airport_name: initialName,
      airport_code: "",
      country_id: initialCountryId,
    },
  });

  // Re-populate when the modal opens with whatever the parent currently has.
  useEffect(() => {
    if (open) {
      form.reset({
        airport_name: initialName,
        airport_code: "",
        country_id: initialCountryId,
      });
    }
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleSubmit = async (values: AddAirportValues) => {
    try {
      const airport = await createAirport.mutateAsync({
        airport_name: values.airport_name,
        airport_code: values.airport_code.toUpperCase(),
        country_id: values.country_id || undefined,
      });
      toast({ title: "Airport created", description: `"${values.airport_name}" has been added.` });
      onSuccess(airport);
      onOpenChange(false);
      form.reset({ airport_name: "", airport_code: "", country_id: initialCountryId });
    } catch {
      toast({ title: "Failed to create airport", variant: "destructive" });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Add Airport</DialogTitle>
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
            {/* Airport Name */}
            <FormField
              control={form.control}
              name="airport_name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-xs font-medium text-black/60">
                    Airport Name <span className="text-red-500">*</span>
                  </FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      placeholder="e.g. Alicante–Elche Airport"
                      className="h-9 rounded-xl border-black/10 bg-white/70"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Airport Code */}
            <FormField
              control={form.control}
              name="airport_code"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-xs font-medium text-black/60">
                    Airport Code <span className="text-red-500">*</span>
                  </FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      onChange={(e) => field.onChange(e.target.value.toUpperCase())}
                      placeholder="e.g. ALC"
                      maxLength={4}
                      className="h-9 rounded-xl border-black/10 bg-white/70 uppercase"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

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

            <DialogFooter className="pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={createAirport.isPending}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={createAirport.isPending}>
                {createAirport.isPending ? "Creating..." : "Create Airport"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

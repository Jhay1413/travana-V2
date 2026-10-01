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
import { useToast } from "@/hooks/use-toast";
import axios from "@/api/client/axios-client";
import { lookupKeys } from "@/hooks/queries";

const addCountrySchema = z.object({
  country_name: z.string().trim().min(1, "Country name is required"),
  country_code: z.string().optional(),
});

type AddCountryValues = z.infer<typeof addCountrySchema>;

interface AddedCountry {
  id: string;
  country_name: string;
  country_code: string | null;
}

interface AddCountryModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialName?: string;
  onSuccess: (country: AddedCountry) => void;
}

export function AddCountryModal({
  open,
  onOpenChange,
  initialName = "",
  onSuccess,
}: AddCountryModalProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const form = useForm<AddCountryValues>({
    resolver: zodResolver(addCountrySchema),
    defaultValues: {
      country_name: initialName,
      country_code: "",
    },
  });

  useEffect(() => {
    if (open) {
      form.reset({
        country_name: initialName,
        country_code: "",
      });
    }
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleSubmit = async (values: AddCountryValues) => {
    setIsSubmitting(true);
    try {
      const payload: Record<string, string> = { country_name: values.country_name };
      if (values.country_code) payload.country_code = values.country_code;

      const { data } = await axios.post<AddedCountry>("/api/v2/settings/countries", payload);

      queryClient.invalidateQueries({ queryKey: lookupKeys.countries });

      toast({ title: "Country created", description: `"${values.country_name}" has been added.` });
      onSuccess(data);
      onOpenChange(false);
    } catch {
      toast({ title: "Failed to create country", variant: "destructive" });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Add Country</DialogTitle>
        </DialogHeader>

        <Form {...form}>
          <form
            onSubmit={(e) => {
              // Stop the submit from bubbling up the React tree to a parent
              // form (the enquiry/quote form this modal is rendered inside).
              e.stopPropagation();
              form.handleSubmit(handleSubmit)(e);
            }}
            className="space-y-4"
          >
            {/* Country Name */}
            <FormField
              control={form.control}
              name="country_name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-xs font-medium text-black/60">
                    Country Name <span className="text-red-500">*</span>
                  </FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      placeholder="Enter country name"
                      className="h-9 rounded-xl border-black/10 bg-white/70"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Country Code */}
            <FormField
              control={form.control}
              name="country_code"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-xs font-medium text-black/60">Country Code</FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      value={field.value ?? ""}
                      placeholder="e.g. GB, ES..."
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
                {isSubmitting ? "Creating..." : "Create Country"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

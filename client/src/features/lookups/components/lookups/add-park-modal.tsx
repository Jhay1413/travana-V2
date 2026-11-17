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

const schema = z.object({
  name: z.string().trim().min(1, "Park name is required").max(200),
  location: z.string().max(200).optional(),
  city: z.string().max(200).optional(),
  county: z.string().max(200).optional(),
  code: z.string().max(50).optional(),
});

type FormValues = z.infer<typeof schema>;

export interface AddedPark {
  id: string;
  name: string | null;
  code: string | null;
}

interface AddParkModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialName?: string;
  onSuccess: (park: AddedPark) => void;
}

const emptyValues = (name: string): FormValues => ({ name, location: "", city: "", county: "", code: "" });

const OPTIONAL_FIELDS = [
  { name: "location", label: "Location", placeholder: "e.g. Coastal", testId: "input-park-location" },
  { name: "city", label: "City", placeholder: "e.g. Torquay", testId: "input-park-city" },
  { name: "county", label: "County", placeholder: "e.g. Devon", testId: "input-park-county" },
  { name: "code", label: "Code", placeholder: "Park code", testId: "input-park-code" },
] as const;

export function AddParkModal({ open, onOpenChange, initialName = "", onSuccess }: AddParkModalProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: emptyValues(initialName),
  });

  useEffect(() => {
    if (open) form.reset(emptyValues(initialName));
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleSubmit = async (values: FormValues) => {
    setIsSubmitting(true);
    try {
      const payload: { name: string; location?: string; city?: string; county?: string; code?: string } = {
        name: values.name,
      };
      for (const key of ["location", "city", "county", "code"] as const) {
        const v = values[key]?.trim();
        if (v) payload[key] = v;
      }

      const { data } = await axios.post<AddedPark>("/api/v2/settings/parks", payload);

      queryClient.invalidateQueries({ queryKey: lookupKeys.parks });

      toast({ title: "Park added", description: `"${values.name}" has been added.` });
      onSuccess(data);
      onOpenChange(false);
      form.reset(emptyValues(""));
    } catch {
      toast({ title: "Failed to add park", variant: "destructive" });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Add Park</DialogTitle>
        </DialogHeader>

        <Form {...form}>
          <form
            onSubmit={(e) => {
              // Stop the submit from bubbling up the React tree to a parent
              // form (the quote form this modal is rendered inside).
              e.stopPropagation();
              form.handleSubmit(handleSubmit)(e);
            }}
            className="space-y-4"
          >
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-xs font-medium text-black/60">
                    Park Name <span className="text-red-500">*</span>
                  </FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      data-testid="input-park-name"
                      placeholder="e.g. Sunhaven Holiday Park"
                      className="h-9 rounded-xl border-black/10 bg-white/70"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {OPTIONAL_FIELDS.map((f) => (
              <FormField
                key={f.name}
                control={form.control}
                name={f.name}
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs font-medium text-black/60">{f.label}</FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        data-testid={f.testId}
                        placeholder={f.placeholder}
                        className="h-9 rounded-xl border-black/10 bg-white/70"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            ))}

            <DialogFooter className="pt-2">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={isSubmitting}>
                Cancel
              </Button>
              <Button type="submit" disabled={isSubmitting} data-testid="button-save-park">
                {isSubmitting ? "Adding..." : "Add Park"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

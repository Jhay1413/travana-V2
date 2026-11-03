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
  lodge_name: z.string().trim().min(1, "Lodge name is required").max(200),
  lodge_code: z.string().max(50).optional(),
  sleeps: z.string().regex(/^\d*$/, "Must be a whole number").optional(),
});

type FormValues = z.infer<typeof schema>;

export interface AddedLodge {
  id: string;
  lodge_name: string | null;
  lodge_code: string | null;
  park_id: string | null;
}

interface AddLodgeModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  parkId: string;
  parkName?: string;
  initialName?: string;
  onSuccess: (lodge: AddedLodge) => void;
}

export function AddLodgeModal({
  open,
  onOpenChange,
  parkId,
  parkName,
  initialName = "",
  onSuccess,
}: AddLodgeModalProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { lodge_name: initialName, lodge_code: "", sleeps: "" },
  });

  useEffect(() => {
    if (open) form.reset({ lodge_name: initialName, lodge_code: "", sleeps: "" });
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleSubmit = async (values: FormValues) => {
    setIsSubmitting(true);
    try {
      const payload: {
        park_id: string;
        lodge_name: string;
        lodge_code?: string;
        sleeps?: number;
      } = { park_id: parkId, lodge_name: values.lodge_name };
      if (values.lodge_code?.trim()) payload.lodge_code = values.lodge_code.trim();
      if (values.sleeps) payload.sleeps = parseInt(values.sleeps, 10);

      const { data } = await axios.post<AddedLodge>("/api/v2/settings/lodges", payload);

      queryClient.invalidateQueries({ queryKey: lookupKeys.lodges(parkId) });
      queryClient.invalidateQueries({ queryKey: ["lookup", "lodges"] });

      toast({ title: "Lodge added", description: `"${values.lodge_name}" has been added.` });
      onSuccess(data);
      onOpenChange(false);
      form.reset({ lodge_name: "", lodge_code: "", sleeps: "" });
    } catch {
      toast({ title: "Failed to add lodge", variant: "destructive" });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Add Lodge</DialogTitle>
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
            <p className="text-xs text-black/60">
              Park: <span className="font-medium text-black/80">{parkName || parkId}</span>
            </p>

            <FormField
              control={form.control}
              name="lodge_name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-xs font-medium text-black/60">
                    Lodge Name <span className="text-red-500">*</span>
                  </FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      data-testid="input-lodge-name"
                      placeholder="e.g. Lakeside Lodge"
                      className="h-9 rounded-xl border-black/10 bg-white/70"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="lodge_code"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-xs font-medium text-black/60">Lodge Code</FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      data-testid="input-lodge-code"
                      placeholder="e.g. LL001"
                      className="h-9 rounded-xl border-black/10 bg-white/70"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="sleeps"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-xs font-medium text-black/60">Sleeps</FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      type="number"
                      min={0}
                      data-testid="input-lodge-sleeps"
                      placeholder="4"
                      className="h-9 rounded-xl border-black/10 bg-white/70"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <DialogFooter className="pt-2">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={isSubmitting}>
                Cancel
              </Button>
              <Button type="submit" disabled={isSubmitting} data-testid="button-save-lodge">
                {isSubmitting ? "Adding..." : "Add Lodge"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

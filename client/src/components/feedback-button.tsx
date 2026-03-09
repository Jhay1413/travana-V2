import { useState } from "react";
import { MessageSquarePlus, Bug, Lightbulb, MessageCircle, Loader2, CheckCircle2, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useCreateFeedback } from "@/hooks/mutations/use-feedback-mutations";
import { useToast } from "@/hooks/use-toast";
import { useLocation } from "wouter";

const TYPES = [
  { value: "suggestion" as const, label: "Suggestion", icon: Lightbulb, color: "text-amber-600" },
  { value: "bug" as const, label: "Report a Bug", icon: Bug, color: "text-red-600" },
  { value: "general" as const, label: "General Feedback", icon: MessageCircle, color: "text-blue-600" },
];

export function FeedbackButton() {
  const [open, setOpen] = useState(false);
  const [type, setType] = useState<"suggestion" | "bug" | "general">("general");
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const createMutation = useCreateFeedback();
  const { toast } = useToast();
  const [location] = useLocation();

  const reset = () => {
    setType("general");
    setSubject("");
    setMessage("");
    setSubmitted(false);
  };

  const handleSubmit = () => {
    if (!subject.trim() || !message.trim()) return;
    createMutation.mutate(
      { type, subject: subject.trim(), message: message.trim(), page: location },
      {
        onSuccess: () => {
          setSubmitted(true);
          setTimeout(() => {
            setOpen(false);
            reset();
          }, 2000);
        },
        onError: (err: any) => {
          toast({ title: "Failed to submit feedback", description: err?.message, variant: "destructive" });
        },
      }
    );
  };

  const selectedType = TYPES.find((t) => t.value === type)!;

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="fixed bottom-5 right-5 z-50 flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 text-white shadow-lg transition-all hover:scale-110 hover:shadow-xl active:scale-95"
        data-testid="button-open-feedback"
        title="Send Feedback"
      >
        <MessageSquarePlus className="h-5 w-5" />
      </button>

      <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) reset(); }}>
        <DialogContent className="sm:max-w-md rounded-2xl border border-black/10 bg-white p-0 overflow-hidden">
          {submitted ? (
            <div className="flex flex-col items-center justify-center py-16 px-6 text-center">
              <div className="grid h-14 w-14 place-items-center rounded-full bg-emerald-500/10 mb-4">
                <CheckCircle2 className="h-7 w-7 text-emerald-600" />
              </div>
              <h3 className="text-lg font-semibold mb-1">Thank you!</h3>
              <p className="text-sm text-black/50">Your feedback has been submitted successfully.</p>
            </div>
          ) : (
            <>
              <DialogHeader className="px-5 pt-5 pb-0">
                <DialogTitle className="text-lg font-bold">Send Feedback</DialogTitle>
                <p className="text-sm text-black/50 mt-1">Help us improve by sharing your thoughts or reporting issues.</p>
              </DialogHeader>
              <div className="px-5 pb-5 pt-3 space-y-4">
                <div className="grid grid-cols-3 gap-2">
                  {TYPES.map((t) => (
                    <button
                      key={t.value}
                      type="button"
                      onClick={() => setType(t.value)}
                      data-testid={`button-feedback-type-${t.value}`}
                      className={`flex flex-col items-center gap-1.5 rounded-xl border p-3 text-xs font-medium transition ${
                        type === t.value
                          ? "border-blue-500/30 bg-blue-500/5 text-blue-700"
                          : "border-black/10 bg-white hover:bg-black/[0.02] text-black/60"
                      }`}
                    >
                      <t.icon className={`h-5 w-5 ${type === t.value ? "text-blue-600" : t.color}`} />
                      {t.label}
                    </button>
                  ))}
                </div>

                <div>
                  <label className="mb-1 block text-xs font-medium text-black/60">Subject</label>
                  <Input
                    placeholder={type === "bug" ? "Describe the issue briefly…" : "What's on your mind?"}
                    value={subject}
                    onChange={(e) => setSubject(e.target.value)}
                    className="rounded-xl"
                    data-testid="input-feedback-subject"
                  />
                </div>

                <div>
                  <label className="mb-1 block text-xs font-medium text-black/60">Details</label>
                  <Textarea
                    placeholder={type === "bug" ? "Steps to reproduce, expected vs actual behaviour…" : "Share your feedback in detail…"}
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    rows={4}
                    className="rounded-xl resize-none"
                    data-testid="input-feedback-message"
                  />
                </div>

                <div className="flex items-center justify-between pt-1">
                  <span className="text-[10px] text-black/35">Page: {location}</span>
                  <Button
                    onClick={handleSubmit}
                    disabled={!subject.trim() || !message.trim() || createMutation.isPending}
                    className="rounded-xl bg-gradient-to-r from-blue-500 to-indigo-600 px-5 text-white hover:from-blue-600 hover:to-indigo-700"
                    data-testid="button-submit-feedback"
                  >
                    {createMutation.isPending ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Sending…
                      </>
                    ) : (
                      "Submit Feedback"
                    )}
                  </Button>
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}

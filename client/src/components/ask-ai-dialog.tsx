import { useState, useMemo } from "react";
import { useMutation } from "@tanstack/react-query";
import { Sparkles, Loader2, Send, Check, Search } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";
import { useClients } from "@/hooks/queries";
import axiosClient from "@/api/client/axios-client";
import { cn } from "@/lib/utils";

interface AskAiDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function AskAiDialog({ open, onOpenChange }: AskAiDialogProps) {
  const { toast } = useToast();
  const { data: clients = [] } = useClients();
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState("");
  const [selectedClientId, setSelectedClientId] = useState<string | null>(null);
  const [clientSearch, setClientSearch] = useState("");

  const askMutation = useMutation({
    mutationFn: async (q: string) => {
      const { data } = await axiosClient.post<{ answer: string }>("/api/ai/ask", { question: q });
      return data.answer;
    },
    onSuccess: (a) => setAnswer(a),
    onError: (err: any) => {
      toast({
        title: "Couldn't get an answer",
        description: err?.response?.data?.message || err?.message || "Please try again.",
        variant: "destructive",
      });
    },
  });

  const saveMutation = useMutation({
    mutationFn: async (clientId: string) => {
      await axiosClient.post("/api/ai/ask/save", { clientId, question, answer });
    },
    onSuccess: () => {
      const c = clients.find((x) => x.id === selectedClientId);
      toast({ title: "Saved to client", description: c?.name ? `Added to ${c.name}'s notes.` : "Note added." });
    },
    onError: (err: any) => {
      toast({
        title: "Couldn't save note",
        description: err?.response?.data?.message || err?.message || "Please try again.",
        variant: "destructive",
      });
    },
  });

  const filteredClients = useMemo(() => {
    const q = clientSearch.trim().toLowerCase();
    const list = clients || [];
    if (!q) return list.slice(0, 50);
    return list.filter((c) => `${c.name} ${c.email ?? ""} ${c.phone ?? ""}`.toLowerCase().includes(q)).slice(0, 50);
  }, [clients, clientSearch]);

  const handleAsk = () => {
    if (!question.trim() || askMutation.isPending) return;
    setAnswer("");
    askMutation.mutate(question.trim());
  };

  const handleSave = () => {
    if (!selectedClientId || !answer || saveMutation.isPending) return;
    saveMutation.mutate(selectedClientId);
  };

  const handleReset = () => {
    setQuestion("");
    setAnswer("");
    setSelectedClientId(null);
    setClientSearch("");
    askMutation.reset();
    saveMutation.reset();
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        onOpenChange(o);
        if (!o) handleReset();
      }}
    >
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-hidden flex flex-col" data-testid="dialog-ask-ai">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <div className="grid h-8 w-8 place-items-center rounded-lg bg-gradient-to-br from-blue-600 to-indigo-600 text-white">
              <Sparkles className="h-4 w-4" />
            </div>
            Ask AI
          </DialogTitle>
          <DialogDescription>
            Ask a travel question. Save the answer straight to a client's notes.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4 overflow-y-auto pr-1 flex-1 min-h-0">
          <div className="space-y-2">
            <label className="text-sm font-medium">Your question</label>
            <Textarea
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              placeholder="e.g. What's the best time to visit the Maldives for honeymooners?"
              rows={3}
              data-testid="textarea-ask-ai-question"
              onKeyDown={(e) => {
                if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
                  e.preventDefault();
                  handleAsk();
                }
              }}
            />
            <div className="flex justify-end">
              <Button
                onClick={handleAsk}
                disabled={!question.trim() || askMutation.isPending}
                data-testid="button-ask-ai-submit"
                className="bg-gradient-to-br from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white"
              >
                {askMutation.isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Thinking...
                  </>
                ) : (
                  <>
                    <Send className="mr-2 h-4 w-4" />
                    Ask
                  </>
                )}
              </Button>
            </div>
          </div>

          {(answer || askMutation.isPending) && (
            <div className="space-y-2">
              <label className="text-sm font-medium">Answer</label>
              <div
                className="rounded-lg border border-slate-200 bg-slate-50 dark:border-slate-800 dark:bg-slate-900/50 p-4 text-sm text-slate-800 dark:text-slate-200 whitespace-pre-wrap min-h-[80px]"
                data-testid="text-ask-ai-answer"
              >
                {askMutation.isPending ? (
                  <div className="flex items-center gap-2 text-slate-500">
                    <Loader2 className="h-4 w-4 animate-spin" /> Generating travel-expert answer...
                  </div>
                ) : (
                  answer
                )}
              </div>
            </div>
          )}

          {answer && (
            <div className="space-y-2">
              <label className="text-sm font-medium">Add To Client</label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <Input
                  value={clientSearch}
                  onChange={(e) => setClientSearch(e.target.value)}
                  placeholder="Search clients by name, email, or phone..."
                  className="pl-9"
                  data-testid="input-ask-ai-client-search"
                />
              </div>

              <ScrollArea className="h-48 rounded-lg border border-slate-200 dark:border-slate-800">
                {filteredClients.length === 0 ? (
                  <div className="p-4 text-sm text-slate-500 text-center">No clients found.</div>
                ) : (
                  <div className="divide-y divide-slate-100 dark:divide-slate-800">
                    {filteredClients.map((c) => {
                      const isSelected = c.id === selectedClientId;
                      return (
                        <button
                          key={c.id}
                          type="button"
                          onClick={() => setSelectedClientId(c.id)}
                          className={cn(
                            "w-full text-left px-3 py-2.5 flex items-center justify-between gap-2 transition-colors",
                            isSelected
                              ? "bg-blue-50 dark:bg-blue-500/10"
                              : "hover:bg-slate-50 dark:hover:bg-slate-800/50"
                          )}
                          data-testid={`button-ask-ai-client-${c.id}`}
                        >
                          <div className="min-w-0">
                            <div className="text-sm font-medium text-slate-900 dark:text-white truncate">{c.name}</div>
                            <div className="text-xs text-slate-500 truncate">
                              {c.email || c.phone || "—"}
                            </div>
                          </div>
                          {isSelected && <Check className="h-4 w-4 text-blue-600 shrink-0" />}
                        </button>
                      );
                    })}
                  </div>
                )}
              </ScrollArea>

              <div className="flex justify-end gap-2 pt-1">
                <Button variant="ghost" onClick={handleReset} data-testid="button-ask-ai-reset">
                  New Question
                </Button>
                <Button
                  onClick={handleSave}
                  disabled={!selectedClientId || saveMutation.isPending}
                  data-testid="button-ask-ai-save"
                >
                  {saveMutation.isPending ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    "Add to Client Notes"
                  )}
                </Button>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

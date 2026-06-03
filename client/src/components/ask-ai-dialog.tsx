import { useState, useMemo, useRef, useEffect } from "react";
import { useMutation } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import { Sparkles, Loader2, Send, Check, Search, BookmarkPlus, X } from "lucide-react";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";
import { useClients } from "@/hooks/queries";
import axiosClient from "@/api/client/axios-client";
import { cn } from "@/lib/utils";
import lunaImg from "@assets/Luna-Platform-600_1780474454496.jpg";

function renderInline(text: string): React.ReactNode[] {
  const parts: React.ReactNode[] = [];
  const regex = /\*\*(.+?)\*\*|\*(.+?)\*|`([^`]+)`/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  let key = 0;
  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) parts.push(text.slice(lastIndex, match.index));
    if (match[1] !== undefined) parts.push(<strong key={key++}>{match[1]}</strong>);
    else if (match[2] !== undefined) parts.push(<em key={key++}>{match[2]}</em>);
    else if (match[3] !== undefined)
      parts.push(
        <code key={key++} className="rounded bg-slate-200 dark:bg-slate-800 px-1 py-0.5 text-xs">
          {match[3]}
        </code>
      );
    lastIndex = regex.lastIndex;
  }
  if (lastIndex < text.length) parts.push(text.slice(lastIndex));
  return parts;
}

function MarkdownAnswer({ text }: { text: string }) {
  const lines = text.split("\n");
  const blocks: React.ReactNode[] = [];
  let bullets: string[] = [];
  let para: string[] = [];
  let key = 0;

  const flushBullets = () => {
    if (bullets.length) {
      blocks.push(
        <ul key={key++} className="list-disc pl-5 space-y-1">
          {bullets.map((b, i) => (
            <li key={i}>{renderInline(b)}</li>
          ))}
        </ul>
      );
      bullets = [];
    }
  };
  const flushPara = () => {
    if (para.length) {
      blocks.push(
        <p key={key++} className="leading-relaxed">
          {renderInline(para.join(" "))}
        </p>
      );
      para = [];
    }
  };

  for (const raw of lines) {
    const line = raw.trim();
    if (!line) {
      flushBullets();
      flushPara();
      continue;
    }
    const heading = line.match(/^(#{1,6})\s+(.*)$/);
    if (heading) {
      flushBullets();
      flushPara();
      const level = heading[1].length;
      const sizes = ["text-lg", "text-base", "text-base", "text-sm", "text-sm", "text-sm"];
      blocks.push(
        <div key={key++} className={cn("font-bold text-slate-900 dark:text-white mt-2", sizes[level - 1])}>
          {renderInline(heading[2])}
        </div>
      );
      continue;
    }
    const bullet = line.match(/^[-*]\s+(.*)$/);
    if (bullet) {
      flushPara();
      bullets.push(bullet[1]);
      continue;
    }
    flushBullets();
    para.push(line);
  }
  flushBullets();
  flushPara();
  return <div className="space-y-3 text-sm text-slate-800 dark:text-slate-200">{blocks}</div>;
}

interface AskAiDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

type ChatMessage =
  | { id: string; role: "user"; text: string }
  | { id: string; role: "luna"; text: string; question: string };

const SUGGESTIONS = [
  "Best time to visit the Maldives for honeymooners?",
  "Family-friendly resorts in Tenerife",
  "Things to do in Dubai with kids",
  "Hidden-gem islands in Greece",
];

let idCounter = 0;
const uid = () => `m${Date.now()}-${idCounter++}`;

function LunaAvatar({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "relative shrink-0 overflow-hidden rounded-full bg-gradient-to-br from-blue-100 to-indigo-100 ring-2 ring-white shadow-sm dark:ring-slate-800",
        className
      )}
    >
      <img src={lunaImg} alt="Luna" className="h-full w-full scale-[1.55] object-cover object-[50%_8%]" />
    </div>
  );
}

function TypingDots() {
  return (
    <div className="flex items-center gap-1" data-testid="luna-typing">
      {[0, 1, 2].map((i) => (
        <motion.span
          key={i}
          className="h-1.5 w-1.5 rounded-full bg-blue-500/70"
          animate={{ y: [0, -4, 0], opacity: [0.4, 1, 0.4] }}
          transition={{ duration: 0.9, repeat: Infinity, delay: i * 0.15 }}
        />
      ))}
    </div>
  );
}

export function AskAiDialog({ open, onOpenChange }: AskAiDialogProps) {
  const { toast } = useToast();
  const { data: clients = [] } = useClients();
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [savingFor, setSavingFor] = useState<{ question: string; answer: string } | null>(null);
  const [selectedClientId, setSelectedClientId] = useState<string | null>(null);
  const [clientSearch, setClientSearch] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);

  const askMutation = useMutation({
    mutationFn: async (q: string) => {
      const { data } = await axiosClient.post<{ answer: string }>("/api/ai/ask", { question: q });
      return { question: q, answer: data.answer };
    },
    onSuccess: ({ question, answer }) => {
      setMessages((m) => [...m, { id: uid(), role: "luna", text: answer, question }]);
    },
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
      if (!savingFor) return;
      await axiosClient.post("/api/ai/ask/save", {
        clientId,
        question: savingFor.question,
        answer: savingFor.answer,
      });
    },
    onSuccess: () => {
      const c = clients.find((x) => x.id === selectedClientId);
      toast({ title: "Saved to client", description: c?.name ? `Added to ${c.name}'s notes.` : "Note added." });
      setSavingFor(null);
      setSelectedClientId(null);
      setClientSearch("");
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

  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
  }, [messages.length, askMutation.isPending]);

  const ask = (q: string) => {
    const question = q.trim();
    if (!question || askMutation.isPending) return;
    setMessages((m) => [...m, { id: uid(), role: "user", text: question }]);
    setInput("");
    askMutation.mutate(question);
  };

  const handleReset = () => {
    setInput("");
    setMessages([]);
    setSavingFor(null);
    setSelectedClientId(null);
    setClientSearch("");
    askMutation.reset();
    saveMutation.reset();
  };

  const isEmpty = messages.length === 0 && !askMutation.isPending;

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        onOpenChange(o);
        if (!o) handleReset();
      }}
    >
      <DialogContent
        className="max-w-2xl h-[88vh] overflow-hidden flex flex-col gap-0 p-0 sm:rounded-2xl"
        data-testid="dialog-ask-ai"
      >
        {/* Header */}
        <div className="relative flex items-center gap-3 border-b border-slate-200/70 bg-gradient-to-r from-blue-600 to-indigo-600 px-5 py-3.5 dark:border-slate-800">
          <div className="absolute inset-0 opacity-20 [background-image:radial-gradient(circle_at_20%_-20%,white,transparent_45%)]" />
          <LunaAvatar className="h-11 w-11" />
          <div className="relative min-w-0 flex-1">
            <DialogTitle className="flex items-center gap-1.5 text-base font-semibold text-white">
              Luna
              <Sparkles className="h-3.5 w-3.5 text-amber-300" />
            </DialogTitle>
            <DialogDescription className="flex items-center gap-1.5 text-xs text-blue-100">
              <span className="inline-block h-1.5 w-1.5 rounded-full bg-emerald-400 shadow-[0_0_6px] shadow-emerald-400" />
              Your AI travel expert · online
            </DialogDescription>
          </div>
          {messages.length > 0 && (
            <button
              onClick={handleReset}
              className="relative rounded-full px-2.5 py-1 text-xs font-medium text-blue-100 transition-colors hover:bg-white/15 hover:text-white"
              data-testid="button-ask-ai-reset"
            >
              New chat
            </button>
          )}
        </div>

        {/* Chat thread */}
        <div
          ref={scrollRef}
          className="flex-1 min-h-0 overflow-y-auto bg-slate-50/60 px-4 py-5 dark:bg-slate-950/40"
        >
          {isEmpty ? (
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4 }}
              className="flex flex-col items-center px-2 pt-2 text-center"
            >
              <div className="flex items-center justify-center gap-1">
                <motion.img
                  src={lunaImg}
                  alt="Luna"
                  className="h-56 w-auto shrink-0 drop-shadow-xl"
                  initial={{ scale: 0.9, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ type: "spring", stiffness: 120, damping: 14 }}
                />
                <motion.div
                  initial={{ opacity: 0, scale: 0.8, x: -10 }}
                  animate={{ opacity: 1, scale: 1, x: 0 }}
                  transition={{ delay: 0.25, type: "spring", stiffness: 200, damping: 16 }}
                  className="max-w-[170px] rounded-2xl rounded-bl-sm border border-slate-200 bg-white px-3.5 py-2.5 text-left text-sm font-medium text-slate-700 shadow-lg dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                >
                  Hi, I'm Luna <span className="text-amber-400">✦</span>
                  <br />
                  How can I help you today?
                </motion.div>
              </div>

              <p className="mt-4 max-w-sm text-sm text-slate-500 dark:text-slate-400">
                Ask me anything about destinations, resorts, or trip ideas — then save my answer straight to a
                client's notes.
              </p>

              <div className="mt-5 grid w-full max-w-md grid-cols-1 gap-2 sm:grid-cols-2">
                {SUGGESTIONS.map((s, i) => (
                  <motion.button
                    key={s}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.3 + i * 0.06 }}
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => ask(s)}
                    className="rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-left text-xs font-medium text-slate-700 shadow-sm transition-colors hover:border-blue-300 hover:bg-blue-50/60 dark:border-slate-700 dark:bg-slate-800/60 dark:text-slate-200 dark:hover:border-blue-500/40 dark:hover:bg-blue-500/10"
                    data-testid={`button-ask-ai-suggestion-${i}`}
                  >
                    {s}
                  </motion.button>
                ))}
              </div>
            </motion.div>
          ) : (
            <div className="flex flex-col gap-4">
              <AnimatePresence initial={false}>
                {messages.map((msg) =>
                  msg.role === "user" ? (
                    <motion.div
                      key={msg.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="flex justify-end"
                      data-testid={`message-user-${msg.id}`}
                    >
                      <div className="max-w-[80%] rounded-2xl rounded-br-sm bg-gradient-to-br from-blue-600 to-indigo-600 px-4 py-2.5 text-sm text-white shadow-sm">
                        {msg.text}
                      </div>
                    </motion.div>
                  ) : (
                    <motion.div
                      key={msg.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="flex items-end gap-2.5"
                      data-testid={`message-luna-${msg.id}`}
                    >
                      <LunaAvatar className="h-8 w-8" />
                      <div className="max-w-[82%] space-y-2">
                        <div className="rounded-2xl rounded-bl-sm border border-slate-200 bg-white px-4 py-3 shadow-sm dark:border-slate-700 dark:bg-slate-800">
                          <MarkdownAnswer text={msg.text} />
                        </div>
                        <button
                          onClick={() => {
                            setSavingFor({ question: msg.question, answer: msg.text });
                            setSelectedClientId(null);
                            setClientSearch("");
                          }}
                          className="ml-1 inline-flex items-center gap-1.5 text-xs font-medium text-blue-600 transition-colors hover:text-blue-700 dark:text-blue-400"
                          data-testid={`button-ask-ai-save-${msg.id}`}
                        >
                          <BookmarkPlus className="h-3.5 w-3.5" />
                          Save to client notes
                        </button>
                      </div>
                    </motion.div>
                  )
                )}
              </AnimatePresence>

              {askMutation.isPending && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="flex items-end gap-2.5"
                >
                  <LunaAvatar className="h-8 w-8" />
                  <div className="rounded-2xl rounded-bl-sm border border-slate-200 bg-white px-4 py-3.5 shadow-sm dark:border-slate-700 dark:bg-slate-800">
                    <TypingDots />
                  </div>
                </motion.div>
              )}
            </div>
          )}
        </div>

        {/* Input bar */}
        <div className="border-t border-slate-200/70 bg-white px-4 py-3 dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-end gap-2">
            <Textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask Luna anything about travel..."
              rows={1}
              className="max-h-32 min-h-[44px] resize-none rounded-2xl"
              data-testid="textarea-ask-ai-question"
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  ask(input);
                }
              }}
            />
            <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.92 }}>
              <Button
                onClick={() => ask(input)}
                disabled={!input.trim() || askMutation.isPending}
                size="icon"
                className="h-11 w-11 shrink-0 rounded-2xl bg-gradient-to-br from-blue-600 to-indigo-600 text-white hover:from-blue-700 hover:to-indigo-700"
                data-testid="button-ask-ai-submit"
              >
                {askMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Send className="h-4 w-4" />
                )}
              </Button>
            </motion.div>
          </div>
        </div>

        {/* Save-to-client sheet */}
        <AnimatePresence>
          {savingFor && (
            <>
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="absolute inset-0 z-10 bg-slate-900/30 backdrop-blur-[2px]"
                onClick={() => setSavingFor(null)}
              />
              <motion.div
                initial={{ y: "100%" }}
                animate={{ y: 0 }}
                exit={{ y: "100%" }}
                transition={{ type: "spring", stiffness: 320, damping: 32 }}
                className="absolute inset-x-0 bottom-0 z-20 max-h-[80%] rounded-t-2xl border-t border-slate-200 bg-white p-4 shadow-2xl dark:border-slate-700 dark:bg-slate-900"
                data-testid="sheet-ask-ai-save"
              >
                <div className="mb-3 flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-slate-900 dark:text-white">Save to a client's notes</h3>
                  <button
                    onClick={() => setSavingFor(null)}
                    className="rounded-full p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800"
                    data-testid="button-ask-ai-save-close"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>

                <div className="relative mb-2">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                  <Input
                    value={clientSearch}
                    onChange={(e) => setClientSearch(e.target.value)}
                    placeholder="Search clients by name, email, or phone..."
                    className="pl-9"
                    data-testid="input-ask-ai-client-search"
                    autoFocus
                  />
                </div>

                <ScrollArea className="h-44 rounded-lg border border-slate-200 dark:border-slate-800">
                  {filteredClients.length === 0 ? (
                    <div className="p-4 text-center text-sm text-slate-500">No clients found.</div>
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
                              "flex w-full items-center justify-between gap-2 px-3 py-2.5 text-left transition-colors",
                              isSelected
                                ? "bg-blue-50 dark:bg-blue-500/10"
                                : "hover:bg-slate-50 dark:hover:bg-slate-800/50"
                            )}
                            data-testid={`button-ask-ai-client-${c.id}`}
                          >
                            <div className="min-w-0">
                              <div className="truncate text-sm font-medium text-slate-900 dark:text-white">
                                {c.name}
                              </div>
                              <div className="truncate text-xs text-slate-500">{c.email || c.phone || "—"}</div>
                            </div>
                            {isSelected && <Check className="h-4 w-4 shrink-0 text-blue-600" />}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </ScrollArea>

                <div className="mt-3 flex justify-end gap-2">
                  <Button variant="ghost" onClick={() => setSavingFor(null)} data-testid="button-ask-ai-save-cancel">
                    Cancel
                  </Button>
                  <Button
                    onClick={() => selectedClientId && saveMutation.mutate(selectedClientId)}
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
              </motion.div>
            </>
          )}
        </AnimatePresence>
      </DialogContent>
    </Dialog>
  );
}

import { useRef, useState } from "react";
import { Sparkles } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { useAiSuggestReply } from "../../../api/use-conversations-mutations";
import type { AiReplyTone } from "../../../api/conversations.api";

const TONES: { value: AiReplyTone; label: string }[] = [
  { value: "friendly", label: "Friendly" },
  { value: "professional", label: "Professional" },
  { value: "short", label: "Short" },
];

interface Suggestion {
  label: string;
  text: string;
}

export interface LunaPopoverProps {
  conversationId: string;
  firstName: string;
  disabled?: boolean;
  /** Puts the chosen text into the reply draft. Never sends. */
  onInsert(text: string): void;
}

export function LunaPopover({ conversationId, firstName, disabled, onInsert }: LunaPopoverProps) {
  const { toast } = useToast();
  const suggest = useAiSuggestReply();
  const [open, setOpen] = useState(false);
  const [tone, setTone] = useState<AiReplyTone | null>(null);
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [selected, setSelected] = useState(0);
  const [loading, setLoading] = useState(false);
  // Only the latest request may land — tone chips can be clicked faster than the API answers.
  const requestSeq = useRef(0);

  const load = (nextTone: AiReplyTone | null) => {
    const seq = ++requestSeq.current;
    setLoading(true);
    setSuggestions([]);
    setSelected(0);
    suggest.mutate(
      { id: conversationId, tone: nextTone ?? undefined, count: nextTone ? 1 : 3 },
      {
        onSuccess: (res) => {
          if (seq !== requestSeq.current) return;
          setSuggestions(res.suggestions.filter((x) => x.text?.trim()).slice(0, 3));
          setLoading(false);
        },
        onError: (err) => {
          if (seq !== requestSeq.current) return;
          setLoading(false);
          toast({ title: "Couldn't generate a reply", description: (err as Error).message, variant: "destructive" });
        },
      },
    );
  };

  const onOpenChange = (next: boolean) => {
    setOpen(next);
    if (next) load(tone);
    else requestSeq.current++;
  };

  const toggleTone = (value: AiReplyTone) => {
    const next = tone === value ? null : value;
    setTone(next);
    load(next);
  };

  const insert = () => {
    const chosen = suggestions[selected];
    if (!chosen) return;
    onInsert(chosen.text);
    setOpen(false);
  };

  return (
    <Popover open={open} onOpenChange={onOpenChange}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          disabled={disabled}
          className="h-9 gap-1.5 rounded-lg border-[#DDD6FE] px-3 text-[13px] font-semibold text-[#6D28D9] hover:bg-[#F5F3FF] hover:text-[#6D28D9] dark:border-violet-500/40 dark:text-violet-300 dark:hover:bg-violet-500/10"
          title="Have Luna draft a reply. It lands in the box for you to edit and send."
          data-testid="composer-luna"
        >
          <Sparkles className="h-4 w-4" />
          Luna AI
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" side="top" className="w-[480px] max-w-[calc(100vw-2rem)] p-4">
        <div className="text-[14px] font-semibold">Luna suggestions</div>
        <div className="text-[12px] text-muted-foreground">
          Based on this chat, {firstName}'s notes and your saved style
        </div>

        <div className="mt-3 flex gap-2">
          {TONES.map((t) => (
            <button
              key={t.value}
              type="button"
              onClick={() => toggleTone(t.value)}
              aria-pressed={tone === t.value}
              className={cn(
                "rounded-full border px-3 py-1 text-[12px] font-semibold transition",
                tone === t.value
                  ? "border-[#6D28D9] bg-[#F5F3FF] text-[#6D28D9] dark:bg-violet-500/15 dark:text-violet-300"
                  : "border-social-border text-muted-foreground hover:bg-muted",
              )}
            >
              {t.label}
            </button>
          ))}
        </div>

        <div className="mt-3 space-y-2" role="radiogroup" aria-label="Luna suggestions">
          {loading
            ? [0, 1, 2].slice(0, tone ? 1 : 3).map((i) => <Skeleton key={i} className="h-16 w-full rounded-xl" />)
            : suggestions.length === 0
            ? (
                <div className="flex items-center justify-between gap-3 rounded-xl border border-dashed border-social-border p-3 text-[13px] text-muted-foreground">
                  <span>No suggestions. Try another tone.</span>
                  <Button type="button" size="sm" variant="outline" onClick={() => load(tone)} className="h-8 rounded-lg">
                    Retry
                  </Button>
                </div>
              )
            : suggestions.map((s, i) => (
                <button
                  key={`${s.label}-${i}`}
                  type="button"
                  role="radio"
                  aria-checked={selected === i}
                  onClick={() => setSelected(i)}
                  className={cn(
                    "block w-full rounded-xl border p-3 text-left transition",
                    selected === i
                      ? "border-[#6D28D9] bg-[#F5F3FF] dark:bg-violet-500/10"
                      : "border-social-border hover:bg-muted/50",
                  )}
                >
                  <div className="text-[12px] font-semibold text-[#6D28D9] dark:text-violet-300">{s.label}</div>
                  <div className="mt-0.5 whitespace-pre-wrap text-[13px] leading-snug">{s.text}</div>
                </button>
              ))}
        </div>

        <div className="mt-3 flex items-center justify-between gap-3">
          <span className="text-[11px] text-muted-foreground">
            🔒 Luna never sends on its own. Check facts before you send.
          </span>
          <Button
            type="button"
            size="sm"
            onClick={insert}
            disabled={loading || suggestions.length === 0}
            className="h-8 shrink-0 rounded-lg bg-[#6D28D9] px-4 text-[13px] text-white hover:bg-[#5B21B6]"
          >
            Insert
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}

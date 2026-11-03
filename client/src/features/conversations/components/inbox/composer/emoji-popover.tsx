import { useState } from "react";
import { Smile } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { EMOJI_CATEGORIES } from "@/lib/emoji";

export interface EmojiPopoverProps {
  onPick(emoji: string): void;
}

export function EmojiPopover({ onPick }: EmojiPopoverProps) {
  const [open, setOpen] = useState(false);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="grid h-9 w-9 place-items-center rounded-[10px] border border-social-border text-black/55 transition hover:bg-black/5 hover:text-black dark:text-white/55 dark:hover:bg-white/10 dark:hover:text-white"
          title="Insert emoji"
          aria-label="Insert emoji"
          data-testid="conversation-composer-emoji"
        >
          <Smile className="h-4.5 w-4.5" />
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" side="top" className="w-72 p-2">
        <div className="max-h-[240px] space-y-2 overflow-y-auto" data-testid="conversation-emoji-picker">
          {EMOJI_CATEGORIES.map((cat) => (
            <div key={cat.name}>
              <div className="mb-1 px-1 text-[10px] font-semibold uppercase tracking-wider text-black/40 dark:text-white/40">
                {cat.name}
              </div>
              <div className="grid grid-cols-8 gap-0.5">
                {cat.emojis.map((emoji) => (
                  <button
                    key={emoji}
                    type="button"
                    onClick={() => {
                      onPick(emoji);
                      setOpen(false);
                    }}
                    className="rounded-lg p-1 text-lg leading-none transition hover:bg-black/5 dark:hover:bg-white/10"
                  >
                    {emoji}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}

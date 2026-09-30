import { useRef, useState, type RefObject } from "react";
import { cn } from "@/lib/utils";
import { useFixedDropdownPosition } from "@/hooks/use-fixed-dropdown-position";
import { useCloseOnOutsideOrEscape } from "@/hooks/use-close-on-outside-or-escape";

const EMOJI_CATEGORIES = [
  { label: "Smileys", emojis: ["😀","😂","🥹","😊","😍","🤩","😎","🤔","😢","😤","🥳","😴","🤗","😇","🙃","😏","🤭","😬","🫡","👋"] },
  { label: "Travel", emojis: ["✈️","🏖️","🏝️","🌍","🗺️","🧳","🚗","🚢","🏨","🌅","🌴","⛱️","🎡","🗼","🏔️","🌊","☀️","🌙","⭐","🎒"] },
  { label: "Gestures", emojis: ["👍","👎","👏","🙌","🤝","✌️","🤞","💪","👊","✋","🫶","❤️","🔥","💯","⚡","🎉","🎊","✅","❌","⭕"] },
  { label: "Objects", emojis: ["📞","📧","💼","📋","📝","📌","📎","🔗","💰","💳","🎫","🛎️","🔑","📅","⏰","🎁","📱","💻","🖨️","📊"] },
];

const PANEL_WIDTH = 280;
const VIEWPORT_PADDING = 8;

/**
 * Rendered as a plain sibling (not portaled) with `position: fixed` computed from the
 * trigger's rect, so it escapes ancestor `overflow` clipping (the note editor shell,
 * ticket cards, scroll containers) while staying inside any Dialog/Sheet focus scope.
 * Same pattern as `SearchableSelect` — see `useFixedDropdownPosition`.
 */
export function EmojiPicker({
  onSelect,
  onClose,
  triggerRef,
}: {
  onSelect: (emoji: string) => void;
  onClose: () => void;
  triggerRef: RefObject<HTMLElement | null>;
}) {
  const [activeTab, setActiveTab] = useState(0);
  const ref = useRef<HTMLDivElement>(null);

  // The picker is only mounted while open, so `open` is always true here.
  const position = useFixedDropdownPosition(triggerRef, true);
  useCloseOnOutsideOrEscape(true, onClose, [triggerRef, ref], triggerRef);

  if (!position) return null;

  // The hook's `width` is the (tiny) trigger width; the panel has its own fixed width,
  // so only clamp its left edge to keep it inside the viewport.
  const left = Math.max(
    VIEWPORT_PADDING,
    Math.min(position.left, window.innerWidth - PANEL_WIDTH - VIEWPORT_PADDING)
  );

  return (
    <div
      ref={ref}
      className="fixed z-[500] w-[280px] overflow-y-auto rounded-2xl border border-black/10 bg-white/95 shadow-xl backdrop-blur-xl"
      style={{ left, top: position.top, bottom: position.bottom, maxHeight: position.maxHeight }}
      data-testid="emoji-picker"
    >
      <div className="flex gap-1 border-b border-black/10 px-2 pt-2">
        {EMOJI_CATEGORIES.map((cat, i) => (
          <button
            key={cat.label}
            type="button"
            onClick={() => setActiveTab(i)}
            className={cn(
              "rounded-lg px-2 py-1 text-[10px] font-semibold transition",
              activeTab === i ? "bg-black/10 text-black" : "text-black/50 hover:text-black/70"
            )}
            data-testid={`emoji-tab-${cat.label}`}
          >
            {cat.label}
          </button>
        ))}
      </div>
      <div className="grid grid-cols-10 gap-0.5 p-2">
        {EMOJI_CATEGORIES[activeTab].emojis.map((emoji) => (
          <button
            key={emoji}
            type="button"
            onClick={() => { onSelect(emoji); onClose(); }}
            className="flex h-7 w-7 items-center justify-center rounded-lg text-base transition hover:bg-black/5"
            data-testid={`emoji-${emoji}`}
          >
            {emoji}
          </button>
        ))}
      </div>
    </div>
  );
}

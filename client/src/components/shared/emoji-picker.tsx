import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

const EMOJI_CATEGORIES = [
  { label: "Smileys", emojis: ["😀","😂","🥹","😊","😍","🤩","😎","🤔","😢","😤","🥳","😴","🤗","😇","🙃","😏","🤭","😬","🫡","👋"] },
  { label: "Travel", emojis: ["✈️","🏖️","🏝️","🌍","🗺️","🧳","🚗","🚢","🏨","🌅","🌴","⛱️","🎡","🗼","🏔️","🌊","☀️","🌙","⭐","🎒"] },
  { label: "Gestures", emojis: ["👍","👎","👏","🙌","🤝","✌️","🤞","💪","👊","✋","🫶","❤️","🔥","💯","⚡","🎉","🎊","✅","❌","⭕"] },
  { label: "Objects", emojis: ["📞","📧","💼","📋","📝","📌","📎","🔗","💰","💳","🎫","🛎️","🔑","📅","⏰","🎁","📱","💻","🖨️","📊"] },
];

export function EmojiPicker({ onSelect, onClose }: { onSelect: (emoji: string) => void; onClose: () => void }) {
  const [activeTab, setActiveTab] = useState(0);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [onClose]);

  return (
    <div ref={ref} className="absolute bottom-full left-0 z-50 mb-2 w-[280px] rounded-2xl border border-black/10 bg-white/95 shadow-xl backdrop-blur-xl" data-testid="emoji-picker">
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

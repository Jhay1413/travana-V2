import EmojiPicker, { EmojiStyle, Theme } from "emoji-picker-react";

interface EmojiPickerPanelProps {
  dark: boolean;
  onPick: (emoji: string) => void;
}

// Separate module so `emoji-picker-react` is only fetched when the menu opens
// (loaded through React.lazy in emoji-insert-button.tsx).
export default function EmojiPickerPanel({ dark, onPick }: EmojiPickerPanelProps) {
  return (
    <EmojiPicker
      theme={dark ? Theme.DARK : Theme.LIGHT}
      emojiStyle={EmojiStyle.NATIVE}
      width={320}
      height={360}
      lazyLoadEmojis
      previewConfig={{ showPreview: false }}
      onEmojiClick={(data) => onPick(data.emoji)}
    />
  );
}

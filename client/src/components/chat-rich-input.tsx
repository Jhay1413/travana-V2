import { useState, useRef, useCallback } from "react";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Link from "@tiptap/extension-link";
import Placeholder from "@tiptap/extension-placeholder";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Bold,
  Italic,
  Strikethrough,
  List,
  ListOrdered,
  Paperclip,
  Send,
  Smile,
  X,
  FileIcon,
  ImageIcon,
} from "lucide-react";

const EMOJI_CATEGORIES = [
  {
    name: "Smileys",
    emojis: ["😀","😃","😄","😁","😆","😅","🤣","😂","🙂","🙃","😉","😊","😇","🥰","😍","🤩","😘","😗","😚","😙","🥲","😋","😛","😜","🤪","😝","🤑","🤗","🤭","🤫","🤔","😐","😑","😶","😏","😒","🙄","😬","🤥","😌","😔","😪","🤤","😴","😷","🤒","🤕","🤢","🤮","🥵","🥶","🥴","😵","🤯","🤠","🥳","🥸","😎","🤓","🧐"],
  },
  {
    name: "Gestures",
    emojis: ["👋","🤚","🖐️","✋","🖖","👌","🤌","🤏","✌️","🤞","🤟","🤘","🤙","👈","👉","👆","🖕","👇","☝️","👍","👎","✊","👊","🤛","🤜","👏","🙌","👐","🤲","🤝","🙏"],
  },
  {
    name: "Hearts",
    emojis: ["❤️","🧡","💛","💚","💙","💜","🖤","🤍","🤎","💔","❣️","💕","💞","💓","💗","💖","💘","💝","💟"],
  },
  {
    name: "Objects",
    emojis: ["🎉","🎊","🎈","🎁","🏆","🎯","📌","📎","✏️","📝","📁","📂","📅","📆","🔔","💡","🔑","🔒","📧","✈️","🏖️","🌍","⭐","🔥","💯","✅","❌","⚠️","💬","💭"],
  },
];

interface ChatRichInputProps {
  onSend: (content: string) => void;
  onSendWithFile: (content: string, file: File) => void;
  disabled?: boolean;
}

export default function ChatRichInput({ onSend, onSendWithFile, disabled }: ChatRichInputProps) {
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [emojiOpen, setEmojiOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: false,
        codeBlock: false,
        blockquote: false,
        horizontalRule: false,
      }),
      Link.configure({ openOnClick: false }),
      Placeholder.configure({ placeholder: "Type a message..." }),
    ],
    editorProps: {
      attributes: {
        class: "outline-none min-h-[40px] max-h-[160px] overflow-y-auto text-sm px-3 py-2",
      },
      handleKeyDown: (_view, event) => {
        if (event.key === "Enter" && !event.shiftKey) {
          event.preventDefault();
          handleSend();
          return true;
        }
        return false;
      },
    },
  });

  const handleSend = useCallback(() => {
    if (!editor) return;
    const html = editor.getHTML();
    const text = editor.getText().trim();
    if (!text && !pendingFile) return;
    if (pendingFile) {
      onSendWithFile(html === "<p></p>" ? "" : html, pendingFile);
      setPendingFile(null);
    } else {
      onSend(html);
    }
    editor.commands.clearContent();
  }, [editor, pendingFile, onSend, onSendWithFile]);

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) setPendingFile(file);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }, []);

  const insertEmoji = useCallback((emoji: string) => {
    if (!editor) return;
    editor.chain().focus().insertContent(emoji).run();
    setEmojiOpen(false);
  }, [editor]);

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const isImage = (file: File) => file.type.startsWith("image/");

  return (
    <div className="border-t border-black/10 dark:border-white/10" data-testid="chat-rich-input">
      {pendingFile && (
        <div className="flex items-center gap-2 px-3 pt-2" data-testid="chat-file-preview">
          <div className="flex items-center gap-2 rounded-lg bg-black/5 dark:bg-white/5 px-3 py-1.5 text-xs">
            {isImage(pendingFile) ? (
              <ImageIcon className="h-3.5 w-3.5 text-[#3b82f6]" />
            ) : (
              <FileIcon className="h-3.5 w-3.5 text-[#3b82f6]" />
            )}
            <span className="max-w-[200px] truncate">{pendingFile.name}</span>
            <span className="text-black/40 dark:text-white/40">{formatFileSize(pendingFile.size)}</span>
            <button
              onClick={() => setPendingFile(null)}
              className="ml-1 rounded-full p-0.5 hover:bg-black/10 dark:hover:bg-white/10"
              data-testid="button-remove-file"
            >
              <X className="h-3 w-3" />
            </button>
          </div>
        </div>
      )}

      <div className="flex items-center gap-1 px-2 py-1 border-b border-black/5 dark:border-white/5">
        <button
          onClick={() => editor?.chain().focus().toggleBold().run()}
          className={`rounded-md p-1.5 transition ${editor?.isActive("bold") ? "bg-black/10 dark:bg-white/10" : "hover:bg-black/5 dark:hover:bg-white/5"}`}
          data-testid="button-bold"
          type="button"
        >
          <Bold className="h-3.5 w-3.5" />
        </button>
        <button
          onClick={() => editor?.chain().focus().toggleItalic().run()}
          className={`rounded-md p-1.5 transition ${editor?.isActive("italic") ? "bg-black/10 dark:bg-white/10" : "hover:bg-black/5 dark:hover:bg-white/5"}`}
          data-testid="button-italic"
          type="button"
        >
          <Italic className="h-3.5 w-3.5" />
        </button>
        <button
          onClick={() => editor?.chain().focus().toggleStrike().run()}
          className={`rounded-md p-1.5 transition ${editor?.isActive("strike") ? "bg-black/10 dark:bg-white/10" : "hover:bg-black/5 dark:hover:bg-white/5"}`}
          data-testid="button-strikethrough"
          type="button"
        >
          <Strikethrough className="h-3.5 w-3.5" />
        </button>
        <div className="mx-1 h-4 w-px bg-black/10 dark:bg-white/10" />
        <button
          onClick={() => editor?.chain().focus().toggleBulletList().run()}
          className={`rounded-md p-1.5 transition ${editor?.isActive("bulletList") ? "bg-black/10 dark:bg-white/10" : "hover:bg-black/5 dark:hover:bg-white/5"}`}
          data-testid="button-bullet-list"
          type="button"
        >
          <List className="h-3.5 w-3.5" />
        </button>
        <button
          onClick={() => editor?.chain().focus().toggleOrderedList().run()}
          className={`rounded-md p-1.5 transition ${editor?.isActive("orderedList") ? "bg-black/10 dark:bg-white/10" : "hover:bg-black/5 dark:hover:bg-white/5"}`}
          data-testid="button-ordered-list"
          type="button"
        >
          <ListOrdered className="h-3.5 w-3.5" />
        </button>
        <div className="mx-1 h-4 w-px bg-black/10 dark:bg-white/10" />
        <Popover open={emojiOpen} onOpenChange={setEmojiOpen}>
          <PopoverTrigger asChild>
            <button
              className="rounded-md p-1.5 transition hover:bg-black/5 dark:hover:bg-white/5"
              data-testid="button-emoji"
              type="button"
            >
              <Smile className="h-3.5 w-3.5" />
            </button>
          </PopoverTrigger>
          <PopoverContent className="w-[320px] p-2 rounded-2xl" align="start" side="top">
            <div className="max-h-[240px] overflow-y-auto space-y-2" data-testid="emoji-picker">
              {EMOJI_CATEGORIES.map((cat) => (
                <div key={cat.name}>
                  <div className="text-[10px] font-semibold text-black/40 dark:text-white/40 uppercase tracking-wider px-1 mb-1">{cat.name}</div>
                  <div className="flex flex-wrap gap-0.5">
                    {cat.emojis.map((emoji) => (
                      <button
                        key={emoji}
                        onClick={() => insertEmoji(emoji)}
                        className="rounded-md p-1 text-lg hover:bg-black/5 dark:hover:bg-white/5 transition"
                        data-testid={`emoji-${emoji}`}
                        type="button"
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
        <button
          onClick={() => fileInputRef.current?.click()}
          className="rounded-md p-1.5 transition hover:bg-black/5 dark:hover:bg-white/5"
          data-testid="button-attach-file"
          type="button"
        >
          <Paperclip className="h-3.5 w-3.5" />
        </button>
        <input
          ref={fileInputRef}
          type="file"
          className="hidden"
          onChange={handleFileSelect}
          accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.txt,.csv,.zip"
          data-testid="input-file-upload"
        />
      </div>

      <div className="flex items-end gap-2 p-2">
        <div className="flex-1 rounded-xl border border-black/10 bg-black/5 dark:border-white/10 dark:bg-white/5 overflow-hidden">
          <EditorContent editor={editor} data-testid="chat-editor" />
        </div>
        <Button
          onClick={handleSend}
          disabled={disabled || (!editor?.getText().trim() && !pendingFile)}
          className="shrink-0 rounded-xl bg-[#3b82f6] text-white hover:bg-[#3b82f6]/90 h-10 w-10 p-0"
          data-testid="button-chat-send"
          type="button"
        >
          <Send className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}

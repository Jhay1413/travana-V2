import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import lunaImg from "@assets/Luna-Platform-600-Final_1780477526775.png";
import type { ChatMessage } from "../types";

// Inline markdown (bold / italic / inline-code) — mirrors the Luna dialog.
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
        <code key={key++} className="rounded bg-slate-200 px-1 py-0.5 text-xs dark:bg-slate-800">
          {match[3]}
        </code>,
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
        <ul key={key++} className="list-disc space-y-1 pl-5">
          {bullets.map((b, i) => (
            <li key={i}>{renderInline(b)}</li>
          ))}
        </ul>,
      );
      bullets = [];
    }
  };
  const flushPara = () => {
    if (para.length) {
      blocks.push(
        <p key={key++} className="leading-relaxed">
          {renderInline(para.join(" "))}
        </p>,
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
      const sizes = ["text-base", "text-sm", "text-sm", "text-sm", "text-sm", "text-sm"];
      blocks.push(
        <div key={key++} className={cn("mt-1 font-bold text-slate-900 dark:text-white", sizes[heading[1].length - 1])}>
          {renderInline(heading[2])}
        </div>,
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
  return <div className="space-y-2 text-sm text-slate-800 dark:text-slate-200">{blocks}</div>;
}

export function AssistantAvatar({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "relative shrink-0 overflow-hidden rounded-full bg-gradient-to-br from-blue-100 to-indigo-100 shadow-sm ring-2 ring-white dark:ring-slate-800",
        className,
      )}
    >
      <img src={lunaImg} alt="Assistant" className="h-full w-full scale-[1.55] object-cover object-[50%_8%]" />
    </div>
  );
}

export function TypingDots() {
  return (
    <div className="flex items-center gap-1">
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

interface ChatMessagesProps {
  messages: ChatMessage[];
}

export function ChatMessages({ messages }: ChatMessagesProps) {
  return (
    <div className="flex flex-col gap-4">
      {messages
        .filter((m) => m.role !== "system_note")
        .map((message) =>
          message.role === "user" ? (
            <motion.div
              key={message.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex justify-end"
            >
              <div className="max-w-[82%] whitespace-pre-wrap break-words rounded-2xl rounded-br-sm bg-gradient-to-br from-blue-600 to-indigo-600 px-3.5 py-2.5 text-sm text-white shadow-sm">
                {message.content}
              </div>
            </motion.div>
          ) : (
            <motion.div
              key={message.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex items-end gap-2"
            >
              <AssistantAvatar className="h-7 w-7" />
              <div className="max-w-[82%] rounded-2xl rounded-bl-sm border border-slate-200 bg-white px-3.5 py-2.5 shadow-sm dark:border-slate-700 dark:bg-slate-800">
                <MarkdownAnswer text={message.content} />
              </div>
            </motion.div>
          ),
        )}
    </div>
  );
}

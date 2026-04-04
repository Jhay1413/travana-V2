import { useState, useEffect, useRef } from "react";
import { motion } from "framer-motion";
import { MessageCircle, Send, Loader2, Inbox, ChevronRight, Home } from "lucide-react";
import { useLocation } from "wouter";
import PortalLayout from "./portal-layout";
import { usePortalMessages, useSendMessage, type PortalMessage } from "@/hooks/use-portal-api";

function GlassCard({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`backdrop-blur-xl bg-white/[0.08] border border-white/[0.12] rounded-3xl ${className}`}>
      {children}
    </div>
  );
}

function Skeleton({ className = "" }: { className?: string }) {
  return <div className={`animate-pulse bg-white/[0.08] rounded-2xl ${className}`} />;
}

const fallbackMessages: PortalMessage[] = [
  {
    id: "1",
    sender: "agent",
    agent_name: "Tina",
    text: "Hi there! I've put together a fantastic Maldives package for you. Have a look at the quote and let me know your thoughts!",
    timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: "2",
    sender: "client",
    text: "That looks amazing! Could we possibly extend it to 10 nights?",
    timestamp: new Date(Date.now() - 1.5 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: "3",
    sender: "agent",
    agent_name: "Tina",
    text: "Absolutely! I'll update the quote with 10 nights and send you a revised version. I might also be able to get a better room rate for the longer stay.",
    timestamp: new Date(Date.now() - 1 * 60 * 60 * 1000).toISOString(),
  },
];

function formatTime(dateStr: string): string {
  try {
    return new Date(dateStr).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
  } catch {
    return "";
  }
}

function MessageSkeleton() {
  return (
    <div className="space-y-4 p-4">
      <div className="flex gap-3">
        <Skeleton className="w-8 h-8 rounded-full shrink-0" />
        <Skeleton className="h-16 w-3/4" />
      </div>
      <div className="flex justify-end">
        <Skeleton className="h-12 w-2/3" />
      </div>
      <div className="flex gap-3">
        <Skeleton className="w-8 h-8 rounded-full shrink-0" />
        <Skeleton className="h-20 w-3/4" />
      </div>
    </div>
  );
}

export default function PortalMessagesPage() {
  const { data: apiMessages, isLoading, isError } = usePortalMessages();
  const [localMessages, setLocalMessages] = useState<PortalMessage[]>([]);
  const [input, setInput] = useState("");
  const sendMutation = useSendMessage();
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const baseMessages = apiMessages ?? (isError ? fallbackMessages : []);
  const allMessages = [...baseMessages, ...localMessages];
  const loading = isLoading;

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [allMessages.length]);

  const handleSend = async () => {
    if (!input.trim() || sendMutation.isPending) return;
    const text = input.trim();
    setInput("");

    const newMsg: PortalMessage = {
      id: "client-" + Date.now(),
      sender: "client",
      text,
      timestamp: new Date().toISOString(),
    };
    setLocalMessages(prev => [...prev, newMsg]);

    try {
      await sendMutation.mutateAsync(text);
    } catch {
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const [, setLocation] = useLocation();

  return (
    <PortalLayout>
      <div className="flex flex-col h-[calc(100vh-6rem)] max-w-lg mx-auto">
        <div className="px-4 pt-6 pb-3">
          <div className="flex items-center gap-1.5 mb-4 text-xs" data-testid="breadcrumb-messages">
            <button onClick={() => setLocation("/portal")} className="text-white/40 hover:text-white/70 transition-colors flex items-center gap-1">
              <Home className="w-3 h-3" /> Home
            </button>
            <ChevronRight className="w-3 h-3 text-white/20" />
            <span className="text-white/70">Messages</span>
          </div>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-green-500/30 to-emerald-500/30 flex items-center justify-center">
              <MessageCircle className="w-5 h-5 text-green-400" />
            </div>
            <h1 className="text-xl font-bold text-white" data-testid="text-messages-title">Messages</h1>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-4">
          {loading ? (
            <MessageSkeleton />
          ) : allMessages.length === 0 ? (
            <div className="flex items-center justify-center h-full">
              <GlassCard className="p-8 text-center">
                <Inbox className="w-12 h-12 text-white/20 mx-auto mb-3" />
                <p className="text-white/60 font-medium mb-1" data-testid="text-empty-messages">No messages yet</p>
                <p className="text-white/40 text-sm">Start a conversation with your travel agent</p>
              </GlassCard>
            </div>
          ) : (
            <div className="space-y-3 py-2">
              {allMessages.map(msg => (
                <motion.div
                  key={msg.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className={`flex ${msg.sender === "client" ? "justify-end" : "justify-start"}`}
                  data-testid={`message-${msg.id}`}
                >
                  {msg.sender === "agent" && (
                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-purple-500/30 to-blue-500/30 flex items-center justify-center mr-2 mt-1 shrink-0">
                      <span className="text-xs font-bold text-purple-400">{msg.agent_name?.[0] || "A"}</span>
                    </div>
                  )}
                  <div className="max-w-[80%]">
                    {msg.sender === "agent" && msg.agent_name && (
                      <p className="text-xs text-white/40 mb-1 ml-1" data-testid={`text-agent-name-${msg.id}`}>{msg.agent_name}</p>
                    )}
                    <div
                      className={`px-4 py-3 rounded-2xl text-sm leading-relaxed ${
                        msg.sender === "client"
                          ? "bg-gradient-to-r from-purple-600 to-blue-600 text-white rounded-br-lg"
                          : "backdrop-blur-xl bg-white/[0.08] border border-white/[0.12] text-white/90 rounded-bl-lg"
                      }`}
                    >
                      {msg.text}
                    </div>
                    <p className={`text-[10px] text-white/30 mt-1 ${msg.sender === "client" ? "text-right mr-1" : "ml-1"}`} data-testid={`text-timestamp-${msg.id}`}>
                      {formatTime(msg.timestamp)}
                    </p>
                  </div>
                </motion.div>
              ))}
              <div ref={messagesEndRef} />
            </div>
          )}
        </div>

        <div className="px-4 pb-2 pt-2">
          <div className="backdrop-blur-xl bg-white/[0.08] border border-white/[0.12] rounded-2xl flex items-end gap-2 p-2">
            <textarea
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Type a message..."
              rows={1}
              className="flex-1 bg-transparent text-white placeholder:text-white/30 text-sm px-3 py-2 focus:outline-none resize-none max-h-24"
              data-testid="input-message"
            />
            <motion.button
              whileTap={{ scale: 0.9 }}
              onClick={handleSend}
              disabled={!input.trim() || sendMutation.isPending}
              className="w-10 h-10 rounded-xl bg-gradient-to-r from-purple-600 to-blue-600 flex items-center justify-center shrink-0 disabled:opacity-40 transition-opacity"
              data-testid="button-send-message"
            >
              {sendMutation.isPending ? (
                <Loader2 className="w-4 h-4 text-white animate-spin" />
              ) : (
                <Send className="w-4 h-4 text-white" />
              )}
            </motion.button>
          </div>
        </div>
      </div>
    </PortalLayout>
  );
}

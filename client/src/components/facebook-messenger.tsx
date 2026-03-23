import { useState, useEffect, useRef } from "react";
import {
  Search,
  Send,
  Paperclip,
  Image,
  Smile,
  Phone,
  Video,
  Info,
  Check,
  CheckCheck,
  Settings,
  RefreshCw,
  Shield,
  Zap,
  ExternalLink,
  Circle,
  MessageCircle,
  ChevronDown,
  X,
  Loader2,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { useAuth } from "@/hooks/use-auth";
import { useFacebookPages, useFacebookConversations, useFacebookMessages } from "@/hooks/queries";
import { useDisconnectFacebookPage, useSendFacebookMessage } from "@/hooks/mutations";
import type { FacebookPagePublic, FbConversation, FbMessage } from "@/api/endpoints/facebook.api";

const FacebookIcon = ({ className = "w-5 h-5" }: { className?: string }) => (
  <svg viewBox="0 0 24 24" className={className} fill="currentColor">
    <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
  </svg>
);

const MessengerIcon = ({ className = "w-5 h-5" }: { className?: string }) => (
  <svg viewBox="0 0 24 24" className={className} fill="currentColor">
    <path d="M12 0C5.373 0 0 4.974 0 11.111c0 3.498 1.744 6.614 4.469 8.654V24l4.088-2.242c1.092.301 2.246.464 3.443.464 6.627 0 12-4.974 12-11.111S18.627 0 12 0zm1.191 14.963l-3.055-3.26-5.963 3.26L10.732 8.2l3.131 3.259L19.752 8.2l-6.561 6.763z" />
  </svg>
);

function initials(name: string) {
  return name
    .split(" ")
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("");
}

function fmtTime(iso: string) {
  const date = new Date(iso);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffHrs = diffMs / (1000 * 60 * 60);
  if (diffHrs < 1) return `${Math.max(1, Math.floor(diffMs / 60000))}m ago`;
  if (diffHrs < 24) return date.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
  if (diffHrs < 48) return "Yesterday";
  return date.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

function fmtMsgTime(iso: string) {
  return new Date(iso).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
}

// ─── Connected View ───────────────────────────────────────────────────────────

function ConnectedView({ pages, onDisconnect }: { pages: FacebookPagePublic[]; onDisconnect: () => void }) {
  const { user } = useAuth();
  const userId = user?.id ?? "";

  const [selectedPageId, setSelectedPageId] = useState(pages[0]?.id ?? "");
  const [selectedConvoId, setSelectedConvoId] = useState<string | null>(null);
  const [messageInput, setMessageInput] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const selectedPage = pages.find((p) => p.id === selectedPageId) ?? pages[0];

  const { data: conversations = [], isLoading: convoLoading, refetch: refetchConvos } = useFacebookConversations(selectedPageId, userId);
  const selectedConvo = conversations.find((c) => c.id === selectedConvoId) ?? null;

  const { data: messages = [], isLoading: msgLoading } = useFacebookMessages(
    selectedConvoId ?? "",
    selectedPageId,
    userId,
  );

  const sendMsg = useSendFacebookMessage(selectedPageId, selectedConvoId ?? "", userId);
  const disconnect = useDisconnectFacebookPage(userId);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    if (conversations.length > 0 && !selectedConvoId) {
      setSelectedConvoId(conversations[0].id);
    }
  }, [conversations]);

  const filteredConversations = conversations.filter((c) =>
    searchQuery === "" || c.participantName.toLowerCase().includes(searchQuery.toLowerCase()),
  );

  const handleSend = async () => {
    if (!selectedConvo || !messageInput.trim()) return;
    await sendMsg.mutateAsync({ recipientId: selectedConvo.participantId, text: messageInput.trim() });
    setMessageInput("");
  };

  const handleDisconnect = async () => {
    if (!selectedPage) return;
    await disconnect.mutateAsync(selectedPage.id);
    onDisconnect();
  };

  return (
    <div className="flex h-full" data-testid="messenger-connected-view">
      {/* Conversation list */}
      <div className="w-[340px] flex-none border-r border-black/10 dark:border-white/10 flex flex-col bg-white/50 dark:bg-white/5" data-testid="messenger-conversation-list">
        <div className="p-4 border-b border-black/10 dark:border-white/10 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center text-white">
                <MessengerIcon className="w-4 h-4" />
              </div>
              <div>
                <h2 className="text-sm font-bold" data-testid="text-messenger-title">Messenger</h2>
                <div className="flex items-center gap-1">
                  <Circle className="w-2 h-2 fill-emerald-500 text-emerald-500" />
                  <span className="text-[10px] text-emerald-600 font-medium">Connected</span>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 rounded-xl"
                onClick={() => refetchConvos()}
                data-testid="button-messenger-refresh"
              >
                <RefreshCw className="w-4 h-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 rounded-xl"
                onClick={handleDisconnect}
                data-testid="button-messenger-settings"
              >
                <Settings className="w-4 h-4" />
              </Button>
            </div>
          </div>

          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-black/40 dark:text-white/40" />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search conversations..."
              className="pl-9 rounded-xl bg-black/5 dark:bg-white/5 border-black/10 dark:border-white/10"
              data-testid="input-messenger-search"
            />
          </div>

          {/* Page selector */}
          {pages.length > 1 && (
            <div className="flex gap-1 flex-wrap">
              {pages.map((p) => (
                <button
                  key={p.id}
                  onClick={() => { setSelectedPageId(p.id); setSelectedConvoId(null); }}
                  className={`px-2.5 py-1 rounded-full text-[11px] font-medium transition-colors ${
                    selectedPageId === p.id
                      ? "bg-blue-600 text-white"
                      : "bg-black/5 dark:bg-white/10 text-black/60 dark:text-white/60 hover:bg-black/10"
                  }`}
                >
                  {p.pageName}
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="flex-1 overflow-y-auto">
          {convoLoading ? (
            <div className="flex flex-col items-center justify-center h-full gap-2 text-black/30 dark:text-white/30 py-12">
              <Loader2 className="w-6 h-6 animate-spin" />
              <span className="text-xs">Loading conversations…</span>
            </div>
          ) : filteredConversations.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full gap-2 text-black/30 dark:text-white/30 py-12">
              <MessageCircle className="w-8 h-8" />
              <span className="text-xs">No conversations yet</span>
            </div>
          ) : (
            filteredConversations.map((convo) => (
              <div
                key={convo.id}
                onClick={() => setSelectedConvoId(convo.id)}
                className={`flex items-start gap-3 px-4 py-3 cursor-pointer transition-colors border-b border-black/5 dark:border-white/5 ${
                  selectedConvoId === convo.id
                    ? "bg-blue-500/10 dark:bg-blue-500/15"
                    : "hover:bg-black/5 dark:hover:bg-white/5"
                }`}
                data-testid={`conversation-${convo.id}`}
              >
                <div className="relative flex-none">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold ${
                    selectedConvoId === convo.id
                      ? "bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-300"
                      : "bg-black/5 dark:bg-white/10 text-black/60 dark:text-white/60"
                  }`}>
                    {initials(convo.participantName)}
                  </div>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-0.5">
                    <span className={`text-sm truncate ${convo.unreadCount > 0 ? "font-bold" : "font-medium"}`}>
                      {convo.participantName}
                    </span>
                    <span className="text-[10px] text-black/40 dark:text-white/40 flex-none ml-2">{fmtTime(convo.updatedAt)}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <p className={`text-xs truncate ${convo.unreadCount > 0 ? "text-black/70 dark:text-white/70 font-medium" : "text-black/50 dark:text-white/50"}`}>
                      {convo.lastMessage || "No messages yet"}
                    </p>
                    {convo.unreadCount > 0 && (
                      <span className="flex-none ml-2 w-5 h-5 rounded-full bg-blue-600 text-white text-[10px] font-bold flex items-center justify-center">
                        {convo.unreadCount}
                      </span>
                    )}
                  </div>
                  {selectedPage && (
                    <span className="text-[10px] text-black/35 dark:text-white/35 mt-0.5 block">{selectedPage.pageName}</span>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Chat panel */}
      <div className="flex-1 flex flex-col min-w-0" data-testid="messenger-chat-panel">
        {selectedConvo ? (
          <>
            <div className="flex-none border-b border-black/10 dark:border-white/10 px-5 py-3 flex items-center justify-between bg-white/50 dark:bg-white/5">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-full bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-300 flex items-center justify-center text-sm font-bold">
                  {initials(selectedConvo.participantName)}
                </div>
                <div>
                  <h3 className="text-sm font-semibold" data-testid="text-chat-name">{selectedConvo.participantName}</h3>
                  <span className="text-xs text-black/40 dark:text-white/40">
                    {fmtTime(selectedConvo.updatedAt)}
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-1">
                <Button variant="ghost" size="icon" className="h-8 w-8 rounded-xl" data-testid="button-call">
                  <Phone className="w-4 h-4" />
                </Button>
                <Button variant="ghost" size="icon" className="h-8 w-8 rounded-xl" data-testid="button-video">
                  <Video className="w-4 h-4" />
                </Button>
                <Button variant="ghost" size="icon" className="h-8 w-8 rounded-xl" data-testid="button-info">
                  <Info className="w-4 h-4" />
                </Button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3">
              {msgLoading ? (
                <div className="flex items-center justify-center py-8 text-black/30 dark:text-white/30 gap-2">
                  <Loader2 className="w-5 h-5 animate-spin" />
                  <span className="text-sm">Loading messages…</span>
                </div>
              ) : messages.length === 0 ? (
                <div className="flex items-center justify-center py-8 text-black/30 dark:text-white/30">
                  <span className="text-sm">No messages yet</span>
                </div>
              ) : (
                messages.map((msg) => (
                  <div
                    key={msg.id}
                    className={`flex ${msg.senderType === "agent" ? "justify-end" : "justify-start"}`}
                    data-testid={`message-${msg.id}`}
                  >
                    <div className="max-w-[70%]">
                      <div
                        className={`px-4 py-2.5 rounded-2xl text-sm leading-relaxed ${
                          msg.senderType === "agent"
                            ? "bg-blue-600 text-white rounded-br-md"
                            : "bg-white dark:bg-white/10 text-black dark:text-white border border-black/10 dark:border-white/10 rounded-bl-md shadow-sm"
                        }`}
                      >
                        {msg.text}
                      </div>
                      <div className={`flex items-center gap-1 mt-1 ${msg.senderType === "agent" ? "justify-end" : ""}`}>
                        <span className="text-[10px] text-black/40 dark:text-white/40">{fmtMsgTime(msg.createdAt)}</span>
                        {msg.senderType === "agent" && <Check className="w-3 h-3 text-black/30 dark:text-white/30" />}
                      </div>
                    </div>
                  </div>
                ))
              )}
              <div ref={messagesEndRef} />
            </div>

            <div className="flex-none border-t border-black/10 dark:border-white/10 p-3 bg-white/50 dark:bg-white/5">
              <div className="flex items-end gap-2">
                <div className="flex gap-1 pb-1">
                  <Button variant="ghost" size="icon" className="h-8 w-8 rounded-xl" data-testid="button-attach">
                    <Paperclip className="w-4 h-4" />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-8 w-8 rounded-xl" data-testid="button-image">
                    <Image className="w-4 h-4" />
                  </Button>
                </div>
                <div className="flex-1 flex items-center bg-black/5 dark:bg-white/5 border border-black/10 dark:border-white/10 rounded-xl px-3 py-2 focus-within:ring-2 focus-within:ring-blue-500/20 focus-within:border-blue-500">
                  <input
                    type="text"
                    value={messageInput}
                    onChange={(e) => setMessageInput(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
                    placeholder="Type a message..."
                    className="flex-1 bg-transparent text-sm outline-none"
                    data-testid="input-message"
                  />
                  <button className="p-1 text-black/40 dark:text-white/40 hover:text-black/60 dark:hover:text-white/60 transition-colors ml-1">
                    <Smile className="w-4 h-4" />
                  </button>
                </div>
                <Button
                  size="icon"
                  className="h-9 w-9 rounded-xl bg-blue-600 hover:bg-blue-700 text-white"
                  onClick={handleSend}
                  disabled={!messageInput.trim() || sendMsg.isPending}
                  data-testid="button-send"
                >
                  {sendMsg.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                </Button>
              </div>
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center">
              <MessageCircle className="w-12 h-12 text-black/20 dark:text-white/20 mx-auto mb-3" />
              <p className="text-sm text-black/50 dark:text-white/50 font-medium" data-testid="text-no-conversation">
                Select a conversation
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Context panel */}
      <div className="w-[260px] flex-none border-l border-black/10 dark:border-white/10 p-4 overflow-y-auto bg-white/50 dark:bg-white/5" data-testid="messenger-context-panel">
        {selectedConvo && (
          <div className="space-y-5">
            <div className="text-center">
              <div className="w-16 h-16 rounded-full bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-300 flex items-center justify-center text-xl font-bold mx-auto mb-2">
                {initials(selectedConvo.participantName)}
              </div>
              <h3 className="text-sm font-bold" data-testid="text-context-name">{selectedConvo.participantName}</h3>
              <p className="text-xs text-black/50 dark:text-white/50 mt-0.5">
                Last active {fmtTime(selectedConvo.updatedAt)}
              </p>
            </div>

            <div className="space-y-2">
              <h4 className="text-[10px] uppercase tracking-wider font-semibold text-black/40 dark:text-white/40">Quick Actions</h4>
              <Button
                variant="outline"
                size="sm"
                className="w-full justify-start gap-2 rounded-xl bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/20 hover:bg-emerald-500/15"
                data-testid="button-create-quote-from-chat"
              >
                <Zap className="w-3.5 h-3.5" />
                Create Quote from Chat
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="w-full justify-start gap-2 rounded-xl bg-blue-500/10 text-blue-700 dark:text-blue-400 border-blue-500/20 hover:bg-blue-500/15"
                data-testid="button-view-client-profile"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                View Client Profile
              </Button>
            </div>

            {selectedPage && (
              <div className="space-y-2">
                <h4 className="text-[10px] uppercase tracking-wider font-semibold text-black/40 dark:text-white/40">Page</h4>
                <Card className="rounded-xl p-3 bg-black/5 dark:bg-white/5 border-black/10 dark:border-white/10">
                  <div className="flex items-center gap-2">
                    {selectedPage.pageAvatar ? (
                      <img src={selectedPage.pageAvatar} alt={selectedPage.pageName} className="w-6 h-6 rounded object-cover" />
                    ) : (
                      <div className="w-6 h-6 rounded bg-blue-600 flex items-center justify-center text-white">
                        <FacebookIcon className="w-3.5 h-3.5" />
                      </div>
                    )}
                    <div>
                      <p className="text-xs font-semibold" data-testid="text-page-name">{selectedPage.pageName}</p>
                      <p className="text-[10px] text-black/50 dark:text-white/50">{selectedPage.pageCategory ?? "Business Page"}</p>
                    </div>
                  </div>
                </Card>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Setup View ───────────────────────────────────────────────────────────────

function SetupView({ userId }: { userId: string }) {
  const handleConnect = () => {
    window.location.href = `/api/facebook/auth?userId=${userId}`;
  };

  return (
    <div className="flex-1 flex items-center justify-center overflow-y-auto" data-testid="messenger-setup-view">
      <div className="max-w-lg w-full mx-4 py-8">
        <div className="text-center mb-8">
          <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center text-white mx-auto mb-4 shadow-lg shadow-blue-500/25">
            <MessengerIcon className="w-8 h-8" />
          </div>
          <h1 className="text-2xl font-bold mb-2" data-testid="text-setup-title">Connect Facebook Messenger</h1>
          <p className="text-sm text-black/50 dark:text-white/50 max-w-sm mx-auto">
            Reply to customer messages directly from your command centre. Connect your Facebook Business Page to get started.
          </p>
        </div>

        <Card className="glass ringed grain rounded-3xl overflow-hidden">
          <div className="p-6 space-y-5">
            <div className="flex items-start gap-4">
              <div className="w-10 h-10 rounded-xl bg-blue-500/10 flex items-center justify-center flex-none">
                <Shield className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <h3 className="text-sm font-semibold">Secure OAuth Authorization</h3>
                <p className="text-xs text-black/50 dark:text-white/50 mt-0.5">
                  Sign in with your Facebook account to authorize access. We only request messaging permissions — we never post on your behalf.
                </p>
              </div>
            </div>
            <div className="flex items-start gap-4">
              <div className="w-10 h-10 rounded-xl bg-emerald-500/10 flex items-center justify-center flex-none">
                <RefreshCw className="w-5 h-5 text-emerald-600" />
              </div>
              <div>
                <h3 className="text-sm font-semibold">Long-Lived Access Token</h3>
                <p className="text-xs text-black/50 dark:text-white/50 mt-0.5">
                  Your Page token is stored securely and doesn't expire. No need to reconnect every time.
                </p>
              </div>
            </div>
            <div className="flex items-start gap-4">
              <div className="w-10 h-10 rounded-xl bg-violet-500/10 flex items-center justify-center flex-none">
                <Zap className="w-5 h-5 text-violet-600" />
              </div>
              <div>
                <h3 className="text-sm font-semibold">Real-Time Messages</h3>
                <p className="text-xs text-black/50 dark:text-white/50 mt-0.5">
                  Conversations refresh automatically every 15 seconds so you never miss a message.
                </p>
              </div>
            </div>
          </div>

          <Separator className="bg-black/10 dark:bg-white/10" />

          <div className="p-6 bg-black/[0.02] dark:bg-white/[0.02]">
            <Button
              onClick={handleConnect}
              className="w-full gap-2.5 bg-[#1877F2] hover:bg-[#166FE5] text-white rounded-xl font-semibold shadow-md shadow-blue-500/20 hover:shadow-lg hover:shadow-blue-500/30 h-12"
              data-testid="button-connect-facebook"
            >
              <FacebookIcon className="w-5 h-5" />
              Continue with Facebook
            </Button>
            <p className="text-[10px] text-black/40 dark:text-white/40 text-center mt-3">
              By connecting, you agree to allow access to your Page's Messenger conversations.
            </p>
          </div>
        </Card>

        <div className="flex items-center justify-center gap-4 mt-6 text-xs text-black/40 dark:text-white/40">
          <span className="flex items-center gap-1"><Shield className="w-3 h-3" /> Encrypted</span>
          <span>·</span>
          <span className="flex items-center gap-1"><Check className="w-3 h-3" /> GDPR Compliant</span>
          <span>·</span>
          <span className="flex items-center gap-1"><RefreshCw className="w-3 h-3" /> Auto-Refresh</span>
        </div>
      </div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function FacebookMessenger() {
  const { user } = useAuth();
  const userId = user?.id ?? "";

  const { data: pages = [], isLoading } = useFacebookPages(userId);
  const disconnect = useDisconnectFacebookPage(userId);

  const isConnected = pages.length > 0;

  if (isLoading) {
    return (
      <section className="flex items-center justify-center h-[calc(100vh-12rem)]">
        <Loader2 className="w-8 h-8 animate-spin text-black/30 dark:text-white/30" />
      </section>
    );
  }

  return (
    <section className="flex flex-col h-[calc(100vh-12rem)] rounded-3xl overflow-hidden border border-black/10 dark:border-white/10 bg-white/50 dark:bg-white/[0.02]" data-testid="section-facebook-messenger">
      <header className="flex-none border-b border-black/10 dark:border-white/10 px-5 py-3 flex items-center justify-between bg-white/70 dark:bg-white/5">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center text-white shadow-sm">
              <MessengerIcon className="w-4 h-4" />
            </div>
            <h1 className="text-base font-bold" data-testid="text-messenger-header">Facebook Messenger</h1>
          </div>
          {isConnected && (
            <Badge variant="outline" className="bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/20 gap-1.5">
              <Circle className="w-2 h-2 fill-emerald-500 text-emerald-500" />
              {pages.length} Page{pages.length > 1 ? "s" : ""} Connected
            </Badge>
          )}
        </div>
      </header>

      {isConnected ? (
        <ConnectedView pages={pages} onDisconnect={() => {}} />
      ) : (
        <SetupView userId={userId} />
      )}
    </section>
  );
}

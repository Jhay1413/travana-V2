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
  LogIn,
  Shield,
  Zap,
  ExternalLink,
  Circle,
  MessageCircle,
  ChevronDown,
  X,
  Plus,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";

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

type View = "connected" | "setup" | "authorizing";

interface Conversation {
  id: string;
  name: string;
  avatar: string;
  lastMessage: string;
  time: string;
  unread: number;
  online: boolean;
  pageLabel: string;
}

interface Message {
  id: string;
  sender: "customer" | "agent";
  text: string;
  time: string;
  status: "sent" | "delivered" | "read";
}

const demoConversations: Conversation[] = [
  { id: "1", name: "Sarah Thompson", avatar: "ST", lastMessage: "Hi, I wanted to ask about the Maldives package you mentioned?", time: "2m ago", unread: 2, online: true, pageLabel: "Apple Travel" },
  { id: "2", name: "David & Emma Wilson", avatar: "DW", lastMessage: "That's perfect! Can you send over the full itinerary?", time: "15m ago", unread: 0, online: true, pageLabel: "Apple Travel" },
  { id: "3", name: "James Patterson", avatar: "JP", lastMessage: "We're interested in the Greece cruise for August", time: "1h ago", unread: 1, online: false, pageLabel: "Apple Travel" },
  { id: "4", name: "Linda McCarthy", avatar: "LM", lastMessage: "Thanks for sending the quote! We'll discuss tonight.", time: "3h ago", unread: 0, online: false, pageLabel: "Apple Holidays" },
  { id: "5", name: "Robert & Sarah Chen", avatar: "RC", lastMessage: "Is the early bird discount still available?", time: "5h ago", unread: 0, online: false, pageLabel: "Apple Travel" },
  { id: "6", name: "Margaret O'Brien", avatar: "MO", lastMessage: "Can we change the departure airport to Birmingham?", time: "1d ago", unread: 0, online: false, pageLabel: "Apple Holidays" },
];

const demoMessages: Message[] = [
  { id: "1", sender: "customer", text: "Hi there! I saw your Maldives all-inclusive package on your page. Could you tell me more about it?", time: "10:23 AM", status: "read" },
  { id: "2", sender: "agent", text: "Hello Sarah! Great to hear from you 😊 The Maldives package is one of our most popular — it includes 7 nights at a 5-star water villa, all meals, return flights from Manchester, and a sunset dolphin cruise.", time: "10:25 AM", status: "read" },
  { id: "3", sender: "customer", text: "That sounds amazing! What dates are available and how much is it per person?", time: "10:28 AM", status: "read" },
  { id: "4", sender: "agent", text: "We have availability in June and September. The price starts from £2,450 per person based on 2 sharing. If you book before the end of this month, there's a £200 early bird discount per person!", time: "10:31 AM", status: "read" },
  { id: "5", sender: "customer", text: "Oh wow, that's a great deal. My husband and I were looking at September. Can you check exact dates for us?", time: "10:45 AM", status: "read" },
  { id: "6", sender: "agent", text: "Absolutely! I'll check the best availability for September and send over a full quote. Just to confirm — would you be flying from Manchester or another airport?", time: "10:47 AM", status: "delivered" },
  { id: "7", sender: "customer", text: "Hi, I wanted to ask about the Maldives package you mentioned?", time: "11:02 AM", status: "sent" },
];

function ConnectedView() {
  const [selectedConvo, setSelectedConvo] = useState("1");
  const [messageInput, setMessageInput] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [pageFilter, setPageFilter] = useState("all");
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const selectedConversation = demoConversations.find((c) => c.id === selectedConvo);
  const filteredConversations = demoConversations.filter(
    (c) => (pageFilter === "all" || c.pageLabel === pageFilter) &&
      (searchQuery === "" || c.name.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [selectedConvo]);

  return (
    <div className="flex h-full" data-testid="messenger-connected-view">
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
              <Button variant="ghost" size="icon" className="h-8 w-8 rounded-xl" data-testid="button-messenger-refresh">
                <RefreshCw className="w-4 h-4" />
              </Button>
              <Button variant="ghost" size="icon" className="h-8 w-8 rounded-xl" data-testid="button-messenger-settings">
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

          <div className="flex gap-1">
            {["all", "Apple Travel", "Apple Holidays"].map((page) => (
              <button
                key={page}
                onClick={() => setPageFilter(page)}
                className={`px-2.5 py-1 rounded-full text-[11px] font-medium transition-colors ${
                  pageFilter === page
                    ? "bg-blue-600 text-white"
                    : "bg-black/5 dark:bg-white/10 text-black/60 dark:text-white/60 hover:bg-black/10 dark:hover:bg-white/15"
                }`}
                data-testid={`filter-page-${page.replace(/\s/g, "-").toLowerCase()}`}
              >
                {page === "all" ? "All Pages" : page}
              </button>
            ))}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          {filteredConversations.map((convo) => (
            <div
              key={convo.id}
              onClick={() => setSelectedConvo(convo.id)}
              className={`flex items-start gap-3 px-4 py-3 cursor-pointer transition-colors border-b border-black/5 dark:border-white/5 ${
                selectedConvo === convo.id
                  ? "bg-blue-500/10 dark:bg-blue-500/15"
                  : "hover:bg-black/5 dark:hover:bg-white/5"
              }`}
              data-testid={`conversation-${convo.id}`}
            >
              <div className="relative flex-none">
                <div className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold ${
                  selectedConvo === convo.id
                    ? "bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-300"
                    : "bg-black/5 dark:bg-white/10 text-black/60 dark:text-white/60"
                }`}>
                  {convo.avatar}
                </div>
                {convo.online && (
                  <div className="absolute bottom-0 right-0 w-3 h-3 bg-emerald-500 rounded-full border-2 border-white dark:border-slate-900" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between mb-0.5">
                  <span className={`text-sm truncate ${convo.unread > 0 ? "font-bold" : "font-medium"}`}>
                    {convo.name}
                  </span>
                  <span className="text-[10px] text-black/40 dark:text-white/40 flex-none ml-2">{convo.time}</span>
                </div>
                <div className="flex items-center justify-between">
                  <p className={`text-xs truncate ${convo.unread > 0 ? "text-black/70 dark:text-white/70 font-medium" : "text-black/50 dark:text-white/50"}`}>
                    {convo.lastMessage}
                  </p>
                  {convo.unread > 0 && (
                    <span className="flex-none ml-2 w-5 h-5 rounded-full bg-blue-600 text-white text-[10px] font-bold flex items-center justify-center">
                      {convo.unread}
                    </span>
                  )}
                </div>
                <span className="text-[10px] text-black/35 dark:text-white/35 mt-0.5 block">{convo.pageLabel}</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="flex-1 flex flex-col min-w-0" data-testid="messenger-chat-panel">
        {selectedConversation ? (
          <>
            <div className="flex-none border-b border-black/10 dark:border-white/10 px-5 py-3 flex items-center justify-between bg-white/50 dark:bg-white/5">
              <div className="flex items-center gap-3">
                <div className="relative">
                  <div className="w-9 h-9 rounded-full bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-300 flex items-center justify-center text-sm font-bold">
                    {selectedConversation.avatar}
                  </div>
                  {selectedConversation.online && (
                    <div className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-emerald-500 rounded-full border-2 border-white dark:border-slate-900" />
                  )}
                </div>
                <div>
                  <h3 className="text-sm font-semibold" data-testid="text-chat-name">{selectedConversation.name}</h3>
                  <span className={`text-xs font-medium ${selectedConversation.online ? "text-emerald-600" : "text-black/40 dark:text-white/40"}`}>
                    {selectedConversation.online ? "Active now" : "Offline"}
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
              {demoMessages.map((msg) => (
                <div
                  key={msg.id}
                  className={`flex ${msg.sender === "agent" ? "justify-end" : "justify-start"}`}
                  data-testid={`message-${msg.id}`}
                >
                  <div className="max-w-[70%]">
                    <div
                      className={`px-4 py-2.5 rounded-2xl text-sm leading-relaxed ${
                        msg.sender === "agent"
                          ? "bg-blue-600 text-white rounded-br-md"
                          : "bg-white dark:bg-white/10 text-black dark:text-white border border-black/10 dark:border-white/10 rounded-bl-md shadow-sm"
                      }`}
                    >
                      {msg.text}
                    </div>
                    <div className={`flex items-center gap-1 mt-1 ${msg.sender === "agent" ? "justify-end" : ""}`}>
                      <span className="text-[10px] text-black/40 dark:text-white/40">{msg.time}</span>
                      {msg.sender === "agent" && (
                        msg.status === "read" ? (
                          <CheckCheck className="w-3 h-3 text-blue-400" />
                        ) : msg.status === "delivered" ? (
                          <CheckCheck className="w-3 h-3 text-black/30 dark:text-white/30" />
                        ) : (
                          <Check className="w-3 h-3 text-black/30 dark:text-white/30" />
                        )
                      )}
                    </div>
                  </div>
                </div>
              ))}
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
                    placeholder="Type a message..."
                    className="flex-1 bg-transparent text-sm outline-none"
                    data-testid="input-message"
                  />
                  <button className="p-1 text-black/40 dark:text-white/40 hover:text-black/60 dark:hover:text-white/60 transition-colors ml-1">
                    <Smile className="w-4 h-4" />
                  </button>
                </div>
                <Button size="icon" className="h-9 w-9 rounded-xl bg-blue-600 hover:bg-blue-700 text-white" data-testid="button-send">
                  <Send className="w-4 h-4" />
                </Button>
              </div>
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center">
              <MessageCircle className="w-12 h-12 text-black/20 dark:text-white/20 mx-auto mb-3" />
              <p className="text-sm text-black/50 dark:text-white/50 font-medium" data-testid="text-no-conversation">Select a conversation</p>
            </div>
          </div>
        )}
      </div>

      <div className="w-[260px] flex-none border-l border-black/10 dark:border-white/10 p-4 overflow-y-auto bg-white/50 dark:bg-white/5" data-testid="messenger-context-panel">
        {selectedConversation && (
          <div className="space-y-5">
            <div className="text-center">
              <div className="w-16 h-16 rounded-full bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-300 flex items-center justify-center text-xl font-bold mx-auto mb-2">
                {selectedConversation.avatar}
              </div>
              <h3 className="text-sm font-bold" data-testid="text-context-name">{selectedConversation.name}</h3>
              <p className="text-xs text-black/50 dark:text-white/50 mt-0.5">
                {selectedConversation.online ? "Active now" : "Last seen 2h ago"}
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

            <div className="space-y-2">
              <h4 className="text-[10px] uppercase tracking-wider font-semibold text-black/40 dark:text-white/40">Linked Client</h4>
              <Card className="rounded-xl p-3 bg-black/5 dark:bg-white/5 border-black/10 dark:border-white/10">
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-7 h-7 rounded-full bg-indigo-100 text-indigo-700 dark:bg-indigo-500/20 dark:text-indigo-300 flex items-center justify-center text-[10px] font-bold">
                    ST
                  </div>
                  <div>
                    <p className="text-xs font-semibold" data-testid="text-linked-client-name">Sarah Thompson</p>
                    <p className="text-[10px] text-black/50 dark:text-white/50">Client #2847</p>
                  </div>
                </div>
                <div className="space-y-1 text-[10px] text-black/50 dark:text-white/50">
                  <p>sarah.thompson@email.com</p>
                  <p>07412 345 678</p>
                </div>
              </Card>
            </div>

            <div className="space-y-2">
              <h4 className="text-[10px] uppercase tracking-wider font-semibold text-black/40 dark:text-white/40">Recent Quotes</h4>
              <Card className="rounded-xl p-2.5 bg-amber-500/10 border-amber-500/20">
                <p className="text-xs font-medium" data-testid="text-recent-quote">Maldives All-Inclusive</p>
                <div className="flex items-center justify-between mt-1">
                  <span className="text-[10px] text-amber-700 dark:text-amber-400 font-medium">£4,900 pp</span>
                  <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4 bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/20">
                    Pending
                  </Badge>
                </div>
              </Card>
            </div>

            <div className="space-y-2">
              <h4 className="text-[10px] uppercase tracking-wider font-semibold text-black/40 dark:text-white/40">Page Info</h4>
              <Card className="rounded-xl p-3 bg-black/5 dark:bg-white/5 border-black/10 dark:border-white/10">
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded bg-blue-600 flex items-center justify-center text-white">
                    <FacebookIcon className="w-3.5 h-3.5" />
                  </div>
                  <div>
                    <p className="text-xs font-semibold" data-testid="text-page-name">Apple Travel</p>
                    <p className="text-[10px] text-black/50 dark:text-white/50">Business Page</p>
                  </div>
                </div>
              </Card>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function SetupView({ onConnect }: { onConnect: () => void }) {
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
                <h3 className="text-sm font-semibold">Auto-Login & Token Refresh</h3>
                <p className="text-xs text-black/50 dark:text-white/50 mt-0.5">
                  Stay connected automatically. Your session refreshes in the background — no need to re-login every time.
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
                  Receive and reply to Messenger conversations instantly, linked to your CRM client profiles.
                </p>
              </div>
            </div>
          </div>

          <Separator className="bg-black/10 dark:bg-white/10" />

          <div className="p-6 bg-black/[0.02] dark:bg-white/[0.02]">
            <Button
              onClick={onConnect}
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

function AuthorizingView({ onComplete }: { onComplete: () => void }) {
  const [step, setStep] = useState(0);

  const steps = [
    "Connecting to Facebook...",
    "Authorizing Messenger access...",
    "Fetching your Pages...",
    "Syncing conversations...",
  ];

  useEffect(() => {
    let current = 0;
    const interval = setInterval(() => {
      current++;
      setStep(current);
      if (current >= steps.length) {
        clearInterval(interval);
        setTimeout(onComplete, 800);
      }
    }, 1200);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="flex-1 flex items-center justify-center" data-testid="messenger-authorizing-view">
      <div className="max-w-md w-full mx-4 text-center">
        <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center text-white mx-auto mb-6 shadow-lg shadow-blue-500/25 animate-pulse">
          <LogIn className="w-7 h-7" />
        </div>
        <h2 className="text-xl font-bold mb-2" data-testid="text-authorizing-title">Authorizing...</h2>
        <p className="text-sm text-black/50 dark:text-white/50 mb-8">Please wait while we connect your Facebook account</p>

        <Card className="glass ringed grain rounded-3xl p-6 text-left space-y-3">
          {steps.map((s, i) => (
            <div key={i} className="flex items-center gap-3">
              <div className={`w-6 h-6 rounded-full flex items-center justify-center flex-none transition-all ${
                i < step
                  ? "bg-emerald-500/15 text-emerald-600"
                  : i === step
                  ? "bg-blue-500/15 text-blue-600 animate-pulse"
                  : "bg-black/5 dark:bg-white/10 text-black/30 dark:text-white/30"
              }`}>
                {i < step ? <Check className="w-3.5 h-3.5" /> : <Circle className="w-3 h-3" />}
              </div>
              <span className={`text-sm ${
                i < step
                  ? "text-emerald-700 dark:text-emerald-400 font-medium"
                  : i === step
                  ? "text-blue-700 dark:text-blue-400 font-medium"
                  : "text-black/40 dark:text-white/40"
              }`}>
                {s}
              </span>
            </div>
          ))}
        </Card>

        <div className="mt-6">
          <div className="h-1.5 bg-black/5 dark:bg-white/10 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-blue-500 to-blue-600 rounded-full transition-all duration-1000"
              style={{ width: `${(step / steps.length) * 100}%` }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

export default function FacebookMessenger() {
  const [view, setView] = useState<View>("setup");

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
          {view === "connected" && (
            <Badge variant="outline" className="bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/20 gap-1.5">
              <Circle className="w-2 h-2 fill-emerald-500 text-emerald-500" />
              2 Pages Connected
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-2">
          {view === "connected" && (
            <Button
              variant="outline"
              size="sm"
              className="rounded-xl text-xs"
              onClick={() => setView("setup")}
              data-testid="button-disconnect"
            >
              Disconnect
            </Button>
          )}
        </div>
      </header>

      {view === "connected" && <ConnectedView />}
      {view === "setup" && <SetupView onConnect={() => setView("authorizing")} />}
      {view === "authorizing" && <AuthorizingView onComplete={() => setView("connected")} />}
    </section>
  );
}

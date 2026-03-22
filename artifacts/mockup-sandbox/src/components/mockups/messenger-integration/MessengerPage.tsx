import { useState } from "react";
import {
  MessageCircle,
  Search,
  Send,
  Paperclip,
  Image,
  Smile,
  MoreVertical,
  Phone,
  Video,
  Info,
  Check,
  CheckCheck,
  ChevronDown,
  Settings,
  RefreshCw,
  LogIn,
  Shield,
  Zap,
  ExternalLink,
  X,
  Circle,
} from "lucide-react";

const FacebookIcon = () => (
  <svg viewBox="0 0 24 24" className="w-5 h-5" fill="currentColor">
    <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
  </svg>
);

const MessengerIcon = () => (
  <svg viewBox="0 0 24 24" className="w-5 h-5" fill="currentColor">
    <path d="M12 0C5.373 0 0 4.974 0 11.111c0 3.498 1.744 6.614 4.469 8.654V24l4.088-2.242c1.092.301 2.246.464 3.443.464 6.627 0 12-4.974 12-11.111S18.627 0 12 0zm1.191 14.963l-3.055-3.26-5.963 3.26L10.732 8.2l3.131 3.259L19.752 8.2l-6.561 6.763z"/>
  </svg>
);

type View = "connected" | "setup" | "authorizing";

const conversations = [
  {
    id: "1",
    name: "Sarah Thompson",
    avatar: "ST",
    lastMessage: "Hi, I wanted to ask about the Maldives package you mentioned?",
    time: "2m ago",
    unread: 2,
    online: true,
    pageLabel: "Apple Travel",
  },
  {
    id: "2",
    name: "David & Emma Wilson",
    avatar: "DW",
    lastMessage: "That's perfect! Can you send over the full itinerary?",
    time: "15m ago",
    unread: 0,
    online: true,
    pageLabel: "Apple Travel",
  },
  {
    id: "3",
    name: "James Patterson",
    avatar: "JP",
    lastMessage: "We're interested in the Greece cruise for August",
    time: "1h ago",
    unread: 1,
    online: false,
    pageLabel: "Apple Travel",
  },
  {
    id: "4",
    name: "Linda McCarthy",
    avatar: "LM",
    lastMessage: "Thanks for sending the quote! We'll discuss tonight.",
    time: "3h ago",
    unread: 0,
    online: false,
    pageLabel: "Apple Holidays",
  },
  {
    id: "5",
    name: "Robert & Sarah Chen",
    avatar: "RC",
    lastMessage: "Is the early bird discount still available?",
    time: "5h ago",
    unread: 0,
    online: false,
    pageLabel: "Apple Travel",
  },
];

const messages = [
  {
    id: "1",
    sender: "customer",
    text: "Hi there! I saw your Maldives all-inclusive package on your page. Could you tell me more about it?",
    time: "10:23 AM",
    status: "read",
  },
  {
    id: "2",
    sender: "agent",
    text: "Hello Sarah! Great to hear from you 😊 The Maldives package is one of our most popular — it includes 7 nights at a 5-star water villa, all meals, return flights from Manchester, and a sunset dolphin cruise.",
    time: "10:25 AM",
    status: "read",
  },
  {
    id: "3",
    sender: "customer",
    text: "That sounds amazing! What dates are available and how much is it per person?",
    time: "10:28 AM",
    status: "read",
  },
  {
    id: "4",
    sender: "agent",
    text: "We have availability in June and September. The price starts from £2,450 per person based on 2 sharing. If you book before the end of this month, there's a £200 early bird discount per person!",
    time: "10:31 AM",
    status: "read",
  },
  {
    id: "5",
    sender: "customer",
    text: "Oh wow, that's a great deal. My husband and I were looking at September. Can you check exact dates for us?",
    time: "10:45 AM",
    status: "read",
  },
  {
    id: "6",
    sender: "agent",
    text: "Absolutely! I'll check the best availability for September and send over a full quote. Just to confirm — would you be flying from Manchester or another airport?",
    time: "10:47 AM",
    status: "delivered",
  },
  {
    id: "7",
    sender: "customer",
    text: "Hi, I wanted to ask about the Maldives package you mentioned?",
    time: "11:02 AM",
    status: "sent",
  },
];

function ConnectedView() {
  const [selectedConvo, setSelectedConvo] = useState("1");
  const [messageInput, setMessageInput] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [pageFilter, setPageFilter] = useState("all");

  const selectedConversation = conversations.find((c) => c.id === selectedConvo);

  return (
    <div className="flex h-full">
      <div className="w-[340px] flex-none bg-white border-r border-slate-200 flex flex-col">
        <div className="p-4 border-b border-slate-100 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center text-white">
                <MessengerIcon />
              </div>
              <div>
                <h2 className="text-sm font-bold text-slate-900">Messenger</h2>
                <div className="flex items-center gap-1">
                  <Circle className="w-2 h-2 fill-emerald-500 text-emerald-500" />
                  <span className="text-[10px] text-emerald-600 font-medium">Connected</span>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-1">
              <button className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors">
                <RefreshCw className="w-4 h-4" />
              </button>
              <button className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors">
                <Settings className="w-4 h-4" />
              </button>
            </div>
          </div>

          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search conversations..."
              className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
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
                    : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                }`}
              >
                {page === "all" ? "All Pages" : page}
              </button>
            ))}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          {conversations
            .filter((c) => pageFilter === "all" || c.pageLabel === pageFilter)
            .map((convo) => (
              <div
                key={convo.id}
                onClick={() => setSelectedConvo(convo.id)}
                className={`flex items-start gap-3 px-4 py-3 cursor-pointer transition-colors border-b border-slate-50 ${
                  selectedConvo === convo.id ? "bg-blue-50/70" : "hover:bg-slate-50"
                }`}
              >
                <div className="relative flex-none">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold ${
                    selectedConvo === convo.id ? "bg-blue-100 text-blue-700" : "bg-slate-100 text-slate-600"
                  }`}>
                    {convo.avatar}
                  </div>
                  {convo.online && (
                    <div className="absolute bottom-0 right-0 w-3 h-3 bg-emerald-500 rounded-full border-2 border-white" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-0.5">
                    <span className={`text-sm truncate ${convo.unread > 0 ? "font-bold text-slate-900" : "font-medium text-slate-800"}`}>
                      {convo.name}
                    </span>
                    <span className="text-[10px] text-slate-400 flex-none ml-2">{convo.time}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <p className={`text-xs truncate ${convo.unread > 0 ? "text-slate-700 font-medium" : "text-slate-500"}`}>
                      {convo.lastMessage}
                    </p>
                    {convo.unread > 0 && (
                      <span className="flex-none ml-2 w-5 h-5 rounded-full bg-blue-600 text-white text-[10px] font-bold flex items-center justify-center">
                        {convo.unread}
                      </span>
                    )}
                  </div>
                  <span className="text-[10px] text-slate-400 mt-0.5 block">{convo.pageLabel}</span>
                </div>
              </div>
            ))}
        </div>
      </div>

      <div className="flex-1 flex flex-col bg-slate-50">
        {selectedConversation ? (
          <>
            <div className="flex-none bg-white border-b border-slate-200 px-5 py-3 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="relative">
                  <div className="w-9 h-9 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center text-sm font-bold">
                    {selectedConversation.avatar}
                  </div>
                  {selectedConversation.online && (
                    <div className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-emerald-500 rounded-full border-2 border-white" />
                  )}
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-slate-900">{selectedConversation.name}</h3>
                  <span className="text-xs text-emerald-600 font-medium">
                    {selectedConversation.online ? "Active now" : "Offline"}
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-1">
                <button className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors">
                  <Phone className="w-4 h-4" />
                </button>
                <button className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors">
                  <Video className="w-4 h-4" />
                </button>
                <button className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors">
                  <Info className="w-4 h-4" />
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3">
              {messages.map((msg) => (
                <div
                  key={msg.id}
                  className={`flex ${msg.sender === "agent" ? "justify-end" : "justify-start"}`}
                >
                  <div className={`max-w-[70%] ${msg.sender === "agent" ? "order-1" : ""}`}>
                    <div
                      className={`px-4 py-2.5 rounded-2xl text-sm leading-relaxed ${
                        msg.sender === "agent"
                          ? "bg-blue-600 text-white rounded-br-md"
                          : "bg-white text-slate-800 border border-slate-200 rounded-bl-md shadow-sm"
                      }`}
                    >
                      {msg.text}
                    </div>
                    <div className={`flex items-center gap-1 mt-1 ${msg.sender === "agent" ? "justify-end" : ""}`}>
                      <span className="text-[10px] text-slate-400">{msg.time}</span>
                      {msg.sender === "agent" && (
                        msg.status === "read" ? (
                          <CheckCheck className="w-3 h-3 text-blue-400" />
                        ) : msg.status === "delivered" ? (
                          <CheckCheck className="w-3 h-3 text-slate-400" />
                        ) : (
                          <Check className="w-3 h-3 text-slate-400" />
                        )
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className="flex-none bg-white border-t border-slate-200 p-3">
              <div className="flex items-end gap-2">
                <div className="flex gap-1 pb-1">
                  <button className="p-2 text-slate-400 hover:text-blue-600 rounded-lg transition-colors">
                    <Paperclip className="w-4 h-4" />
                  </button>
                  <button className="p-2 text-slate-400 hover:text-blue-600 rounded-lg transition-colors">
                    <Image className="w-4 h-4" />
                  </button>
                </div>
                <div className="flex-1 flex items-end bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 focus-within:ring-2 focus-within:ring-blue-500/20 focus-within:border-blue-500">
                  <textarea
                    value={messageInput}
                    onChange={(e) => setMessageInput(e.target.value)}
                    placeholder="Type a message..."
                    className="flex-1 bg-transparent text-sm resize-none outline-none min-h-[24px] max-h-[100px]"
                    rows={1}
                  />
                  <button className="p-1 text-slate-400 hover:text-slate-600 transition-colors ml-1">
                    <Smile className="w-4 h-4" />
                  </button>
                </div>
                <button className="p-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl transition-colors">
                  <Send className="w-4 h-4" />
                </button>
              </div>
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center">
              <MessageCircle className="w-12 h-12 text-slate-300 mx-auto mb-3" />
              <p className="text-sm text-slate-500 font-medium">Select a conversation</p>
            </div>
          </div>
        )}
      </div>

      <div className="w-[260px] flex-none bg-white border-l border-slate-200 p-4 overflow-y-auto">
        {selectedConversation && (
          <div className="space-y-5">
            <div className="text-center">
              <div className="w-16 h-16 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center text-xl font-bold mx-auto mb-2">
                {selectedConversation.avatar}
              </div>
              <h3 className="text-sm font-bold text-slate-900">{selectedConversation.name}</h3>
              <p className="text-xs text-slate-500 mt-0.5">{selectedConversation.online ? "Active now" : "Last seen 2h ago"}</p>
            </div>

            <div className="space-y-2">
              <h4 className="text-[10px] uppercase tracking-wider font-semibold text-slate-400">Quick Actions</h4>
              <button className="w-full flex items-center gap-2 px-3 py-2 bg-emerald-50 text-emerald-700 rounded-lg text-xs font-medium hover:bg-emerald-100 transition-colors border border-emerald-200">
                <Zap className="w-3.5 h-3.5" />
                Create Quote from Chat
              </button>
              <button className="w-full flex items-center gap-2 px-3 py-2 bg-blue-50 text-blue-700 rounded-lg text-xs font-medium hover:bg-blue-100 transition-colors border border-blue-200">
                <ExternalLink className="w-3.5 h-3.5" />
                View Client Profile
              </button>
            </div>

            <div className="space-y-2">
              <h4 className="text-[10px] uppercase tracking-wider font-semibold text-slate-400">Linked Client</h4>
              <div className="bg-slate-50 rounded-lg p-3 border border-slate-200">
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-7 h-7 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center text-[10px] font-bold">ST</div>
                  <div>
                    <p className="text-xs font-semibold text-slate-800">Sarah Thompson</p>
                    <p className="text-[10px] text-slate-500">Client #2847</p>
                  </div>
                </div>
                <div className="space-y-1 text-[10px] text-slate-500">
                  <p>sarah.thompson@email.com</p>
                  <p>07412 345 678</p>
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <h4 className="text-[10px] uppercase tracking-wider font-semibold text-slate-400">Recent Quotes</h4>
              <div className="space-y-1.5">
                <div className="bg-amber-50 rounded-lg p-2.5 border border-amber-200">
                  <p className="text-xs font-medium text-slate-800">Maldives All-Inclusive</p>
                  <div className="flex items-center justify-between mt-1">
                    <span className="text-[10px] text-amber-700 font-medium">£4,900 pp</span>
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-100 text-amber-700 font-medium">Pending</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <h4 className="text-[10px] uppercase tracking-wider font-semibold text-slate-400">Page Info</h4>
              <div className="bg-slate-50 rounded-lg p-3 border border-slate-200">
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded bg-blue-600 flex items-center justify-center text-white">
                    <FacebookIcon />
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-slate-800">Apple Travel</p>
                    <p className="text-[10px] text-slate-500">Business Page</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function SetupView({ onConnect }: { onConnect: () => void }) {
  return (
    <div className="flex-1 flex items-center justify-center bg-gradient-to-br from-slate-50 to-blue-50/30">
      <div className="max-w-lg w-full mx-4">
        <div className="text-center mb-8">
          <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center text-white mx-auto mb-4 shadow-lg shadow-blue-500/25">
            <MessengerIcon />
          </div>
          <h1 className="text-2xl font-bold text-slate-900 mb-2">Connect Facebook Messenger</h1>
          <p className="text-sm text-slate-500 max-w-sm mx-auto">
            Reply to customer messages directly from your command centre. Connect your Facebook Business Page to get started.
          </p>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="p-6 space-y-5">
            <div className="flex items-start gap-4">
              <div className="w-10 h-10 rounded-lg bg-blue-50 flex items-center justify-center flex-none">
                <Shield className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-slate-900">Secure OAuth Authorization</h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Sign in with your Facebook account to authorize access. We only request messaging permissions — we never post on your behalf.
                </p>
              </div>
            </div>

            <div className="flex items-start gap-4">
              <div className="w-10 h-10 rounded-lg bg-emerald-50 flex items-center justify-center flex-none">
                <RefreshCw className="w-5 h-5 text-emerald-600" />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-slate-900">Auto-Login & Token Refresh</h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Stay connected automatically. Your session refreshes in the background — no need to re-login every time.
                </p>
              </div>
            </div>

            <div className="flex items-start gap-4">
              <div className="w-10 h-10 rounded-lg bg-violet-50 flex items-center justify-center flex-none">
                <Zap className="w-5 h-5 text-violet-600" />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-slate-900">Real-Time Messages</h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Receive and reply to Messenger conversations instantly, linked to your CRM client profiles.
                </p>
              </div>
            </div>
          </div>

          <div className="border-t border-slate-100 p-6 bg-slate-50/50">
            <button
              onClick={onConnect}
              className="w-full flex items-center justify-center gap-2.5 bg-[#1877F2] hover:bg-[#166FE5] text-white px-6 py-3 rounded-xl font-semibold text-sm transition-all shadow-md shadow-blue-500/20 hover:shadow-lg hover:shadow-blue-500/30"
            >
              <FacebookIcon />
              Continue with Facebook
            </button>
            <p className="text-[10px] text-slate-400 text-center mt-3">
              By connecting, you agree to allow access to your Page's Messenger conversations.
            </p>
          </div>
        </div>

        <div className="flex items-center justify-center gap-4 mt-6 text-xs text-slate-400">
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
    { label: "Connecting to Facebook...", done: false },
    { label: "Authorizing Messenger access...", done: false },
    { label: "Fetching your Pages...", done: false },
    { label: "Syncing conversations...", done: false },
  ];

  useState(() => {
    let current = 0;
    const interval = setInterval(() => {
      current++;
      setStep(current);
      if (current >= steps.length) {
        clearInterval(interval);
        setTimeout(onComplete, 800);
      }
    }, 1200);
  });

  return (
    <div className="flex-1 flex items-center justify-center bg-gradient-to-br from-slate-50 to-blue-50/30">
      <div className="max-w-md w-full mx-4 text-center">
        <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center text-white mx-auto mb-6 shadow-lg shadow-blue-500/25 animate-pulse">
          <LogIn className="w-7 h-7" />
        </div>
        <h2 className="text-xl font-bold text-slate-900 mb-2">Authorizing...</h2>
        <p className="text-sm text-slate-500 mb-8">Please wait while we connect your Facebook account</p>

        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 text-left space-y-3">
          {steps.map((s, i) => (
            <div key={i} className="flex items-center gap-3">
              <div className={`w-6 h-6 rounded-full flex items-center justify-center flex-none transition-all ${
                i < step ? "bg-emerald-100 text-emerald-600" : i === step ? "bg-blue-100 text-blue-600 animate-pulse" : "bg-slate-100 text-slate-400"
              }`}>
                {i < step ? <Check className="w-3.5 h-3.5" /> : <Circle className="w-3 h-3" />}
              </div>
              <span className={`text-sm ${i < step ? "text-emerald-700 font-medium" : i === step ? "text-blue-700 font-medium" : "text-slate-400"}`}>
                {s.label}
              </span>
            </div>
          ))}
        </div>

        <div className="mt-6">
          <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
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

export function MessengerPage() {
  const [view, setView] = useState<View>("connected");
  const [showSetupDemo, setShowSetupDemo] = useState(false);

  return (
    <div className="flex flex-col h-screen min-h-screen bg-slate-50 text-slate-800 font-['Inter',system-ui,sans-serif]">
      <header className="flex-none bg-white border-b border-slate-200 px-6 py-3 flex items-center justify-between z-10">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center text-white shadow-sm">
              <MessengerIcon />
            </div>
            <h1 className="text-lg font-bold text-slate-900">Messenger</h1>
          </div>
          {view === "connected" && (
            <div className="flex items-center gap-1.5 px-2.5 py-1 bg-emerald-50 border border-emerald-200 rounded-full">
              <Circle className="w-2 h-2 fill-emerald-500 text-emerald-500" />
              <span className="text-[10px] text-emerald-700 font-semibold">2 Pages Connected</span>
            </div>
          )}
        </div>
        <div className="flex items-center gap-2">
          {view === "connected" && (
            <button
              onClick={() => setView("setup")}
              className="text-xs text-slate-500 hover:text-slate-700 px-3 py-1.5 rounded-lg hover:bg-slate-100 transition-colors"
            >
              Demo: Setup View
            </button>
          )}
          {view === "setup" && (
            <button
              onClick={() => setView("connected")}
              className="text-xs text-slate-500 hover:text-slate-700 px-3 py-1.5 rounded-lg hover:bg-slate-100 transition-colors"
            >
              Demo: Connected View
            </button>
          )}
        </div>
      </header>

      {view === "connected" && <ConnectedView />}
      {view === "setup" && (
        <SetupView onConnect={() => setView("authorizing")} />
      )}
      {view === "authorizing" && (
        <AuthorizingView onComplete={() => setView("connected")} />
      )}
    </div>
  );
}

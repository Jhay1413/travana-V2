import { useState } from "react";
import { FileText, MessageSquare, Plus, X } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import ChatRichInput from "@/features/chat/components/chat-rich-input";
import {
  useChatConversations,
  useChatMessages,
  useCurrentUser,
  useUsers,
} from "@/hooks/queries";
import {
  useMarkChatRead,
  useSendMessage,
  useSendMessageWithFile,
  useStartDirectChat,
} from "@/hooks/mutations";

export default function ChatPage() {
  const { data: currentUser } = useCurrentUser();
  const { data: apiUsers } = useUsers();
  const { data: chatConversations } = useChatConversations();

  const [chatSelectedConversation, setChatSelectedConversation] = useState<string | null>(null);
  const { data: chatMessages } = useChatMessages(chatSelectedConversation || "");

  const sendMessageMutation = useSendMessage();
  const sendMessageWithFileMutation = useSendMessageWithFile();
  const startDirectChatMutation = useStartDirectChat();
  const markChatReadMutation = useMarkChatRead();

  const currentUserId = currentUser?.id;

  return (
    <section
      className="grid gap-4 lg:grid-cols-[320px_1fr] h-[60vh] lg:h-[calc(100vh-12rem)]"
      data-testid="section-live-chat"
    >
      <Card className="glass ringed grain flex flex-col rounded-3xl p-0 overflow-hidden">
        <div className="flex items-center justify-between border-b border-black/10 px-4 py-3 dark:border-white/10">
          <div className="space-y-0.5">
            <div className="text-sm font-semibold" data-testid="text-chat-title">Conversations</div>
            <div className="text-xs text-muted-foreground">{(chatConversations || []).length} chats</div>
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                className="rounded-xl border-black/10 bg-black/5 dark:border-white/10 dark:bg-white/5"
                data-testid="button-new-chat"
              >
                <Plus className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56 rounded-2xl">
              <DropdownMenuLabel className="text-xs text-muted-foreground">Start new chat with</DropdownMenuLabel>
              <DropdownMenuSeparator />
              {(apiUsers || []).filter((u: any) => u.id !== currentUserId).map((u: any) => (
                <DropdownMenuItem
                  key={u.id}
                  onClick={() => {
                    startDirectChatMutation.mutate(u.id, {
                      onSuccess: (data) => setChatSelectedConversation(data.conversationId),
                    });
                  }}
                  className="rounded-xl"
                  data-testid={`chat-user-${u.id}`}
                >
                  <div className="flex items-center gap-2">
                    <div className="flex h-7 w-7 items-center justify-center rounded-full bg-[#3b82f6]/10 text-[#3b82f6] text-xs font-semibold">
                      {(u.name || "?").charAt(0).toUpperCase()}
                    </div>
                    <span className="text-sm">{u.name}</span>
                  </div>
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        <div className="flex-1 overflow-y-auto" data-testid="chat-conversation-list">
          {(chatConversations || []).length === 0 ? (
            <div className="flex flex-col items-center justify-center p-8 text-center">
              <MessageSquare className="h-10 w-10 text-black/20 dark:text-white/20 mb-3" />
              <div className="text-sm font-medium text-black/50 dark:text-white/50">No conversations yet</div>
              <div className="text-xs text-black/40 dark:text-white/40 mt-1">Start a new chat with a team member</div>
            </div>
          ) : (
            (chatConversations || []).map((conv: any) => {
              const isPortalConv = !!conv.portalClientId;
              const otherParticipants = (conv.participants || []).filter((p: any) => p.userId !== currentUserId);
              const displayName = isPortalConv
                ? (conv.portalClientName || "Portal Client")
                : conv.type === "group" ? (conv.name || "Group Chat") : (otherParticipants[0]?.userName || "Unknown");
              const initials = displayName.split(" ").map((w: string) => w[0]).join("").substring(0, 2).toUpperCase();
              const isSelected = chatSelectedConversation === conv.id;
              const lastMsg = conv.lastMessage;
              return (
                <button
                  key={conv.id}
                  onClick={() => {
                    setChatSelectedConversation(conv.id);
                    markChatReadMutation.mutate(conv.id);
                  }}
                  className={`flex w-full items-center gap-3 border-b border-black/5 px-4 py-3 text-left transition dark:border-white/5 ${
                    isSelected ? "bg-[#3b82f6]/5 dark:bg-[#3b82f6]/10" : "hover:bg-black/3 dark:hover:bg-white/3"
                  }`}
                  data-testid={`chat-conv-${conv.id}`}
                >
                  <div
                    className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-sm font-semibold ${
                      isPortalConv
                        ? (isSelected ? "bg-emerald-500 text-white" : "bg-emerald-500/10 text-emerald-600 dark:bg-emerald-500/20 dark:text-emerald-400")
                        : (isSelected ? "bg-[#3b82f6] text-white" : "bg-black/10 text-black/60 dark:bg-white/10 dark:text-white/60")
                    }`}
                  >
                    {initials}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between">
                      <span className="truncate text-sm font-medium flex items-center gap-1.5">
                        {displayName}
                        {isPortalConv && (
                          <span className="inline-flex items-center rounded-full bg-emerald-500/10 px-1.5 py-0.5 text-[9px] font-semibold text-emerald-600 dark:text-emerald-400">
                            PORTAL
                          </span>
                        )}
                      </span>
                      {lastMsg && (
                        <span className="shrink-0 text-[10px] text-black/40 dark:text-white/40">
                          {new Date(lastMsg.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="truncate text-xs text-black/50 dark:text-white/50">
                        {lastMsg ? lastMsg.content.replace(/<[^>]*>/g, "") : "No messages yet"}
                      </span>
                      {(conv.unreadCount || 0) > 0 && (
                        <span
                          className="ml-2 inline-flex h-5 min-w-[20px] shrink-0 items-center justify-center rounded-full bg-[#3b82f6] px-1.5 text-[10px] font-bold text-white"
                          data-testid={`chat-unread-${conv.id}`}
                        >
                          {conv.unreadCount}
                        </span>
                      )}
                    </div>
                  </div>
                </button>
              );
            })
          )}
        </div>
      </Card>

      <Card className="glass ringed grain flex flex-col rounded-3xl p-0 overflow-hidden">
        {!chatSelectedConversation ? (
          <div className="flex flex-1 flex-col items-center justify-center p-8 text-center">
            <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-3xl bg-[#3b82f6]/10">
              <MessageSquare className="h-8 w-8 text-[#3b82f6]" />
            </div>
            <div className="text-lg font-semibold" data-testid="text-chat-empty">Live Chat</div>
            <div className="mt-1 text-sm text-muted-foreground">Select a conversation or start a new one</div>
          </div>
        ) : (
          <>
            {(() => {
              const conv = (chatConversations || []).find((c: any) => c.id === chatSelectedConversation);
              const isPortalConvHeader = !!conv?.portalClientId;
              const otherParticipants = (conv?.participants || []).filter((p: any) => p.userId !== currentUserId);
              const displayName = isPortalConvHeader
                ? (conv?.portalClientName || "Portal Client")
                : conv?.type === "group" ? (conv.name || "Group Chat") : (otherParticipants[0]?.userName || "Unknown");
              const subtitle = isPortalConvHeader
                ? "Portal Client Chat"
                : conv?.type === "group" ? `${(conv.participants || []).length} members` : "Direct message";
              return (
                <div className="flex items-center gap-3 border-b border-black/10 px-4 py-3 dark:border-white/10">
                  <div
                    className={`flex h-9 w-9 items-center justify-center rounded-full text-sm font-semibold text-white ${
                      isPortalConvHeader ? "bg-emerald-500" : "bg-[#3b82f6]"
                    }`}
                  >
                    {displayName.split(" ").map((w: string) => w[0]).join("").substring(0, 2).toUpperCase()}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-semibold truncate flex items-center gap-1.5" data-testid="text-chat-header-name">
                      {displayName}
                      {isPortalConvHeader && (
                        <span className="inline-flex items-center rounded-full bg-emerald-500/10 px-1.5 py-0.5 text-[9px] font-semibold text-emerald-600 dark:text-emerald-400">
                          PORTAL
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-muted-foreground">{subtitle}</div>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setChatSelectedConversation(null)}
                    className="rounded-xl"
                    data-testid="button-close-chat"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              );
            })()}

            <div className="flex-1 overflow-y-auto p-4 space-y-3" data-testid="chat-messages-area">
              {(chatMessages || []).length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-center">
                  <div className="text-sm text-black/40 dark:text-white/40">No messages yet. Say hello!</div>
                </div>
              ) : (
                (chatMessages || []).map((msg: any) => {
                  const isOwn = msg.senderId === currentUserId;
                  const isPortalMsg = typeof msg.senderId === "string" && msg.senderId.startsWith("portal-client:");
                  const selectedConv = (chatConversations || []).find((c: any) => c.id === chatSelectedConversation);
                  const portalClientDisplayName = selectedConv?.portalClientName || "Portal Client";
                  const isImage = msg.fileType?.startsWith("image/");
                  return (
                    <div
                      key={msg.id}
                      className={`flex ${isOwn ? "justify-end" : "justify-start"}`}
                      data-testid={`chat-msg-${msg.id}`}
                    >
                      <div
                        className={`max-w-[70%] rounded-2xl px-4 py-2.5 ${
                          isOwn
                            ? "bg-[#3b82f6] text-white"
                            : isPortalMsg
                              ? "bg-emerald-500/10 text-black dark:text-white border border-emerald-500/20"
                              : "bg-black/5 text-black dark:bg-white/10 dark:text-white"
                        }`}
                      >
                        {!isOwn && (
                          <div
                            className={`mb-0.5 text-[11px] font-semibold ${
                              isPortalMsg ? "text-emerald-600 dark:text-emerald-400" : "text-[#3b82f6]"
                            }`}
                          >
                            {isPortalMsg ? portalClientDisplayName : (msg.senderName || "Unknown")}
                          </div>
                        )}
                        {msg.fileUrl && (
                          <div className="mb-1.5">
                            {isImage ? (
                              <a href={msg.fileUrl} target="_blank" rel="noopener noreferrer">
                                <img
                                  src={msg.fileUrl}
                                  alt={msg.fileName || "image"}
                                  className="max-w-full rounded-lg max-h-[200px] object-cover"
                                  data-testid={`chat-img-${msg.id}`}
                                />
                              </a>
                            ) : (
                              <a
                                href={msg.fileUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className={`flex items-center gap-2 rounded-lg px-3 py-2 text-xs ${
                                  isOwn
                                    ? "bg-white/10 hover:bg-white/20"
                                    : "bg-black/5 hover:bg-black/10 dark:bg-white/5 dark:hover:bg-white/10"
                                }`}
                                data-testid={`chat-file-${msg.id}`}
                              >
                                <FileText className="h-4 w-4 shrink-0" />
                                <span className="truncate">{msg.fileName}</span>
                                {msg.fileSize && (
                                  <span className="shrink-0 opacity-60">
                                    {msg.fileSize < 1024 * 1024
                                      ? `${(msg.fileSize / 1024).toFixed(0)} KB`
                                      : `${(msg.fileSize / (1024 * 1024)).toFixed(1)} MB`}
                                  </span>
                                )}
                              </a>
                            )}
                          </div>
                        )}
                        {msg.content && msg.content !== "<p></p>" && (
                          <div
                            className="text-sm break-words chat-message-content"
                            dangerouslySetInnerHTML={{ __html: msg.content }}
                          />
                        )}
                        <div className={`mt-1 text-[10px] ${isOwn ? "text-white/60" : "text-black/40 dark:text-white/40"}`}>
                          {new Date(msg.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            <ChatRichInput
              onSend={(content) => {
                if (!chatSelectedConversation) return;
                sendMessageMutation.mutate({ conversationId: chatSelectedConversation, content });
              }}
              onSendWithFile={(content, file) => {
                if (!chatSelectedConversation) return;
                sendMessageWithFileMutation.mutate({ conversationId: chatSelectedConversation, content, file });
              }}
              disabled={sendMessageMutation.isPending || sendMessageWithFileMutation.isPending}
            />
          </>
        )}
      </Card>
    </section>
  );
}

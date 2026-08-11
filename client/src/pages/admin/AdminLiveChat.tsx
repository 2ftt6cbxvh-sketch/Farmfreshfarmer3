import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { MessageSquare, UserCheck, CheckCircle2, Send, Clock, ShieldAlert, Sparkles, RefreshCw, XCircle, Crown, Star } from "lucide-react";
import { AdminLayout } from "./AdminLayout";
import { apiRequest, apiGet, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { useAuth } from "@/lib/store";

interface LiveSession {
  id: number;
  sessionToken: string;
  userId?: number | null;
  language: string;
  status: "bot" | "waiting_for_agent" | "agent_connected" | "closed";
  assignedAgentId?: number | null;
  assignedAgentName?: string | null;
  lastActivityAt: string;
  createdAt: string;
  lastMessage?: string;
  lastMessageSender?: string;
}

interface ChatMessage {
  id: string;
  sender: "customer" | "support" | "bot" | "system";
  senderName?: string | null;
  message: string;
  createdAt: string;
  senderMeta?: {
    isPrimaryAdmin?: boolean;
    isVerified?: boolean;
    starRating?: number;
    experienceRank?: string;
    role?: string;
    customTitle?: string;
  } | null;
}

interface MissedQuery {
  id: number;
  sessionToken: string;
  query: string;
  language: string;
  resolved: boolean;
  createdAt: string;
}

const QUICK_REPLIES = [
  "Hello! I am here to help you. What can I assist you with today?",
  "Your order is currently being packed and will be delivered in 30-45 minutes.",
  "I have verified your request and initiated a full refund for your item.",
  "Thank you for reaching out to FarmFreshFarmer! Have a wonderful day.",
];

export function AdminLiveChat() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [selectedToken, setSelectedToken] = useState<string | null>(null);
  const [replyInput, setReplyInput] = useState("");
  const [activeTab, setActiveTab] = useState("waiting");
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Poll live sessions every 3 seconds
  const { data: sessionsData, isLoading: loadingSessions, refetch: refetchSessions } = useQuery<{ sessions: LiveSession[] }>({
    queryKey: ["/api/admin/chatbot/live-sessions"],
    queryFn: () => apiGet<{ sessions: LiveSession[] }>("/api/admin/chatbot/live-sessions"),
    refetchInterval: 3000,
  });

  const sessions = sessionsData?.sessions || [];
  const waitingSessions = sessions.filter((s) => s.status === "waiting_for_agent");
  const activeSessions = sessions.filter((s) => s.status === "agent_connected");

  // Poll messages for selected session every 2 seconds
  const { data: messagesData, refetch: refetchMessages } = useQuery<{ session: LiveSession; messages: ChatMessage[] }>({
    queryKey: ["/api/admin/chatbot/messages", selectedToken],
    queryFn: () => apiGet<{ session: LiveSession; messages: ChatMessage[] }>(`/api/admin/chatbot/messages/${selectedToken}`),
    enabled: !!selectedToken,
    refetchInterval: 2000,
  });

  // Fetch missed queries
  const { data: missedData, refetch: refetchMissed } = useQuery<{ queries: MissedQuery[] }>({
    queryKey: ["/api/admin/chatbot/missed"],
    queryFn: () => apiGet<{ queries: MissedQuery[] }>("/api/admin/chatbot/missed"),
  });

  const currentSession = messagesData?.session || sessions.find((s) => s.sessionToken === selectedToken);
  const messages = messagesData?.messages || [];

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Claim session mutation ("I am Available / Take Over Chat")
  const claimMutation = useMutation({
    mutationFn: async (sessionToken: string) => {
      return apiRequest("POST", "/api/admin/chatbot/claim-session", { sessionToken });
    },
    onSuccess: (_, sessionToken) => {
      toast({ title: "🟢 Chat Claimed!", description: "You have taken over this live chat. Customer is notified." });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/chatbot/live-sessions"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/chatbot/messages", sessionToken] });
      refetchSessions();
      refetchMessages();
    },
    onError: (err: any) => {
      toast({ title: "Claim Error", description: err?.message || "Failed to claim session", variant: "destructive" });
    },
  });

  // Send reply mutation
  const sendMutation = useMutation({
    mutationFn: async ({ sessionToken, message }: { sessionToken: string; message: string }) => {
      return apiRequest("POST", "/api/admin/chatbot/send-message", { sessionToken, message });
    },
    onSuccess: () => {
      setReplyInput("");
      refetchMessages();
      refetchSessions();
    },
    onError: (err: any) => {
      toast({ title: "Send Error", description: err?.message || "Failed to send message", variant: "destructive" });
    },
  });

  // Close session mutation
  const closeMutation = useMutation({
    mutationFn: async (sessionToken: string) => {
      return apiRequest("POST", "/api/admin/chatbot/close-session", { sessionToken });
    },
    onSuccess: () => {
      toast({ title: "🏁 Session Closed", description: "Chat support session closed successfully." });
      setSelectedToken(null);
      refetchSessions();
    },
  });

  const handleSend = () => {
    if (!selectedToken || !replyInput.trim()) return;
    sendMutation.mutate({ sessionToken: selectedToken, message: replyInput.trim() });
  };

  return (
    <AdminLayout>
      <div className="space-y-4">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-card-border pb-4">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-black tracking-tight text-foreground flex items-center gap-2">
                💬 Live Support & Escalation Console
              </h1>
              {waitingSessions.length > 0 && (
                <Badge variant="destructive" className="animate-pulse px-2 py-0.5 text-xs font-bold">
                  {waitingSessions.length} Waiting
                </Badge>
              )}
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">
              Live customer support takeover for Admins, Sub-Admins, Grievance Officers & Customer Representatives.
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={() => { refetchSessions(); refetchMissed(); }} className="gap-2 self-start">
            <RefreshCw size={14} className={loadingSessions ? "animate-spin" : ""} /> Refresh Queue
          </Button>
        </div>

        {/* Main Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 h-[calc(100vh-220px)] min-h-[560px]">
          {/* Left Sidebar: Session List (4 cols) */}
          <div className="lg:col-span-4 flex flex-col rounded-xl border border-card-border bg-card shadow-sm overflow-hidden">
            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full flex-1 flex flex-col">
              <div className="p-3 border-b border-card-border bg-muted/20">
                <TabsList className="grid grid-cols-3 w-full">
                  <TabsTrigger value="waiting" className="text-xs relative">
                    Waiting
                    {waitingSessions.length > 0 && (
                      <span className="ml-1 px-1.5 py-0.2 bg-red-500 text-white rounded-full text-[10px] font-bold">
                        {waitingSessions.length}
                      </span>
                    )}
                  </TabsTrigger>
                  <TabsTrigger value="active" className="text-xs">
                    Active ({activeSessions.length})
                  </TabsTrigger>
                  <TabsTrigger value="missed" className="text-xs">
                    Missed ({missedData?.queries?.length || 0})
                  </TabsTrigger>
                </TabsList>
              </div>

              {/* Waiting Sessions List */}
              <TabsContent value="waiting" className="flex-1 overflow-y-auto p-2 space-y-2 m-0">
                {waitingSessions.length === 0 ? (
                  <div className="p-6 text-center text-muted-foreground text-xs">
                    <CheckCircle2 size={32} className="mx-auto text-emerald-500 mb-2 opacity-70" />
                    No customers waiting right now! All chats resolved.
                  </div>
                ) : (
                  waitingSessions.map((s) => (
                    <div
                      key={s.sessionToken}
                      onClick={() => setSelectedToken(s.sessionToken)}
                      className={`p-3 rounded-lg border cursor-pointer transition ${
                        selectedToken === s.sessionToken
                          ? "border-emerald-500 bg-emerald-50/50 dark:bg-emerald-950/20"
                          : "border-card-border hover:bg-muted/40"
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-mono text-xs font-bold truncate max-w-[130px]">
                          {s.sessionToken.substring(0, 14)}...
                        </span>
                        <div className="flex gap-1 items-center">
                          <Badge variant="outline" className="text-[10px] uppercase">
                            {s.language}
                          </Badge>
                          <Badge variant="destructive" className="text-[10px] py-0">
                            Waiting
                          </Badge>
                        </div>
                      </div>
                      <p className="text-xs text-muted-foreground mt-1 line-clamp-2 italic">
                        "{s.lastMessage}"
                      </p>
                      <div className="flex items-center justify-between mt-2 pt-2 border-t border-card-border/50 text-[10px] text-muted-foreground">
                        <span>{new Date(s.lastActivityAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>
                        <Button
                          size="sm"
                          className="h-6 text-[10px] bg-emerald-600 hover:bg-emerald-700 text-white gap-1 px-2"
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedToken(s.sessionToken);
                            claimMutation.mutate(s.sessionToken);
                          }}
                        >
                          <UserCheck size={10} /> Take Over
                        </Button>
                      </div>
                    </div>
                  ))
                )}
              </TabsContent>

              {/* Active Sessions List */}
              <TabsContent value="active" className="flex-1 overflow-y-auto p-2 space-y-2 m-0">
                {activeSessions.length === 0 ? (
                  <div className="p-6 text-center text-muted-foreground text-xs">
                    No ongoing active live chats.
                  </div>
                ) : (
                  activeSessions.map((s) => (
                    <div
                      key={s.sessionToken}
                      onClick={() => setSelectedToken(s.sessionToken)}
                      className={`p-3 rounded-lg border cursor-pointer transition ${
                        selectedToken === s.sessionToken
                          ? "border-emerald-500 bg-emerald-50/50 dark:bg-emerald-950/20"
                          : "border-card-border hover:bg-muted/40"
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-mono text-xs font-bold truncate max-w-[130px]">
                          {s.sessionToken.substring(0, 14)}...
                        </span>
                        <Badge className="bg-emerald-500 text-white text-[10px] py-0">
                          Active
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground mt-1 line-clamp-1 italic">
                        "{s.lastMessage}"
                      </p>
                      <p className="text-[10px] text-emerald-600 dark:text-emerald-400 mt-1">
                        👤 Rep: {s.assignedAgentName || "Assigned"}
                      </p>
                    </div>
                  ))
                )}
              </TabsContent>

              {/* Missed Queries */}
              <TabsContent value="missed" className="flex-1 overflow-y-auto p-2 space-y-2 m-0">
                {missedData?.queries?.length === 0 ? (
                  <div className="p-6 text-center text-muted-foreground text-xs">
                    No unhandled missed queries.
                  </div>
                ) : (
                  missedData?.queries?.map((q) => (
                    <div key={q.id} className="p-3 rounded-lg border border-card-border space-y-1 text-xs">
                      <p className="font-medium text-foreground">"{q.query}"</p>
                      <div className="flex items-center justify-between text-[10px] text-muted-foreground pt-1">
                        <span>Lang: {q.language}</span>
                        <span>{new Date(q.createdAt).toLocaleDateString()}</span>
                      </div>
                    </div>
                  ))
                )}
              </TabsContent>
            </Tabs>
          </div>

          {/* Right Panel: Chat Room (8 cols) */}
          <div className="lg:col-span-8 flex flex-col rounded-xl border border-card-border bg-card shadow-sm overflow-hidden">
            {!selectedToken ? (
              <div className="flex-1 flex flex-col items-center justify-center p-8 text-center text-muted-foreground">
                <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mb-4 text-primary">
                  <MessageSquare size={32} />
                </div>
                <h3 className="font-bold text-lg text-foreground">No Chat Selected</h3>
                <p className="text-xs max-w-sm mt-1">
                  Select a pending customer chat from the waiting queue on the left to inspect conversation history, claim the chat, and respond live.
                </p>
              </div>
            ) : (
              <>
                {/* Chat Room Header */}
                <div className="p-4 border-b border-card-border bg-muted/10 flex items-center justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="font-bold text-sm text-foreground">
                        Customer Session: <span className="font-mono">{selectedToken.substring(0, 16)}...</span>
                      </h3>
                      <Badge variant={currentSession?.status === "waiting_for_agent" ? "destructive" : "default"}>
                        {currentSession?.status === "waiting_for_agent" ? "⏳ Waiting for Rep" : "🟢 Live Chat Active"}
                      </Badge>
                    </div>
                    {currentSession?.assignedAgentName && (
                      <p className="text-xs text-muted-foreground mt-0.5">
                        Assigned Agent: <strong className="text-foreground">{currentSession.assignedAgentName}</strong>
                      </p>
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    {currentSession?.status === "waiting_for_agent" && (
                      <Button
                        size="sm"
                        className="bg-emerald-600 hover:bg-emerald-700 text-white gap-2 font-bold"
                        onClick={() => claimMutation.mutate(selectedToken)}
                        disabled={claimMutation.isPending}
                      >
                        <UserCheck size={14} /> ✋ I am Available — Take Over Chat
                      </Button>
                    )}
                    {currentSession?.status === "agent_connected" && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="text-red-500 border-red-200 hover:bg-red-50 gap-1"
                        onClick={() => closeMutation.mutate(selectedToken)}
                      >
                        <XCircle size={14} /> Close Session
                      </Button>
                    )}
                  </div>
                </div>

                {/* Messages Container */}
                <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-muted/5">
                  {messages.length === 0 ? (
                    <div className="text-center text-xs text-muted-foreground py-8">
                      Loading conversation history...
                    </div>
                  ) : (
                    messages.map((m) => (
                      <div
                        key={m.id}
                        className={`flex flex-col ${
                          m.sender === "customer"
                            ? "items-start"
                            : m.sender === "support"
                            ? "items-end"
                            : "items-center"
                        }`}
                      >
                        {m.sender === "system" ? (
                          <div className="px-3 py-1 bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 rounded-full text-[11px] font-medium border border-purple-200 dark:border-purple-800 my-1">
                            {m.message}
                          </div>
                        ) : (
                          <div
                            className={`max-w-[85%] sm:max-w-[75%] rounded-2xl px-4 py-2.5 text-xs shadow-sm ${
                              m.sender === "customer"
                                ? "bg-white dark:bg-zinc-800 text-foreground border border-card-border rounded-tl-none"
                                : "bg-gradient-to-br from-emerald-600 to-teal-700 text-white rounded-tr-none"
                            }`}
                          >
                            <div className="flex items-center gap-1.5 flex-nowrap whitespace-nowrap mb-1 overflow-x-auto">
                              <span className="font-extrabold text-[11px] text-white">
                                {m.senderName || (m.sender === "customer" ? "Customer" : "Support Rep")}
                              </span>
                              {m.sender === "support" && (
                                <>
                                  {m.senderMeta?.isVerified !== false && (
                                    <CheckCircle2 size={12} className="text-sky-300 fill-sky-300/20 shrink-0" title="Verified Staff" />
                                  )}
                                  {m.senderMeta?.isPrimaryAdmin ? (
                                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-gradient-to-r from-amber-400/30 via-emerald-400/30 to-amber-400/30 border border-amber-300/50 text-amber-200 text-[9px] font-black shrink-0">
                                      <Crown size={10} className="fill-amber-300 text-amber-300 shrink-0" />
                                      <span>Super Admin</span>
                                    </span>
                                  ) : (
                                    <span className="inline-flex items-center gap-1 px-1.5 py-0.2 rounded-full bg-white/20 text-white text-[9px] font-extrabold shrink-0">
                                      🏅 {m.senderMeta?.experienceRank || m.senderMeta?.customTitle || "Specialist"}
                                    </span>
                                  )}
                                  <div className="flex items-center gap-0.5 shrink-0 whitespace-nowrap">
                                    {[...Array(Math.min(5, Math.max(1, Number(m.senderMeta?.starRating) || 5)))].map((_, i) => (
                                      <Star key={i} size={9} className="fill-amber-300 text-amber-300 shrink-0" />
                                    ))}
                                  </div>
                                </>
                              )}
                            </div>
                            <p className="whitespace-pre-wrap leading-relaxed">{m.message}</p>
                            <p className="text-[9px] opacity-70 text-right mt-1">
                              {new Date(m.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                            </p>
                          </div>
                        )}
                      </div>
                    ))
                  )}
                  <div ref={messagesEndRef} />
                </div>

                {/* Canned Quick Replies */}
                <div className="px-4 py-2 border-t border-card-border bg-muted/10 flex items-center gap-1.5 overflow-x-auto">
                  <span className="text-[10px] font-bold text-muted-foreground whitespace-nowrap">Quick Replies:</span>
                  {QUICK_REPLIES.map((qr, idx) => (
                    <button
                      key={idx}
                      onClick={() => setReplyInput(qr)}
                      className="px-2.5 py-1 bg-background hover:bg-muted border border-card-border rounded-lg text-[11px] whitespace-nowrap transition text-foreground"
                    >
                      {qr.substring(0, 24)}...
                    </button>
                  ))}
                </div>

                {/* Input Area */}
                <div className="p-3 border-t border-card-border bg-card flex gap-2 items-center">
                  <Input
                    value={replyInput}
                    onChange={(e) => setReplyInput(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && handleSend()}
                    placeholder={
                      currentSession?.status === "waiting_for_agent"
                        ? "Click 'Take Over Chat' above to start responding live..."
                        : "Type your live response to customer..."
                    }
                    disabled={currentSession?.status === "waiting_for_agent" || sendMutation.isPending}
                    className="flex-1 text-xs"
                  />
                  <Button
                    size="sm"
                    className="bg-emerald-600 hover:bg-emerald-700 text-white gap-1.5 px-4 font-bold"
                    onClick={handleSend}
                    disabled={!replyInput.trim() || currentSession?.status === "waiting_for_agent" || sendMutation.isPending}
                  >
                    <Send size={13} /> Send
                  </Button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </AdminLayout>
  );
}

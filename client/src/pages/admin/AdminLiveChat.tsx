import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import {
  MessageSquare, UserCheck, CheckCircle2, Send, Clock, ShieldAlert, ShieldCheck,
  Sparkles, RefreshCw, XCircle, Crown, Star, ShoppingCart, Package,
  User, Phone, Mail, MapPin, Plus, Minus, Trash2, Edit3, RotateCcw,
  Ban, Search, Check, ChevronRight, AlertCircle, ShoppingBag, Lock, Key
} from "lucide-react";
import { AdminLayout } from "./AdminLayout";
import { apiRequest, apiGet, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { useAuth } from "@/lib/store";
import { formatINR } from "@/lib/types";

/* ─── Types ───────────────────────────────────────────────────── */

interface LiveSession {
  id: number;
  sessionToken: string;
  userId?: number | null;
  customerName?: string;
  customerPhone?: string;
  customerEmail?: string;
  language: string;
  status: "bot" | "waiting_for_agent" | "agent_connected" | "closed";
  assignedAgentId?: number | null;
  assignedAgentName?: string | null;
  lastActivityAt: string;
  createdAt: string;
  lastMessage?: string;
  lastMessageSender?: string;
  totalMessages?: number;
}

interface ChatMessage {
  id: string;
  sender: string;
  senderName?: string;
  message: string;
  messageType?: string;
  metadata?: any;
  createdAt: string;
  senderMeta?: {
    isPrimaryAdmin?: boolean;
    isVerified?: boolean;
    starRating?: number;
    customerStars?: number;
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

interface CustomerProfile {
  id: number;
  name: string;
  email: string;
  phone: string;
  address: string;
  customerStars: number;
  role: string;
  createdAt: string;
  orderCount: number;
  totalSpent: number;
}

interface CartItemData {
  id: number;
  productId: number;
  name: string;
  image?: string;
  unit?: string;
  price: number;
  originalPrice: number;
  qty: number;
  lineTotal: number;
}

interface CustomerOrder {
  id: number;
  customerName: string;
  phone: string;
  address: string;
  subtotal: string;
  discount: string;
  total: string;
  status: string;
  paymentMethod: string;
  paymentStatus: string;
  createdAt: string;
}

interface CatalogProduct {
  id: number;
  name: string;
  price: string;
  unit: string;
  image?: string;
  stock: number;
  discountPercent?: string;
}

interface CustomerContextResponse {
  session: LiveSession;
  customer: CustomerProfile | null;
  cart: { id: number | null; items: CartItemData[]; total: number };
  orders: CustomerOrder[];
  catalogProducts: CatalogProduct[];
  customerPermissionGranted?: boolean;
  permissionScope?: string;
  permissionGrantedAt?: string;
}

const QUICK_REPLIES = [
  "Hello! I am your Customer Representative. How can I assist you with your cart or order today?",
  "I have sent a permission request to assist you with updating your details/cart. Please click 'Proceed & Authorize'.",
  "I have added the requested items to your cart. Please check your cart and proceed to checkout!",
  "I have updated your delivery address on your active order.",
  "Your order cancellation has been successfully reverted to 'Placed'.",
  "Your order is currently being packed and will be delivered in 30-45 minutes.",
  "Thank you for contacting FarmFreshFarmer live support!",
];

export function AdminLiveChat() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [selectedToken, setSelectedToken] = useState<string | null>(null);
  const [replyInput, setReplyInput] = useState("");
  const [filterStatus, setFilterStatus] = useState<"all" | "waiting" | "active" | "closed" | "bot" | "missed">("all");
  const [searchTerm, setSearchTerm] = useState("");
  const [opsTab, setOpsTab] = useState<"profile" | "cart" | "orders">("profile");
  const chatScrollRef = useRef<HTMLDivElement>(null);

  // Deletion modals state
  const [deleteConfirmToken, setDeleteConfirmToken] = useState<string | null>(null);
  const [purgeConfirmOpen, setPurgeConfirmOpen] = useState(false);

  // Modals state
  const [editProfileOpen, setEditProfileOpen] = useState(false);
  const [editProfileData, setEditProfileData] = useState({ name: "", phone: "", address: "", email: "" });

  const [addCartItemOpen, setAddCartItemOpen] = useState(false);
  const [selectedProductId, setSelectedProductId] = useState<string>("");
  const [productSearch, setProductSearch] = useState("");
  const [addQty, setAddQty] = useState(1);

  const [editOrderOpen, setEditOrderOpen] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<CustomerOrder | null>(null);
  const [orderEditData, setOrderEditData] = useState({ address: "", phone: "", status: "" });

  const [cancelOrderOpen, setCancelOrderOpen] = useState(false);
  const [cancelReason, setCancelReason] = useState("Customer requested cancellation via Live Support");

  const [requestPermissionOpen, setRequestPermissionOpen] = useState(false);
  const [permissionScope, setPermissionScope] = useState("all");
  const [permissionNote, setPermissionNote] = useState("");

  // Poll live sessions every 3 seconds
  const { data: sessionsData, isLoading: loadingSessions, refetch: refetchSessions } = useQuery<{
    sessions: LiveSession[];
    counts?: { all: number; waiting: number; active: number; closed: number; bot: number };
  }>({
    queryKey: ["/api/admin/chatbot/live-sessions", filterStatus, searchTerm],
    queryFn: () => apiGet<{ sessions: LiveSession[]; counts?: any }>(`/api/admin/chatbot/live-sessions?filter=${filterStatus}&search=${encodeURIComponent(searchTerm)}`),
    refetchInterval: 3000,
  });

  const sessions = sessionsData?.sessions || [];
  const counts = sessionsData?.counts || { all: sessions.length, waiting: 0, active: 0, closed: 0, bot: 0 };
  const waitingSessions = sessions.filter((s) => s.status === "waiting_for_agent");
  const activeSessions = sessions.filter((s) => s.status === "agent_connected");

  // Keep selectedToken synchronized with available sessions
  useEffect(() => {
    if (sessions.length === 0) {
      if (selectedToken !== null) {
        setSelectedToken(null);
      }
      return;
    }

    // If current selectedToken is not in active sessions, pick first available
    const exists = sessions.some((s) => s.sessionToken === selectedToken);
    if (!exists) {
      const firstWaiting = sessions.find((s) => s.status === "waiting_for_agent") || sessions[0];
      setSelectedToken(firstWaiting?.sessionToken || null);
    }
  }, [sessions, selectedToken]);

  // Poll messages for selected session every 2 seconds
  const { data: messagesData, isLoading: loadingMessages, refetch: refetchMessages } = useQuery<{ session: LiveSession; messages: ChatMessage[] }>({
    queryKey: ["/api/admin/chatbot/messages", selectedToken],
    queryFn: () => apiGet<{ session: LiveSession; messages: ChatMessage[] }>(`/api/admin/chatbot/messages/${selectedToken}`),
    enabled: !!selectedToken,
    refetchInterval: 2000,
  });

  // Fetch Customer 360, Cart & Orders Context for selected session
  const { data: contextData, refetch: refetchContext } = useQuery<CustomerContextResponse>({
    queryKey: ["/api/admin/chatbot/customer-context", selectedToken],
    queryFn: () => apiGet<CustomerContextResponse>(`/api/admin/chatbot/customer-context/${selectedToken}`),
    enabled: !!selectedToken,
    refetchInterval: 3000,
  });

  // Fetch missed queries
  const { data: missedData, refetch: refetchMissed } = useQuery<{ queries: MissedQuery[] }>({
    queryKey: ["/api/admin/chatbot/missed"],
    queryFn: () => apiGet<{ queries: MissedQuery[] }>("/api/admin/chatbot/missed"),
  });

  const currentSession = messagesData?.session || sessions.find((s) => s.sessionToken === selectedToken);
  const isSessionClosed = currentSession?.status === "closed";
  const isPermissionGranted = Boolean(contextData?.customerPermissionGranted);
  const isEditable = isPermissionGranted && !isSessionClosed;
  const messages = messagesData?.messages || [];
  const customer = contextData?.customer;
  const cart = contextData?.cart || { id: null, items: [], total: 0 };
  const customerOrders = contextData?.orders || [];
  const catalogProducts = contextData?.catalogProducts || [];

  useEffect(() => {
    if (chatScrollRef.current) {
      chatScrollRef.current.scrollTo({
        top: chatScrollRef.current.scrollHeight,
        behavior: "smooth",
      });
    }
  }, [messages.length, selectedToken]);

  // Pre-fill profile edit data
  useEffect(() => {
    if (customer) {
      setEditProfileData({
        name: customer.name || "",
        phone: customer.phone || "",
        address: customer.address || "",
        email: customer.email || "",
      });
    }
  }, [customer]);

  // Mutations
  const claimMutation = useMutation({
    mutationFn: async (sessionToken: string) => {
      return apiRequest("POST", "/api/admin/chatbot/claim-session", { sessionToken });
    },
    onSuccess: (_, sessionToken) => {
      toast({ title: "🟢 Chat Claimed!", description: "You have taken over this live chat. Customer is notified." });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/chatbot/live-sessions"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/chatbot/messages", sessionToken] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/chatbot/customer-context", sessionToken] });
      refetchSessions();
      refetchMessages();
    },
    onError: (err: any) => {
      toast({ title: "Claim Error", description: err?.message || "Failed to claim session", variant: "destructive" });
    },
  });

  const requestPermissionMutation = useMutation({
    mutationFn: async () => {
      if (!selectedToken) throw new Error("No chat session selected");
      return apiRequest("POST", "/api/admin/chatbot/request-permission", {
        sessionToken: selectedToken,
        scope: permissionScope,
        requestNote: permissionNote,
      });
    },
    onSuccess: () => {
      toast({
        title: "🛡️ Permission Request Dispatched!",
        description: "Customer received an interactive consent prompt in chat. Editing will unlock when they click 'Proceed'.",
      });
      setRequestPermissionOpen(false);
      setPermissionNote("");
      refetchMessages();
      refetchContext();
    },
    onError: (err: any) => {
      toast({ title: "Failed to request permission", description: err?.message, variant: "destructive" });
    },
  });

  const revokePermissionMutation = useMutation({
    mutationFn: async () => {
      if (!selectedToken) throw new Error("No chat session selected");
      return apiRequest("POST", "/api/admin/chatbot/revoke-permission", {
        sessionToken: selectedToken,
      });
    },
    onSuccess: () => {
      toast({ title: "🔒 Locked", description: "Modification access returned to Read-Only mode." });
      refetchMessages();
      refetchContext();
    },
    onError: (err: any) => {
      toast({ title: "Failed to revoke permission", description: err?.message, variant: "destructive" });
    },
  });

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

  const closeMutation = useMutation({
    mutationFn: async (sessionToken: string) => {
      return apiRequest("POST", "/api/admin/chatbot/close-session", { sessionToken });
    },
    onSuccess: () => {
      toast({ title: "🏁 Session Closed", description: "Chat support session marked as closed." });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/chatbot/live-sessions"] });
      refetchSessions();
      refetchMessages();
    },
  });

  const deleteSessionMutation = useMutation({
    mutationFn: async (sessionToken: string) => {
      return apiRequest("DELETE", `/api/admin/chatbot/session/${sessionToken}`);
    },
    onSuccess: (_, sessionToken) => {
      toast({ title: "🗑️ Chat Deleted Permanently", description: "Chat conversation removed from database." });
      setDeleteConfirmToken(null);
      if (selectedToken === sessionToken) {
        setSelectedToken(null);
        localStorage.removeItem("admin_selected_chat_token");
      }
      queryClient.invalidateQueries({ queryKey: ["/api/admin/chatbot/live-sessions"] });
      refetchSessions();
    },
    onError: (err: any) => {
      toast({ title: "Delete Failed", description: err?.message || "Failed to delete chat", variant: "destructive" });
    },
  });

  const purgeSessionsMutation = useMutation({
    mutationFn: async () => {
      return apiRequest("POST", "/api/admin/chatbot/purge-sessions", { purgeType: "closed" });
    },
    onSuccess: (res: any) => {
      toast({ title: "🧹 Database Cleaned", description: "Closed chat history purged successfully." });
      setPurgeConfirmOpen(false);
      queryClient.invalidateQueries({ queryKey: ["/api/admin/chatbot/live-sessions"] });
      refetchSessions();
    },
    onError: (err: any) => {
      toast({ title: "Purge Failed", description: err?.message || "Failed to purge chats", variant: "destructive" });
    },
  });

  // Customer Profile Mutation
  const updateCustomerMutation = useMutation({
    mutationFn: async (data: typeof editProfileData) => {
      if (!customer?.id) throw new Error("No customer linked to this session");
      return apiRequest("PUT", `/api/admin/chatbot/customer/${customer.id}`, { ...data, sessionToken: selectedToken });
    },
    onSuccess: () => {
      toast({ title: "Profile Updated", description: "Customer details saved and customer notified." });
      setEditProfileOpen(false);
      refetchContext();
      refetchMessages();
    },
    onError: (err: any) => {
      toast({ title: "Update Failed", description: err?.message || "Could not update customer", variant: "destructive" });
    },
  });

  // Cart Add Item Mutation
  const addToCartMutation = useMutation({
    mutationFn: async () => {
      if (!customer?.id || !selectedProductId) throw new Error("Customer and Product are required");
      return apiRequest("POST", "/api/admin/chatbot/cart/add-item", {
        userId: customer.id,
        productId: Number(selectedProductId),
        qty: addQty,
        sessionToken: selectedToken,
      });
    },
    onSuccess: () => {
      toast({ title: "Item Added to Cart", description: "Product was added to customer's live cart." });
      setAddCartItemOpen(false);
      setSelectedProductId("");
      setAddQty(1);
      refetchContext();
      refetchMessages();
    },
    onError: (err: any) => {
      toast({ title: "Add to Cart Failed", description: err?.message, variant: "destructive" });
    },
  });

  // Cart Update Quantity Mutation
  const updateCartQtyMutation = useMutation({
    mutationFn: async ({ cartItemId, qty }: { cartItemId: number; qty: number }) => {
      return apiRequest("POST", "/api/admin/chatbot/cart/update-qty", {
        cartItemId,
        qty,
        sessionToken: selectedToken,
      });
    },
    onSuccess: () => {
      refetchContext();
      refetchMessages();
    },
  });

  // Cart Remove Item Mutation
  const removeCartItemMutation = useMutation({
    mutationFn: async (cartItemId: number) => {
      return apiRequest("DELETE", `/api/admin/chatbot/cart/remove-item/${cartItemId}?sessionToken=${selectedToken}`);
    },
    onSuccess: () => {
      toast({ title: "Item Removed", description: "Item removed from customer's cart." });
      refetchContext();
      refetchMessages();
    },
  });

  // Order Update Mutation
  const updateOrderMutation = useMutation({
    mutationFn: async () => {
      if (!selectedOrder?.id) throw new Error("No order selected");
      return apiRequest("PUT", `/api/admin/chatbot/orders/${selectedOrder.id}`, {
        ...orderEditData,
        sessionToken: selectedToken,
      });
    },
    onSuccess: () => {
      toast({ title: "Order Updated", description: "Order details updated successfully." });
      setEditOrderOpen(false);
      refetchContext();
      refetchMessages();
    },
    onError: (err: any) => {
      toast({ title: "Order Update Failed", description: err?.message, variant: "destructive" });
    },
  });

  // Cancel Order Mutation
  const cancelOrderMutation = useMutation({
    mutationFn: async (orderId: number) => {
      return apiRequest("POST", `/api/admin/chatbot/orders/${orderId}/cancel`, {
        reason: cancelReason,
        sessionToken: selectedToken,
      });
    },
    onSuccess: () => {
      toast({ title: "Order Cancelled", description: "Order has been marked Cancelled." });
      setCancelOrderOpen(false);
      refetchContext();
      refetchMessages();
    },
    onError: (err: any) => {
      toast({ title: "Cancellation Failed", description: err?.message, variant: "destructive" });
    },
  });

  // Revert Order Cancellation Mutation
  const revertCancelMutation = useMutation({
    mutationFn: async ({ orderId, targetStatus }: { orderId: number; targetStatus: string }) => {
      return apiRequest("POST", `/api/admin/chatbot/orders/${orderId}/revert-cancel`, {
        targetStatus,
        sessionToken: selectedToken,
      });
    },
    onSuccess: () => {
      toast({ title: "Cancellation Reverted", description: "Order status restored to active." });
      refetchContext();
      refetchMessages();
    },
    onError: (err: any) => {
      toast({ title: "Revert Failed", description: err?.message, variant: "destructive" });
    },
  });

  const handleSend = () => {
    if (!selectedToken || !replyInput.trim()) return;
    sendMutation.mutate({ sessionToken: selectedToken, message: replyInput.trim() });
  };

  const filteredCatalog = catalogProducts.filter((p) =>
    p.name.toLowerCase().includes(productSearch.toLowerCase())
  );

  return (
    <AdminLayout title="Live Support & Escalation Console">
      <div className="space-y-4">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-card-border pb-4">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-black tracking-tight text-foreground flex items-center gap-2">
                💬 Live Support &amp; Escalation Console
              </h1>
              {waitingSessions.length > 0 && (
                <Badge variant="destructive" className="animate-pulse px-2 py-0.5 text-xs font-bold">
                  {waitingSessions.length} Waiting
                </Badge>
              )}
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">
              Live customer support takeover &amp; persistent conversation history for Admins, Sub-Admins, Grievance Officers &amp; Staff.
            </p>
          </div>
          <div className="flex items-center gap-2 self-start">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPurgeConfirmOpen(true)}
              className="gap-1.5 text-xs text-amber-600 dark:text-amber-400 border-amber-300 dark:border-amber-700 hover:bg-amber-500/10"
              title="Purge closed chat sessions permanently from DB"
            >
              <Trash2 size={13} /> Purge Closed Chats
            </Button>
            <Button variant="outline" size="sm" onClick={() => { refetchSessions(); refetchMissed(); if (selectedToken) refetchContext(); }} className="gap-2">
              <RefreshCw size={14} className={loadingSessions ? "animate-spin" : ""} /> Refresh Queue
            </Button>
          </div>
        </div>

        {/* 3-Column Super-Console Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 lg:h-[calc(100vh-200px)] lg:min-h-[600px] h-auto">
          
          {/* Column 1: Sessions Queue (3 cols) */}
          <div className="lg:col-span-3 flex flex-col rounded-xl border border-card-border bg-card shadow-sm overflow-hidden">
            {/* Search Input */}
            <div className="p-2 border-b border-card-border bg-muted/10">
              <div className="relative">
                <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
                <Input
                  placeholder="Search customer, phone, token..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="h-8 pl-8 text-xs rounded-lg"
                />
              </div>
            </div>

            {/* Filter Tabs */}
            <div className="p-1.5 border-b border-card-border bg-muted/20 overflow-x-auto">
              <div className="flex items-center gap-1 min-w-max">
                {[
                  { id: "all", label: `All (${counts.all})` },
                  { id: "waiting", label: `⏳ Waiting (${counts.waiting})`, alert: counts.waiting > 0 },
                  { id: "active", label: `🟢 Active (${counts.active})` },
                  { id: "closed", label: `📁 Closed (${counts.closed})` },
                  { id: "bot", label: `🤖 Bot (${counts.bot})` },
                  { id: "missed", label: `⚠️ Missed (${missedData?.queries?.length || 0})` },
                ].map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => setFilterStatus(tab.id as any)}
                    className={`px-2 py-1 rounded-md text-[11px] font-bold transition whitespace-nowrap ${
                      filterStatus === tab.id
                        ? "bg-primary text-primary-foreground shadow-xs"
                        : "text-muted-foreground hover:text-foreground hover:bg-muted/60"
                    } ${tab.alert ? "text-red-500 animate-pulse font-extrabold" : ""}`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Sessions List */}
            <div className="flex-1 overflow-y-auto p-2 space-y-2">
              {filterStatus === "missed" ? (
                missedData?.queries?.length === 0 ? (
                  <div className="p-6 text-center text-muted-foreground text-xs">
                    No unhandled missed queries.
                  </div>
                ) : (
                  missedData?.queries?.map((q) => (
                    <div key={q.id} className="p-2.5 rounded-lg border border-card-border space-y-1 text-xs">
                      <p className="font-medium text-foreground">"{q.query}"</p>
                      <div className="flex items-center justify-between text-[10px] text-muted-foreground pt-1">
                        <span>Lang: {q.language}</span>
                        <span>{new Date(q.createdAt).toLocaleDateString()}</span>
                      </div>
                    </div>
                  ))
                )
              ) : sessions.length === 0 ? (
                <div className="p-6 text-center text-muted-foreground text-xs space-y-1">
                  <CheckCircle2 size={24} className="mx-auto text-emerald-500 mb-1 opacity-70" />
                  <p className="font-bold">No chat sessions found</p>
                  <p className="text-[11px]">No matching chats in "{filterStatus}" filter.</p>
                </div>
              ) : (
                sessions.map((s) => {
                  const isSelected = selectedToken === s.sessionToken;
                  const isWaiting = s.status === "waiting_for_agent";
                  const isActive = s.status === "agent_connected";
                  const isClosed = s.status === "closed";
                  return (
                    <div
                      key={s.sessionToken}
                      onClick={() => setSelectedToken(s.sessionToken)}
                      className={`p-2.5 rounded-lg border cursor-pointer transition relative group ${
                        isSelected
                          ? "border-emerald-500 bg-emerald-50/50 dark:bg-emerald-950/20 shadow-xs"
                          : "border-card-border hover:bg-muted/40"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-1">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5">
                            <span className="font-bold text-xs truncate text-foreground">
                              {s.customerName || `Customer #${s.userId || s.sessionToken.substring(0, 8)}`}
                            </span>
                            {s.totalMessages !== undefined && s.totalMessages > 0 && (
                              <span className="px-1 py-0.2 rounded text-[9px] bg-muted font-mono text-muted-foreground">
                                {s.totalMessages} msgs
                              </span>
                            )}
                          </div>
                          {s.customerPhone && (
                            <p className="text-[10px] text-muted-foreground mt-0.5">📞 {s.customerPhone}</p>
                          )}
                        </div>

                        <div className="flex items-center gap-1 shrink-0">
                          {isWaiting && (
                            <Badge variant="destructive" className="text-[9px] py-0 px-1.5 animate-pulse">
                              Waiting
                            </Badge>
                          )}
                          {isActive && (
                            <Badge className="bg-emerald-500 text-white text-[9px] py-0 px-1.5">
                              Active
                            </Badge>
                          )}
                          {isClosed && (
                            <Badge variant="secondary" className="text-[9px] py-0 px-1.5 opacity-75">
                              Closed
                            </Badge>
                          )}
                          {s.status === "bot" && (
                            <Badge variant="outline" className="text-[9px] py-0 px-1.5">
                              AI Bot
                            </Badge>
                          )}
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setDeleteConfirmToken(s.sessionToken);
                            }}
                            className="text-muted-foreground hover:text-red-500 p-0.5 rounded opacity-50 hover:opacity-100 transition"
                            title="Delete session from DB"
                          >
                            <Trash2 size={12} />
                          </button>
                        </div>
                      </div>

                      <p className="text-[11px] text-muted-foreground mt-1 line-clamp-1 italic">
                        "{s.lastMessage}"
                      </p>

                      <div className="flex items-center justify-between mt-2 pt-1.5 border-t border-card-border/50 text-[10px] text-muted-foreground">
                        <span>{new Date(s.lastActivityAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>
                        {isWaiting && (
                          <Button
                            size="sm"
                            className="h-5 text-[10px] bg-emerald-600 hover:bg-emerald-700 text-white gap-1 px-2"
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedToken(s.sessionToken);
                              claimMutation.mutate(s.sessionToken);
                            }}
                          >
                            <UserCheck size={10} /> Take Over
                          </Button>
                        )}
                        {isActive && s.assignedAgentName && (
                          <span className="text-emerald-600 dark:text-emerald-400 font-semibold truncate max-w-[100px]">
                            👤 {s.assignedAgentName}
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Column 2: Chat Conversation Panel (5 cols) */}
          <div className="lg:col-span-5 flex flex-col rounded-xl border border-card-border bg-card shadow-sm overflow-hidden">
            {!selectedToken ? (
              <div className="flex-1 min-h-[300px] flex flex-col items-center justify-center p-6 text-center text-muted-foreground">
                <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center mb-3 text-primary">
                  <MessageSquare size={28} />
                </div>
                <h3 className="font-bold text-base text-foreground">No Chat Selected</h3>
                <p className="text-xs max-w-xs mt-1">
                  Select any chat session from the list on the left to inspect full conversation history or respond live.
                </p>
              </div>
            ) : (
              <>
                {/* Chat Room Header */}
                <div className="p-3 border-b border-card-border bg-muted/10 flex items-center justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="font-bold text-xs sm:text-sm text-foreground">
                        {customer?.name || currentSession?.customerName || "Customer Chat"}
                      </h3>
                      <Badge variant={currentSession?.status === "waiting_for_agent" ? "destructive" : currentSession?.status === "agent_connected" ? "default" : "secondary"} className="text-[10px]">
                        {currentSession?.status === "waiting_for_agent" ? "⏳ Waiting" : currentSession?.status === "agent_connected" ? "🟢 Live" : currentSession?.status === "closed" ? "📁 Closed" : "🤖 Bot"}
                      </Badge>
                    </div>
                    {currentSession?.assignedAgentName && (
                      <p className="text-[10px] text-muted-foreground mt-0.5">
                        Rep: <strong className="text-foreground">{currentSession.assignedAgentName}</strong>
                      </p>
                    )}
                  </div>

                  <div className="flex items-center gap-1.5">
                    {currentSession?.status === "waiting_for_agent" && (
                      <Button
                        size="sm"
                        className="bg-emerald-600 hover:bg-emerald-700 text-white gap-1 font-bold text-xs h-7 px-2.5"
                        onClick={() => claimMutation.mutate(selectedToken)}
                        disabled={claimMutation.isPending}
                      >
                        <UserCheck size={12} /> Claim Chat
                      </Button>
                    )}
                    {currentSession?.status === "agent_connected" && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="text-amber-600 border-amber-200 hover:bg-amber-50 gap-1 text-xs h-7 px-2"
                        onClick={() => closeMutation.mutate(selectedToken)}
                      >
                        <XCircle size={12} /> End Session
                      </Button>
                    )}
                    <Button
                      size="sm"
                      variant="outline"
                      className="text-red-500 border-red-200 hover:bg-red-50 gap-1 text-xs h-7 px-2"
                      onClick={() => setDeleteConfirmToken(selectedToken)}
                      title="Permanently delete this chat from DB"
                    >
                      <Trash2 size={12} /> Delete
                    </Button>
                  </div>
                </div>

                {/* Messages Container */}
                <div ref={chatScrollRef} className="flex-1 overflow-y-auto p-3 space-y-2.5 bg-muted/5 max-h-[380px] lg:max-h-none">
                  {loadingMessages && !messagesData ? (
                    <div className="text-center text-xs text-muted-foreground py-8">
                      Loading conversation history...
                    </div>
                  ) : messages.length === 0 ? (
                    <div className="text-center text-xs text-muted-foreground py-8 space-y-1">
                      <p className="font-semibold text-foreground/80">No conversation messages yet</p>
                      <p className="text-[11px]">Type a response below to start assisting the customer.</p>
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
                          <div className="px-3 py-1 bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 rounded-full text-[10px] font-medium border border-purple-200 dark:border-purple-800 my-1 text-center max-w-[90%]">
                            {m.message}
                          </div>
                        ) : (
                          <div
                            className={`max-w-[88%] rounded-2xl px-3.5 py-2 text-xs shadow-sm ${
                              m.sender === "customer"
                                ? "bg-white dark:bg-zinc-800 text-foreground border border-card-border rounded-tl-none"
                                : "bg-gradient-to-br from-emerald-600 to-teal-700 text-white rounded-tr-none"
                            }`}
                          >
                            <div className="flex items-center gap-1.5 flex-nowrap whitespace-nowrap mb-0.5">
                              <span className={`font-bold text-[11px] ${m.sender === "customer" ? "text-emerald-500 dark:text-emerald-400" : "text-white"}`}>
                                {m.senderName || (m.sender === "customer" ? "Customer" : "Support Rep")}
                              </span>
                              {m.sender === "customer" && (m.senderMeta?.customerStars ?? 0) > 0 && (
                                <span className="text-amber-400 font-bold text-[9px] bg-amber-500/15 px-1.5 py-0.2 rounded border border-amber-400/30">
                                  ★ {m.senderMeta?.customerStars}
                                </span>
                              )}
                              {m.sender === "support" && (
                                <CheckCircle2 size={11} className="text-sky-300 fill-sky-300/20" />
                              )}
                            </div>
                            <p className="whitespace-pre-wrap leading-relaxed text-[11px]">{m.message}</p>
                            <p className="text-[8px] opacity-70 text-right mt-0.5">
                              {new Date(m.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                            </p>
                          </div>
                        )}
                      </div>
                    ))
                  )}
                </div>

                {/* Canned Quick Replies */}
                <div className="px-3 py-1.5 border-t border-card-border bg-muted/10 flex items-center gap-1.5 overflow-x-auto no-scrollbar">
                  <span className="text-[9px] font-bold text-muted-foreground whitespace-nowrap">Quick:</span>
                  {QUICK_REPLIES.map((qr, idx) => (
                    <button
                      key={idx}
                      onClick={() => setReplyInput(qr)}
                      className="px-2 py-0.5 bg-background hover:bg-muted border border-card-border rounded text-[10px] whitespace-nowrap transition text-foreground"
                    >
                      {qr.substring(0, 20)}...
                    </button>
                  ))}
                </div>

                {/* Input Area */}
                <div className="p-2.5 border-t border-card-border bg-card flex gap-1.5 items-center">
                  <Input
                    value={replyInput}
                    onChange={(e) => setReplyInput(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && handleSend()}
                    placeholder={
                      isSessionClosed
                        ? "Chat session is closed (read-only)."
                        : currentSession?.status === "waiting_for_agent"
                        ? "Claim chat to respond..."
                        : "Type response to customer..."
                    }
                    disabled={isSessionClosed || currentSession?.status === "waiting_for_agent" || sendMutation.isPending}
                    className="flex-1 text-xs h-8"
                  />
                  <Button
                    size="sm"
                    className="bg-emerald-600 hover:bg-emerald-700 text-white gap-1 px-3 font-bold h-8 text-xs"
                    onClick={handleSend}
                    disabled={isSessionClosed || !replyInput.trim() || currentSession?.status === "waiting_for_agent" || sendMutation.isPending}
                  >
                    <Send size={12} /> Send
                  </Button>
                </div>
              </>
            )}
          </div>

          {/* Column 3: Customer 360 & Rep Operations Panel (4 cols) */}
          <div className="lg:col-span-4 flex flex-col rounded-xl border border-card-border bg-card shadow-sm overflow-hidden">
            {!selectedToken ? (
              <div className="flex-1 flex flex-col items-center justify-center p-6 text-center text-muted-foreground">
                <User size={32} className="opacity-30 mb-2" />
                <p className="text-xs">Customer 360 &amp; Actions appear here when a chat is selected.</p>
              </div>
            ) : (
              <div className="flex-1 flex flex-col overflow-hidden">
                {/* Operations Header & Tabs */}
                <div className="p-2.5 border-b border-card-border bg-muted/20">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-1.5">
                      <span className="font-bold text-xs text-foreground">Customer 360</span>
                      {customer?.customerStars ? (
                        <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-500 border border-amber-400/30">
                          ★ {customer.customerStars} Stars
                        </span>
                      ) : null}
                    </div>
                    {customer && (
                      <span className="text-[10px] text-muted-foreground font-mono">
                        User #{customer.id}
                      </span>
                    )}
                  </div>

                  {/* Customer Permission / Consent Status Banner */}
                  {isSessionClosed ? (
                    <div className="mb-2 p-2 bg-muted/40 border border-card-border rounded-lg flex items-center gap-1.5 text-xs text-muted-foreground font-medium">
                      <Lock size={13} className="text-muted-foreground shrink-0" />
                      <span>Session Closed: Customer operations and modifications are disabled.</span>
                    </div>
                  ) : isPermissionGranted ? (
                    <div className="mb-2 p-2 bg-emerald-500/10 border border-emerald-500/30 rounded-lg flex items-center justify-between gap-2">
                      <div className="flex items-center gap-1.5 text-xs text-emerald-700 dark:text-emerald-300 font-bold">
                        <ShieldCheck size={14} className="text-emerald-600 dark:text-emerald-400 shrink-0" />
                        <span>Customer Consent: ACTIVE</span>
                      </div>
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-6 text-[10px] text-muted-foreground border-border hover:text-foreground gap-1 px-2"
                        onClick={() => revokePermissionMutation.mutate()}
                        disabled={revokePermissionMutation.isPending}
                      >
                        <Lock size={10} /> Lock
                      </Button>
                    </div>
                  ) : (
                    <div className="mb-2 p-2 bg-amber-500/10 border border-amber-500/30 rounded-lg flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <div className="flex items-center gap-1.5 text-[11px] text-amber-700 dark:text-amber-300 font-medium">
                        <ShieldAlert size={14} className="text-amber-600 dark:text-amber-400 shrink-0" />
                        <span>Read-Only: Customer permission required to edit.</span>
                      </div>
                      <Button
                        size="sm"
                        className="h-6 text-[10px] bg-amber-600 hover:bg-amber-700 text-white font-bold gap-1 px-2 shrink-0 self-start sm:self-auto shadow-sm"
                        onClick={() => setRequestPermissionOpen(true)}
                        disabled={requestPermissionMutation.isPending}
                      >
                        <Key size={10} /> Ask Permission
                      </Button>
                    </div>
                  )}

                  <div className="grid grid-cols-3 gap-1">
                    <button
                      onClick={() => setOpsTab("profile")}
                      className={`py-1 text-[11px] font-bold rounded-md transition ${
                        opsTab === "profile" ? "bg-emerald-600 text-white shadow-sm" : "bg-muted/60 text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      👤 Profile
                    </button>
                    <button
                      onClick={() => setOpsTab("cart")}
                      className={`py-1 text-[11px] font-bold rounded-md transition relative ${
                        opsTab === "cart" ? "bg-emerald-600 text-white shadow-sm" : "bg-muted/60 text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      🛒 Cart ({cart.items.length})
                    </button>
                    <button
                      onClick={() => setOpsTab("orders")}
                      className={`py-1 text-[11px] font-bold rounded-md transition ${
                        opsTab === "orders" ? "bg-emerald-600 text-white shadow-sm" : "bg-muted/60 text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      📦 Orders ({customerOrders.length})
                    </button>
                  </div>
                </div>

                {/* Operations Body */}
                <div className="flex-1 overflow-y-auto p-3 space-y-3">
                  {/* TAB 1: CUSTOMER PROFILE & EDIT */}
                  {opsTab === "profile" && (
                    <div className="space-y-3 text-xs">
                      {!customer ? (
                        <div className="p-4 text-center text-muted-foreground">
                          <p>Customer is not authenticated on this session.</p>
                        </div>
                      ) : (
                        <>
                          <div className="p-3 bg-muted/20 border border-card-border rounded-xl space-y-2">
                            <div className="flex items-center justify-between border-b border-card-border/60 pb-2">
                              <div>
                                <h4 className="font-bold text-sm text-foreground">{customer.name || "Customer"}</h4>
                                <span className="text-[10px] text-muted-foreground capitalize">{customer.role}</span>
                              </div>
                              {isEditable ? (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="h-7 text-[11px] gap-1 px-2.5 font-semibold text-emerald-600 border-emerald-500/30 hover:bg-emerald-50 dark:hover:bg-emerald-950/40"
                                  onClick={() => setEditProfileOpen(true)}
                                >
                                  <Edit3 size={11} /> Edit Details
                                </Button>
                              ) : isSessionClosed ? (
                                <span className="text-[10px] text-muted-foreground italic">Session closed</span>
                              ) : (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="h-7 text-[11px] gap-1 px-2.5 font-semibold text-amber-600 border-amber-500/30 hover:bg-amber-50 dark:hover:bg-amber-950/40"
                                  onClick={() => {
                                    setPermissionScope("profile");
                                    setRequestPermissionOpen(true);
                                  }}
                                >
                                  <Lock size={11} /> Request Edit Permission
                                </Button>
                              )}
                            </div>

                            <div className="space-y-1.5 pt-1 text-[11px]">
                              <div className="flex items-center gap-2 text-muted-foreground">
                                <Phone size={12} className="text-emerald-500 shrink-0" />
                                <span className="font-medium text-foreground">{customer.phone || "No phone provided"}</span>
                              </div>
                              <div className="flex items-center gap-2 text-muted-foreground">
                                <Mail size={12} className="text-emerald-500 shrink-0" />
                                <span className="font-medium text-foreground truncate">{customer.email || "No email"}</span>
                              </div>
                              <div className="flex items-start gap-2 text-muted-foreground">
                                <MapPin size={12} className="text-emerald-500 shrink-0 mt-0.5" />
                                <span className="font-medium text-foreground leading-snug">{customer.address || "No address saved"}</span>
                              </div>
                            </div>
                          </div>

                          {/* Customer Stats Card */}
                          <div className="grid grid-cols-2 gap-2">
                            <div className="p-2.5 bg-muted/30 border border-card-border rounded-xl text-center">
                              <span className="text-[10px] text-muted-foreground font-semibold">Total Orders</span>
                              <p className="text-lg font-black text-foreground mt-0.5">{customer.orderCount}</p>
                            </div>
                            <div className="p-2.5 bg-muted/30 border border-card-border rounded-xl text-center">
                              <span className="text-[10px] text-muted-foreground font-semibold">Total Spent</span>
                              <p className="text-lg font-black text-emerald-600 dark:text-emerald-400 mt-0.5">
                                {formatINR(customer.totalSpent)}
                              </p>
                            </div>
                          </div>
                        </>
                      )}
                    </div>
                  )}

                  {/* TAB 2: LIVE CART & ADD ITEMS */}
                  {opsTab === "cart" && (
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-xs text-foreground">Active Cart Items</span>
                        {isEditable ? (
                          <Button
                            size="sm"
                            className="h-7 text-[11px] bg-emerald-600 hover:bg-emerald-700 text-white gap-1 px-2.5 font-bold"
                            onClick={() => setAddCartItemOpen(true)}
                            disabled={!customer?.id}
                          >
                            <Plus size={12} /> Add Item to Cart
                          </Button>
                        ) : isSessionClosed ? (
                          <span className="text-[10px] text-muted-foreground italic bg-muted px-2 py-0.5 rounded border border-card-border">🔒 Session closed</span>
                        ) : (
                          <Button
                            size="sm"
                            className="h-7 text-[11px] bg-amber-600 hover:bg-amber-700 text-white gap-1 px-2.5 font-bold"
                            onClick={() => {
                              setPermissionScope("cart");
                              setRequestPermissionOpen(true);
                            }}
                          >
                            <Lock size={12} /> Request Cart Permission
                          </Button>
                        )}
                      </div>

                      {isSessionClosed ? (
                        <div className="p-8 text-center border border-card-border bg-muted/10 rounded-2xl text-muted-foreground text-xs space-y-2">
                          <Lock size={26} className="mx-auto text-muted-foreground/60" />
                          <p className="font-bold text-foreground">Customer Cart Hidden</p>
                          <p className="text-[11px] max-w-xs mx-auto">
                            The support session has been closed. Cart items and rep modification actions are automatically protected and hidden.
                          </p>
                        </div>
                      ) : cart.items.length === 0 ? (
                        <div className="p-6 text-center border border-dashed border-card-border rounded-xl text-muted-foreground text-xs space-y-1">
                          <ShoppingCart size={24} className="mx-auto opacity-40 mb-1" />
                          <p className="font-medium">Customer's cart is empty.</p>
                          <p className="text-[10px]">
                            {isPermissionGranted
                              ? "Click '+ Add Item to Cart' above to put items into their cart live."
                              : "Request permission to add items into the customer's cart on their behalf."}
                          </p>
                        </div>
                      ) : (
                        <div className="space-y-2">
                          {cart.items.map((item) => (
                            <div
                              key={item.id}
                              className="p-2.5 bg-muted/20 border border-card-border rounded-xl flex items-center justify-between gap-2"
                            >
                              <div className="flex items-center gap-2 overflow-hidden">
                                {item.image ? (
                                  <img src={item.image} alt="" className="w-9 h-9 rounded-lg object-cover shrink-0 border" />
                                ) : (
                                  <div className="w-9 h-9 rounded-lg bg-muted flex items-center justify-center shrink-0">
                                    <ShoppingBag size={14} className="text-muted-foreground" />
                                  </div>
                                )}
                                <div className="truncate">
                                  <p className="font-bold text-xs text-foreground truncate">{item.name}</p>
                                  <p className="text-[10px] text-muted-foreground">
                                    {formatINR(item.price)} / {item.unit || "unit"}
                                  </p>
                                </div>
                              </div>

                              <div className="flex items-center gap-1.5 shrink-0">
                                <div className="flex items-center border border-card-border rounded-lg bg-background overflow-hidden">
                                  <button
                                    disabled={!isEditable}
                                    onClick={() => isEditable ? updateCartQtyMutation.mutate({ cartItemId: item.id, qty: item.qty - 1 }) : setRequestPermissionOpen(true)}
                                    className="p-1 text-muted-foreground hover:text-foreground hover:bg-muted disabled:opacity-40 disabled:cursor-not-allowed"
                                    title={!isEditable ? (isSessionClosed ? "Session is closed" : "Customer permission required") : ""}
                                  >
                                    <Minus size={11} />
                                  </button>
                                  <span className="px-1.5 text-xs font-bold font-mono">{item.qty}</span>
                                  <button
                                    disabled={!isEditable}
                                    onClick={() => isEditable ? updateCartQtyMutation.mutate({ cartItemId: item.id, qty: item.qty + 1 }) : setRequestPermissionOpen(true)}
                                    className="p-1 text-muted-foreground hover:text-foreground hover:bg-muted disabled:opacity-40 disabled:cursor-not-allowed"
                                    title={!isEditable ? (isSessionClosed ? "Session is closed" : "Customer permission required") : ""}
                                  >
                                    <Plus size={11} />
                                  </button>
                                </div>
                                <button
                                  disabled={!isEditable}
                                  onClick={() => isEditable ? removeCartItemMutation.mutate(item.id) : setRequestPermissionOpen(true)}
                                  className="p-1 text-red-500 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950/30 rounded disabled:opacity-40 disabled:cursor-not-allowed"
                                  title={!isEditable ? (isSessionClosed ? "Session is closed" : "Customer permission required") : ""}
                                >
                                  <Trash2 size={13} />
                                </button>
                              </div>
                            </div>
                          ))}

                          {/* Subtotal row */}
                          <div className="p-2.5 bg-emerald-500/10 border border-emerald-500/20 rounded-xl flex items-center justify-between text-xs font-bold text-emerald-800 dark:text-emerald-300">
                            <span>Cart Total</span>
                            <span>{formatINR(cart.total)}</span>
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {/* TAB 3: CUSTOMER ORDERS & REVERT CANCELLATIONS */}
                  {opsTab === "orders" && (
                    <div className="space-y-3">
                      <span className="font-bold text-xs text-foreground">Customer Order History</span>

                      {customerOrders.length === 0 ? (
                        <div className="p-6 text-center border border-dashed border-card-border rounded-xl text-muted-foreground text-xs">
                          <Package size={24} className="mx-auto opacity-40 mb-1" />
                          <p>No orders placed by this customer yet.</p>
                        </div>
                      ) : (
                        <div className="space-y-2.5">
                          {customerOrders.map((order) => {
                            const isCancelled = order.status === "Cancelled";
                            return (
                              <div
                                key={order.id}
                                className={`p-3 rounded-xl border text-xs space-y-2 transition ${
                                  isCancelled
                                    ? "bg-red-50/40 dark:bg-red-950/15 border-red-200 dark:border-red-900/40"
                                    : "bg-muted/20 border-card-border"
                                }`}
                              >
                                <div className="flex items-center justify-between">
                                  <span className="font-bold text-foreground">Order #{order.id}</span>
                                  <Badge
                                    variant={isCancelled ? "destructive" : order.status === "Delivered" ? "default" : "secondary"}
                                    className="text-[10px] capitalize font-bold"
                                  >
                                    {order.status}
                                  </Badge>
                                </div>

                                <div className="space-y-0.5 text-[11px] text-muted-foreground">
                                  <p>📅 {new Date(order.createdAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}</p>
                                  <p>💰 Total: <strong className="text-foreground">{formatINR(Number(order.total))}</strong> ({order.paymentMethod})</p>
                                  <p className="truncate">📍 {order.address}</p>
                                </div>

                                {/* Order Action Buttons for Rep */}
                                <div className="flex items-center gap-1.5 pt-1 border-t border-card-border/60">
                                  {isEditable ? (
                                    <>
                                      <Button
                                        size="sm"
                                        variant="outline"
                                        className="h-6 text-[10px] gap-1 px-2 font-semibold"
                                        onClick={() => {
                                          setSelectedOrder(order);
                                          setOrderEditData({ address: order.address, phone: order.phone, status: order.status });
                                          setEditOrderOpen(true);
                                        }}
                                      >
                                        <Edit3 size={10} /> Edit Address/Status
                                      </Button>

                                      {isCancelled ? (
                                        <Button
                                          size="sm"
                                          className="h-6 text-[10px] bg-emerald-600 hover:bg-emerald-700 text-white gap-1 px-2 font-bold"
                                          onClick={() => revertCancelMutation.mutate({ orderId: order.id, targetStatus: "Placed" })}
                                          disabled={revertCancelMutation.isPending}
                                        >
                                          <RotateCcw size={10} /> Revert Cancel
                                        </Button>
                                      ) : (
                                        <Button
                                          size="sm"
                                          variant="outline"
                                          className="h-6 text-[10px] text-red-500 border-red-200 hover:bg-red-50 dark:hover:bg-red-950/30 gap-1 px-2 font-semibold"
                                          onClick={() => {
                                            setSelectedOrder(order);
                                            setCancelOrderOpen(true);
                                          }}
                                        >
                                          <Ban size={10} /> Cancel Order
                                        </Button>
                                      )}
                                    </>
                                  ) : isSessionClosed ? (
                                    <span className="text-[10px] text-muted-foreground italic">Session closed</span>
                                  ) : (
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      className="h-6 text-[10px] text-amber-600 border-amber-500/30 hover:bg-amber-50 dark:hover:bg-amber-950/40 gap-1 px-2 font-semibold"
                                      onClick={() => {
                                        setPermissionScope("orders");
                                        setRequestPermissionOpen(true);
                                      }}
                                    >
                                      <Lock size={10} /> Request Order Permission
                                    </Button>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ─── MODAL 1: EDIT CUSTOMER PROFILE ─── */}
      <Dialog open={editProfileOpen} onOpenChange={setEditProfileOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base font-bold">
              <User size={16} className="text-emerald-500" />
              Update Customer Profile
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2 text-xs">
            <div>
              <Label className="text-xs font-semibold">Customer Full Name</Label>
              <Input
                value={editProfileData.name}
                onChange={(e) => setEditProfileData({ ...editProfileData, name: e.target.value })}
                placeholder="Full name"
                className="mt-1 text-xs"
              />
            </div>
            <div>
              <Label className="text-xs font-semibold">Phone Number</Label>
              <Input
                value={editProfileData.phone}
                onChange={(e) => setEditProfileData({ ...editProfileData, phone: e.target.value })}
                placeholder="+91 XXXXX XXXXX"
                className="mt-1 text-xs"
              />
            </div>
            <div>
              <Label className="text-xs font-semibold">Email Address</Label>
              <Input
                value={editProfileData.email}
                onChange={(e) => setEditProfileData({ ...editProfileData, email: e.target.value })}
                placeholder="customer@example.com"
                className="mt-1 text-xs"
              />
            </div>
            <div>
              <Label className="text-xs font-semibold">Delivery Address</Label>
              <Textarea
                value={editProfileData.address}
                onChange={(e) => setEditProfileData({ ...editProfileData, address: e.target.value })}
                placeholder="Full delivery address with pincode"
                className="mt-1 text-xs"
                rows={3}
              />
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" size="sm" onClick={() => setEditProfileOpen(false)}>
              Cancel
            </Button>
            <Button
              size="sm"
              className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold"
              onClick={() => updateCustomerMutation.mutate(editProfileData)}
              disabled={updateCustomerMutation.isPending}
            >
              {updateCustomerMutation.isPending ? "Saving..." : "Save Profile Details"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ─── MODAL 2: ADD ITEM TO CUSTOMER CART ─── */}
      <Dialog open={addCartItemOpen} onOpenChange={setAddCartItemOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base font-bold">
              <ShoppingCart size={16} className="text-emerald-500" />
              Add Product to Customer Cart
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2 text-xs">
            <div>
              <Label className="text-xs font-semibold">Search Store Catalog</Label>
              <div className="relative mt-1">
                <Search size={14} className="absolute left-2.5 top-2.5 text-muted-foreground" />
                <Input
                  value={productSearch}
                  onChange={(e) => setProductSearch(e.target.value)}
                  placeholder="Search tomatoes, mangoes, sweets..."
                  className="pl-8 text-xs"
                />
              </div>
            </div>

            <div className="max-h-48 overflow-y-auto space-y-1.5 border border-card-border rounded-xl p-1.5">
              {filteredCatalog.length === 0 ? (
                <p className="text-center text-muted-foreground py-4 text-xs">No products found matching query.</p>
              ) : (
                filteredCatalog.map((p) => (
                  <div
                    key={p.id}
                    onClick={() => setSelectedProductId(String(p.id))}
                    className={`p-2 rounded-lg flex items-center justify-between cursor-pointer transition ${
                      selectedProductId === String(p.id)
                        ? "bg-emerald-500/20 border border-emerald-500 font-bold"
                        : "hover:bg-muted/40 border border-transparent"
                    }`}
                  >
                    <div className="flex items-center gap-2 truncate">
                      {p.image && <img src={p.image} alt="" className="w-7 h-7 rounded object-cover shrink-0" />}
                      <span className="truncate text-xs">{p.name}</span>
                    </div>
                    <span className="text-xs font-mono font-bold text-emerald-600 shrink-0">
                      {formatINR(Number(p.price))}
                    </span>
                  </div>
                ))
              )}
            </div>

            <div className="flex items-center gap-3">
              <Label className="text-xs font-semibold shrink-0">Quantity:</Label>
              <div className="flex items-center border border-card-border rounded-lg bg-background">
                <button
                  type="button"
                  onClick={() => setAddQty(Math.max(1, addQty - 1))}
                  className="p-1.5 text-muted-foreground hover:text-foreground"
                >
                  <Minus size={12} />
                </button>
                <span className="px-3 text-xs font-bold font-mono">{addQty}</span>
                <button
                  type="button"
                  onClick={() => setAddQty(addQty + 1)}
                  className="p-1.5 text-muted-foreground hover:text-foreground"
                >
                  <Plus size={12} />
                </button>
              </div>
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" size="sm" onClick={() => setAddCartItemOpen(false)}>
              Cancel
            </Button>
            <Button
              size="sm"
              className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold"
              onClick={() => addToCartMutation.mutate()}
              disabled={addToCartMutation.isPending || !selectedProductId}
            >
              {addToCartMutation.isPending ? "Adding..." : "Add to Customer Cart"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ─── MODAL 3: EDIT ORDER DETAILS ─── */}
      <Dialog open={editOrderOpen} onOpenChange={setEditOrderOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base font-bold">
              <Package size={16} className="text-emerald-500" />
              Edit Order #{selectedOrder?.id}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2 text-xs">
            <div>
              <Label className="text-xs font-semibold">Order Status</Label>
              <Select
                value={orderEditData.status}
                onValueChange={(val) => setOrderEditData({ ...orderEditData, status: val })}
              >
                <SelectTrigger className="mt-1 text-xs">
                  <SelectValue placeholder="Select status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Placed">Placed</SelectItem>
                  <SelectItem value="Packed">Packed</SelectItem>
                  <SelectItem value="Out for delivery">Out for delivery</SelectItem>
                  <SelectItem value="Delivered">Delivered</SelectItem>
                  <SelectItem value="Cancelled">Cancelled</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs font-semibold">Delivery Phone</Label>
              <Input
                value={orderEditData.phone}
                onChange={(e) => setOrderEditData({ ...orderEditData, phone: e.target.value })}
                className="mt-1 text-xs"
              />
            </div>
            <div>
              <Label className="text-xs font-semibold">Delivery Address</Label>
              <Textarea
                value={orderEditData.address}
                onChange={(e) => setOrderEditData({ ...orderEditData, address: e.target.value })}
                className="mt-1 text-xs"
                rows={3}
              />
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" size="sm" onClick={() => setEditOrderOpen(false)}>
              Cancel
            </Button>
            <Button
              size="sm"
              className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold"
              onClick={() => updateOrderMutation.mutate()}
              disabled={updateOrderMutation.isPending}
            >
              {updateOrderMutation.isPending ? "Saving..." : "Save Order Changes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ─── MODAL 4: CANCEL ORDER CONFIRMATION ─── */}
      <Dialog open={cancelOrderOpen} onOpenChange={setCancelOrderOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base font-bold text-red-500">
              <Ban size={16} />
              Cancel Order #{selectedOrder?.id}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2 text-xs">
            <p className="text-muted-foreground">
              Are you sure you want to cancel this order upon customer's request? A cancellation notice will be recorded in chat.
            </p>
            <div>
              <Label className="text-xs font-semibold">Cancellation Reason</Label>
              <Input
                value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value)}
                placeholder="Reason for cancellation"
                className="mt-1 text-xs"
              />
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" size="sm" onClick={() => setCancelOrderOpen(false)}>
              Keep Order
            </Button>
            <Button
              size="sm"
              variant="destructive"
              className="font-bold"
              onClick={() => selectedOrder && cancelOrderMutation.mutate(selectedOrder.id)}
              disabled={cancelOrderMutation.isPending}
            >
              {cancelOrderMutation.isPending ? "Cancelling..." : "Confirm Cancellation"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ─── MODAL 5: REQUEST CUSTOMER PERMISSION ─── */}
      <Dialog open={requestPermissionOpen} onOpenChange={setRequestPermissionOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base font-bold text-amber-600 dark:text-amber-400">
              <ShieldAlert size={18} />
              Request Customer Authorization
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2 text-xs">
            <p className="text-muted-foreground leading-relaxed">
              Customer Representatives can view customer profiles, cart, and orders in Read-Only mode by default. To make changes on behalf of the customer, send an authorization prompt to the customer in chat.
            </p>
            <div>
              <Label className="text-xs font-semibold">Permission Scope</Label>
              <Select value={permissionScope} onValueChange={setPermissionScope}>
                <SelectTrigger className="mt-1 text-xs">
                  <SelectValue placeholder="Select scope" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Full Access (Profile, Cart &amp; Orders)</SelectItem>
                  <SelectItem value="cart">Live Cart Management Only</SelectItem>
                  <SelectItem value="profile">Customer Profile Details Only</SelectItem>
                  <SelectItem value="orders">Order Modifications &amp; Cancellations Only</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs font-semibold">Note / Reason for Customer (Optional)</Label>
              <Input
                value={permissionNote}
                onChange={(e) => setPermissionNote(e.target.value)}
                placeholder="e.g. Adding seasonal fruits to your cart per your request"
                className="mt-1 text-xs"
              />
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" size="sm" onClick={() => setRequestPermissionOpen(false)}>
              Cancel
            </Button>
            <Button
              size="sm"
              className="bg-amber-600 hover:bg-amber-700 text-white font-bold gap-1.5"
              onClick={() => requestPermissionMutation.mutate()}
              disabled={requestPermissionMutation.isPending}
            >
              <Send size={12} />
              {requestPermissionMutation.isPending ? "Sending Request..." : "Send Authorization Prompt"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ─── MODAL 6: DELETE CHAT SESSION CONFIRMATION ─── */}
      <Dialog open={!!deleteConfirmToken} onOpenChange={(o) => !o && setDeleteConfirmToken(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base font-bold text-red-600">
              <Trash2 size={18} />
              Permanently Delete Chat Session?
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2 text-xs">
            <p className="text-muted-foreground leading-relaxed">
              Are you sure you want to permanently delete this chat session (<code>{deleteConfirmToken}</code>) and all related messages from the database?
            </p>
            <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-red-600 dark:text-red-400 font-semibold">
              ⚠️ Warning: This action cannot be undone. All message logs and context for this session will be permanently erased.
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" size="sm" onClick={() => setDeleteConfirmToken(null)}>
              Cancel
            </Button>
            <Button
              size="sm"
              variant="destructive"
              className="font-bold gap-1.5"
              onClick={() => deleteConfirmToken && deleteSessionMutation.mutate(deleteConfirmToken)}
              disabled={deleteSessionMutation.isPending}
            >
              <Trash2 size={13} />
              {deleteSessionMutation.isPending ? "Deleting..." : "Permanently Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ─── MODAL 7: PURGE ALL CLOSED SESSIONS CONFIRMATION ─── */}
      <Dialog open={purgeConfirmOpen} onOpenChange={setPurgeConfirmOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base font-bold text-amber-600 dark:text-amber-400">
              <Trash2 size={18} />
              Purge All Closed Sessions From Database?
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2 text-xs">
            <p className="text-muted-foreground leading-relaxed">
              This will permanently delete all closed/resolved chat support sessions and their associated message logs from the database to save space.
            </p>
            <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl text-amber-700 dark:text-amber-300 font-semibold">
              ℹ️ Active live sessions and waiting customer requests will NOT be deleted.
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" size="sm" onClick={() => setPurgeConfirmOpen(false)}>
              Cancel
            </Button>
            <Button
              size="sm"
              className="bg-amber-600 hover:bg-amber-700 text-white font-bold gap-1.5"
              onClick={() => purgeSessionsMutation.mutate()}
              disabled={purgeSessionsMutation.isPending}
            >
              <Trash2 size={13} />
              {purgeSessionsMutation.isPending ? "Purging Database..." : "Confirm Purge"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
}

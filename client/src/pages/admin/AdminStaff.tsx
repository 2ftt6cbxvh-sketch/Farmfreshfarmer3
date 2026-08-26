import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Users, UserPlus, Shield, ShieldAlert, Lock, Trash2, CheckCircle2,
  XCircle, Edit3, Key, Phone, Mail, Check, ChevronDown, Sparkles,
  Smartphone, Send, RefreshCw, AlertTriangle, Star
} from "lucide-react";
import { AdminLayout } from "./AdminLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { getStarTheme } from "@/lib/starTheme";

export const ALL_MENU_OPTIONS = [
  // Core
  { href: "/admin", label: "Dashboard", category: "Core" },
  { href: "/admin/live-chat", label: "Live Support Chat 💬", category: "Core" },
  { href: "/admin/tickets", label: "Support Tickets", category: "Core" },

  // Catalog
  { href: "/admin/products", label: "Products", category: "Catalog" },
  { href: "/admin/categories", label: "Categories", category: "Catalog" },
  { href: "/admin/approvals", label: "Approvals & Moderation 🛡️", category: "Catalog" },
  { href: "/admin/inventory", label: "Inventory & Stock", category: "Catalog" },

  // Sales
  { href: "/admin/orders", label: "Orders & Live Dispatch", category: "Sales" },
  { href: "/admin/refunds", label: "Refunds & PhonePe Processing 💳", category: "Sales" },
  { href: "/admin/subscriptions", label: "Subscriptions", category: "Sales" },
  { href: "/admin/payments", label: "Payments & Invoices", category: "Sales" },

  // Growth
  { href: "/admin/customers", label: "Customers", category: "Growth" },
  { href: "/admin/reviews", label: "Customer Reviews", category: "Growth" },
  { href: "/admin/coupons", label: "Coupons", category: "Growth" },
  { href: "/admin/discounts", label: "Discounts & Offers", category: "Growth" },
  { href: "/admin/referrals", label: "Referral Program", category: "Growth" },

  // System & Platform
  { href: "/admin/staff", label: "Staff & Sub-Admins", category: "System" },
  { href: "/admin/users", label: "User Roster", category: "System" },
  { href: "/admin/delivery-partners", label: "Delivery Partners", category: "System" },
  { href: "/admin/warehouses", label: "Warehouses & Hubs", category: "System" },
  { href: "/admin/delivery", label: "Delivery & Geo Logistics", category: "System" },
  { href: "/admin/gst", label: "GST & Tax Config", category: "System" },
  { href: "/admin/security", label: "Security Logs & Bot Access", category: "System" },
  { href: "/admin/settings", label: "Settings (Platform Config)", category: "System" },
];

const PRESET_ROLES = [
  { value: "custom_subadmin", label: "Custom Sub-Admin (Pick Menus)", defaultPerms: ["/admin", "/admin/orders"] },
  { value: "warehouse_admin", label: "Warehouse Admin", defaultPerms: ["/admin", "/admin/inventory", "/admin/warehouses"] },
  { value: "manager_admin", label: "Manager Admin", defaultPerms: ["/admin", "/admin/products", "/admin/categories", "/admin/approvals", "/admin/orders", "/admin/inventory"] },
  { value: "delivery_partner", label: "Delivery Partner / Rider", defaultPerms: ["/admin", "/admin/orders", "/admin/delivery"] },
  { value: "customer_rep", label: "Customer Representative", defaultPerms: ["/admin", "/admin/orders", "/admin/customers", "/admin/live-chat", "/admin/tickets"] },
  { value: "local_grievance_officer", label: "Local Grievance Officer", defaultPerms: ["/admin", "/admin/orders", "/admin/customers", "/admin/reviews", "/admin/tickets", "/admin/live-chat"] },
  { value: "zonal_grievance_officer", label: "Zonal Grievance Officer", defaultPerms: ["/admin", "/admin/orders", "/admin/customers", "/admin/reviews", "/admin/tickets", "/admin/live-chat"] },
  { value: "chief_grievance_officer", label: "Chief Grievance Officer", defaultPerms: ["/admin", "/admin/orders", "/admin/customers", "/admin/reviews", "/admin/tickets", "/admin/live-chat", "/admin/settings"] },
  { value: "admin", label: "Main Admin (Full Rights)", defaultPerms: ALL_MENU_OPTIONS.map((m) => m.href) },
];

export default function AdminStaff() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [modalOpen, setModalOpen] = useState(false);
  const [editStaff, setEditStaff] = useState<any>(null);

  // Form State
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState("custom_subadmin");
  const [customTitle, setCustomTitle] = useState("");
  const [telegramChatId, setTelegramChatId] = useState("");
  const [selectedPermissions, setSelectedPermissions] = useState<string[]>(["/admin", "/admin/orders"]);
  const [isVerified, setIsVerified] = useState(true);
  const [starRating, setStarRating] = useState(5);
  const [experienceRank, setExperienceRank] = useState("Senior Specialist");

  // 2FA Global Settings State
  const [twoFaEnabled, setTwoFaEnabled] = useState(false);
  const [twoFaBotToken, setTwoFaBotToken] = useState("");
  const [testChatId, setTestChatId] = useState("");

  const { data, isLoading, error } = useQuery<{ staff: any[] }>({
    queryKey: ["/api/admin/staff"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/admin/staff");
      return res.json();
    },
  });

  const { data: twoFaConfig, refetch: refetch2fa } = useQuery({
    queryKey: ["/api/admin/staff/2fa-config"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/admin/staff/2fa-config");
      return res.json();
    },
  });

  useEffect(() => {
    if (twoFaConfig) {
      setTwoFaEnabled(!!twoFaConfig.enabled);
      if (twoFaConfig.botToken && !twoFaConfig.botToken.includes("...")) {
        setTwoFaBotToken(twoFaConfig.botToken);
      }
    }
  }, [twoFaConfig]);

  const save2faMutation = useMutation({
    mutationFn: async (payload: { enabled: boolean; botToken?: string }) => {
      const res = await apiRequest("POST", "/api/admin/staff/2fa-config", payload);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/staff/2fa-config"] });
      refetch2fa();
      toast({ title: "🛡️ 2FA Security Settings Saved!" });
    },
    onError: (err: any) => {
      toast({ title: "Error", description: err?.message || "Failed to save 2FA configuration", variant: "destructive" });
    },
  });

  const test2faMutation = useMutation({
    mutationFn: async (chatId: string) => {
      const res = await apiRequest("POST", "/api/admin/staff/2fa-test", { chatId });
      return res.json();
    },
    onSuccess: (data) => {
      toast({ title: "✨ 2FA OTP Dispatched!", description: data?.message || "Check your Telegram app." });
    },
    onError: (err: any) => {
      toast({ title: "2FA Dispatch Failed", description: err?.message || "Could not send OTP", variant: "destructive" });
    },
  });

  const staffList = data?.staff || [];

  const openCreateModal = () => {
    setEditStaff(null);
    setName("");
    setEmail("");
    setPhone("");
    setPassword("");
    setRole("custom_subadmin");
    setCustomTitle("");
    setTelegramChatId("");
    setSelectedPermissions(["/admin", "/admin/orders"]);
    setIsVerified(true);
    setStarRating(5);
    setExperienceRank("Senior Specialist");
    setModalOpen(true);
  };

  const openEditModal = (staff: any) => {
    if (!staff) return;
    setEditStaff(staff);
    setName(staff.name || "");
    setEmail(staff.email || "");
    setPhone(staff.phone || "");
    setPassword(""); // Blank unless updating password
    setRole(staff.role || "custom_subadmin");
    setCustomTitle(staff.customTitle || "");
    setTelegramChatId(staff.telegramChatId || "");

    let permsArray: string[] = [];
    if (Array.isArray(staff.permissions)) {
      permsArray = staff.permissions;
    } else if (typeof staff.permissions === "string" && staff.permissions.trim()) {
      try {
        const parsed = JSON.parse(staff.permissions);
        if (Array.isArray(parsed)) permsArray = parsed;
      } catch (e) {
        console.warn("[AdminStaff] failed to parse perms string:", e);
      }
    }
    setSelectedPermissions(permsArray);
    setIsVerified(staff.isVerified !== false);
    setStarRating(Math.min(5, Math.max(1, Number(staff.starRating) || 5)));
    setExperienceRank(staff.experienceRank || "Senior Specialist");
    setModalOpen(true);
  };

  const createMutation = useMutation({
    mutationFn: async (payload: any) => {
      const res = await apiRequest("POST", "/api/admin/staff", payload);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/staff"] });
      toast({ title: "✨ Sub-Admin Created", description: "New staff member credentials & permissions saved." });
      setModalOpen(false);
    },
    onError: (err: any) => {
      toast({ title: "Failed to create sub-admin", description: err.message, variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, payload }: { id: number; payload: any }) => {
      const res = await apiRequest("PATCH", `/api/admin/staff/${id}`, payload);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/staff"] });
      toast({ title: "✨ Sub-Admin Updated", description: "Credentials & permissions updated." });
      setModalOpen(false);
    },
    onError: (err: any) => {
      toast({ title: "Failed to update sub-admin", description: err.message, variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await apiRequest("DELETE", `/api/admin/staff/${id}`);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/staff"] });
      toast({ title: "Sub-Admin Deleted", description: "Account removed." });
    },
    onError: (err: any) => {
      toast({ title: "Delete Failed", description: err.message, variant: "destructive" });
    },
  });

  const handleTogglePermission = (href: string) => {
    setSelectedPermissions((prev) => {
      const arr = Array.isArray(prev) ? prev : [];
      return arr.includes(href) ? arr.filter((p) => p !== href) : [...arr, href];
    });
  };

  const handleRoleChange = (newRole: string) => {
    setRole(newRole);
    const preset = PRESET_ROLES.find((r) => r.value === newRole);
    if (preset) {
      setSelectedPermissions(preset.defaultPerms);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (role === "custom_subadmin" && !customTitle.trim()) {
      toast({
        title: "Custom Title Required",
        description: "Please enter a custom designation title (e.g. Regional Manager, Inventory Lead) when selecting Custom Sub-Admin.",
        variant: "destructive",
      });
      return;
    }

    if (editStaff) {
      updateMutation.mutate({
        id: editStaff.id,
        payload: {
          name,
          phone,
          ...(password ? { password } : {}),
          role,
          customTitle: customTitle.trim(),
          telegramChatId: telegramChatId.trim(),
          permissions: selectedPermissions,
          isVerified,
          starRating,
          experienceRank: experienceRank.trim() || "Senior Specialist",
        },
      });
    } else {
      createMutation.mutate({
        name,
        email,
        phone,
        password,
        role,
        customTitle: customTitle.trim(),
        telegramChatId: telegramChatId.trim(),
        permissions: selectedPermissions,
        isVerified,
        starRating,
        experienceRank: experienceRank.trim() || "Senior Specialist",
      });
    }
  };

  const handleToggleStatus = (staff: any) => {
    const newStatus = staff.status === "active" ? "blocked" : "active";
    updateMutation.mutate({
      id: staff.id,
      payload: { status: newStatus },
    });
  };

  return (
    <AdminLayout title="Staff & Sub-Admins">
      <div className="space-y-6">
        {/* Top Header Card */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-6 rounded-3xl bg-gradient-to-r from-emerald-950/60 via-card to-card border border-emerald-500/30 shadow-xl">
          <div>
            <div className="flex items-center gap-2">
              <Shield className="w-6 h-6 text-emerald-400" />
              <h1 className="text-xl font-extrabold text-foreground font-serif">Staff & Sub-Admin Control</h1>
              <span className="bg-amber-500/20 text-amber-300 text-[10px] font-black px-2.5 py-0.5 rounded-full border border-amber-500/30">
                Primary Admin Only
              </span>
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Add, modify credentials, block accounts, configure 2FA Telegram OTPs, and assign granular menu permissions to designated sub-admin roles.
            </p>
          </div>
          <Button onClick={openCreateModal} className="gap-2 rounded-2xl bg-gradient-to-r from-emerald-600 via-primary to-green-500 text-white font-extrabold shadow-lg shadow-emerald-900/30 hover:scale-105 transition-all">
            <UserPlus size={16} />
            <span>Add Sub-Admin</span>
          </Button>
        </div>

        {/* 🛡️ Sub-Admin 2FA Security Layer & Dedicated Telegram OTP Authenticator Card */}
        <div className="p-6 rounded-3xl bg-card border border-emerald-500/30 shadow-xl space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border pb-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
                <Key size={20} />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-base font-extrabold text-foreground">Sub-Admin 2FA Telegram Authenticator Layer</h2>
                  {twoFaConfig?.configured ? (
                    <span className="inline-flex items-center gap-1 bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 text-[10px] font-extrabold px-2 py-0.5 rounded-full">
                      <CheckCircle2 size={11} /> Bot Connected
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 bg-amber-500/15 text-amber-400 border border-amber-500/30 text-[10px] font-extrabold px-2 py-0.5 rounded-full">
                      <AlertTriangle size={11} /> Token Required
                    </span>
                  )}
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Sends unbreachable, time-limited (3-min) 6-digit OTPs directly to each sub-admin's Telegram account before allowing dashboard login.
                </p>
              </div>
            </div>

            {/* Global Master 2FA Requirement Switch */}
            <div className="flex items-center gap-3 bg-secondary/50 border border-border p-2 px-3 rounded-2xl">
              <span className="text-xs font-extrabold text-foreground">Global 2FA Enforcement:</span>
              <button
                type="button"
                onClick={() => setTwoFaEnabled(!twoFaEnabled)}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ${
                  twoFaEnabled ? "bg-emerald-500" : "bg-muted"
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    twoFaEnabled ? "translate-x-6" : "translate-x-1"
                  }`}
                />
              </button>
              <span className={`text-[11px] font-black uppercase ${twoFaEnabled ? "text-emerald-400" : "text-muted-foreground"}`}>
                {twoFaEnabled ? "ENFORCED (ON)" : "DISABLED (OFF)"}
              </span>
            </div>
          </div>

          {/* Dedicated 2FA OTP Bot Credentials & Dispatch Tester */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 pt-1">
            <div className="space-y-2">
              <label className="text-xs font-bold text-foreground flex items-center justify-between">
                <span>Dedicated 2FA OTP Bot Token (from @BotFather)</span>
                <span className="text-[10px] text-muted-foreground">e.g. 7123456789:AAFx...</span>
              </label>
              <Input
                type="password"
                value={twoFaBotToken}
                onChange={(e) => setTwoFaBotToken(e.target.value)}
                placeholder={twoFaConfig?.botToken ? "•••••••••••••••• (Saved. Type to change)" : "Enter dedicated 2FA bot token from @BotFather"}
                className="rounded-xl text-xs"
              />
              <p className="text-[10px] text-muted-foreground">
                Create a distinct private Telegram bot on @BotFather (e.g. <code>@FarmFreshAuthenticatorBot</code>) strictly for dispatching login OTPs.
              </p>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-bold text-foreground flex items-center justify-between">
                <span>Test 2FA OTP Dispatch</span>
                <span className="text-[10px] text-muted-foreground">Send real-time verification code</span>
              </label>
              <div className="flex items-center gap-2">
                <Input
                  type="text"
                  value={testChatId}
                  onChange={(e) => setTestChatId(e.target.value)}
                  placeholder="Enter Telegram Chat ID (e.g. 1927711332)"
                  className="rounded-xl text-xs flex-1"
                />
                <Button
                  type="button"
                  onClick={() => test2faMutation.mutate(testChatId)}
                  disabled={test2faMutation.isPending || !testChatId.trim()}
                  className="rounded-xl bg-sky-600 hover:bg-sky-500 text-white font-bold text-xs gap-1.5 shrink-0"
                >
                  <Send size={13} />
                  <span>{test2faMutation.isPending ? "Sending…" : "Send Test OTP"}</span>
                </Button>
              </div>
              <p className="text-[10px] text-muted-foreground">
                Ensure the recipient has opened the 2FA bot in Telegram and clicked <b>/start</b> before testing.
              </p>
            </div>
          </div>

          <div className="flex items-center justify-end pt-2 border-t border-border/50">
            <Button
              type="button"
              onClick={() => save2faMutation.mutate({ enabled: twoFaEnabled, botToken: twoFaBotToken })}
              disabled={save2faMutation.isPending}
              className="rounded-2xl bg-gradient-to-r from-emerald-600 via-primary to-green-500 text-white font-extrabold text-xs shadow-md"
            >
              {save2faMutation.isPending ? "Saving Security Settings…" : "💾 Save 2FA Security Settings"}
            </Button>
          </div>
        </div>

        {/* Staff Members List Table */}
        <div className="rounded-3xl border border-emerald-500/20 bg-card overflow-hidden shadow-xl">
          <div className="p-4 border-b border-border flex items-center justify-between">
            <h2 className="text-sm font-bold text-foreground flex items-center gap-2">
              <Users size={16} className="text-emerald-400" />
              <span>Sub-Admin Roster ({staffList.length})</span>
            </h2>
          </div>

          {isLoading ? (
            <div className="p-8 text-center text-xs text-muted-foreground">Loading sub-admin roster…</div>
          ) : error ? (
            <div className="p-8 text-center text-xs text-destructive flex items-center justify-center gap-2">
              <ShieldAlert size={16} />
              <span>{(error as any)?.message || "Failed to load sub-admin roster"}</span>
            </div>
          ) : staffList.length === 0 ? (
            <div className="p-8 text-center text-xs text-muted-foreground">No sub-admins configured yet. Click "Add Sub-Admin" to create staff credentials.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-secondary/40 text-muted-foreground uppercase text-[10px] font-bold border-b border-border">
                  <tr>
                    <th className="p-4">Staff Member</th>
                    <th className="p-4">Role & Designation</th>
                    <th className="p-4">Telegram 2FA ID</th>
                    <th className="p-4">Menu Permissions</th>
                    <th className="p-4">Status</th>
                    <th className="p-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/60">
                  {staffList.map((s) => {
                    const isPrimary = s.isPrimaryAdmin || s.email.toLowerCase() === "admin@farmfreshfarmer.com";
                    const isBlocked = s.status === "blocked";
                    const perms: string[] = Array.isArray(s.permissions) ? s.permissions : [];

                    return (
                      <tr key={s.id} className="hover:bg-secondary/20 transition-colors">
                        <td className="p-4">
                          <div className="flex items-center gap-3">
                            <div className="w-9 h-9 rounded-2xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center font-extrabold text-emerald-400 text-sm">
                              {s.name ? s.name.charAt(0).toUpperCase() : "A"}
                            </div>
                            <div>
                              <p className="font-extrabold text-foreground flex items-center gap-1.5">
                                {s.name}
                                {isPrimary && (
                                  <span className="bg-emerald-500/20 text-emerald-400 text-[9px] font-black px-1.5 py-0.5 rounded-full border border-emerald-500/30">
                                    👑 Sole Super Admin
                                  </span>
                                )}
                              </p>
                              <p className="text-[11px] text-muted-foreground">{s.email}</p>
                              {s.phone && <p className="text-[10px] text-emerald-400/90 font-mono">📱 {s.phone}</p>}
                            </div>
                          </div>
                        </td>

                        <td className="p-4">
                          <div>
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-primary/15 text-primary border border-primary/30 capitalize">
                              {isPrimary ? "Sole Super Admin" : s.role === "admin" ? "Main Admin" : s.role ? s.role.replace("_", " ") : "Sub-Admin"}
                            </span>
                            {s.customTitle && (
                              <p className="text-[10px] font-bold text-amber-300 mt-1">🏷️ {s.customTitle}</p>
                            )}
                          </div>
                        </td>

                        <td className="p-4">
                          {isPrimary ? (
                            <span className="inline-flex items-center gap-1 text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                              🛡️ Super Admin 2FA
                            </span>
                          ) : s.telegramChatId ? (
                            <span className="inline-flex items-center gap-1 text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-sky-500/15 text-sky-400 border border-sky-500/30 font-mono">
                              📱 {s.telegramChatId}
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-400 border border-amber-500/30">
                              ⚠️ No 2FA ID
                            </span>
                          )}
                        </td>

                        <td className="p-4 max-w-xs">
                          {isPrimary ? (
                            <span className="text-[10px] font-bold text-emerald-400">All System Menus (Full Access)</span>
                          ) : perms.length === 0 ? (
                            <span className="text-[10px] text-muted-foreground italic">No menus assigned</span>
                          ) : (
                            <div className="flex flex-wrap gap-1">
                              {perms.map((p) => {
                                const option = ALL_MENU_OPTIONS.find((m) => m.href === p);
                                return (
                                  <span key={p} className="bg-secondary/80 text-foreground text-[10px] font-semibold px-2 py-0.5 rounded-md border border-border">
                                    {option ? option.label : p}
                                  </span>
                                );
                              })}
                            </div>
                          )}
                        </td>

                        <td className="p-4">
                          {isBlocked ? (
                            <span className="inline-flex items-center gap-1 text-[10px] font-extrabold px-2.5 py-1 rounded-full bg-red-500/15 text-red-400 border border-red-500/30">
                              <XCircle size={12} /> Blocked
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-[10px] font-extrabold px-2.5 py-1 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                              <CheckCircle2 size={12} /> Active
                            </span>
                          )}
                        </td>

                        <td className="p-4 text-right">
                          {isPrimary ? (
                            <span className="text-[10px] text-muted-foreground italic">Protected Superuser</span>
                          ) : (
                            <div className="flex items-center justify-end gap-2">
                              <Button variant="ghost" size="sm" onClick={() => openEditModal(s)} className="h-8 px-2.5 rounded-xl border border-emerald-500/20 text-xs font-bold hover:bg-emerald-500/15">
                                <Edit3 size={13} className="mr-1" /> Edit
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleToggleStatus(s)}
                                className={`h-8 px-2.5 rounded-xl text-xs font-bold border ${isBlocked ? "border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/15" : "border-amber-500/30 text-amber-400 hover:bg-amber-500/15"}`}
                              >
                                {isBlocked ? "Unblock" : "Block"}
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => {
                                  if (confirm(`Delete sub-admin account for ${s.name}?`)) {
                                    deleteMutation.mutate(s.id);
                                  }
                                }}
                                className="h-8 px-2.5 rounded-xl border border-red-500/30 text-red-400 hover:bg-red-500/15 text-xs font-bold"
                              >
                                <Trash2 size={13} />
                              </Button>
                            </div>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Add / Edit Sub-Admin Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-md p-4 overflow-y-auto">
          <div className="bg-card w-full max-w-lg rounded-3xl p-6 shadow-2xl border border-emerald-500/30 my-8 space-y-4">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <div className="flex items-center gap-2">
                <Shield className="w-5 h-5 text-emerald-400" />
                <h3 className="text-lg font-extrabold text-foreground font-serif">
                  {editStaff ? `Edit Sub-Admin: ${editStaff.name}` : "Add New Sub-Admin"}
                </h3>
              </div>
              <button onClick={() => setModalOpen(false)} className="text-muted-foreground hover:text-foreground text-sm font-bold">✕</button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-muted-foreground">Full Name *</label>
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g. Ramesh Varma"
                    className="w-full mt-1 rounded-xl border border-input bg-background px-3 py-2 text-xs font-medium focus:ring-2 focus:ring-primary outline-none"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-muted-foreground">Email Address *</label>
                  <input
                    type="email"
                    required
                    disabled={!!editStaff}
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="subadmin@farmfreshfarmer.com"
                    className="w-full mt-1 rounded-xl border border-input bg-background px-3 py-2 text-xs font-medium focus:ring-2 focus:ring-primary outline-none disabled:opacity-50"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-muted-foreground">Mobile Phone</label>
                  <input
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value.replace(/\D/g, '').slice(0, 10))}
                    placeholder="10-digit mobile"
                    className="w-full mt-1 rounded-xl border border-input bg-background px-3 py-2 text-xs font-medium focus:ring-2 focus:ring-primary outline-none"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-muted-foreground">{editStaff ? "New Password (Optional)" : "Password *"}</label>
                  <input
                    type="password"
                    required={!editStaff}
                    minLength={6}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder={editStaff ? "Leave blank to keep existing" : "Min 6 characters"}
                    className="w-full mt-1 rounded-xl border border-input bg-background px-3 py-2 text-xs font-medium focus:ring-2 focus:ring-primary outline-none"
                  />
                </div>
              </div>

              {/* Verified Badge, Experience Rank & Star Rating Controls */}
              <div className="p-3.5 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 space-y-3">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-extrabold text-emerald-300 flex items-center gap-1.5">
                    <CheckCircle2 size={14} className="text-sky-400 fill-sky-400/20" />
                    <span>Verified Staff Tick Mark</span>
                  </label>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-bold text-muted-foreground">{isVerified ? "ON (Verified ✓)" : "OFF"}</span>
                    <input
                      type="checkbox"
                      checked={isVerified}
                      onChange={(e) => setIsVerified(e.target.checked)}
                      className="w-4 h-4 rounded text-emerald-500 focus:ring-emerald-500 accent-emerald-500 cursor-pointer"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                  <div>
                    <label className="text-xs font-bold text-muted-foreground">Experience Rank Title</label>
                    <input
                      type="text"
                      value={experienceRank}
                      onChange={(e) => setExperienceRank(e.target.value)}
                      placeholder="e.g. Senior Lead, Operations Master"
                      className="w-full mt-1 rounded-xl border border-input bg-background px-3 py-2 text-xs font-medium focus:ring-2 focus:ring-primary outline-none"
                    />
                    <div className="flex flex-wrap gap-1 mt-1.5">
                      {["Senior Lead", "Operations Master", "Executive Admin", "L2 Specialist", "Customer Lead"].map((preset) => (
                        <button
                          key={preset}
                          type="button"
                          onClick={() => setExperienceRank(preset)}
                          className="text-[9px] font-bold px-1.5 py-0.5 rounded-md bg-secondary border border-border text-foreground hover:bg-emerald-500/20"
                        >
                          {preset}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Staff Star Rating Selector (0 - 6 Stars) */}
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-muted-foreground">Staff Authorization Rating (0 – 6 Stars)</label>
                    <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
                      {[0, 1, 2, 3, 4, 5, 6].map((star) => {
                        const theme = getStarTheme(star, true);
                        const isSelected = starRating === star;
                        return (
                          <button
                            key={star}
                            type="button"
                            onClick={() => setStarRating(star)}
                            className={`px-2.5 py-1 rounded-xl text-xs font-bold border transition flex items-center gap-1 ${
                              isSelected
                                ? `${theme.badgeClass} ring-2 ring-emerald-500/40 shadow-sm`
                                : "bg-background border-border text-muted-foreground hover:text-foreground"
                            }`}
                          >
                            <Star size={13} fill={isSelected ? "currentColor" : "none"} className={isSelected ? theme.starColor : ""} />
                            <span>{star === 0 ? "0★ (No Discount)" : `${star}★`}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </div>

              {/* Personal Telegram Chat ID Input for 2FA OTPs */}
              <div className="p-3 rounded-2xl bg-sky-500/10 border border-sky-500/30 space-y-1.5">
                <label className="text-xs font-extrabold text-sky-300 flex items-center justify-between">
                  <span className="flex items-center gap-1">
                    <Smartphone size={13} /> Personal Telegram Chat ID (for 2FA OTPs)
                  </span>
                  <span className="text-[10px] text-sky-400/80 font-normal">from @userinfobot</span>
                </label>
                <input
                  type="text"
                  value={telegramChatId}
                  onChange={(e) => setTelegramChatId(e.target.value)}
                  placeholder="e.g. 1927711332"
                  className="w-full rounded-xl border border-sky-500/30 bg-background/80 px-3 py-2 text-xs font-bold text-foreground font-mono focus:ring-2 focus:ring-sky-500 outline-none"
                />
                <p className="text-[10px] text-sky-300/80">
                  When global 2FA is active, this sub-admin will receive their instant 6-digit login verification OTP on this Telegram ID.
                </p>
              </div>

              {/* Role Selection */}
              <div>
                <label className="text-xs font-bold text-muted-foreground">Assigned Staff Role</label>
                <select
                  value={role}
                  onChange={(e) => handleRoleChange(e.target.value)}
                  className="w-full mt-1 rounded-xl border border-input bg-background px-3 py-2 text-xs font-bold text-foreground focus:ring-2 focus:ring-primary outline-none"
                >
                  {PRESET_ROLES.map((r) => (
                    <option key={r.value} value={r.value}>{r.label}</option>
                  ))}
                </select>
              </div>

              {/* Custom Title Input for Custom Sub-Admin */}
              {role === "custom_subadmin" && (
                <div>
                  <label className="text-xs font-extrabold text-amber-400 flex items-center gap-1">
                    <span>Custom Designation / Role Title * (Compulsory)</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={customTitle}
                    onChange={(e) => setCustomTitle(e.target.value)}
                    placeholder="e.g. Regional Manager, Inventory Lead, Operations Head"
                    className="w-full mt-1 rounded-xl border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs font-bold text-amber-200 placeholder:text-amber-500/50 focus:ring-2 focus:ring-amber-500 outline-none"
                  />
                  <p className="text-[10px] text-muted-foreground mt-1">
                    Enter the exact custom designation to display on this sub-admin's profile and staff roster.
                  </p>
                </div>
              )}

              {/* Customizable Menu Permissions Dropdown & Multi-Select Checkboxes */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-bold text-emerald-400 flex items-center gap-1">
                    <Sparkles size={13} />
                    <span>Customizable Menu Permissions ({selectedPermissions.length}/{ALL_MENU_OPTIONS.length})</span>
                  </label>
                  <button
                    type="button"
                    onClick={() => setSelectedPermissions(ALL_MENU_OPTIONS.map((m) => m.href))}
                    className="text-[10px] text-emerald-400 underline font-bold"
                  >
                    Select All
                  </button>
                </div>

                {/* Interactive Multi-Select Dropdown Container */}
                <div className="border border-emerald-500/30 rounded-2xl bg-secondary/30 p-3 max-h-64 overflow-y-auto space-y-3">
                  {["Core", "Catalog", "Sales", "Growth", "System"].map((category) => {
                    const safePerms = Array.isArray(selectedPermissions) ? selectedPermissions : [];
                    const catItems = ALL_MENU_OPTIONS.filter((m) => m.category === category);
                    const allCatChecked = catItems.every((m) => safePerms.includes(m.href));

                    const toggleCategory = () => {
                      if (allCatChecked) {
                        const toRemove = new Set(catItems.map((m) => m.href));
                        setSelectedPermissions((prev) => (Array.isArray(prev) ? prev : []).filter((p) => !toRemove.has(p)));
                      } else {
                        const toAdd = catItems.map((m) => m.href);
                        setSelectedPermissions((prev) => Array.from(new Set([...(Array.isArray(prev) ? prev : []), ...toAdd])));
                      }
                    };

                    return (
                      <div key={category} className="space-y-1.5 p-2 rounded-xl bg-background/50 border border-card-border/50">
                        <div className="flex items-center justify-between">
                          <p className="text-[11px] font-black uppercase text-foreground tracking-wider">{category}</p>
                          <button
                            type="button"
                            onClick={toggleCategory}
                            className="text-[10px] font-bold text-emerald-400 hover:underline cursor-pointer"
                          >
                            {allCatChecked ? "Deselect Group" : "Select Group"}
                          </button>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                          {catItems.map((menu) => {
                            const isChecked = safePerms.includes(menu.href);
                            return (
                              <label
                                key={menu.href}
                                className={`flex items-center gap-2 p-2 rounded-xl border text-xs font-bold cursor-pointer transition-all ${
                                  isChecked
                                    ? "bg-emerald-500/20 border-emerald-500/50 text-emerald-300 shadow-sm"
                                    : "bg-background/60 border-border text-muted-foreground hover:bg-secondary"
                                }`}
                              >
                                <input
                                  type="checkbox"
                                  checked={isChecked}
                                  onChange={() => handleTogglePermission(menu.href)}
                                  className="rounded text-emerald-500 focus:ring-emerald-500 accent-emerald-500 cursor-pointer"
                                />
                                <span>{menu.label}</span>
                              </label>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
                <p className="text-[10px] text-muted-foreground mt-1">
                  Sub-admins will ONLY see and access the specific menu options checked above. Restricted menus (Security, Core Settings) are automatically blocked.
                </p>
              </div>

              {/* Modal Buttons */}
              <div className="flex items-center justify-end gap-3 pt-3 border-t border-border">
                <Button type="button" variant="ghost" onClick={() => setModalOpen(false)} className="rounded-xl text-xs font-bold">
                  Cancel
                </Button>
                <Button type="submit" disabled={createMutation.isPending || updateMutation.isPending} className="rounded-xl bg-gradient-to-r from-emerald-600 via-primary to-green-500 text-white font-extrabold text-xs shadow-md">
                  {createMutation.isPending || updateMutation.isPending ? "Saving..." : editStaff ? "Save Sub-Admin Changes" : "Create Sub-Admin"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </AdminLayout>
  );
}

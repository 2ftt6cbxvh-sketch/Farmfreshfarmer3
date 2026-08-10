import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Users, UserPlus, Shield, ShieldAlert, Lock, Trash2, CheckCircle2,
  XCircle, Edit3, Key, Phone, Mail, Check, ChevronDown, Sparkles
} from "lucide-react";
import { AdminLayout } from "./AdminLayout";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";

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
  { value: "admin", label: "Full Admin", defaultPerms: ALL_MENU_OPTIONS.map((m) => m.href) },
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
  const [selectedPermissions, setSelectedPermissions] = useState<string[]>(["/admin", "/admin/orders"]);
  const [dropdownOpen, setDropdownOpen] = useState(false);

  const { data, isLoading, error } = useQuery<{ staff: any[] }>({
    queryKey: ["/api/admin/staff"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/admin/staff");
      return res.json();
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
    setSelectedPermissions(["/admin", "/admin/orders"]);
    setModalOpen(true);
  };

  const openEditModal = (staff: any) => {
    setEditStaff(staff);
    setName(staff.name || "");
    setEmail(staff.email || "");
    setPhone(staff.phone || "");
    setPassword(""); // Blank unless updating password
    setRole(staff.role || "custom_subadmin");
    setCustomTitle(staff.customTitle || "");
    setSelectedPermissions(Array.isArray(staff.permissions) ? staff.permissions : []);
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
    setSelectedPermissions((prev) =>
      prev.includes(href) ? prev.filter((p) => p !== href) : [...prev, href]
    );
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
          permissions: selectedPermissions,
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
        permissions: selectedPermissions,
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
              Add, modify credentials, block accounts, and assign granular menu permissions to designated sub-admin roles.
            </p>
          </div>
          <Button onClick={openCreateModal} className="gap-2 rounded-2xl bg-gradient-to-r from-emerald-600 via-primary to-green-500 text-white font-extrabold shadow-lg shadow-emerald-900/30 hover:scale-105 transition-all">
            <UserPlus size={16} />
            <span>Add Sub-Admin</span>
          </Button>
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
                    <th className="p-4">Role</th>
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
                                    Primary Admin
                                  </span>
                                )}
                              </p>
                              <p className="text-[11px] text-muted-foreground">{s.email}</p>
                              {s.phone && <p className="text-[10px] text-emerald-400/90 font-mono">📱 {s.phone}</p>}
                            </div>
                          </div>
                        </td>

                        <td className="p-4">
                          <span className="inline-flex items-center px-2.5 py-1 rounded-full text-[10px] font-extrabold bg-primary/15 text-primary border border-primary/30 capitalize">
                            {s.role ? s.role.replace("_", " ") : "Sub-Admin"}
                          </span>
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
                    const catItems = ALL_MENU_OPTIONS.filter((m) => m.category === category);
                    const allCatChecked = catItems.every((m) => selectedPermissions.includes(m.href));

                    const toggleCategory = () => {
                      if (allCatChecked) {
                        const toRemove = new Set(catItems.map((m) => m.href));
                        setSelectedPermissions((prev) => prev.filter((p) => !toRemove.has(p)));
                      } else {
                        const toAdd = catItems.map((m) => m.href);
                        setSelectedPermissions((prev) => Array.from(new Set([...prev, ...toAdd])));
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
                            const isChecked = selectedPermissions.includes(menu.href);
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

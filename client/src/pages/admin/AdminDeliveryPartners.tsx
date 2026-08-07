import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Truck, UserPlus, Shield, ShieldAlert, Lock, Trash2, CheckCircle2,
  XCircle, Edit3, Key, Phone, Mail, Check, Car, Bike, AlertCircle, RefreshCw
} from "lucide-react";
import { AdminLayout } from "./AdminLayout";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";

const PARTNER_TYPES = [
  { value: "local_delivery", label: "Local Delivery (Instant Hub)" },
  { value: "inter_district", label: "Inter District" },
  { value: "inter_state", label: "Inter State" },
  { value: "international", label: "International Shipping" },
];

const ID_TYPES = [
  { value: "aadhar", label: "Aadhar Card" },
  { value: "passport", label: "Passport" },
  { value: "pan", label: "PAN Card" },
  { value: "voter_id", label: "Voter ID" },
];

const VEHICLE_TYPES = [
  { value: "bike", label: "Bike / Motorcycle" },
  { value: "auto", label: "Auto Rickshaw / 3-Wheeler" },
  { value: "van", label: "Delivery Van" },
  { value: "car", label: "Car / Sedan" },
  { value: "lorry", label: "Lorry / Heavy Truck" },
];

export default function AdminDeliveryPartners() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [modalOpen, setModalOpen] = useState(false);
  const [editPartner, setEditPartner] = useState<any>(null);

  // Form State
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [partnerType, setPartnerType] = useState("local_delivery");
  const [idType, setIdType] = useState("aadhar");
  const [idNumber, setIdNumber] = useState("");
  const [drivingLicenseNumber, setDrivingLicenseNumber] = useState("");
  const [vehicleNumber, setVehicleNumber] = useState("");
  const [vehicleType, setVehicleType] = useState("bike");
  const [vehicleModel, setVehicleModel] = useState("");

  const { data, isLoading, error, refetch } = useQuery<{ partners: any[] }>({
    queryKey: ["/api/admin/delivery-partners"],
    refetchInterval: 5000, // Live status polling every 5 seconds
  });

  const partners = data?.partners || [];

  const availableCount = partners.filter((p) => p.availabilityStatus === "available" && !p.isBlockedByAdmin).length;
  const busyCount = partners.filter((p) => p.availabilityStatus === "busy" || p.activeOrdersCount > 0).length;
  const offlineCount = partners.filter((p) => p.availabilityStatus === "offline" && !p.isBlockedByAdmin).length;
  const blockedCount = partners.filter((p) => p.isBlockedByAdmin).length;

  const openCreateModal = () => {
    setEditPartner(null);
    setName("");
    setEmail("");
    setPhone("");
    setUsername("");
    setPassword("");
    setPartnerType("local_delivery");
    setIdType("aadhar");
    setIdNumber("");
    setDrivingLicenseNumber("");
    setVehicleNumber("");
    setVehicleType("bike");
    setVehicleModel("");
    setModalOpen(true);
  };

  const openEditModal = (p: any) => {
    setEditPartner(p);
    setName(p.name || "");
    setEmail(p.email || "");
    setPhone(p.phone || "");
    setUsername(p.username || "");
    setPassword(""); // Blank unless updating password
    setPartnerType(p.partnerType || "local_delivery");
    setIdType(p.idType || "aadhar");
    setIdNumber(p.idNumber || "");
    setDrivingLicenseNumber(p.drivingLicenseNumber || "");
    setVehicleNumber(p.vehicleNumber || "");
    setVehicleType(p.vehicleType || "bike");
    setVehicleModel(p.vehicleModel || "");
    setModalOpen(true);
  };

  const createMutation = useMutation({
    mutationFn: async (payload: any) => {
      const res = await apiRequest("POST", "/api/admin/delivery-partners", payload);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/delivery-partners"] });
      toast({ title: "✨ Delivery Partner Account Created", description: "Credentials & vehicle details saved." });
      setModalOpen(false);
    },
    onError: (err: any) => {
      toast({ title: "Failed to create partner", description: err.message, variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, payload }: { id: number; payload: any }) => {
      const res = await apiRequest("PATCH", `/api/admin/delivery-partners/${id}`, payload);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/delivery-partners"] });
      toast({ title: "✨ Delivery Partner Updated", description: "Details updated successfully." });
      setModalOpen(false);
    },
    onError: (err: any) => {
      toast({ title: "Failed to update partner", description: err.message, variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await apiRequest("DELETE", `/api/admin/delivery-partners/${id}`);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/delivery-partners"] });
      toast({ title: "Delivery Partner Deleted", description: "Account removed." });
    },
    onError: (err: any) => {
      toast({ title: "Delete Failed", description: err.message, variant: "destructive" });
    },
  });

  const overrideAvailabilityMutation = useMutation({
    mutationFn: async ({ id, availabilityStatus, isBlockedByAdmin }: { id: number; availabilityStatus?: string; isBlockedByAdmin?: boolean }) => {
      const res = await apiRequest("POST", `/api/admin/delivery-partners/${id}/override-availability`, { availabilityStatus, isBlockedByAdmin });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/delivery-partners"] });
      toast({ title: "Availability Overridden", description: "Superadmin availability status updated." });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const payload = {
      name,
      email,
      phone,
      username,
      ...(password ? { password } : {}),
      partnerType,
      idType,
      idNumber,
      drivingLicenseNumber,
      vehicleNumber,
      vehicleType,
      vehicleModel,
    };

    if (editPartner) {
      updateMutation.mutate({ id: editPartner.id, payload });
    } else {
      createMutation.mutate(payload);
    }
  };

  return (
    <AdminLayout title="Delivery Partners & Live Dispatch">
      <div className="space-y-6">
        {/* Top Summary Banner */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-between">
            <div>
              <p className="text-[10px] font-extrabold uppercase text-emerald-400">🟢 Available</p>
              <p className="text-2xl font-black text-emerald-300 mt-1">{availableCount}</p>
            </div>
            <div className="w-10 h-10 rounded-xl bg-emerald-500/20 flex items-center justify-center text-emerald-400 font-bold">🟢</div>
          </div>

          <div className="p-4 rounded-2xl bg-blue-500/10 border border-blue-500/30 flex items-center justify-between">
            <div>
              <p className="text-[10px] font-extrabold uppercase text-blue-400">🚚 On Delivery</p>
              <p className="text-2xl font-black text-blue-300 mt-1">{busyCount}</p>
            </div>
            <div className="w-10 h-10 rounded-xl bg-blue-500/20 flex items-center justify-center text-blue-400 font-bold">🚚</div>
          </div>

          <div className="p-4 rounded-2xl bg-slate-500/10 border border-slate-500/30 flex items-center justify-between">
            <div>
              <p className="text-[10px] font-extrabold uppercase text-slate-400">🔴 Offline</p>
              <p className="text-2xl font-black text-slate-300 mt-1">{offlineCount}</p>
            </div>
            <div className="w-10 h-10 rounded-xl bg-slate-500/20 flex items-center justify-center text-slate-400 font-bold">🔴</div>
          </div>

          <div className="p-4 rounded-2xl bg-red-500/10 border border-red-500/30 flex items-center justify-between">
            <div>
              <p className="text-[10px] font-extrabold uppercase text-red-400">⛔ Blocked</p>
              <p className="text-2xl font-black text-red-300 mt-1">{blockedCount}</p>
            </div>
            <div className="w-10 h-10 rounded-xl bg-red-500/20 flex items-center justify-center text-red-400 font-bold">⛔</div>
          </div>
        </div>

        {/* Action Header Card */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-6 rounded-3xl bg-gradient-to-r from-emerald-950/60 via-card to-card border border-emerald-500/30 shadow-xl">
          <div>
            <div className="flex items-center gap-2">
              <Truck className="w-6 h-6 text-emerald-400" />
              <h1 className="text-xl font-extrabold text-foreground font-serif">Delivery Partner Dispatch Panel</h1>
              <span className="bg-amber-500/20 text-amber-300 text-[10px] font-black px-2.5 py-0.5 rounded-full border border-amber-500/30">
                Superadmin Only
              </span>
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Manage delivery partner accounts, credentials, vehicle details, live availability status, and superadmin availability overrides.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => refetch()} className="gap-1.5 rounded-2xl border-emerald-500/30 text-xs font-bold">
              <RefreshCw size={13} /> Refresh Status
            </Button>
            <Button onClick={openCreateModal} className="gap-2 rounded-2xl bg-gradient-to-r from-emerald-600 via-primary to-green-500 text-white font-extrabold shadow-lg shadow-emerald-900/30 hover:scale-105 transition-all">
              <UserPlus size={16} />
              <span>Add Delivery Partner</span>
            </Button>
          </div>
        </div>

        {/* Delivery Partner Table */}
        <div className="rounded-3xl border border-emerald-500/20 bg-card overflow-hidden shadow-xl">
          <div className="p-4 border-b border-border flex items-center justify-between">
            <h2 className="text-sm font-bold text-foreground flex items-center gap-2">
              <Truck size={16} className="text-emerald-400" />
              <span>Delivery Partner Roster ({partners.length})</span>
            </h2>
          </div>

          {isLoading ? (
            <div className="p-8 text-center text-xs text-muted-foreground">Loading delivery partner roster…</div>
          ) : error ? (
            <div className="p-8 text-center text-xs text-destructive flex items-center justify-center gap-2">
              <ShieldAlert size={16} />
              <span>Access Denied: Only the Primary Admin can manage delivery partners.</span>
            </div>
          ) : partners.length === 0 ? (
            <div className="p-8 text-center text-xs text-muted-foreground">No delivery partners registered. Click "Add Delivery Partner" to create partner credentials.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-secondary/40 text-muted-foreground uppercase text-[10px] font-bold border-b border-border">
                  <tr>
                    <th className="p-4">Partner Name & Email</th>
                    <th className="p-4">Partner Type</th>
                    <th className="p-4">ID & Driving License</th>
                    <th className="p-4">Vehicle Details</th>
                    <th className="p-4">Live Status</th>
                    <th className="p-4 text-right">Superadmin Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/60">
                  {partners.map((p) => {
                    const isBlocked = p.isBlockedByAdmin;
                    const isAvailable = p.availabilityStatus === "available" && !isBlocked;
                    const isBusy = p.availabilityStatus === "busy" || p.activeOrdersCount > 0;

                    return (
                      <tr key={p.id} className="hover:bg-secondary/20 transition-colors">
                        <td className="p-4">
                          <div className="flex items-center gap-3">
                            <div className="w-9 h-9 rounded-2xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center font-extrabold text-emerald-400 text-sm">
                              🚚
                            </div>
                            <div>
                              <p className="font-extrabold text-foreground">{p.name}</p>
                              <p className="text-[11px] text-muted-foreground">{p.email}</p>
                              <p className="text-[10px] text-emerald-400/90 font-mono">📱 {p.phone} • Username: <span className="font-bold text-white">{p.username}</span></p>
                            </div>
                          </div>
                        </td>

                        <td className="p-4">
                          <span className="inline-flex items-center px-2.5 py-1 rounded-full text-[10px] font-extrabold bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 capitalize">
                            {p.partnerType ? p.partnerType.replace("_", " ") : "Local Delivery"}
                          </span>
                        </td>

                        <td className="p-4">
                          <p className="font-bold text-foreground capitalize text-[11px]">{p.idType || "Aadhar"}: {p.idNumber}</p>
                          {p.drivingLicenseNumber && <p className="text-[10px] text-muted-foreground">DL: {p.drivingLicenseNumber}</p>}
                        </td>

                        <td className="p-4">
                          <p className="font-extrabold text-emerald-300 capitalize text-[11px]">{p.vehicleType || "Bike"} • {p.vehicleNumber}</p>
                          {p.vehicleModel && <p className="text-[10px] text-muted-foreground">Model: {p.vehicleModel}</p>}
                        </td>

                        <td className="p-4">
                          {isBlocked ? (
                            <span className="inline-flex items-center gap-1 text-[10px] font-extrabold px-2.5 py-1 rounded-full bg-red-500/15 text-red-400 border border-red-500/30">
                              ⛔ Blocked by Admin
                            </span>
                          ) : isBusy ? (
                            <span className="inline-flex items-center gap-1 text-[10px] font-extrabold px-2.5 py-1 rounded-full bg-blue-500/15 text-blue-400 border border-blue-500/30">
                              🚚 On Delivery ({p.activeOrdersCount} active)
                            </span>
                          ) : isAvailable ? (
                            <span className="inline-flex items-center gap-1 text-[10px] font-extrabold px-2.5 py-1 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                              🟢 Available
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-[10px] font-extrabold px-2.5 py-1 rounded-full bg-slate-500/15 text-slate-400 border border-slate-500/30">
                              🔴 Not Available
                            </span>
                          )}
                        </td>

                        <td className="p-4 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <Button variant="ghost" size="sm" onClick={() => openEditModal(p)} className="h-8 px-2.5 rounded-xl border border-emerald-500/20 text-xs font-bold hover:bg-emerald-500/15">
                              <Edit3 size={13} className="mr-1" /> Edit
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => overrideAvailabilityMutation.mutate({ id: p.id, isBlockedByAdmin: !isBlocked })}
                              className={`h-8 px-2.5 rounded-xl text-xs font-bold border ${isBlocked ? "border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/15" : "border-amber-500/30 text-amber-400 hover:bg-amber-500/15"}`}
                            >
                              {isBlocked ? "Unblock Mode" : "Block Mode"}
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                if (confirm(`Delete delivery partner ${p.name}?`)) {
                                  deleteMutation.mutate(p.id);
                                }
                              }}
                              className="h-8 px-2.5 rounded-xl border border-red-500/30 text-red-400 hover:bg-red-500/15 text-xs font-bold"
                            >
                              <Trash2 size={13} />
                            </Button>
                          </div>
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

      {/* Add / Edit Delivery Partner Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-md p-4 overflow-y-auto">
          <div className="bg-card w-full max-w-xl rounded-3xl p-6 shadow-2xl border border-emerald-500/30 my-8 space-y-4">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <div className="flex items-center gap-2">
                <Truck className="w-5 h-5 text-emerald-400" />
                <h3 className="text-lg font-extrabold text-foreground font-serif">
                  {editPartner ? `Edit Delivery Partner: ${editPartner.name}` : "Add New Delivery Partner"}
                </h3>
              </div>
              <button onClick={() => setModalOpen(false)} className="text-muted-foreground hover:text-foreground text-sm font-bold">✕</button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-muted-foreground">Partner Type *</label>
                  <select
                    value={partnerType}
                    onChange={(e) => setPartnerType(e.target.value)}
                    className="w-full mt-1 rounded-xl border border-input bg-background px-3 py-2 text-xs font-bold text-foreground focus:ring-2 focus:ring-primary outline-none"
                  >
                    {PARTNER_TYPES.map((t) => (
                      <option key={t.value} value={t.value}>{t.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-bold text-muted-foreground">Full Name *</label>
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g. Siva Kumar"
                    className="w-full mt-1 rounded-xl border border-input bg-background px-3 py-2 text-xs font-medium focus:ring-2 focus:ring-primary outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-muted-foreground">Email Address *</label>
                  <input
                    type="email"
                    required
                    disabled={!!editPartner}
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="partner@farmfreshfarmer.com"
                    className="w-full mt-1 rounded-xl border border-input bg-background px-3 py-2 text-xs font-medium focus:ring-2 focus:ring-primary outline-none disabled:opacity-50"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-muted-foreground">Mobile Phone Number *</label>
                  <input
                    type="tel"
                    required
                    value={phone}
                    onChange={(e) => setPhone(e.target.value.replace(/\D/g, '').slice(0, 10))}
                    placeholder="10-digit mobile"
                    className="w-full mt-1 rounded-xl border border-input bg-background px-3 py-2 text-xs font-medium focus:ring-2 focus:ring-primary outline-none"
                  />
                </div>
              </div>

              {/* Login Credentials */}
              <div className="p-3 rounded-2xl bg-secondary/30 border border-emerald-500/20 space-y-3">
                <p className="text-xs font-extrabold text-emerald-400">🔐 Partner Portal Login Credentials</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-bold text-muted-foreground">Username *</label>
                    <input
                      type="text"
                      required
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      placeholder="e.g. siva_rider"
                      className="w-full mt-1 rounded-xl border border-input bg-background px-3 py-2 text-xs font-medium focus:ring-2 focus:ring-primary outline-none"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-muted-foreground">{editPartner ? "New Password (Optional)" : "Password *"}</label>
                    <input
                      type="password"
                      required={!editPartner}
                      minLength={6}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder={editPartner ? "Leave blank to keep existing" : "Min 6 characters"}
                      className="w-full mt-1 rounded-xl border border-input bg-background px-3 py-2 text-xs font-medium focus:ring-2 focus:ring-primary outline-none"
                    />
                  </div>
                </div>
              </div>

              {/* ID & License Info */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="text-xs font-bold text-muted-foreground">ID Type *</label>
                  <select
                    value={idType}
                    onChange={(e) => setIdType(e.target.value)}
                    className="w-full mt-1 rounded-xl border border-input bg-background px-3 py-2 text-xs font-bold text-foreground focus:ring-2 focus:ring-primary outline-none"
                  >
                    {ID_TYPES.map((t) => (
                      <option key={t.value} value={t.value}>{t.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-bold text-muted-foreground">ID Number *</label>
                  <input
                    type="text"
                    required
                    value={idNumber}
                    onChange={(e) => setIdNumber(e.target.value)}
                    placeholder="e.g. 1234 5678 9012"
                    className="w-full mt-1 rounded-xl border border-input bg-background px-3 py-2 text-xs font-medium focus:ring-2 focus:ring-primary outline-none"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-muted-foreground">Driving License No.</label>
                  <input
                    type="text"
                    value={drivingLicenseNumber}
                    onChange={(e) => setDrivingLicenseNumber(e.target.value)}
                    placeholder="e.g. AP39 2023000123"
                    className="w-full mt-1 rounded-xl border border-input bg-background px-3 py-2 text-xs font-medium focus:ring-2 focus:ring-primary outline-none"
                  />
                </div>
              </div>

              {/* Vehicle Information */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="text-xs font-bold text-muted-foreground">Vehicle Type *</label>
                  <select
                    value={vehicleType}
                    onChange={(e) => setVehicleType(e.target.value)}
                    className="w-full mt-1 rounded-xl border border-input bg-background px-3 py-2 text-xs font-bold text-foreground focus:ring-2 focus:ring-primary outline-none"
                  >
                    {VEHICLE_TYPES.map((t) => (
                      <option key={t.value} value={t.value}>{t.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-bold text-muted-foreground">Vehicle Registration No. *</label>
                  <input
                    type="text"
                    required
                    value={vehicleNumber}
                    onChange={(e) => setVehicleNumber(e.target.value.toUpperCase())}
                    placeholder="e.g. AP 39 AB 1234"
                    className="w-full mt-1 rounded-xl border border-input bg-background px-3 py-2 text-xs font-medium focus:ring-2 focus:ring-primary outline-none uppercase"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-muted-foreground">Vehicle Model</label>
                  <input
                    type="text"
                    value={vehicleModel}
                    onChange={(e) => setVehicleModel(e.target.value)}
                    placeholder="e.g. Hero Splendor / Tata Ace"
                    className="w-full mt-1 rounded-xl border border-input bg-background px-3 py-2 text-xs font-medium focus:ring-2 focus:ring-primary outline-none"
                  />
                </div>
              </div>

              {/* Modal Buttons */}
              <div className="flex items-center justify-end gap-3 pt-3 border-t border-border">
                <Button type="button" variant="ghost" onClick={() => setModalOpen(false)} className="rounded-xl text-xs font-bold">
                  Cancel
                </Button>
                <Button type="submit" disabled={createMutation.isPending || updateMutation.isPending} className="rounded-xl bg-gradient-to-r from-emerald-600 via-primary to-green-500 text-white font-extrabold text-xs shadow-md">
                  {createMutation.isPending || updateMutation.isPending ? "Saving..." : editPartner ? "Save Partner Changes" : "Create Delivery Partner"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </AdminLayout>
  );
}

import { useState, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Link } from "wouter";
import { AdminLayout } from "./AdminLayout";
import { apiGet, apiRequest, queryClient } from "@/lib/queryClient";
import type { User } from "@/lib/types";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/store";
import { useToast } from "@/hooks/use-toast";
import {
  Users, Shield, Crown, Search, UserCheck, ExternalLink,
  Phone, Mail, CheckCircle2, ShieldAlert, Trash2, AlertTriangle, Lock, Unlock, BadgeCheck
} from "lucide-react";
import { VerifiedBadge } from "@/components/VerifiedBadge";

export default function AdminUsers() {
  const { toast } = useToast();
  const { user: currentUser } = useAuth();
  const isSuperAdminLoggedIn = Boolean(currentUser?.isPrimaryAdmin || currentUser?.email?.toLowerCase() === "admin@farmfreshfarmer.com");

  const [filterRole, setFilterRole] = useState<"all" | "customers" | "staff">("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<User | null>(null);

  const { data: users = [], isLoading } = useQuery<User[]>({
    queryKey: ["/api/users"],
    queryFn: () => apiGet<User[]>("/api/users"),
    staleTime: 30000,
  });

  const deleteUserMut = useMutation({
    mutationFn: async (id: number) => {
      const res = await apiRequest("DELETE", `/api/admin/users/${id}/permanent`);
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/users"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/customers"] });
      toast({ title: "🗑️ Account Deleted", description: data.message || "User permanently purged from database." });
      setDeleteTarget(null);
    },
    onError: (err: any) => {
      toast({ title: "Deletion Failed", description: err.message || "Could not delete user", variant: "destructive" });
    },
  });

  const unlockUserMut = useMutation({
    mutationFn: async (id: number) => {
      const res = await apiRequest("POST", `/api/admin/users/${id}/unlock`);
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/users"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/customers"] });
      toast({ title: "🔓 Account Unlocked", description: data.message || "User account unlocked successfully." });
    },
    onError: (err: any) => {
      toast({ title: "Unlock Failed", description: err.message || "Could not unlock user", variant: "destructive" });
    },
  });

  const verifyUserMut = useMutation({
    mutationFn: async (id: number) => {
      const res = await apiRequest("POST", `/api/admin/users/${id}/verify-badge`);
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/users"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/customers"] });
      toast({ title: data.message || "Verification status updated" });
    },
    onError: (err: any) => {
      toast({ title: "Verification update failed", description: err?.message, variant: "destructive" });
    },
  });

  const filteredUsers = useMemo(() => {
    return users.filter((u) => {
      const isStaffOrAdmin =
        Boolean(u.isPrimaryAdmin) ||
        u.email?.toLowerCase() === "admin@farmfreshfarmer.com" ||
        u.role !== "customer";

      if (filterRole === "customers" && isStaffOrAdmin) return false;
      if (filterRole === "staff" && !isStaffOrAdmin) return false;

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchName = u.name?.toLowerCase().includes(q);
        const matchEmail = u.email?.toLowerCase().includes(q);
        const matchPhone = u.phone?.toLowerCase().includes(q);
        const matchRole = u.role?.toLowerCase().includes(q);
        return matchName || matchEmail || matchPhone || matchRole;
      }

      return true;
    });
  }, [users, filterRole, searchQuery]);

  return (
    <AdminLayout title="User Roster">
      <div className="space-y-4 mb-6">
        <p className="text-sm text-muted-foreground">
          Platform-wide account directory. Use this roster for troubleshooting customer and staff accounts.
        </p>

        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
          <div className="relative flex-1 max-w-md">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input
              type="search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by name, email, phone, or role..."
              className="w-full pl-9 pr-4 py-2 text-xs font-semibold rounded-xl bg-card border border-card-border text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>

          <div className="flex items-center gap-1.5 p-1 rounded-xl bg-secondary border border-card-border self-start sm:self-auto">
            <button
              onClick={() => setFilterRole("all")}
              className={`px-3 py-1.5 rounded-lg text-xs font-extrabold transition-all ${
                filterRole === "all"
                  ? "bg-card text-foreground shadow-xs border border-card-border"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              All ({users.length})
            </button>
            <button
              onClick={() => setFilterRole("customers")}
              className={`px-3 py-1.5 rounded-lg text-xs font-extrabold transition-all ${
                filterRole === "customers"
                  ? "bg-card text-emerald-500 shadow-xs border border-card-border"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Customers ({users.filter((u) => u.role === "customer" && !u.isPrimaryAdmin).length})
            </button>
            <button
              onClick={() => setFilterRole("staff")}
              className={`px-3 py-1.5 rounded-lg text-xs font-extrabold transition-all ${
                filterRole === "staff"
                  ? "bg-card text-blue-500 shadow-xs border border-card-border"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Staff ({users.filter((u) => u.role !== "customer" || u.isPrimaryAdmin).length})
            </button>
          </div>
        </div>
      </div>

      {isLoading ? (
        <Skeleton className="h-64 rounded-2xl" />
      ) : (
        <div className="rounded-2xl border border-card-border bg-card overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="bg-secondary/70 border-b border-card-border text-xs font-bold text-muted-foreground uppercase">
                <tr>
                  <th className="p-3.5">ID</th>
                  <th className="p-3.5">Name</th>
                  <th className="p-3.5">Email</th>
                  <th className="p-3.5">Role</th>
                  <th className="p-3.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-card-border">
                {filteredUsers.map((u) => {
                  const isSuperAdmin = Boolean(u.isPrimaryAdmin) || u.email?.toLowerCase() === "admin@farmfreshfarmer.com";
                  const isStaff = !isSuperAdmin && u.role !== "customer";

                  return (
                    <tr key={u.id} className="hover:bg-secondary/30 transition-colors">
                      <td className="p-3.5 text-muted-foreground font-mono text-xs font-bold">#{u.id}</td>
                      <td className="p-3.5 font-bold text-foreground">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          {isSuperAdmin && <Crown size={14} className="text-amber-400" />}
                          {isStaff && <Shield size={14} className="text-blue-400" />}
                          <span>{u.name}</span>
                          {u.isVerified && <VerifiedBadge size="sm" />}
                        </div>
                      </td>
                      <td className="p-3.5 text-xs text-foreground font-medium">{u.email}</td>
                      <td className="p-3.5">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <Badge variant="outline" className="text-[10px] font-black uppercase">
                            {isSuperAdmin ? "Executive Admin" : u.role}
                          </Badge>
                          {u.isVerified && (
                            <Badge className="text-[10px] bg-sky-500/20 text-sky-400 border border-sky-500/30 flex items-center gap-1">
                              <BadgeCheck size={10} /> Verified
                            </Badge>
                          )}
                          {(u.isPermanentlyLocked || u.status === "locked") && (
                            <Badge className="text-[10px] bg-red-600/20 text-red-400 border border-red-500/30 flex items-center gap-1">
                              <Lock size={10} /> Permanently Locked
                            </Badge>
                          )}
                          {u.lockoutUntil && new Date(u.lockoutUntil) > new Date() && (
                            <Badge className="text-[10px] bg-amber-600/20 text-amber-400 border border-amber-500/30 flex items-center gap-1">
                              <Lock size={10} /> Temp Locked
                            </Badge>
                          )}
                        </div>
                      </td>
                      <td className="p-3.5 text-right flex items-center justify-end gap-2">
                        {isSuperAdmin ? (
                          <span className="inline-flex items-center gap-1 text-[10px] font-black px-3 py-1 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                            👑 Protected Root Super Admin (Immutable)
                          </span>
                        ) : (
                          <>
                            {isSuperAdminLoggedIn && (
                              <Button
                                variant="outline"
                                size="sm"
                                className={`h-7 text-xs font-bold flex items-center gap-1 ${
                                  u.isVerified
                                    ? "text-sky-400 border-sky-500/40 hover:bg-sky-500/10"
                                    : "text-muted-foreground border-border hover:text-sky-400 hover:border-sky-500/40"
                                }`}
                                onClick={() => verifyUserMut.mutate(u.id)}
                                disabled={verifyUserMut.isPending}
                                title={u.isVerified ? "Remove Super Admin verification" : "Verify user with Blue Badge"}
                              >
                                <BadgeCheck size={12} /> {u.isVerified ? "Verified" : "Verify"}
                              </Button>
                            )}
                            {(u.isPermanentlyLocked || u.status === "locked" || (u.lockoutUntil && new Date(u.lockoutUntil) > new Date()) || (u.failedLoginAttempts || 0) > 0) && (
                              <Button
                                variant="outline"
                                size="sm"
                                className="h-7 text-xs font-bold text-emerald-400 border-emerald-500/40 hover:bg-emerald-500/10 flex items-center gap-1"
                                onClick={() => unlockUserMut.mutate(u.id)}
                                disabled={unlockUserMut.isPending}
                              >
                                <Unlock size={12} /> Unlock
                              </Button>
                            )}
                            {isStaff ? (
                              <Link href="/admin/staff" className="text-xs text-blue-400 font-bold hover:underline">Manage Staff</Link>
                            ) : (
                              <Link href="/admin/customers" className="text-xs text-emerald-400 font-bold hover:underline">Manage Customer</Link>
                            )}
                            {isSuperAdminLoggedIn && u.id !== currentUser?.id && (
                              <Button variant="ghost" size="sm" className="h-7 text-red-400 hover:text-red-500 hover:bg-red-500/10" onClick={() => setDeleteTarget(u)}>
                                <Trash2 size={14} />
                              </Button>
                            )}
                          </>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-xs p-4" onClick={() => setDeleteTarget(null)}>
          <div className="bg-card border border-red-500/40 rounded-3xl p-6 w-full max-w-md shadow-2xl space-y-4" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center gap-3 text-red-400">
              <AlertTriangle size={20} />
              <h3 className="text-base font-extrabold text-foreground">Permanent Purge</h3>
            </div>
            <p className="text-xs text-muted-foreground">Are you sure you want to permanently delete {deleteTarget.name}? This cannot be reversed.</p>
            <div className="flex gap-2">
              <Button variant="outline" className="flex-1" onClick={() => setDeleteTarget(null)}>Cancel</Button>
              <Button variant="destructive" className="flex-1" onClick={() => deleteUserMut.mutate(deleteTarget.id)}>Purge</Button>
            </div>
          </div>
        </div>
      )}
    </AdminLayout>
  );
}

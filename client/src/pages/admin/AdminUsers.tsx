import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { AdminLayout } from "./AdminLayout";
import { apiGet } from "@/lib/queryClient";
import type { User } from "@/lib/types";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/lib/store";
import {
  Users, Shield, Crown, Search, UserCheck, ExternalLink,
  Phone, Mail, CheckCircle2, ShieldAlert
} from "lucide-react";
import { getStarTheme } from "@/lib/starTheme";

export default function AdminUsers() {
  const { user: currentUser } = useAuth();
  const [filterRole, setFilterRole] = useState<"all" | "customers" | "staff">("all");
  const [searchQuery, setSearchQuery] = useState("");

  const { data: users = [], isLoading } = useQuery<User[]>({
    queryKey: ["/api/users"],
    queryFn: () => apiGet<User[]>("/api/users"),
    staleTime: 30000,
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
      {/* Header Description & Search / Filter Controls */}
      <div className="space-y-4 mb-6">
        <p className="text-sm text-muted-foreground">
          Platform-wide account directory. Use this roster for troubleshooting customer and staff accounts.
          Customer loyalty stars are managed exclusively in{" "}
          <Link href="/admin/customers" className="text-emerald-500 font-bold underline hover:text-emerald-400">
            Customers
          </Link>
          , and Staff roles/ratings are managed in{" "}
          <Link href="/admin/staff" className="text-emerald-500 font-bold underline hover:text-emerald-400">
            Staff & Sub-Admins
          </Link>
          .
        </p>

        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
          {/* Search Input */}
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

          {/* Role Filter Tabs */}
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
                  ? "bg-card text-amber-500 shadow-xs border border-card-border"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Staff & Admins ({users.filter((u) => u.role !== "customer" || u.isPrimaryAdmin).length})
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
                  <th className="p-3.5">Phone</th>
                  <th className="p-3.5">Account Role</th>
                  <th className="p-3.5">Classification & Stars</th>
                  <th className="p-3.5 text-right">Quick Management</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-card-border">
                {filteredUsers.map((u) => {
                  const isSuperAdmin =
                    Boolean(u.isPrimaryAdmin) ||
                    u.email?.toLowerCase() === "admin@farmfreshfarmer.com" ||
                    u.id === 1;
                  const isStaff = !isSuperAdmin && u.role !== "customer";

                  return (
                    <tr
                      key={u.id}
                      className="hover:bg-secondary/30 transition-colors"
                      data-testid={`row-user-${u.id}`}
                    >
                      <td className="p-3.5 text-muted-foreground font-mono text-xs font-bold">
                        #{u.id}
                      </td>
                      <td className="p-3.5 font-bold text-foreground">
                        <div className="flex items-center gap-1.5">
                          {isSuperAdmin && <Crown size={14} className="text-amber-400 shrink-0" />}
                          {isStaff && <Shield size={14} className="text-blue-400 shrink-0" />}
                          <span>{u.name}</span>
                        </div>
                      </td>
                      <td className="p-3.5 text-xs text-foreground font-medium" data-testid={`text-email-${u.id}`}>
                        {u.email}
                      </td>
                      <td className="p-3.5 text-xs text-muted-foreground">
                        {u.phone ? (
                          <span className="font-mono">{u.phone}</span>
                        ) : (
                          <span className="opacity-40">—</span>
                        )}
                      </td>
                      <td className="p-3.5">
                        {isSuperAdmin ? (
                          <Badge className="bg-amber-500/15 text-amber-400 border border-amber-500/30 text-[10px] font-black uppercase">
                            Executive Admin
                          </Badge>
                        ) : isStaff ? (
                          <Badge className="bg-blue-500/15 text-blue-400 border border-blue-500/30 text-[10px] font-black uppercase">
                            {u.role.replace(/_/g, " ")}
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="text-[10px] font-bold text-muted-foreground">
                            Customer
                          </Badge>
                        )}
                      </td>
                      <td className="p-3.5">
                        {isSuperAdmin ? (
                          <div className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-400 text-xs font-black">
                            <span>👑 Master Admin (6★)</span>
                          </div>
                        ) : isStaff ? (
                          <div className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-400 text-xs font-black">
                            <span>🛡️ Staff Member</span>
                          </div>
                        ) : (
                          <div className="flex items-center gap-1.5">
                            <span className="text-xs font-extrabold text-emerald-400">
                              {(u.customerStars || 0) > 0 ? `★ ${u.customerStars} Stars` : "No Loyalty Stars"}
                            </span>
                          </div>
                        )}
                      </td>
                      <td className="p-3.5 text-right">
                        {isSuperAdmin || isStaff ? (
                          <Link
                            href="/admin/staff"
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold text-blue-400 bg-blue-500/10 hover:bg-blue-500/20 border border-blue-500/20 transition-all"
                          >
                            <span>Manage Staff</span>
                            <ExternalLink size={11} />
                          </Link>
                        ) : (
                          <Link
                            href="/admin/customers"
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold text-emerald-400 bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/20 transition-all"
                          >
                            <span>Manage Customer</span>
                            <ExternalLink size={11} />
                          </Link>
                        )}
                      </td>
                    </tr>
                  );
                })}
                {filteredUsers.length === 0 && (
                  <tr>
                    <td colSpan={7} className="p-8 text-center text-muted-foreground text-xs">
                      No matching accounts found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </AdminLayout>
  );
}

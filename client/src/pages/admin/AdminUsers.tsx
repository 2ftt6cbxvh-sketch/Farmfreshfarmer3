import { useQuery } from "@tanstack/react-query";
import { AdminLayout } from "./AdminLayout";
import { apiGet } from "@/lib/queryClient";
import type { User } from "@/lib/types";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";

export default function AdminUsers() {
  const { data: users = [], isLoading } = useQuery<User[]>({
    queryKey: ["/api/users"],
    queryFn: () => apiGet<User[]>("/api/users"),
  });

  return (
    <AdminLayout title="Users">
      <p className="text-sm text-muted-foreground mb-4">
        All registered accounts. Use this to look up a customer's email or phone when troubleshooting.
        Passwords are securely encrypted and cannot be displayed.
      </p>
      {isLoading ? <Skeleton className="h-64 rounded-xl" /> : (
        <div className="rounded-xl border border-card-border bg-card overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-secondary text-left">
              <tr>
                <th className="p-3 font-semibold">ID</th>
                <th className="p-3 font-semibold">Name</th>
                <th className="p-3 font-semibold">Email</th>
                <th className="p-3 font-semibold">Phone</th>
                <th className="p-3 font-semibold">Role</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id} className="border-t border-card-border" data-testid={`row-user-${u.id}`}>
                  <td className="p-3 text-muted-foreground">{u.id}</td>
                  <td className="p-3 font-medium">{u.name}</td>
                  <td className="p-3" data-testid={`text-email-${u.id}`}>{u.email}</td>
                  <td className="p-3 text-muted-foreground">{u.phone || "—"}</td>
                  <td className="p-3"><Badge variant={u.role === "admin" ? "default" : "outline"}>{u.role}</Badge></td>
                </tr>
              ))}
              {users.length === 0 && <tr><td colSpan={5} className="p-8 text-center text-muted-foreground">No users yet.</td></tr>}
            </tbody>
          </table>
        </div>
      )}
    </AdminLayout>
  );
}

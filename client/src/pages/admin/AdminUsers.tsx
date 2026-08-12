import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { AdminLayout } from "./AdminLayout";
import { apiGet, apiRequest } from "@/lib/queryClient";
import type { User } from "@/lib/types";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/lib/store";
import { useToast } from "@/hooks/use-toast";

export default function AdminUsers() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { user: currentUser } = useAuth();
  const isPrimaryAdmin = currentUser?.isPrimaryAdmin || currentUser?.email?.toLowerCase() === "admin@farmfreshfarmer.com";

  const [starEditOpen, setStarEditOpen] = useState<number | null>(null); // userId
  const [starEditValue, setStarEditValue] = useState(0);

  const setCustomerStarsMut = useMutation({
    mutationFn: async ({ userId, stars }: { userId: number, stars: number }) => {
      const res = await apiRequest('PATCH', `/api/users/${userId}/customer-stars`, { customerStars: stars });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/users'] });
      toast({ title: 'Stars updated! ⭐' });
      setStarEditOpen(null);
    },
    onError: () => toast({ title: 'Failed to update stars', variant: 'destructive' })
  });

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
                <th className="p-3 font-semibold">Stars</th>
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
                  <td className="p-3">
                    <div className="flex items-center gap-1.5">
                      <span className="text-blue-400 text-sm font-bold">
                        {'★'.repeat(u.customerStars ?? 0)}
                        {'☆'.repeat(Math.max(0, 5 - (u.customerStars ?? 0)))}
                      </span>
                      {isPrimaryAdmin && (
                        <button
                          onClick={() => { setStarEditOpen(u.id); setStarEditValue(u.customerStars ?? 0); }}
                          className="text-xs text-blue-400 hover:text-blue-300 underline"
                        >Edit</button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
              {users.length === 0 && <tr><td colSpan={6} className="p-8 text-center text-muted-foreground">No users yet.</td></tr>}
            </tbody>
          </table>
        </div>
      )}

      {starEditOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => setStarEditOpen(null)}>
          <div className="bg-card rounded-2xl p-6 w-80 shadow-2xl border border-card-border" onClick={e => e.stopPropagation()}>
            <h3 className="font-bold text-lg mb-4">🌟 Set Loyalty Stars</h3>
            <div className="flex items-center justify-center gap-2 mb-6">
              {Array.from({ length: 5 }, (_, i) => (
                <button
                  key={i}
                  onClick={() => setStarEditValue(i + 1)}
                  className={`text-2xl transition-transform hover:scale-125 ${
                    i < starEditValue ? 'text-blue-400 drop-shadow-[0_0_6px_rgba(59,130,246,0.8)]' : 'text-muted-foreground'
                  }`}
                >
                  ★
                </button>
              ))}
            </div>
            <div className="text-center text-sm text-muted-foreground mb-4">{starEditValue} / 5 loyalty stars</div>
            <div className="flex gap-2">
              <button
                onClick={() => setStarEditOpen(null)}
                className="flex-1 py-2 rounded-xl border border-card-border text-sm"
              >Cancel</button>
              <button
                onClick={() => setCustomerStarsMut.mutate({ userId: starEditOpen, stars: starEditValue })}
                className="flex-1 py-2 rounded-xl bg-blue-600 text-white text-sm font-bold hover:bg-blue-500"
                disabled={setCustomerStarsMut.isPending}
              >{setCustomerStarsMut.isPending ? 'Saving...' : 'Save Stars'}</button>
            </div>
          </div>
        </div>
      )}
    </AdminLayout>
  );
}

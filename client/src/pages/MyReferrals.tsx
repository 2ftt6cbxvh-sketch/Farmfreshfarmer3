import { Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Gift, Copy, Users, CheckCircle2, Wallet, IndianRupee } from "lucide-react";
import { Layout } from "@/components/Layout";
import { useAuth } from "@/lib/store";
import { apiGet } from "@/lib/queryClient";
import { formatINR } from "@/lib/types";
import { useToast } from "@/hooks/use-toast";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

interface ReferralRow {
  id: number;
  referrerUserId: number;
  referredUserId: number;
  code: string;
  status: string;
  qualifyingOrderId: number | null;
  createdAt: string;
  convertedAt: string | null;
}

interface RewardRow {
  id: number;
  referrerUserId: number;
  referralId: number;
  rewardPercent: string;
  amount: string;
  status: string;
  createdAt: string;
}

interface ReferralSummary {
  code: string;
  totalReferrals: number;
  successfulReferrals: number;
  totalEarned: number;
  availableBalance: number;
  referrals: ReferralRow[];
  rewards: RewardRow[];
}

function referralStatusVariant(status: string): "default" | "secondary" | "outline" {
  if (status === "converted") return "default";
  if (status === "rejected") return "outline";
  return "secondary";
}

export default function MyReferrals() {
  const { user, loading } = useAuth();
  const { toast } = useToast();

  const { data: summary, isLoading } = useQuery<ReferralSummary>({
    queryKey: ["/api/referral/summary"],
    queryFn: () => apiGet<ReferralSummary>("/api/referral/summary"),
    enabled: !!user,
  });

  async function copyCode() {
    if (!summary) return;
    const message = `Use my code ${summary.code} for 10% off your first FarmFreshFarmer order.`;
    try {
      await navigator.clipboard.writeText(message);
      toast({ title: "Copied to clipboard", description: message });
    } catch {
      toast({ title: "Could not copy", description: "Please copy the code manually.", variant: "destructive" });
    }
  }

  if (!loading && !user) {
    return (
      <Layout>
        <div className="mx-auto max-w-md px-4 py-20 text-center">
          <Gift className="mx-auto text-muted-foreground" size={44} />
          <h1 className="font-serif text-2xl font-bold mt-4">Please log in</h1>
          <p className="text-muted-foreground mt-2">Log in to see your referral code and rewards.</p>
          <Link href="/login" className="inline-block mt-6 rounded-full bg-primary text-primary-foreground px-6 py-3 text-sm font-semibold hover-elevate" data-testid="link-login">Log in</Link>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="mx-auto max-w-4xl px-4 py-8">
        <h1 className="font-serif text-2xl sm:text-3xl font-bold mb-2">My referrals</h1>
        <p className="text-muted-foreground mb-6">Share your code with friends — you both win.</p>

        {isLoading || !summary ? (
          <div className="space-y-4">
            <Skeleton className="h-24 rounded-xl" />
            <Skeleton className="h-32 rounded-xl" />
          </div>
        ) : (
          <>
            {/* Referral code */}
            <div className="rounded-xl border border-card-border bg-card p-5 mb-6 flex flex-wrap items-center justify-between gap-4" data-testid="panel-referral-code">
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wide">Your referral code</p>
                <p className="text-3xl font-serif font-bold text-primary mt-1" data-testid="text-referral-code">{summary.code}</p>
                <p className="text-sm text-muted-foreground mt-1">
                  Use my code <span className="font-semibold">{summary.code}</span> for 10% off your first FarmFreshFarmer order.
                </p>
              </div>
              <Button onClick={copyCode} data-testid="button-copy-referral-code">
                <Copy size={15} className="mr-2" /> Copy
              </Button>
            </div>

            {/* KPI cards */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
              <div className="rounded-xl border border-card-border bg-card p-4" data-testid="kpi-total-referrals">
                <Users className="text-primary mb-2" size={20} />
                <p className="text-xs text-muted-foreground">Total referrals</p>
                <p className="text-xl font-bold">{summary.totalReferrals}</p>
              </div>
              <div className="rounded-xl border border-card-border bg-card p-4" data-testid="kpi-successful-referrals">
                <CheckCircle2 className="text-primary mb-2" size={20} />
                <p className="text-xs text-muted-foreground">Successful</p>
                <p className="text-xl font-bold">{summary.successfulReferrals}</p>
              </div>
              <div className="rounded-xl border border-card-border bg-card p-4" data-testid="kpi-total-earned">
                <IndianRupee className="text-primary mb-2" size={20} />
                <p className="text-xs text-muted-foreground">Total earned</p>
                <p className="text-xl font-bold">{formatINR(Number(summary.totalEarned))}</p>
              </div>
              <div className="rounded-xl border border-card-border bg-card p-4" data-testid="kpi-available-balance">
                <Wallet className="text-primary mb-2" size={20} />
                <p className="text-xs text-muted-foreground">Available balance</p>
                <p className="text-xl font-bold">{formatINR(Number(summary.availableBalance))}</p>
              </div>
            </div>

            {/* Rules */}
            <div className="rounded-xl border border-card-border bg-secondary/50 p-4 mb-8 text-sm space-y-1" data-testid="panel-referral-rules">
              <h2 className="font-semibold mb-1">How it works</h2>
              <p>• Your friend gets 10% off their first order when they use your code.</p>
              <p>• You earn 5% of their qualifying order as reward credit.</p>
              <p>• Rewards can be redeemed at checkout, capped at 30% max discount per order.</p>
            </div>

            {/* Referrals table */}
            <section className="mb-8">
              <h2 className="font-semibold text-lg mb-3">Your referrals</h2>
              <div className="rounded-xl border border-card-border bg-card overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-secondary text-left">
                    <tr>
                      <th className="p-3 font-semibold">Referred customer ID</th>
                      <th className="p-3 font-semibold">Code used</th>
                      <th className="p-3 font-semibold">Status</th>
                      <th className="p-3 font-semibold">Date</th>
                    </tr>
                  </thead>
                  <tbody>
                    {summary.referrals.map((r) => (
                      <tr key={r.id} className="border-t border-card-border" data-testid={`referral-row-${r.id}`}>
                        <td className="p-3">#{r.referredUserId}</td>
                        <td className="p-3">{r.code}</td>
                        <td className="p-3"><Badge variant={referralStatusVariant(r.status)}>{r.status}</Badge></td>
                        <td className="p-3 text-muted-foreground">{new Date(r.createdAt).toLocaleDateString("en-IN")}</td>
                      </tr>
                    ))}
                    {summary.referrals.length === 0 && (
                      <tr><td colSpan={4} className="p-8 text-center text-muted-foreground">No referrals yet — share your code to get started.</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </section>

            {/* Rewards table */}
            <section>
              <h2 className="font-semibold text-lg mb-3">Your rewards</h2>
              <div className="rounded-xl border border-card-border bg-card overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-secondary text-left">
                    <tr>
                      <th className="p-3 font-semibold">Amount</th>
                      <th className="p-3 font-semibold">Reward %</th>
                      <th className="p-3 font-semibold">Status</th>
                      <th className="p-3 font-semibold">Date</th>
                    </tr>
                  </thead>
                  <tbody>
                    {summary.rewards.map((r) => (
                      <tr key={r.id} className="border-t border-card-border" data-testid={`reward-row-${r.id}`}>
                        <td className="p-3 font-semibold text-primary">{formatINR(Number(r.amount))}</td>
                        <td className="p-3">{Number(r.rewardPercent)}%</td>
                        <td className="p-3"><Badge variant={r.status === "used" ? "outline" : "default"}>{r.status}</Badge></td>
                        <td className="p-3 text-muted-foreground">{new Date(r.createdAt).toLocaleDateString("en-IN")}</td>
                      </tr>
                    ))}
                    {summary.rewards.length === 0 && (
                      <tr><td colSpan={4} className="p-8 text-center text-muted-foreground">No rewards earned yet.</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </section>
          </>
        )}
      </div>
    </Layout>
  );
}

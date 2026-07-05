import { useState } from "react";
import { useSearch, useLocation } from "wouter";
import { useMutation } from "@tanstack/react-query";
import { CheckCircle2, XCircle, Smartphone } from "lucide-react";
import { Layout } from "@/components/Layout";
import { apiRequest, apiGet } from "@/lib/queryClient";
import { formatINR } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";

interface StatusResult {
  merchantOrderId: string;
  status: "success" | "failed" | "pending";
}

export default function PaymentSimulate() {
  const search = useSearch();
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const params = new URLSearchParams(search);
  const merchantOrderId = params.get("merchantOrderId") || "";
  const amount = params.get("amount");

  const [resolving, setResolving] = useState<"success" | "failed" | null>(null);

  const simulate = useMutation({
    mutationFn: async (outcome: "success" | "failed") => {
      await apiRequest("POST", "/api/payments/simulate", { merchantOrderId, outcome });
      const status = await apiGet<StatusResult>(`/api/payments/status/${encodeURIComponent(merchantOrderId)}`);
      return status;
    },
    onMutate: (outcome) => setResolving(outcome),
    onSuccess: (status) => {
      if (status.status === "success") {
        navigate(`/payment/success/${encodeURIComponent(merchantOrderId)}`);
      } else {
        navigate(`/payment/failure/${encodeURIComponent(merchantOrderId)}`);
      }
    },
    onError: () => {
      setResolving(null);
      toast({ title: "Could not reach the payment simulator", variant: "destructive" });
    },
  });

  return (
    <Layout>
      <div className="mx-auto max-w-md px-4 py-16">
        <div className="rounded-2xl border border-card-border bg-card p-6 text-center" data-testid="panel-payment-simulate">
          <div className="mx-auto h-14 w-14 rounded-full bg-primary/10 flex items-center justify-center mb-4">
            <Smartphone className="text-primary" size={28} />
          </div>
          <h1 className="font-serif text-2xl font-bold">PhonePe (sandbox)</h1>
          <p className="text-sm text-muted-foreground mt-1">This is a preview-only payment simulator.</p>

          <div className="mt-6 rounded-xl bg-secondary p-4">
            <p className="text-xs text-muted-foreground">Amount payable</p>
            <p className="text-2xl font-bold" data-testid="text-simulate-amount">{amount ? formatINR(Number(amount)) : "—"}</p>
            <p className="text-xs text-muted-foreground mt-2 break-all" data-testid="text-simulate-merchant-order-id">Order ref: {merchantOrderId || "—"}</p>
          </div>

          <div className="mt-6 flex flex-col gap-3">
            <Button
              className="w-full"
              onClick={() => simulate.mutate("success")}
              disabled={!merchantOrderId || simulate.isPending}
              data-testid="button-simulate-success"
            >
              <CheckCircle2 size={16} className="mr-2" />
              {resolving === "success" && simulate.isPending ? "Processing…" : "Simulate success"}
            </Button>
            <Button
              variant="outline"
              className="w-full"
              onClick={() => simulate.mutate("failed")}
              disabled={!merchantOrderId || simulate.isPending}
              data-testid="button-simulate-failure"
            >
              <XCircle size={16} className="mr-2" />
              {resolving === "failed" && simulate.isPending ? "Processing…" : "Simulate failure"}
            </Button>
          </div>

          {!merchantOrderId && (
            <p className="text-xs text-destructive mt-4">Missing payment reference — please retry checkout.</p>
          )}
        </div>
      </div>
    </Layout>
  );
}

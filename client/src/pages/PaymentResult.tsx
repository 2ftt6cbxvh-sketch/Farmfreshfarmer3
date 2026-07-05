import { useParams, useLocation, Link } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { CheckCircle2, XCircle, Loader2, RefreshCw } from "lucide-react";
import { Layout } from "@/components/Layout";
import { apiGet, apiRequest } from "@/lib/queryClient";
import { formatINR } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";

interface StatusResult {
  merchantOrderId: string;
  status: "success" | "failed" | "pending";
  providerTransactionId?: string;
  method?: string;
  raw: any;
}

interface InitiatePaymentResult {
  paymentId: number;
  merchantOrderId: string;
  redirectUrl: string;
  simulated: boolean;
}

export function PaymentSuccess() {
  return <PaymentResult expected="success" />;
}

export function PaymentFailure() {
  return <PaymentResult expected="failed" />;
}

function PaymentResult({ expected }: { expected: "success" | "failed" }) {
  const params = useParams<{ merchantOrderId: string }>();
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const merchantOrderId = params.merchantOrderId || "";

  const { data: status, isLoading } = useQuery<StatusResult>({
    queryKey: ["/api/payments/status", merchantOrderId],
    queryFn: () => apiGet<StatusResult>(`/api/payments/status/${encodeURIComponent(merchantOrderId)}`),
    enabled: !!merchantOrderId,
  });

  const retry = useMutation({
    mutationFn: async () => {
      // orderId isn't directly returned by the status endpoint, so we rely on the
      // linked order via the raw payload when present; otherwise send the user
      // back to their orders to retry payment from there.
      const orderId = status?.raw?.orderId ?? status?.raw?.metaInfo?.udf1;
      if (!orderId) throw new Error("Missing order reference");
      const res = await apiRequest("POST", "/api/payments/initiate", { orderId: Number(orderId) });
      return res.json() as Promise<InitiatePaymentResult>;
    },
    onSuccess: (pay) => {
      if (pay.redirectUrl.startsWith("http")) {
        window.location.href = pay.redirectUrl;
      } else {
        const hashIdx = pay.redirectUrl.indexOf("#");
        navigate(hashIdx >= 0 ? pay.redirectUrl.slice(hashIdx + 1) : pay.redirectUrl);
      }
    },
    onError: () => {
      toast({ title: "Could not restart payment", description: "Please retry from your orders page.", variant: "destructive" });
      navigate("/orders");
    },
  });

  if (isLoading || !status) {
    return (
      <Layout>
        <div className="mx-auto max-w-md px-4 py-24 text-center">
          <Loader2 className="mx-auto animate-spin text-primary" size={40} />
          <h1 className="font-serif text-xl font-bold mt-4">Checking payment status…</h1>
        </div>
      </Layout>
    );
  }

  const isSuccess = status.status === "success";

  // If we expected success but it's not, or vice versa, still show the true status.
  const showSuccess = isSuccess;

  return (
    <Layout>
      <div className="mx-auto max-w-md px-4 py-16 text-center">
        <div className="rounded-2xl border border-card-border bg-card p-6" data-testid={showSuccess ? "panel-payment-success" : "panel-payment-failure"}>
          {showSuccess ? (
            <>
              <div className="mx-auto h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center mb-4">
                <CheckCircle2 className="text-primary" size={36} />
              </div>
              <h1 className="font-serif text-2xl font-bold">Payment successful</h1>
              <p className="text-sm text-muted-foreground mt-2">Your payment has been received.</p>
            </>
          ) : (
            <>
              <div className="mx-auto h-16 w-16 rounded-full bg-destructive/10 flex items-center justify-center mb-4">
                <XCircle className="text-destructive" size={36} />
              </div>
              <h1 className="font-serif text-2xl font-bold">Payment {status.status === "pending" ? "pending" : "failed"}</h1>
              <p className="text-sm text-muted-foreground mt-2">
                {status.status === "pending" ? "We haven't received confirmation yet." : "Your payment could not be completed."}
              </p>
            </>
          )}

          <div className="mt-6 rounded-xl bg-secondary p-4 text-left text-sm space-y-1">
            <div className="flex justify-between"><span className="text-muted-foreground">Reference</span><span className="break-all text-right" data-testid="text-merchant-order-id">{status.merchantOrderId}</span></div>
            {status.method && <div className="flex justify-between"><span className="text-muted-foreground">Method</span><span>{status.method}</span></div>}
            {status.providerTransactionId && (
              <div className="flex justify-between"><span className="text-muted-foreground">Transaction ID</span><span className="break-all text-right">{status.providerTransactionId}</span></div>
            )}
          </div>

          <div className="mt-6 flex flex-col gap-3">
            {showSuccess ? (
              <>
                <Link href="/orders" className="w-full inline-block rounded-md bg-primary text-primary-foreground px-4 py-2 text-sm font-semibold hover-elevate" data-testid="link-view-orders">
                  View my orders
                </Link>
                <Link href="/" className="w-full inline-block rounded-md border border-input px-4 py-2 text-sm font-semibold hover-elevate" data-testid="link-continue-shopping">
                  Continue shopping
                </Link>
              </>
            ) : (
              <>
                <Button className="w-full" onClick={() => retry.mutate()} disabled={retry.isPending} data-testid="button-retry-payment">
                  <RefreshCw size={15} className="mr-2" /> {retry.isPending ? "Retrying…" : "Retry payment"}
                </Button>
                <Link href="/cart" className="w-full inline-block rounded-md border border-input px-4 py-2 text-sm font-semibold hover-elevate" data-testid="link-back-to-cart">
                  Back to cart
                </Link>
                <Link href="/orders" className="text-xs text-primary underline" data-testid="link-view-orders-failure">
                  View my orders
                </Link>
              </>
            )}
          </div>
        </div>
      </div>
    </Layout>
  );
}

export default PaymentResult;

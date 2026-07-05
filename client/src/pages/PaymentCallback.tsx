import { useEffect, useRef } from "react";
import { useSearch, useLocation } from "wouter";
import { Loader2 } from "lucide-react";
import { Layout } from "@/components/Layout";
import { apiGet } from "@/lib/queryClient";

interface StatusResult {
  merchantOrderId: string;
  status: "success" | "failed" | "pending";
}

export default function PaymentCallback() {
  const search = useSearch();
  const [, navigate] = useLocation();
  const params = new URLSearchParams(search);
  const merchantOrderId = params.get("merchantOrderId") || "";
  const startedRef = useRef(false);

  useEffect(() => {
    if (!merchantOrderId || startedRef.current) return;
    startedRef.current = true;

    let cancelled = false;
    (async () => {
      try {
        const status = await apiGet<StatusResult>(`/api/payments/status/${encodeURIComponent(merchantOrderId)}`);
        if (cancelled) return;
        if (status.status === "success") {
          navigate(`/payment/success/${encodeURIComponent(merchantOrderId)}`, { replace: true });
        } else {
          navigate(`/payment/failure/${encodeURIComponent(merchantOrderId)}`, { replace: true });
        }
      } catch {
        if (!cancelled) navigate(`/payment/failure/${encodeURIComponent(merchantOrderId)}`, { replace: true });
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [merchantOrderId, navigate]);

  return (
    <Layout>
      <div className="mx-auto max-w-md px-4 py-24 text-center" data-testid="panel-payment-callback">
        <Loader2 className="mx-auto animate-spin text-primary" size={40} />
        <h1 className="font-serif text-xl font-bold mt-4">Verifying payment…</h1>
        <p className="text-sm text-muted-foreground mt-2">Please wait while we confirm your payment status.</p>
      </div>
    </Layout>
  );
}

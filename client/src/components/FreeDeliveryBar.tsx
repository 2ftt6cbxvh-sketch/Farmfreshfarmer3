import { useQuery } from "@tanstack/react-query";
import { useCart } from "@/lib/store";
import { motion, AnimatePresence } from "framer-motion";

interface DeliveryRules {
  freeAbove?: number;
  freeDeliveryAboveOrderValue?: number;
}

export function FreeDeliveryBar() {
  const { subtotal } = useCart();

  const { data: rules } = useQuery<DeliveryRules>({
    queryKey: ["/api/delivery-rules"],
    staleTime: 60_000,
  });

  const threshold = Number(
    rules?.freeAbove ?? rules?.freeDeliveryAboveOrderValue ?? 500
  );
  const pct = Math.min(100, Math.round((subtotal / threshold) * 100));
  const remaining = threshold - subtotal;
  const unlocked = subtotal >= threshold;
  const isVisible = subtotal > 0;

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          initial={{ height: 0, opacity: 0, scaleY: 0.9 }}
          animate={{ height: "auto", opacity: 1, scaleY: 1 }}
          exit={{ height: 0, opacity: 0, scaleY: 0.9 }}
          transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
          className="w-full bg-background border-b border-border/50 overflow-hidden origin-top"
        >
          <div className="mx-auto max-w-7xl px-4 py-1.5 flex items-center gap-3">
            {/* Label */}
            <span className="text-[11px] font-semibold text-muted-foreground shrink-0 hidden sm:block">
              {unlocked ? "🎉" : "🚚"}
            </span>
            <span className="text-[11px] font-medium text-foreground/70 shrink-0 whitespace-nowrap">
              {unlocked ? (
                <span className="text-emerald-600 dark:text-emerald-400 font-semibold">
                  Free delivery unlocked!
                </span>
              ) : (
                <>
                  Add <strong className="text-foreground">₹{Math.ceil(remaining)}</strong> more for free delivery
                </>
              )}
            </span>

            {/* Progress bar */}
            <div className="flex-1 h-1 rounded-full bg-border overflow-hidden min-w-0">
              <motion.div
                className="h-full rounded-full"
                animate={{
                  width: `${pct}%`,
                  background: unlocked
                    ? "#10b981"
                    : "linear-gradient(to right, #10b981, #34d399)",
                }}
                transition={{ duration: 0.4, ease: "easeOut" }}
              />
            </div>

            {/* Badge */}
            <span className="text-[10px] font-semibold text-emerald-600 dark:text-emerald-400 shrink-0 whitespace-nowrap hidden sm:block">
              {unlocked ? "FREE" : `₹${threshold}`}
            </span>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

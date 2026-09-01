import { useState, useMemo, useEffect } from "react";
import { Link } from "wouter";
import { Minus, Plus, ShoppingCart, Sparkles, Trash2, Check, ChevronDown } from "lucide-react";
import type { Product, QuantityTier } from "@/lib/types";
import { effectivePrice, formatINR } from "@/lib/types";
import { useCart } from "@/lib/store";
import { useLocation } from "wouter";
import { imgUrl } from "@/lib/queryClient";
import { DietDot } from "./DietDot";
import { useToast } from "@/hooks/use-toast";
import { TiltCard } from "./TiltCard";

export function ProductCard({ product }: { product: Product }) {
  const { items, add, setQty: setCartQty, remove: removeFromCart } = useCart();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [animating, setAnimating] = useState(false);
  const [imgFailed, setImgFailed] = useState(false);

  const tiers: QuantityTier[] = useMemo(() => {
    if (!(product as any).quantityTiers) return [];
    try {
      const parsed =
        typeof (product as any).quantityTiers === "string"
          ? JSON.parse((product as any).quantityTiers)
          : (product as any).quantityTiers;
      return Array.isArray(parsed) ? parsed.filter((t: any) => t.active !== false) : [];
    } catch {
      return [];
    }
  }, [(product as any).quantityTiers]);

  const [selectedTier, setSelectedTier] = useState<QuantityTier | null>(() => {
    if (tiers.length > 0) {
      return tiers.find((t) => t.quantity === product.unit) || tiers[0];
    }
    return null;
  });

  useEffect(() => {
    if (tiers.length > 0) {
      setSelectedTier((prev) => {
        if (prev && tiers.some((t) => t.quantity === prev.quantity)) return prev;
        return tiers.find((t) => t.quantity === product.unit) || tiers[0];
      });
    } else {
      setSelectedTier(null);
    }
  }, [tiers, product.unit]);

  const activeUnitPrice = selectedTier ? selectedTier.price : Number(product.price);
  const activeUnit = selectedTier ? selectedTier.quantity : product.unit;

  const cartItem = items.find((i) => i.productId === product.id && (i.unit || "") === (activeUnit || ""));
  const inCartQty = cartItem?.qty || 0;

  const hasDiscount = Number(product.discountPercent || 0) > 0;
  const price = effectivePrice(activeUnitPrice, Number(product.discountPercent));
  const outOfStock = product.stock <= 0;

  function addToCart(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (outOfStock) {
      toast({ title: "Out of Stock", description: "This harvest is currently out of stock", variant: "destructive" });
      return;
    }
    const available = Math.max(0, Number(product.stock || 0) - inCartQty);
    if (available <= 0) {
      toast({
        title: "Stock Limit Reached",
        description: `You already have the maximum available stock (${product.stock} units) in your cart.`,
        variant: "destructive",
      });
      return;
    }
    setAnimating(true);
    add(product, 1, selectedTier || undefined);
    toast({
      title: "✨ Added to Basket",
      description: `1 × ${product.name} (${activeUnit})`,
    });
    setTimeout(() => setAnimating(false), 400);
  }

  function handleDecrementCart(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (inCartQty <= 1) {
      removeFromCart(product.id, activeUnit);
      toast({ title: "🗑️ Removed from Basket", description: `${product.name} (${activeUnit})` });
    } else {
      setCartQty(product.id, inCartQty - 1, activeUnit);
    }
  }

  function handleIncrementCart(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (inCartQty + 1 > product.stock) {
      toast({
        title: "Stock Limit Exceeded",
        description: `Only ${product.stock} unit(s) available in stock for ${product.name}`,
        variant: "destructive",
      });
      return;
    }
    setCartQty(product.id, inCartQty + 1, activeUnit);
  }

  return (
    <TiltCard maxTilt={6} perspective={1000} className="h-full">
      <div
        className={`group relative flex flex-col h-full rounded-2xl sm:rounded-3xl border bg-gradient-to-b from-card/95 via-card/85 to-card/95 backdrop-blur-xl overflow-hidden shadow-md hover:shadow-xl hover:shadow-emerald-950/30 transition-all duration-300 ${
          inCartQty > 0
            ? "border-emerald-500/60 ring-1 ring-emerald-500/30"
            : "border-emerald-500/20 hover:border-emerald-500/50"
        }`}
        data-testid={`card-product-${product.id}`}
      >
        {/* Top Accent Strip */}
        <div className="h-1 w-full bg-gradient-to-r from-emerald-600 via-teal-500 to-amber-500 opacity-70 group-hover:opacity-100 transition-opacity" />

        {/* Product Image Section */}
        <Link
          href={`/product/${product.id}`}
          className="relative block aspect-[4/3] overflow-hidden bg-emerald-950/20 m-2 rounded-xl sm:rounded-2xl"
        >
          {product.image && !imgFailed ? (
            <img
              src={imgUrl(product.image, product.name)}
              alt={product.name}
              loading="lazy"
              decoding="async"
              onError={() => setImgFailed(true)}
              className="h-full w-full object-cover transition-transform duration-500 ease-out group-hover:scale-108"
            />
          ) : (
            <div className="h-full w-full flex flex-col items-center justify-center bg-emerald-950/30 text-emerald-300 p-2 text-center">
              <span className="text-3xl">🌱</span>
              <span className="text-[11px] font-bold mt-1 line-clamp-1">{product.name}</span>
            </div>
          )}

          {/* Floating Discount Tag */}
          {hasDiscount && (
            <span className="absolute top-2 left-2 z-10 bg-amber-500 text-black text-[10px] font-black px-2 py-0.5 rounded-full shadow-md border border-amber-300/40">
              {Math.round(Number(product.discountPercent))}% OFF
            </span>
          )}

          {/* In-Cart Indicator */}
          {inCartQty > 0 && (
            <span className="absolute bottom-2 right-2 z-10 bg-emerald-600 text-white text-[10px] font-black px-2 py-0.5 rounded-full shadow-md border border-emerald-400/40 flex items-center gap-1">
              <Check size={11} strokeWidth={3} /> {inCartQty}
            </span>
          )}

          {/* Out of Stock Overlay */}
          {outOfStock && (
            <div className="absolute inset-0 bg-background/85 backdrop-blur-xs flex items-center justify-center">
              <span className="text-xs font-black text-destructive uppercase tracking-wider bg-destructive/10 px-2.5 py-1 rounded-full border border-destructive/20">
                Out of Stock
              </span>
            </div>
          )}
        </Link>

        {/* Product Details & Pack Picker */}
        <div className="flex flex-1 flex-col p-3 sm:p-4 pt-1">
          <div className="flex items-center gap-1.5 mb-1">
            <DietDot tag={product.dietTag} size={12} />
            <span className="text-[10px] sm:text-[11px] font-bold text-emerald-400/80 uppercase tracking-wider truncate">
              {product.categorySlug}
            </span>
          </div>

          <Link href={`/product/${product.id}`} className="block group-hover:text-emerald-400 transition-colors">
            <h3
              className="text-sm sm:text-base font-serif font-bold leading-snug line-clamp-1 text-foreground"
              data-testid={`text-name-${product.id}`}
            >
              {product.name}
            </h3>
            {product.nameTe && (
              <p className="text-[11px] sm:text-xs font-semibold text-emerald-400 font-sans tracking-wide mt-0.5 line-clamp-1">
                {product.nameTe}
              </p>
            )}
          </Link>

          {/* Clean Subtle Disclaimer */}
          <p className="text-[9px] text-muted-foreground/70 italic leading-tight mt-1">
            *Images for representation. Natural produce may vary by season.
          </p>

          {/* Mobile-Friendly Segmented Pack Selector */}
          {tiers.length > 1 ? (
            <div className="mt-2 flex items-center gap-1 overflow-x-auto pb-0.5 no-scrollbar relative z-20">
              {tiers.map((t, idx) => {
                const isSelected = activeUnit === t.quantity;
                return (
                  <button
                    key={idx}
                    type="button"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      setSelectedTier(t);
                    }}
                    className={`px-2 py-1 rounded-lg text-[10px] sm:text-[11px] font-black whitespace-nowrap transition-all cursor-pointer border shrink-0 ${
                      isSelected
                        ? "bg-emerald-600 text-white border-emerald-400 shadow-xs"
                        : "bg-emerald-500/10 text-emerald-300 border-emerald-500/25 hover:bg-emerald-500/20"
                    }`}
                  >
                    <span>{t.quantity}</span>
                  </button>
                );
              })}
            </div>
          ) : (
            <p className="text-[11px] text-muted-foreground mt-1 font-medium">{activeUnit}</p>
          )}

          {/* Price Row */}
          <div className="mt-auto pt-2.5 flex items-baseline justify-between">
            <div className="flex items-baseline gap-1.5">
              <span
                className="text-lg sm:text-xl font-serif font-black text-primary tracking-tight"
                data-testid={`text-price-${product.id}`}
              >
                {formatINR(price)}
              </span>
              <span className="text-[10px] sm:text-[11px] text-muted-foreground font-medium">/ {activeUnit}</span>
              {hasDiscount && (
                <span className="text-[11px] text-muted-foreground line-through ml-0.5">
                  {formatINR(activeUnitPrice)}
                </span>
              )}
            </div>
          </div>

          {/* 1-Tap Action Area: Add CTA OR Full Stepper */}
          <div className="mt-2.5 w-full relative z-30 pointer-events-auto">
            {inCartQty > 0 ? (
              <div className="flex items-center justify-between rounded-xl border border-emerald-500/60 bg-emerald-950/60 backdrop-blur-md p-1 shadow-md w-full">
                <button
                  type="button"
                  onClick={handleDecrementCart}
                  className="w-8 h-8 flex items-center justify-center hover:bg-emerald-500/20 active:scale-90 transition-all rounded-lg text-emerald-300 cursor-pointer shrink-0"
                  aria-label="Decrease cart count"
                  title={inCartQty === 1 ? "Remove from basket" : "Decrease quantity"}
                >
                  {inCartQty === 1 ? <Trash2 size={14} className="text-red-400" /> : <Minus size={14} />}
                </button>

                <button
                  type="button"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setLocation("/cart");
                  }}
                  className="px-2 py-0.5 text-emerald-300 hover:text-white transition-colors cursor-pointer flex items-center justify-center gap-1.5 min-w-0"
                  title="View Basket"
                >
                  <ShoppingCart size={13} className="shrink-0 text-emerald-400" />
                  <span className="text-xs font-black">{inCartQty} in Cart</span>
                </button>

                <button
                  type="button"
                  onClick={handleIncrementCart}
                  className="w-8 h-8 flex items-center justify-center hover:bg-emerald-500/20 active:scale-90 transition-all rounded-lg text-emerald-300 cursor-pointer shrink-0"
                  aria-label="Increase cart count"
                >
                  <Plus size={14} />
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={addToCart}
                disabled={outOfStock}
                className={`w-full flex items-center justify-center gap-1.5 rounded-xl bg-gradient-to-r from-emerald-600 to-emerald-700 hover:from-emerald-500 hover:to-emerald-600 text-white text-xs font-black py-2 px-3 shadow-md border border-emerald-400/40 active:scale-95 transition-all duration-200 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed ${
                  animating ? "animate-pulse ring-2 ring-emerald-400/50" : ""
                }`}
                data-testid={`button-add-${product.id}`}
              >
                {animating ? (
                  <Sparkles size={14} className="animate-spin text-amber-300 shrink-0" />
                ) : (
                  <Plus size={14} className="text-white shrink-0" strokeWidth={3} />
                )}
                <span>{animating ? "Added!" : "Add to Cart"}</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </TiltCard>
  );
}

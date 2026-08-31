import { useState, useEffect, useMemo } from "react";
import { useRoute, Link, useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Minus, Plus, ShoppingCart, Star, Sparkles, Home, ArrowRight, Check } from "lucide-react";
import { Layout } from "@/components/Layout";
import { DietDot } from "@/components/DietDot";
import { ProductCard } from "@/components/ProductCard";
import type { Product, Review, QuantityTier } from "@/lib/types";
import { effectivePrice, formatINR } from "@/lib/types";
import { getStarTheme } from "@/lib/starTheme";
import { useCart, useAuth } from "@/lib/store";
import { apiRequest, apiGet, queryClient, imgUrl } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { recordProductView } from "@/lib/recommendation-store";

function Stars({ value, onChange }: { value: number; onChange?: (n: number) => void }) {
  return (
    <div className="flex gap-0.5 text-accent">
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          disabled={!onChange}
          onClick={() => onChange?.(n)}
          className={onChange ? "cursor-pointer" : "cursor-default"}
          aria-label={`${n} star`}
          data-testid={onChange ? `star-${n}` : undefined}
        >
          <Star size={onChange ? 22 : 15} fill={n <= value ? "currentColor" : "none"} />
        </button>
      ))}
    </div>
  );
}

export default function ProductDetail() {
  const [, params] = useRoute("/product/:id");
  const id = Number(params?.id);
  const { add, items } = useCart();
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [qty, setQty] = useState(1);
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState("");
  const [imgFailed, setImgFailed] = useState(false);

  const { data: product, isLoading } = useQuery<Product>({
    queryKey: ["/api/products", id],
    queryFn: () => apiGet<Product>(`/api/products/${id}`),
  });

  const tiers: QuantityTier[] = useMemo(() => {
    if (!(product as any)?.quantityTiers) return [];
    try {
      const parsed = typeof (product as any).quantityTiers === "string"
        ? JSON.parse((product as any).quantityTiers)
        : (product as any).quantityTiers;
      return Array.isArray(parsed) ? parsed.filter((t: any) => t.active !== false) : [];
    } catch {
      return [];
    }
  }, [(product as any)?.quantityTiers]);

  const [selectedTier, setSelectedTier] = useState<QuantityTier | null>(null);

  useEffect(() => {
    if (tiers.length > 0) {
      setSelectedTier((prev) => {
        if (prev && tiers.some((t) => t.quantity === prev.quantity)) return prev;
        return tiers.find((t) => t.quantity === product?.unit) || tiers[0];
      });
    } else {
      setSelectedTier(null);
    }
  }, [tiers, product?.unit]);

  const activeUnitPrice = selectedTier ? selectedTier.price : Number(product?.price || 0);
  const activeUnit = selectedTier ? selectedTier.quantity : (product?.unit || "1 Pack");
  const price = effectivePrice(activeUnitPrice, Number(product?.discountPercent || 0));

  // Real-time behavioral & recommendation signal tracking
  useEffect(() => {
    if (id) {
      recordProductView(id, product?.categorySlug);
    }
  }, [id, product?.categorySlug]);

  const { data: reviews = [] } = useQuery<Review[]>({
    queryKey: ["/api/reviews", id],
    queryFn: () => apiGet<Review[]>(`/api/reviews?productId=${id}`),
  });

  // Similar Products Query (Matching Category)
  const { data: categoryProducts = [] } = useQuery<Product[]>({
    queryKey: ["/api/products", "similar", product?.categorySlug],
    queryFn: () => apiGet<Product[]>(`/api/products?category=${product?.categorySlug}`),
    enabled: !!product?.categorySlug,
  });

  // Featured fallback if category has few items
  const { data: featuredProducts = [] } = useQuery<Product[]>({
    queryKey: ["/api/products", "featured"],
    queryFn: () => apiGet<Product[]>("/api/products?featured=1"),
  });

  const { data: deliveryRes } = useQuery<any>({
    queryKey: ["deliveryResolution"],
    queryFn: async () => {
      try {
        const saved = localStorage.getItem("deliveryResolution");
        if (saved) return JSON.parse(saved);
      } catch {}
      return null;
    },
  });

  const activeRadiusKm = deliveryRes?.maxRadiusKm || 30;

  const similarList = categoryProducts.filter((p) => p.id !== id);
  const fallbackList = featuredProducts.filter((p) => p.id !== id && !similarList.some((s) => s.id === p.id));
  const displaySimilar = [...similarList, ...fallbackList].slice(0, 4);

  const reviewMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("POST", "/api/reviews", { productId: id, rating, comment });
    },
    onSuccess: () => {
      setComment("");
      setRating(5);
      queryClient.invalidateQueries({ queryKey: ["/api/reviews", id] });
      toast({ title: "Thank you!", description: "Your review has been posted." });
    },
    onError: () => toast({ title: "Could not post review", variant: "destructive" }),
  });

  if (isLoading) {
    return <Layout><div className="mx-auto max-w-5xl px-4 py-8"><Skeleton className="h-96" /></div></Layout>;
  }
  if (!product) {
    return <Layout><div className="mx-auto max-w-5xl px-4 py-16 text-center text-muted-foreground">Product not found.</div></Layout>;
  }

  const hasDiscount = Number(product.discountPercent || 0) > 0;
  const avg = reviews.length ? reviews.reduce((s, r) => s + r.rating, 0) / reviews.length : 0;

  return (
    <Layout>
      <div className="mx-auto max-w-5xl px-4 py-8 space-y-8">
        {/* Breadcrumb Navigation with Home button */}
        <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground">
          <Link href="/" className="hover:text-emerald-500 flex items-center gap-1.5 transition-colors cursor-pointer bg-emerald-500/10 px-2.5 py-1 rounded-full text-emerald-600 dark:text-emerald-400 font-bold">
            <Home size={13} />
            <span>Home</span>
          </Link>
          <span>/</span>
          <Link href={`/category/${product.categorySlug}`} className="hover:text-emerald-500 capitalize transition-colors cursor-pointer">
            {product.categorySlug}
          </Link>
          <span>/</span>
          <span className="text-foreground font-bold truncate max-w-[200px] sm:max-w-xs">{product.name}</span>
        </div>

        {/* Main Product Specs */}
        <div className="grid md:grid-cols-2 gap-8 items-start">
          <div className="rounded-3xl overflow-hidden border border-emerald-500/20 bg-card aspect-square shadow-xl relative group w-full max-w-full">
            {product.image && !imgFailed ? (
              <img
                src={imgUrl(product.image)}
                alt={product.name}
                fetchPriority="high"
                decoding="async"
                onError={() => setImgFailed(true)}
                className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-105"
              />
            ) : (
              <div className="h-full w-full flex flex-col items-center justify-center bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 p-6 text-center">
                <span className="text-6xl">🌱</span>
                <span className="text-sm font-black mt-3">{product.name}</span>
                <span className="text-xs text-muted-foreground mt-1">Farm Fresh Harvest</span>
              </div>
            )}
            {hasDiscount && (
              <span className="absolute top-4 left-4 bg-gradient-to-r from-amber-500 to-amber-600 text-black text-xs font-extrabold px-3.5 py-1 rounded-full shadow-lg border border-amber-300/40">
                {Math.round(Number(product.discountPercent))}% OFF
              </span>
            )}
            {(product as any).allowInternationalShipping === false && (
              <span className="absolute bottom-4 left-4 max-w-[90%] truncate bg-amber-950/90 text-amber-300 border border-amber-500/50 text-xs font-black px-3 py-1.5 rounded-full shadow-lg backdrop-blur-md">
                📍 Local Delivery Only ({activeRadiusKm}km Radius)
              </span>
            )}
          </div>

          <div className="space-y-4 max-w-full">
            <div className="flex items-center gap-2 flex-wrap">
              <DietDot tag={product.dietTag} size={16} />
              <h1 className="font-serif text-2xl sm:text-3xl lg:text-4xl font-extrabold text-foreground break-words">{product.name}</h1>
            </div>

            {product.nameTe && (
              <p className="text-lg sm:text-xl font-bold text-emerald-600 dark:text-emerald-400 font-sans tracking-wide">
                {product.nameTe}
              </p>
            )}

            {reviews.length > 0 && (
              <div className="flex items-center gap-2">
                <Stars value={Math.round(avg)} />
                <span className="text-sm font-bold text-muted-foreground">{avg.toFixed(1)} ({reviews.length} reviews)</span>
              </div>
            )}

            <p className="text-sm text-muted-foreground leading-relaxed break-words">{product.description || "Fresh farm produce delivered directly with care."}</p>
            
            {/* Multi-Quantity Pack Selector Cards */}
            {tiers.length > 1 && (
              <div className="space-y-2.5 pt-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-black uppercase tracking-wider text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5">
                    <Sparkles size={14} className="text-amber-500 animate-pulse" />
                    <span>Select Pack Size / Quantity:</span>
                  </label>
                  <span className="text-xs font-extrabold text-muted-foreground">
                    Selected: <strong className="text-foreground text-emerald-500">{activeUnit}</strong>
                  </span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                  {tiers.map((t, idx) => {
                    const isSelected = activeUnit === t.quantity;
                    const tierEffective = effectivePrice(t.price, Number(product.discountPercent || 0));

                    return (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => setSelectedTier(t)}
                        className={`relative p-3 rounded-2xl border-2 text-left transition-all duration-200 cursor-pointer ${
                          isSelected
                            ? "bg-gradient-to-br from-emerald-500/20 via-card to-teal-500/20 border-emerald-500 shadow-md ring-2 ring-emerald-500/30 scale-102"
                            : "bg-card/70 border-emerald-500/20 hover:border-emerald-500/60"
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-black text-foreground">{t.quantity}</span>
                          <span className="text-sm font-black text-emerald-600 dark:text-emerald-400">
                            {formatINR(tierEffective)}
                          </span>
                        </div>

                        <div className="text-[10.5px] text-muted-foreground flex items-center justify-between mt-1">
                          <span>{t.perUnit || ""}</span>
                          {t.savings && (
                            <span className="text-amber-500 font-extrabold bg-amber-500/10 px-1.5 py-0.5 rounded text-[9.5px]">
                              {t.savings}
                            </span>
                          )}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            <div className="flex flex-wrap items-center gap-2 w-full pt-1">
              <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-3 py-1 rounded-full border border-emerald-500/20 max-w-full truncate">
                Pack Size: {activeUnit}
              </span>
              {(product as any).allowInternationalShipping === false ? (
                <span className="text-xs font-extrabold text-amber-400 bg-amber-500/10 px-3 py-1 rounded-full border border-amber-500/30 flex items-center gap-1 max-w-full truncate">
                  🛵 Local Warehouse Only ({activeRadiusKm}km Radius)
                </span>
              ) : (
                <span className="text-xs font-extrabold text-emerald-400 bg-emerald-500/10 px-3 py-1 rounded-full border border-emerald-500/30 flex items-center gap-1 max-w-full truncate">
                  ✈️ Local & Out-of-Station Delivery Eligible
                </span>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-3 pt-2">
              <span className="text-3xl font-serif font-black text-primary">{formatINR(price)}</span>
              <span className="text-sm text-muted-foreground font-medium">/ {activeUnit}</span>
              {hasDiscount && <span className="text-lg text-muted-foreground line-through">{formatINR(activeUnitPrice)}</span>}
              {user && (
                (() => {
                  const isSuperAdmin = Boolean(user?.isPrimaryAdmin || user?.email?.toLowerCase() === "admin@farmfreshfarmer.com" || user?.id === 1);
                  const isStaffRole = Boolean(!isSuperAdmin && user.role !== "customer");
                  const starsCount = isSuperAdmin ? 6 : isStaffRole ? Math.max(0, Number(user?.starRating) ?? 5) : Number(user?.customerStars || 0);
                  const theme = getStarTheme(starsCount, true);
                  return (
                    <span className={`inline-flex items-center gap-1 text-[11px] px-2.5 py-0.5 rounded-full font-bold border ${theme.badgeClass}`}>
                      <span className={`${theme.starColor} ${theme.glowClass}`}>★</span> {theme.label} Active
                    </span>
                  );
                })()
              )}
            </div>

            {product.stock > 0 ? (
              <div className="space-y-4 pt-3 w-full">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                  <p className="text-xs font-bold text-emerald-600 dark:text-emerald-400">
                    In Stock · <span className="text-foreground font-extrabold">{product.stock} units</span> available
                  </p>
                </div>

                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full">
                  {/* Premium Rounded Stepper */}
                  <div className="flex items-center justify-between sm:justify-start rounded-2xl border border-emerald-500/25 bg-card/80 backdrop-blur-sm p-1 shadow-xs shrink-0 h-12">
                    <button
                      type="button"
                      onClick={() => setQty((q) => Math.max(1, q - 1))}
                      className="w-10 h-10 flex items-center justify-center rounded-xl text-muted-foreground hover:text-foreground hover:bg-emerald-500/10 active:scale-95 transition-all cursor-pointer"
                      aria-label="Decrease quantity"
                    >
                      <Minus size={15} />
                    </button>
                    <span className="w-10 text-center font-mono font-black text-sm text-foreground">
                      {qty}
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        if (qty >= product.stock) {
                          toast({ title: "Stock Limit Reached", description: `Only ${product.stock} unit(s) in stock.`, variant: "destructive" });
                          return;
                        }
                        setQty((q) => Math.min(product.stock, q + 1));
                      }}
                      className="w-10 h-10 flex items-center justify-center rounded-xl text-muted-foreground hover:text-foreground hover:bg-emerald-500/10 active:scale-95 transition-all cursor-pointer"
                      aria-label="Increase quantity"
                    >
                      <Plus size={15} />
                    </button>
                  </div>
                  
                  {/* Primary Add to Cart Action */}
                  <Button
                    onClick={() => { 
                      const inCart = items.find((i) => i.productId === product.id && (i.unit || "") === (activeUnit || ""))?.qty || 0;
                      const available = Math.max(0, product.stock - inCart);
                      if (available <= 0) {
                        toast({ title: "Stock Limit Reached", description: `You already have the maximum available stock (${product.stock} units) in your cart.`, variant: "destructive" });
                        return;
                      }
                      const finalQty = Math.min(available, qty);
                      add(product, finalQty, selectedTier || undefined); 
                      toast({ title: "✨ Added to basket", description: `${finalQty} × ${product.name} (${activeUnit})` }); 
                    }}
                    className="flex-1 h-12 px-6 rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold text-sm shadow-md shadow-emerald-950/20 hover:shadow-lg hover:shadow-emerald-900/30 transition-all active:scale-[0.98] cursor-pointer flex items-center justify-center gap-2.5"
                    data-testid="button-add-detail"
                  >
                    <ShoppingCart size={17} />
                    <span>Add {qty > 1 ? `${qty} × ${activeUnit}` : activeUnit} to Cart</span>
                  </Button>

                  {/* Secondary View Cart & Checkout Button (Rendered cleanly when in basket) */}
                  {items.some(i => i.productId === product.id) && (
                    <Button
                      onClick={() => setLocation("/cart")}
                      variant="outline"
                      className="h-12 px-5 rounded-2xl border-2 border-emerald-500/40 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-600 dark:text-emerald-300 font-extrabold text-sm transition-all hover:scale-102 active:scale-95 flex items-center justify-center gap-2 shrink-0 cursor-pointer"
                      data-testid="button-go-to-cart"
                    >
                      <span>View Cart</span>
                      <ArrowRight size={15} />
                    </Button>
                  )}
                </div>
              </div>
            ) : (
              <p className="font-extrabold text-destructive pt-4">Out of Stock</p>
            )}
          </div>
        </div>

        {/* Customer Reviews Section */}
        <div className="rounded-3xl border border-emerald-500/20 bg-card p-6 sm:p-8 space-y-6 shadow-xl">
          <h2 className="font-serif text-2xl font-bold">Customer Reviews ({reviews.length})</h2>

          {user ? (
            <div className="rounded-2xl border border-emerald-500/30 bg-secondary/30 p-4 space-y-3">
              <p className="text-xs font-bold text-foreground">Write a Review</p>
              <Stars value={rating} onChange={setRating} />
              <Textarea
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                placeholder="Share your fresh harvest experience..."
                className="bg-card border-emerald-500/20 text-sm"
                data-testid="input-review"
              />
              <Button onClick={() => reviewMutation.mutate()} disabled={reviewMutation.isPending} className="bg-primary font-bold" data-testid="button-submit-review">
                {reviewMutation.isPending ? "Posting..." : "Post Review"}
              </Button>
            </div>
          ) : (
            <p className="text-xs text-muted-foreground">
              <Link href="/login" className="text-primary font-bold underline">Log in</Link> to write a review.
            </p>
          )}

          {reviews.length === 0 ? (
            <p className="text-xs text-muted-foreground">No reviews yet. Be the first to review this produce!</p>
          ) : (
            <ul className="space-y-3" role="list">
              {reviews.map((r) => (
                <li key={r.id} className="rounded-2xl border border-card-border bg-secondary/30 p-4 space-y-1" data-testid={`review-${r.id}`}>
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-xs text-foreground">{r.userName}</span>
                    <Stars value={r.rating} />
                  </div>
                  {r.comment && <p className="text-xs text-muted-foreground mt-1 leading-relaxed">{r.comment}</p>}
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Similar Products Section */}
        {displaySimilar.length > 0 && (
          <div className="space-y-6 pt-4 border-t border-emerald-500/20">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-xs font-extrabold uppercase tracking-widest text-amber-500 bg-amber-500/10 px-3 py-1 rounded-full border border-amber-500/20">
                  Recommended For You
                </span>
                <h2 className="font-serif text-2xl sm:text-3xl font-extrabold text-foreground mt-2 flex items-center gap-2">
                  <Sparkles className="w-6 h-6 text-emerald-400" />
                  Similar Organic Products
                </h2>
              </div>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
              {displaySimilar.map((p) => (
                <ProductCard key={p.id} product={p} />
              ))}
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
}

import { useState } from "react";
import { Link } from "wouter";
import { Minus, Plus, ShoppingCart, Sparkles, Trash2, Check } from "lucide-react";
import type { Product } from "@/lib/types";
import { effectivePrice, formatINR } from "@/lib/types";
import { useCart, useAuth } from "@/lib/store";
import { useLocation } from "wouter";
import { imgUrl } from "@/lib/queryClient";
import { DietDot } from "./DietDot";
import { useToast } from "@/hooks/use-toast";
import { TiltCard } from "./TiltCard";

export function ProductCard({ product }: { product: Product }) {
  const { items, add, setQty: setCartQty, remove: removeFromCart } = useCart();
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [qty, setQty] = useState(1);
  const [animating, setAnimating] = useState(false);
  const [imgFailed, setImgFailed] = useState(false);

  const cartItem = items.find((i) => i.productId === product.id);
  const inCartQty = cartItem?.qty || 0;

  const hasDiscount = Number(product.discountPercent || 0) > 0;
  const price = effectivePrice(Number(product.price), Number(product.discountPercent));
  const outOfStock = product.stock <= 0;

  function addToCart(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (outOfStock) {
      toast({ title: "Out of Stock", description: "This product is currently out of stock", variant: "destructive" });
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
    const finalAdd = Math.min(available, qty);
    setAnimating(true);
    add(product, finalAdd);
    toast({
      title: "✨ Added to Cart",
      description: `${finalAdd} × ${product.name}`,
    });
    setTimeout(() => setAnimating(false), 500);
    setQty(1);
  }

  function handleDecrementCart(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (inCartQty <= 1) {
      removeFromCart(product.id);
      toast({ title: "Removed from Cart", description: product.name });
    } else {
      setCartQty(product.id, inCartQty - 1);
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
    setCartQty(product.id, inCartQty + 1);
  }

  function handleRemoveAll(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    removeFromCart(product.id);
    toast({ title: "Removed from Cart", description: product.name });
  }

  function handleDecQty(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    setQty((q) => Math.max(1, q - 1));
  }

  function handleIncQty(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (qty + inCartQty >= product.stock) {
      toast({
        title: "Stock Limit Exceeded",
        description: `Only ${product.stock} unit(s) available in stock.`,
        variant: "destructive",
      });
      return;
    }
    setQty((q) => Math.min(product.stock, q + 1));
  }

  return (
    <TiltCard maxTilt={8} perspective={1000} className="h-full">
      <div
        className={`group relative flex flex-col h-full rounded-3xl border bg-gradient-to-b from-card/90 via-card/70 to-card/95 backdrop-blur-xl overflow-hidden shadow-lg hover:shadow-[0_20px_40px_-15px_rgba(34,197,94,0.3)] transition-all duration-500 ${
          inCartQty > 0 ? "border-emerald-500/60 ring-1 ring-emerald-500/30" : "border-emerald-500/20 hover:border-primary/60"
        }`}
        data-testid={`card-product-${product.id}`}
      >
        {/* Top Glow Accent Bar */}
        <div className="h-1.5 w-full bg-gradient-to-r from-emerald-600 via-primary to-amber-500 opacity-80 group-hover:opacity-100 transition-opacity" />

        {/* Product Image with 3D Depth Zoom */}
        <Link href={`/product/${product.id}`} className="relative block aspect-[4/3] overflow-hidden bg-emerald-950/20 m-2 rounded-2xl">
          {product.image && !imgFailed ? (
            <img
              src={imgUrl(product.image)}
              alt={product.name}
              loading="lazy"
              decoding="async"
              onError={() => setImgFailed(true)}
              className="h-full w-full object-cover transition-transform duration-700 ease-out group-hover:scale-115 group-hover:rotate-1"
            />
          ) : (
            <div className="h-full w-full flex flex-col items-center justify-center bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 p-2 text-center">
              <span className="text-3xl">🌱</span>
              <span className="text-[11px] font-bold mt-1 line-clamp-1">{product.name}</span>
            </div>
          )}

          {/* Floating Glassmorphic Discount Badge */}
          {hasDiscount && (
            <span className="absolute top-2.5 left-2.5 z-10 bg-gradient-to-r from-amber-500 to-amber-600 text-black text-[10px] sm:text-[11px] font-black px-2.5 py-0.5 sm:py-1 rounded-full shadow-lg border border-amber-300/40 backdrop-blur-md">
              {Math.round(Number(product.discountPercent))}% OFF
            </span>
          )}

          {/* Local Only Shipping Badge */}
          {(product as any).allowInternationalShipping === false && (
            <span className="absolute bottom-2.5 left-2.5 z-10 bg-amber-800/95 text-amber-100 border border-amber-300/80 text-[9px] sm:text-[10px] font-black px-2 py-0.5 rounded-full shadow-lg backdrop-blur-md flex items-center gap-1">
              📍 Local Only
            </span>
          )}

          {/* In-Cart Badge */}
          {inCartQty > 0 && (
            <span className="absolute bottom-2.5 right-2.5 z-10 bg-emerald-600/90 text-white text-[10px] sm:text-[11px] font-black px-2.5 py-0.5 sm:py-1 rounded-full shadow-lg border border-emerald-300/40 backdrop-blur-md flex items-center gap-1">
              <Check size={11} strokeWidth={3} /> {inCartQty} in Cart
            </span>
          )}

          {/* Out of Stock Overlay */}
          {outOfStock && (
            <span className="absolute inset-0 bg-background/85 backdrop-blur-md flex items-center justify-center text-sm font-bold text-destructive tracking-wide uppercase">
              Out of stock
            </span>
          )}
        </Link>

        {/* Product Info */}
        <div className="flex flex-1 flex-col p-4 pt-2">
          <div className="flex items-center gap-2 mb-1">
            <DietDot tag={product.dietTag} size={14} />
            <span className="text-[11px] font-semibold text-emerald-400/90 uppercase tracking-wider">
              {product.categorySlug}
            </span>
          </div>

          <Link href={`/product/${product.id}`} className="block">
            <h3
              className="text-base font-bold leading-snug line-clamp-1 hover:text-primary transition-colors font-serif text-foreground group-hover:text-primary"
              data-testid={`text-name-${product.id}`}
            >
              {product.name}
            </h3>
            {product.nameTe && (
              <p className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 font-sans tracking-wide mt-0.5 line-clamp-1">
                {product.nameTe}
              </p>
            )}
          </Link>
          <p className="text-xs text-muted-foreground mt-0.5">{product.unit}</p>

          <div className="mt-auto pt-3 flex items-baseline justify-between">
            <div className="flex items-baseline gap-2">
              <span
                className="text-xl font-black text-primary tracking-tight font-serif"
                data-testid={`text-price-${product.id}`}
              >
                {formatINR(price)}
              </span>
              {hasDiscount && (
                <span className="text-xs text-muted-foreground line-through">
                  {formatINR(Number(product.price))}
                </span>
              )}
            </div>
          </div>

          {/* Controls: If in cart, show live quantity modifier & remove button */}
          {inCartQty > 0 ? (
            <div className="mt-3 flex items-center gap-1.5 w-full relative z-30 pointer-events-auto">
              <div className="flex flex-1 items-center justify-between rounded-xl border border-emerald-500/60 bg-emerald-950/50 backdrop-blur p-1 shadow-md min-w-0">
                <button
                  type="button"
                  onClick={handleDecrementCart}
                  className="p-1 sm:p-1.5 hover:bg-emerald-500/20 active:scale-90 transition-all rounded-lg text-emerald-300 cursor-pointer shrink-0"
                  aria-label="Decrease cart count"
                  title={inCartQty === 1 ? "Remove from cart" : "Decrease quantity"}
                >
                  {inCartQty === 1 ? <Trash2 size={14} className="text-red-400" /> : <Minus size={14} />}
                </button>
                
                <button
                  type="button"
                  onClick={(e) => { e.preventDefault(); e.stopPropagation(); setLocation("/cart"); }}
                  className="px-1 py-0.5 text-emerald-300 hover:text-white transition-colors cursor-pointer flex items-center justify-center gap-1 min-w-0 truncate"
                  title="Go to Cart"
                >
                  <ShoppingCart size={12} className="shrink-0 text-emerald-400" />
                  <span className="text-[11px] font-black truncate">{inCartQty} in Cart</span>
                </button>

                <button
                  type="button"
                  onClick={handleIncrementCart}
                  className="p-1 sm:p-1.5 hover:bg-emerald-500/20 active:scale-90 transition-all rounded-lg text-emerald-300 cursor-pointer shrink-0"
                  aria-label="Increase cart count"
                >
                  <Plus size={14} />
                </button>
              </div>

              <button
                type="button"
                onClick={(e) => { e.preventDefault(); e.stopPropagation(); setLocation("/cart"); }}
                className="hidden sm:flex p-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-black font-extrabold shadow-md transition-all hover:scale-105 active:scale-95 cursor-pointer shrink-0 items-center justify-center"
                title="Go to Cart"
                aria-label="Go to Cart"
              >
                <ShoppingCart size={16} />
              </button>
            </div>
          ) : (
            <div className="mt-3 flex items-center gap-1.5 w-full relative z-30 pointer-events-auto">
              {/* Initial Quantity Selector */}
              <div className="flex items-center rounded-xl border border-emerald-500/30 bg-background/80 backdrop-blur shadow-inner shrink-0">
                <button
                  type="button"
                  onClick={handleDecQty}
                  className="px-1.5 sm:px-2 py-1.5 hover:bg-primary/20 active:scale-90 transition-all rounded-l-xl text-muted-foreground hover:text-primary cursor-pointer"
                  aria-label="Decrease quantity"
                  data-testid={`button-dec-${product.id}`}
                >
                  <Minus size={12} />
                </button>
                <span
                  className="w-5 text-center text-xs font-extrabold select-none text-foreground"
                  data-testid={`text-qty-${product.id}`}
                >
                  {qty}
                </span>
                <button
                  type="button"
                  onClick={handleIncQty}
                  className="px-1.5 sm:px-2 py-1.5 hover:bg-primary/20 active:scale-90 transition-all rounded-r-xl text-muted-foreground hover:text-primary cursor-pointer"
                  aria-label="Increase quantity"
                  data-testid={`button-inc-${product.id}`}
                >
                  <Plus size={12} />
                </button>
              </div>

              {/* Add to Cart Button */}
              <button
                type="button"
                onClick={addToCart}
                disabled={outOfStock}
                className={`flex flex-1 items-center justify-center gap-1 rounded-xl bg-gradient-to-r from-emerald-500 to-emerald-700 hover:from-emerald-400 hover:to-emerald-600 text-white text-xs font-black py-2 px-2 shadow-md border border-emerald-400/50 backdrop-blur-md active:scale-95 transition-all duration-300 cursor-pointer disabled:opacity-50 min-w-0 ${
                  animating ? "animate-pulse ring-2 ring-emerald-400/50" : ""
                }`}
                data-testid={`button-add-${product.id}`}
              >
                {animating ? (
                  <Sparkles size={14} className="animate-spin text-amber-300 shrink-0" />
                ) : (
                  <ShoppingCart size={14} className="text-white shrink-0" />
                )}
                <span className="truncate">{animating ? "Added!" : "Add"}</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </TiltCard>
  );
}

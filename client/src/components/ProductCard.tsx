import { useState } from "react";
import { Link } from "wouter";
import { Minus, Plus, ShoppingCart, Sparkles, Trash2, Check } from "lucide-react";
import type { Product } from "@/lib/types";
import { effectivePrice, formatINR } from "@/lib/types";
import { useCart } from "@/lib/store";
import { imgUrl } from "@/lib/queryClient";
import { DietDot } from "./DietDot";
import { useToast } from "@/hooks/use-toast";
import { TiltCard } from "./TiltCard";

export function ProductCard({ product }: { product: Product }) {
  const { items, add, setQty: setCartQty, remove: removeFromCart } = useCart();
  const { toast } = useToast();
  const [qty, setQty] = useState(1);
  const [animating, setAnimating] = useState(false);

  const cartItem = items.find((i) => i.productId === product.id);
  const inCartQty = cartItem?.qty || 0;

  const hasDiscount = Number(product.discountPercent || 0) > 0;
  const price = effectivePrice(Number(product.price), Number(product.discountPercent));
  const outOfStock = product.stock <= 0;

  function addToCart(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    setAnimating(true);
    add(product, qty);
    toast({
      title: "✨ Added to Cart",
      description: `${qty} × ${product.name}`,
    });
    setTimeout(() => setAnimating(false), 600);
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
    setQty((q) => q + 1);
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
          {product.image ? (
            <img
              src={imgUrl(product.image)}
              alt={product.name}
              loading="lazy"
              className="h-full w-full object-cover transition-transform duration-700 ease-out group-hover:scale-115 group-hover:rotate-1"
            />
          ) : (
            <div className="h-full w-full flex items-center justify-center text-muted-foreground text-sm font-medium">
              No image
            </div>
          )}

          {/* In-Cart Badge */}
          {inCartQty > 0 && (
            <span className="absolute top-3 right-3 bg-emerald-600/90 text-white text-[11px] font-black px-2.5 py-1 rounded-full shadow-lg border border-emerald-300/40 backdrop-blur-md flex items-center gap-1">
              <Check size={12} strokeWidth={3} /> {inCartQty} in Cart
            </span>
          )}

          {/* Floating Glassmorphic Discount Badge */}
          {hasDiscount && (
            <span className="absolute top-3 left-3 bg-gradient-to-r from-amber-500 to-amber-600 text-black text-[11px] font-black px-3 py-1 rounded-full shadow-lg border border-amber-300/40 backdrop-blur-md animate-pulse">
              {Math.round(Number(product.discountPercent))}% OFF
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
            <div className="mt-4 flex items-center gap-2 relative z-30 pointer-events-auto">
              <div className="flex flex-1 items-center justify-between rounded-xl border border-emerald-500/50 bg-emerald-950/40 backdrop-blur p-1 shadow-md">
                <button
                  type="button"
                  onClick={handleDecrementCart}
                  className="p-1.5 hover:bg-emerald-500/20 active:scale-90 transition-all rounded-lg text-emerald-300 cursor-pointer"
                  aria-label="Decrease cart count"
                  title={inCartQty === 1 ? "Remove from cart" : "Decrease quantity"}
                >
                  {inCartQty === 1 ? <Trash2 size={15} className="text-red-400" /> : <Minus size={15} />}
                </button>
                <span className="text-xs font-black text-emerald-300 px-2 flex items-center gap-1">
                  <ShoppingCart size={13} /> {inCartQty} in Cart
                </span>
                <button
                  type="button"
                  onClick={handleIncrementCart}
                  className="p-1.5 hover:bg-emerald-500/20 active:scale-90 transition-all rounded-lg text-emerald-300 cursor-pointer"
                  aria-label="Increase cart count"
                >
                  <Plus size={15} />
                </button>
              </div>
              <button
                type="button"
                onClick={handleRemoveAll}
                className="p-2.5 rounded-xl border border-red-500/30 bg-red-950/30 hover:bg-red-500/20 text-red-400 hover:text-red-300 transition-colors cursor-pointer shrink-0"
                aria-label="Remove all from cart"
                title="Remove completely from cart"
              >
                <Trash2 size={16} />
              </button>
            </div>
          ) : (
            <div className="mt-4 flex items-center gap-2 relative z-30 pointer-events-auto">
              {/* Initial Quantity Selector */}
              <div className="flex items-center rounded-xl border border-emerald-500/30 bg-background/80 backdrop-blur shadow-inner">
                <button
                  type="button"
                  onClick={handleDecQty}
                  className="px-2.5 py-2 hover:bg-primary/20 active:scale-90 transition-all rounded-l-xl text-muted-foreground hover:text-primary cursor-pointer"
                  aria-label="Decrease quantity"
                  data-testid={`button-dec-${product.id}`}
                >
                  <Minus size={13} />
                </button>
                <span
                  className="w-7 text-center text-xs font-extrabold select-none text-foreground"
                  data-testid={`text-qty-${product.id}`}
                >
                  {qty}
                </span>
                <button
                  type="button"
                  onClick={handleIncQty}
                  className="px-2.5 py-2 hover:bg-primary/20 active:scale-90 transition-all rounded-r-xl text-muted-foreground hover:text-primary cursor-pointer"
                  aria-label="Increase quantity"
                  data-testid={`button-inc-${product.id}`}
                >
                  <Plus size={13} />
                </button>
              </div>

              {/* Add to Cart Button */}
              <button
                type="button"
                onClick={addToCart}
                disabled={outOfStock}
                className={`flex flex-1 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-emerald-600 via-primary to-green-500 hover:from-emerald-500 hover:to-primary text-white text-xs font-bold py-2.5 px-3 shadow-lg shadow-emerald-900/30 hover:shadow-emerald-500/40 hover:scale-[1.02] active:scale-95 transition-all duration-300 cursor-pointer disabled:opacity-50 relative z-30 ${
                  animating ? "animate-pulse ring-4 ring-emerald-400/50" : ""
                }`}
                data-testid={`button-add-${product.id}`}
              >
                {animating ? (
                  <Sparkles size={15} className="animate-spin text-amber-300" />
                ) : (
                  <ShoppingCart size={15} className="text-white group-hover:rotate-12 transition-transform" />
                )}
                <span>{animating ? "Added!" : "Add to Cart"}</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </TiltCard>
  );
}

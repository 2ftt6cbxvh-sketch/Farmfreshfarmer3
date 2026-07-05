import { useState } from "react";
import { Link } from "wouter";
import { Minus, Plus, ShoppingCart } from "lucide-react";
import type { Product } from "@/lib/types";
import { effectivePrice, formatINR } from "@/lib/types";
import { useCart } from "@/lib/store";
import { imgUrl } from "@/lib/queryClient";
import { DietDot } from "./DietDot";
import { useToast } from "@/hooks/use-toast";

export function ProductCard({ product }: { product: Product }) {
  const { add } = useCart();
  const { toast } = useToast();
  const [qty, setQty] = useState(1);

  const hasDiscount = Number(product.discountPercent || 0) > 0;
  const price = effectivePrice(Number(product.price), Number(product.discountPercent));
  const outOfStock = product.stock <= 0;

  function addToCart() {
    add(product, qty);
    toast({ title: "Added to cart", description: `${qty} × ${product.name}` });
    setQty(1);
  }

  return (
    <div
      className="group flex flex-col rounded-xl border border-card-border bg-card overflow-hidden hover-elevate"
      data-testid={`card-product-${product.id}`}
    >
      <Link href={`/product/${product.id}`} className="relative block aspect-square overflow-hidden bg-secondary">
        {product.image ? (
          <img
            src={imgUrl(product.image)}
            alt={product.name}
            loading="lazy"
            className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
          />
        ) : (
          <div className="h-full w-full flex items-center justify-center text-muted-foreground text-sm">No image</div>
        )}
        {hasDiscount && (
          <span className="absolute top-2 left-2 bg-accent text-accent-foreground text-xs font-bold px-2 py-0.5 rounded-full">
            {Math.round(Number(product.discountPercent))}% OFF
          </span>
        )}
        {outOfStock && (
          <span className="absolute inset-0 bg-background/70 flex items-center justify-center text-sm font-semibold">
            Out of stock
          </span>
        )}
      </Link>

      <div className="flex flex-1 flex-col p-3">
        <div className="flex items-start gap-2">
          <DietDot tag={product.dietTag} size={14} />
          <Link href={`/product/${product.id}`} className="flex-1">
            <h3 className="text-sm font-semibold leading-snug line-clamp-2 hover:text-primary" data-testid={`text-name-${product.id}`}>
              {product.name}
            </h3>
          </Link>
        </div>
        <p className="text-xs text-muted-foreground mt-0.5">{product.unit}</p>

        <div className="mt-2 flex items-baseline gap-2">
          <span className="text-base font-bold text-primary" data-testid={`text-price-${product.id}`}>{formatINR(price)}</span>
          {hasDiscount && (
            <span className="text-xs text-muted-foreground line-through">{formatINR(Number(product.price))}</span>
          )}
        </div>

        <div className="mt-3 flex items-center gap-2">
          <div className="flex items-center rounded-md border border-input">
            <button
              onClick={() => setQty((q) => Math.max(1, q - 1))}
              className="px-2 py-1.5 hover-elevate"
              aria-label="Decrease quantity"
              data-testid={`button-dec-${product.id}`}
            >
              <Minus size={14} />
            </button>
            <span className="w-8 text-center text-sm" data-testid={`text-qty-${product.id}`}>{qty}</span>
            <button
              onClick={() => setQty((q) => q + 1)}
              className="px-2 py-1.5 hover-elevate"
              aria-label="Increase quantity"
              data-testid={`button-inc-${product.id}`}
            >
              <Plus size={14} />
            </button>
          </div>
          <button
            onClick={addToCart}
            disabled={outOfStock}
            className="flex flex-1 items-center justify-center gap-1.5 rounded-md bg-primary text-primary-foreground text-sm font-medium py-2 hover-elevate disabled:opacity-50"
            data-testid={`button-add-${product.id}`}
          >
            <ShoppingCart size={15} /> Add
          </button>
        </div>
      </div>
    </div>
  );
}

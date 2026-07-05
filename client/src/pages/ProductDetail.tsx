import { useState } from "react";
import { useRoute, Link } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Minus, Plus, ShoppingCart, Star } from "lucide-react";
import { Layout } from "@/components/Layout";
import { DietDot } from "@/components/DietDot";
import type { Product, Review } from "@/lib/types";
import { effectivePrice, formatINR } from "@/lib/types";
import { useCart, useAuth } from "@/lib/store";
import { apiRequest, apiGet, queryClient, imgUrl } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";

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
  const { add } = useCart();
  const { user } = useAuth();
  const { toast } = useToast();
  const [qty, setQty] = useState(1);
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState("");

  const { data: product, isLoading } = useQuery<Product>({
    queryKey: ["/api/products", id],
    queryFn: () => apiGet<Product>(`/api/products/${id}`),
  });

  const { data: reviews = [] } = useQuery<Review[]>({
    queryKey: ["/api/reviews", id],
    queryFn: () => apiGet<Review[]>(`/api/reviews?productId=${id}`),
  });

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

  const price = effectivePrice(Number(product.price), Number(product.discountPercent));
  const hasDiscount = Number(product.discountPercent || 0) > 0;
  const avg = reviews.length ? reviews.reduce((s, r) => s + r.rating, 0) / reviews.length : 0;

  return (
    <Layout>
      <div className="mx-auto max-w-5xl px-4 py-8">
        <div className="grid md:grid-cols-2 gap-8">
          <div className="rounded-xl overflow-hidden border border-card-border bg-secondary aspect-square">
            {product.image ? (
              <img src={imgUrl(product.image)} alt={product.name} className="h-full w-full object-cover" />
            ) : <div className="h-full flex items-center justify-center text-muted-foreground">No image</div>}
          </div>

          <div>
            <div className="flex items-center gap-2">
              <DietDot tag={product.dietTag} size={16} />
              <h1 className="font-serif text-2xl sm:text-3xl font-bold">{product.name}</h1>
            </div>
            {reviews.length > 0 && (
              <div className="flex items-center gap-2 mt-2">
                <Stars value={Math.round(avg)} />
                <span className="text-sm text-muted-foreground">{avg.toFixed(1)} ({reviews.length})</span>
              </div>
            )}
            <p className="text-sm text-muted-foreground mt-3">{product.description || "Fresh and delivered with care."}</p>
            <p className="text-xs text-muted-foreground mt-2">Pack: {product.unit}</p>

            <div className="mt-4 flex items-baseline gap-3">
              <span className="text-2xl font-bold text-primary">{formatINR(price)}</span>
              {hasDiscount && <span className="text-base text-muted-foreground line-through">{formatINR(Number(product.price))}</span>}
              {hasDiscount && <span className="text-sm font-semibold text-accent-foreground bg-accent/30 rounded px-2">{Math.round(Number(product.discountPercent))}% OFF</span>}
            </div>

            {product.stock > 0 ? (
              <div className="mt-6 flex items-center gap-3">
                <div className="flex items-center rounded-md border border-input">
                  <button onClick={() => setQty((q) => Math.max(1, q - 1))} className="px-3 py-2 hover-elevate" aria-label="Decrease"><Minus size={16} /></button>
                  <span className="w-10 text-center">{qty}</span>
                  <button onClick={() => setQty((q) => q + 1)} className="px-3 py-2 hover-elevate" aria-label="Increase"><Plus size={16} /></button>
                </div>
                <Button onClick={() => { add(product, qty); toast({ title: "Added to cart" }); }} className="gap-2" data-testid="button-add-detail">
                  <ShoppingCart size={16} /> Add to cart
                </Button>
              </div>
            ) : (
              <p className="mt-6 font-semibold text-destructive">Out of stock</p>
            )}
          </div>
        </div>

        {/* Reviews */}
        <div className="mt-12">
          <h2 className="font-serif text-xl font-bold mb-4">Customer reviews</h2>

          {user ? (
            <div className="rounded-xl border border-card-border bg-card p-4 mb-6">
              <p className="text-sm font-medium mb-2">Write a review</p>
              <Stars value={rating} onChange={setRating} />
              <Textarea
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                placeholder="Share your experience…"
                className="mt-3"
                data-testid="input-review"
              />
              <Button onClick={() => reviewMutation.mutate()} disabled={reviewMutation.isPending} className="mt-3" data-testid="button-submit-review">
                {reviewMutation.isPending ? "Posting…" : "Post review"}
              </Button>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground mb-6">
              <Link href="/login" className="text-primary underline">Log in</Link> to write a review.
            </p>
          )}

          {reviews.length === 0 ? (
            <p className="text-sm text-muted-foreground">No reviews yet. Be the first!</p>
          ) : (
            <ul className="space-y-4" role="list">
              {reviews.map((r) => (
                <li key={r.id} className="rounded-xl border border-card-border bg-card p-4" data-testid={`review-${r.id}`}>
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-sm">{r.userName}</span>
                    <Stars value={r.rating} />
                  </div>
                  {r.comment && <p className="text-sm text-muted-foreground mt-2">{r.comment}</p>}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </Layout>
  );
}

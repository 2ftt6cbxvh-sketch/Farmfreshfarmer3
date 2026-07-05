// Re-export shared types and add frontend-only helpers
export type {
  Product,
  Category,
  Coupon,
  Review,
  Order,
  User,
} from "@shared/schema";

export interface CartItem {
  productId: number;
  name: string;
  unit: string;
  price: number; // effective price (after product discount)
  image: string;
  qty: number;
}

export interface AuthUser {
  id: number;
  name: string;
  email: string;
  role: string;
  phone?: string | null;
  address?: string | null;
}

// Effective price after the product's own discount
export function effectivePrice(price: number, discountPercent: number): number {
  const p = price * (1 - (discountPercent || 0) / 100);
  return Math.round(p * 100) / 100;
}

export function formatINR(n: number): string {
  return "\u20B9" + Number(n).toLocaleString("en-IN", { maximumFractionDigits: 2 });
}

// Diet tag dot: "veg" -> green, "nonveg" -> red, else none
export function dietDotColor(tag?: string | null): string | null {
  if (tag === "veg") return "#2e7d32";
  if (tag === "nonveg") return "#c62828";
  return null;
}

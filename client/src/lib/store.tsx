import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { apiRequest } from "./queryClient";
import type { AuthUser, CartItem, Product } from "./types";
import { effectivePrice } from "./types";

/* ----------------------------- Auth ------------------------------ */
interface AuthContextType {
  user: AuthUser | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<AuthUser>;
  register: (data: { name: string; email: string; password: string; phone?: string }) => Promise<AuthUser>;
  logout: () => Promise<void>;
  refresh: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  async function refresh() {
    try {
      const res = await apiRequest("GET", "/api/me");
      const data = await res.json();
      setUser(data.user || null);
    } catch {
      setUser(null);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    refresh();
  }, []);

  async function login(email: string, password: string) {
    const res = await apiRequest("POST", "/api/login", { email, password });
    const data = await res.json();
    setUser(data.user);
    return data.user as AuthUser;
  }

  async function register(payload: { name: string; email: string; password: string; phone?: string }) {
    const res = await apiRequest("POST", "/api/register", payload);
    const data = await res.json();
    setUser(data.user);
    return data.user as AuthUser;
  }

  async function logout() {
    await apiRequest("POST", "/api/logout");
    setUser(null);
  }

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout, refresh }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}

/* ----------------------------- Cart ------------------------------ */
interface CartContextType {
  items: CartItem[];
  add: (product: Product, qty?: number) => void;
  setQty: (productId: number, qty: number) => void;
  remove: (productId: number) => void;
  clear: () => void;
  count: number;
  subtotal: number;
}

const CartContext = createContext<CartContextType | null>(null);

export function CartProvider({ children }: { children: ReactNode }) {
  // In-memory only (sandboxed iframe blocks localStorage).
  const [items, setItems] = useState<CartItem[]>([]);

  function add(product: Product, qty = 1) {
    setItems((prev) => {
      const existing = prev.find((i) => i.productId === product.id);
      const price = effectivePrice(Number(product.price), Number(product.discountPercent));
      if (existing) {
        return prev.map((i) =>
          i.productId === product.id ? { ...i, qty: i.qty + qty } : i
        );
      }
      return [
        ...prev,
        {
          productId: product.id,
          name: product.name,
          unit: product.unit,
          price,
          image: product.image,
          qty,
        },
      ];
    });
  }

  function setQty(productId: number, qty: number) {
    setItems((prev) =>
      qty <= 0
        ? prev.filter((i) => i.productId !== productId)
        : prev.map((i) => (i.productId === productId ? { ...i, qty } : i))
    );
  }

  function remove(productId: number) {
    setItems((prev) => prev.filter((i) => i.productId !== productId));
  }

  function clear() {
    setItems([]);
  }

  const count = items.reduce((s, i) => s + i.qty, 0);
  const subtotal = items.reduce((s, i) => s + i.qty * i.price, 0);

  return (
    <CartContext.Provider value={{ items, add, setQty, remove, clear, count, subtotal }}>
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCart must be used within CartProvider");
  return ctx;
}

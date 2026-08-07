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
  setUser: (user: AuthUser | null) => void;
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
      if (data.user && data.user.role !== "customer") {
        localStorage.setItem("adminUser", JSON.stringify(data.user));
      }
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
    if (data.accessToken) {
      localStorage.setItem('accessToken', data.accessToken);
    }
    if (data.refreshToken) {
      localStorage.setItem('refreshToken', data.refreshToken);
    }
    setUser(data.user);
    if (data.user && data.user.role !== "customer") {
      localStorage.setItem("adminUser", JSON.stringify(data.user));
    }
    return data.user as AuthUser;
  }

  async function register(payload: { name: string; email: string; password: string; phone?: string }) {
    const res = await apiRequest("POST", "/api/register", payload);
    const data = await res.json();
    setUser(data.user);
    if (data.user && data.user.role !== "customer") {
      localStorage.setItem("adminUser", JSON.stringify(data.user));
    }
    return data.user as AuthUser;
  }

  async function logout() {
    await apiRequest("POST", "/api/logout");
    localStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken');
    localStorage.removeItem('adminUser');
    setUser(null);
  }

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout, refresh, setUser }}>
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
  const [items, setItems] = useState<CartItem[]>(() => {
    try { return JSON.parse(localStorage.getItem("cartItems") || "[]"); } catch { return []; }
  });
  const { user } = useAuth();

  // Sync to localStorage
  useEffect(() => {
    try { localStorage.setItem("cartItems", JSON.stringify(items)); } catch {}
  }, [items]);

  // Fetch / merge cart on user login
  useEffect(() => {
    if (!user) return;
    let cancelled = false;

    async function syncCartOnLogin() {
      try {
        if (items.length > 0) {
          const res = await apiRequest("POST", "/api/cart/merge", {
            items: items.map((i) => ({ productId: i.productId, qty: i.qty })),
          });
          const data = await res.json();
          if (!cancelled && Array.isArray(data.items)) {
            setItems(data.items);
          }
        } else {
          const res = await apiRequest("GET", "/api/cart");
          const data = await res.json();
          if (!cancelled && Array.isArray(data.items)) {
            setItems(data.items);
          }
        }
      } catch (err) {
        console.error("[Cart] DB sync error:", err);
      }
    }

    syncCartOnLogin();
    return () => { cancelled = true; };
  }, [user?.id]);

  // Helper to sync changes to DB for logged in user
  const syncToDb = (updatedItems: CartItem[]) => {
    if (user) {
      apiRequest("POST", "/api/cart", {
        items: updatedItems.map((i) => ({ productId: i.productId, qty: i.qty })),
      }).catch(() => {});
    }
  };

  function add(product: Product, qty = 1) {
    setItems((prev) => {
      const existing = prev.find((i) => i.productId === product.id);
      const price = effectivePrice(Number(product.price), Number(product.discountPercent));
      let next: CartItem[];
      if (existing) {
        next = prev.map((i) =>
          i.productId === product.id ? { ...i, qty: i.qty + qty } : i
        );
      } else {
        next = [
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
      }
      syncToDb(next);
      return next;
    });
  }

  function setQty(productId: number, qty: number) {
    setItems((prev) => {
      const next = qty <= 0
        ? prev.filter((i) => i.productId !== productId)
        : prev.map((i) => (i.productId === productId ? { ...i, qty } : i));
      syncToDb(next);
      return next;
    });
  }

  function remove(productId: number) {
    setItems((prev) => {
      const next = prev.filter((i) => i.productId !== productId);
      syncToDb(next);
      return next;
    });
  }

  function clear() {
    setItems([]);
    syncToDb([]);
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

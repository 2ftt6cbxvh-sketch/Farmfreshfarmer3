import { create } from 'zustand';
import { api } from './api';

export interface CartItem {
  id: number;
  name: string;
  price: number;
  unit: string;
  image?: string;
  qty: number;
}

interface CartStore {
  items: CartItem[];
  addItem: (product: any, count?: number) => void;
  removeItem: (id: number) => void;
  updateQty: (id: number, targetQty: number) => void;
  clearCart: () => void;
  syncWithServer: () => Promise<void>;
}

const syncToDb = (items: CartItem[]) => {
  api.post('/api/cart', {
    items: items.map((i) => ({ productId: i.id, qty: i.qty })),
  }).catch(() => {});
};

export const useCartStore = create<CartStore>((set, get) => ({
  items: [],
  syncWithServer: async () => {
    try {
      const res = await api.get('/api/cart');
      if (res.data?.items && Array.isArray(res.data.items)) {
        const serverItems: CartItem[] = res.data.items.map((i: any) => ({
          id: i.productId,
          name: i.name,
          price: Number(i.price),
          unit: i.unit,
          image: i.image,
          qty: Number(i.qty) || 1,
        }));
        set({ items: serverItems });
      }
    } catch {}
  },
  addItem: (product, count = 1) => {
    const items = get().items;
    const existing = items.find((i) => i.id === product.id);
    const price = parseFloat(product.price || product.effectivePrice || '0');
    const maxStock = Number(product.stock !== undefined ? product.stock : (product.stockQuantity !== undefined ? product.stockQuantity : 999));
    let nextItems: CartItem[];
    if (existing) {
      const targetQty = Math.min(maxStock > 0 ? maxStock : 999, existing.qty + count);
      nextItems = items.map((i) => (i.id === product.id ? { ...i, qty: targetQty } : i));
    } else {
      const targetQty = Math.min(maxStock > 0 ? maxStock : 999, count);
      if (targetQty <= 0) return;
      nextItems = [
        ...items,
        {
          id: product.id,
          name: product.name,
          price: price > 0 ? price : 100,
          unit: product.unit || '1 Kg',
          image: product.image,
          qty: targetQty,
        },
      ];
    }
    set({ items: nextItems });
    syncToDb(nextItems);
  },
  removeItem: (id) => {
    const nextItems = get().items.filter((i) => i.id !== id);
    set({ items: nextItems });
    syncToDb(nextItems);
  },
  updateQty: (id, targetQty) => {
    if (targetQty <= 0) {
      get().removeItem(id);
      return;
    }
    const items = get().items;
    const nextItems = items.map((i) => (i.id === id ? { ...i, qty: targetQty } : i));
    set({ items: nextItems });
    syncToDb(nextItems);
  },
  clearCart: () => {
    set({ items: [] });
    syncToDb([]);
  },
}));

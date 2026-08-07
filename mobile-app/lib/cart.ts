import { create } from 'zustand';

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
  addItem: (product: any) => void;
  removeItem: (id: number) => void;
  updateQty: (id: number, delta: number) => void;
  clearCart: () => void;
}

export const useCartStore = create<CartStore>((set, get) => ({
  items: [],
  addItem: (product) => {
    const items = get().items;
    const existing = items.find((i) => i.id === product.id);
    const price = parseFloat(product.price || product.effectivePrice || '0');
    if (existing) {
      set({ items: items.map((i) => (i.id === product.id ? { ...i, qty: i.qty + 1 } : i)) });
    } else {
      set({
        items: [
          ...items,
          {
            id: product.id,
            name: product.name,
            price: price > 0 ? price : 100,
            unit: product.unit || '1 Kg',
            image: product.image,
            qty: 1,
          },
        ],
      });
    }
  },
  removeItem: (id) => set({ items: get().items.filter((i) => i.id !== id) }),
  updateQty: (id, delta) => {
    const items = get().items;
    set({
      items: items
        .map((i) => {
          if (i.id === id) {
            const newQty = i.qty + delta;
            return newQty > 0 ? { ...i, qty: newQty } : null;
          }
          return i;
        })
        .filter(Boolean) as CartItem[],
    });
  },
  clearCart: () => set({ items: [] }),
}));

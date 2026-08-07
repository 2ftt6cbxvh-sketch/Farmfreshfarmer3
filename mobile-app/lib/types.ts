export interface User {
  id: number;
  name: string;
  email: string;
  role: 'customer' | 'admin';
  phone?: string;
}

export interface Product {
  id: number;
  name: string;
  description: string;
  categorySlug: string;
  price: string;
  discountPercent: string;
  unit: string;
  image: string;
  stock: number;
  dietTag: string;
  featured: boolean;
  active: boolean;
}

export interface Category {
  id: number;
  name: string;
  slug: string;
  image: string;
  active: boolean;
}

export interface Order {
  id: number;
  customerName: string;
  phone: string;
  address: string;
  subtotal: string;
  discount: string;
  total: string;
  status: string;
  paymentStatus: string;
  paymentMethod: string;
  createdAt: string;
}

export interface CartItem {
  product: Product;
  qty: number;
}

export interface DeliveryResolution {
  serviceable: boolean;
  fee: number;
  etaMinutes: number;
  packingTimeMinutes?: number;
  travelTimeMinutes?: number;
  distanceKm?: number;
  locationArea?: string;
  warehouseName?: string;
  reason?: string;
}

export interface LockdownStatus {
  active: boolean;
  reason: string;
}

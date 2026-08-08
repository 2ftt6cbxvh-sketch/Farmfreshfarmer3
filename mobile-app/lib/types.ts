export interface User {
  id: number;
  name: string;
  email: string;
  role: 'customer' | 'admin' | string;
  phone?: string;
  isPrimaryAdmin?: boolean;
}

export interface Product {
  id: number;
  name: string;
  description: string;
  categorySlug: string;
  categoryId?: number | string;
  price: string;
  discountPercent: string;
  unit: string;
  image: string;
  stock: number;
  dietTag: string;
  featured: boolean;
  active: boolean;
  allowInternationalShipping?: boolean;
}

export interface Category {
  id: number;
  name: string;
  slug: string;
  image: string;
  active: boolean;
  dietTag?: string;
}

export interface Order {
  id: number;
  customerName: string;
  phone: string;
  address: string;
  subtotal: string;
  discount: string;
  couponCode?: string;
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
  freeDeliveryAbove?: number;
  packingTimeMinutes?: number;
  travelTimeMinutes?: number;
  distanceKm?: number;
  maxRadiusKm?: number;
  warehouseId?: number;
  locationArea?: string;
  warehouseName?: string;
  pincode?: string;
  reason?: string;
}

export interface LockdownStatus {
  active: boolean;
  reason: string;
}

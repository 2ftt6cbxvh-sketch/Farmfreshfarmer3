import type { Category, Product } from "./types";

export const SEED_CATEGORIES: Category[] = [
  {
    id: 1,
    name: "Fruits",
    slug: "fruits",
    description: "Farm-fresh organic seasonal fruits",
    image: "/images/cat-fruits.jpg",
    dietTag: "veg",
    parentId: null,
    active: true,
    sortOrder: 0,
  },
  {
    id: 2,
    name: "Vegetables",
    slug: "vegetables",
    description: "Naturally grown farm vegetables",
    image: "/images/cat-vegetables.jpg",
    dietTag: "veg",
    parentId: null,
    active: true,
    sortOrder: 1,
  },
  {
    id: 3,
    name: "Homemade Sweets",
    slug: "homemade-sweets",
    description: "Traditional pure ghee Andhra sweets",
    image: "/images/cat-sweets.jpg",
    dietTag: "veg",
    parentId: null,
    active: true,
    sortOrder: 2,
  },
  {
    id: 4,
    name: "Namkeen",
    slug: "namkeen",
    description: "Crispy homemade snacks & savories",
    image: "/images/cat-namkeen.jpg",
    dietTag: "veg",
    parentId: null,
    active: true,
    sortOrder: 3,
  },
  {
    id: 5,
    name: "Pickles (Veg)",
    slug: "pickles-veg",
    description: "Authentic spicy homemade veg pickles",
    image: "/images/cat-pickle-veg.jpg",
    dietTag: "veg",
    parentId: null,
    active: true,
    sortOrder: 4,
  },
  {
    id: 6,
    name: "Pickles (Non-Veg)",
    slug: "pickles-non-veg",
    description: "Traditional Andhra chicken, mutton & prawn pickles",
    image: "/images/cat-pickle-nonveg.jpg",
    dietTag: "nonveg",
    parentId: null,
    active: true,
    sortOrder: 5,
  },
  {
    id: 7,
    name: "Millets",
    slug: "millets",
    description: "Unpolished organic healthy millets & grains",
    image: "/images/cat-millets.jpg",
    dietTag: "veg",
    parentId: null,
    active: true,
    sortOrder: 6,
  },
  {
    id: 8,
    name: "Pulses",
    slug: "pulses",
    description: "Unpolished traditional farm dal & pulses",
    image: "/images/cat-pulses.jpg",
    dietTag: "veg",
    parentId: null,
    active: true,
    sortOrder: 7,
  },
  {
    id: 9,
    name: "Spices",
    slug: "spices",
    description: "Single-origin aromatic farm-ground spices",
    image: "/images/cat-spices.jpg",
    dietTag: "veg",
    parentId: null,
    active: true,
    sortOrder: 8,
  },
];

export const SEED_PRODUCTS: Product[] = [
  {
    id: 1,
    name: "Alphonso Mango",
    categorySlug: "fruits",
    price: "350.00",
    unit: "1 Kg",
    image: "/images/p-mango.jpg",
    dietTag: "veg",
    stock: 49,
    featured: true,
    discountPercent: "10.00",
    description: "Naturally ripened sweet Alphonso mangoes directly from Andhra orchards.",
    active: true,
    approvalStatus: "approved",
  },
  {
    id: 5,
    name: "Farm Tomatoes",
    categorySlug: "vegetables",
    price: "40.00",
    unit: "1 Kg",
    image: "/images/p-tomato.jpg",
    dietTag: "veg",
    stock: 50,
    featured: true,
    discountPercent: "0.00",
    description: "Vine-ripened farm-fresh juicy red tomatoes.",
    active: true,
    approvalStatus: "approved",
  },
  {
    id: 9,
    name: "Boondi Laddu",
    categorySlug: "homemade-sweets",
    price: "320.00",
    unit: "500 Grams",
    image: "/images/p-laddu.jpg",
    dietTag: "veg",
    stock: 50,
    featured: true,
    discountPercent: "5.00",
    description: "Traditional pure ghee boondi laddu with cashews and cardamom.",
    active: true,
    approvalStatus: "approved",
  },
  {
    id: 12,
    name: "Special Mixture",
    categorySlug: "namkeen",
    price: "160.00",
    unit: "500 Grams",
    image: "/images/p-mixture.jpg",
    dietTag: "veg",
    stock: 50,
    featured: true,
    discountPercent: "0.00",
    description: "Crisp and crunchy homemade spicy mixture made in fresh groundnut oil.",
    active: true,
    approvalStatus: "approved",
  },
  {
    id: 4,
    name: "Seedless Grapes",
    categorySlug: "fruits",
    price: "90.00",
    unit: "500 Grams",
    image: "/images/cat-fruits.jpg",
    dietTag: "veg",
    stock: 50,
    featured: false,
    discountPercent: "0.00",
    description: "Sweet and crunchy seedless green grapes.",
    active: true,
    approvalStatus: "approved",
  },
  {
    id: 6,
    name: "Green Spinach",
    categorySlug: "vegetables",
    price: "25.00",
    unit: "1 Bunch",
    image: "/images/cat-vegetables.jpg",
    dietTag: "veg",
    stock: 50,
    featured: false,
    discountPercent: "0.00",
    description: "Freshly harvested organic palak greens with tender leaves.",
    active: true,
    approvalStatus: "approved",
  },
  {
    id: 7,
    name: "Lady Finger (Okra)",
    categorySlug: "vegetables",
    price: "50.00",
    unit: "500 Grams",
    image: "/images/cat-vegetables.jpg",
    dietTag: "veg",
    stock: 50,
    featured: false,
    discountPercent: "0.00",
    description: "Tender crisp bhendi picked fresh from farm fields.",
    active: true,
    approvalStatus: "approved",
  },
  {
    id: 8,
    name: "Fresh Carrots",
    categorySlug: "vegetables",
    price: "45.00",
    unit: "500 Grams",
    image: "/images/cat-vegetables.jpg",
    dietTag: "veg",
    stock: 50,
    featured: false,
    discountPercent: "0.00",
    description: "Sweet and crunchy organic farm-fresh red carrots.",
    active: true,
    approvalStatus: "approved",
  },
];

export function getInitialCategories(): Category[] {
  if (typeof window === "undefined") return SEED_CATEGORIES;
  try {
    const raw = localStorage.getItem("fff_cached_categories");
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    }
  } catch {}
  return SEED_CATEGORIES;
}

export function saveCachedCategories(cats: Category[]): void {
  if (typeof window === "undefined" || !Array.isArray(cats) || cats.length === 0) return;
  try {
    localStorage.setItem("fff_cached_categories", JSON.stringify(cats));
  } catch {}
}

export function getInitialProducts(): Product[] {
  if (typeof window === "undefined") return SEED_PRODUCTS;
  try {
    const raw = localStorage.getItem("fff_cached_products");
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    }
  } catch {}
  return SEED_PRODUCTS;
}

export function saveCachedProducts(prods: Product[]): void {
  if (typeof window === "undefined" || !Array.isArray(prods) || prods.length === 0) return;
  try {
    localStorage.setItem("fff_cached_products", JSON.stringify(prods));
  } catch {}
}

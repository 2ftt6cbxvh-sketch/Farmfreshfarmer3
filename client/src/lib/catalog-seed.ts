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
  // Fruits
  { id: 1, name: "Alphonso Mango", categorySlug: "fruits", price: "350.00", unit: "1 Kg", image: "/images/p-mango.jpg", dietTag: "veg", stock: 50, featured: true, discountPercent: "10.00", description: "Naturally ripened sweet Alphonso mangoes directly from Andhra orchards.", active: true, approvalStatus: "approved" },
  { id: 2, name: "Fresh Pomegranate", categorySlug: "fruits", price: "180.00", unit: "1 Kg", image: "/images/produce/pomegranate.jpg", dietTag: "veg", stock: 50, featured: false, discountPercent: "0.00", description: "Ruby-red antioxidant-rich pomegranates fresh from orchards.", active: true, approvalStatus: "approved" },
  { id: 3, name: "Papaya", categorySlug: "fruits", price: "60.00", unit: "1 Kg", image: "/images/produce/papaya.jpg", dietTag: "veg", stock: 50, featured: false, discountPercent: "0.00", description: "Naturally ripened sweet organic papaya.", active: true, approvalStatus: "approved" },
  { id: 4, name: "Pineapple", categorySlug: "fruits", price: "80.00", unit: "1 Piece", image: "/images/produce/pineapple.jpg", dietTag: "veg", stock: 50, featured: false, discountPercent: "0.00", description: "Juicy tropical golden pineapple.", active: true, approvalStatus: "approved" },
  { id: 5, name: "Muskmelon", categorySlug: "fruits", price: "70.00", unit: "1 Kg", image: "/images/produce/muskmelon.jpg", dietTag: "veg", stock: 50, featured: false, discountPercent: "0.00", description: "Sweet aromatic ripe cantaloupe muskmelon.", active: true, approvalStatus: "approved" },
  { id: 6, name: "Guava", categorySlug: "fruits", price: "80.00", unit: "1 Kg", image: "/images/produce/guava.jpg", dietTag: "veg", stock: 50, featured: false, discountPercent: "0.00", description: "Crisp organic white guava.", active: true, approvalStatus: "approved" },
  { id: 7, name: "Dragon Fruit", categorySlug: "fruits", price: "140.00", unit: "500 Grams", image: "/images/produce/dragon-fruit.jpg", dietTag: "veg", stock: 50, featured: false, discountPercent: "0.00", description: "Fresh pink pitaya dragon fruit.", active: true, approvalStatus: "approved" },
  { id: 8, name: "Custard Apple", categorySlug: "fruits", price: "120.00", unit: "1 Kg", image: "/images/produce/custard-apple.jpg", dietTag: "veg", stock: 50, featured: false, discountPercent: "0.00", description: "Creamy sweet sitaphal custard apple.", active: true, approvalStatus: "approved" },

  // Vegetables
  { id: 9, name: "Farm Tomatoes", categorySlug: "vegetables", price: "40.00", unit: "1 Kg", image: "/images/p-tomato.jpg", dietTag: "veg", stock: 50, featured: true, discountPercent: "0.00", description: "Vine-ripened farm-fresh juicy red tomatoes.", active: true, approvalStatus: "approved" },
  { id: 10, name: "Fresh Carrots", categorySlug: "vegetables", price: "45.00", unit: "500 Grams", image: "/images/produce/carrots.jpg", dietTag: "veg", stock: 50, featured: false, discountPercent: "0.00", description: "Sweet and crunchy organic farm-fresh red carrots.", active: true, approvalStatus: "approved" },
  { id: 11, name: "Bottle Gourd", categorySlug: "vegetables", price: "35.00", unit: "1 Piece", image: "/images/produce/bottlegourd.jpg", dietTag: "veg", stock: 50, featured: false, discountPercent: "0.00", description: "Tender organic sorakaya bottle gourd.", active: true, approvalStatus: "approved" },
  { id: 12, name: "Bitter Gourd", categorySlug: "vegetables", price: "40.00", unit: "500 Grams", image: "/images/produce/bitter-gourd.jpg", dietTag: "veg", stock: 50, featured: false, discountPercent: "0.00", description: "Fresh crisp kakarakaya bitter gourd.", active: true, approvalStatus: "approved" },
  { id: 13, name: "Ridge Gourd", categorySlug: "vegetables", price: "45.00", unit: "500 Grams", image: "/images/produce/ridge-gourd.jpg", dietTag: "veg", stock: 50, featured: false, discountPercent: "0.00", description: "Fresh tender beerakaya ridge gourd.", active: true, approvalStatus: "approved" },
  { id: 14, name: "Tindora (Dondakaya)", categorySlug: "vegetables", price: "40.00", unit: "500 Grams", image: "/images/produce/tindora.jpg", dietTag: "veg", stock: 50, featured: false, discountPercent: "0.00", description: "Crisp fresh ivy gourd tindora.", active: true, approvalStatus: "approved" },
  { id: 15, name: "Purple Brinjal", categorySlug: "vegetables", price: "35.00", unit: "500 Grams", image: "/images/produce/purple-brinjal.jpg", dietTag: "veg", stock: 50, featured: false, discountPercent: "0.00", description: "Fresh tender purple vankaya eggplant.", active: true, approvalStatus: "approved" },
  { id: 16, name: "Green Brinjal", categorySlug: "vegetables", price: "35.00", unit: "500 Grams", image: "/images/produce/green-brinjal.jpg", dietTag: "veg", stock: 50, featured: false, discountPercent: "0.00", description: "Farm fresh green striped brinjal.", active: true, approvalStatus: "approved" },
  { id: 17, name: "Green Chilli", categorySlug: "vegetables", price: "30.00", unit: "250 Grams", image: "/images/produce/green-chilli.jpg", dietTag: "veg", stock: 50, featured: false, discountPercent: "0.00", description: "Spicy pungent fresh green chillies.", active: true, approvalStatus: "approved" },
  { id: 18, name: "Fresh Garlic", categorySlug: "vegetables", price: "80.00", unit: "500 Grams", image: "/images/produce/garlic.jpg", dietTag: "veg", stock: 50, featured: false, discountPercent: "0.00", description: "Aromatic pungent garlic bulbs.", active: true, approvalStatus: "approved" },
  { id: 19, name: "Fresh Ginger", categorySlug: "vegetables", price: "50.00", unit: "250 Grams", image: "/images/produce/ginger.jpg", dietTag: "veg", stock: 50, featured: false, discountPercent: "0.00", description: "Fresh spicy allam ginger root.", active: true, approvalStatus: "approved" },
  { id: 20, name: "Weekly Fresh Box", categorySlug: "vegetables", price: "399.00", unit: "1 Box", image: "/images/produce/weekly-fresh-box.jpg", dietTag: "veg", stock: 50, featured: true, discountPercent: "0.00", description: "Curated harvest box of weekly essential vegetables.", active: true, approvalStatus: "approved" },

  // Sweets & Namkeen
  { id: 21, name: "Boondi Laddu", categorySlug: "homemade-sweets", price: "320.00", unit: "500 Grams", image: "/images/p-laddu.jpg", dietTag: "veg", stock: 50, featured: true, discountPercent: "5.00", description: "Traditional pure ghee boondi laddus made fresh in small batches.", active: true, approvalStatus: "approved" },
  { id: 22, name: "Kaju Katli", categorySlug: "homemade-sweets", price: "650.00", unit: "500 Grams", image: "/images/produce/kaju-katli.jpg", dietTag: "veg", stock: 50, featured: true, discountPercent: "0.00", description: "Premium cashew fudge with a delicate silver finish.", active: true, approvalStatus: "approved" },
  { id: 23, name: "Mysore Pak", categorySlug: "homemade-sweets", price: "380.00", unit: "500 Grams", image: "/images/produce/mysore-pak.jpg", dietTag: "veg", stock: 50, featured: true, discountPercent: "0.00", description: "Rich, melt-in-mouth ghee Mysore pak.", active: true, approvalStatus: "approved" },
  { id: 24, name: "Special Mixture", categorySlug: "namkeen", price: "160.00", unit: "500 Grams", image: "/images/p-mixture.jpg", dietTag: "veg", stock: 50, featured: true, discountPercent: "0.00", description: "Crunchy South-Indian style spicy mixture.", active: true, approvalStatus: "approved" },
  { id: 25, name: "Murukku", categorySlug: "namkeen", price: "140.00", unit: "500 Grams", image: "/images/produce/murukku.jpg", dietTag: "veg", stock: 50, featured: false, discountPercent: "0.00", description: "Crispy, traditional rice-flour murukku.", active: true, approvalStatus: "approved" },

  // Pickles
  { id: 26, name: "Mango Pickle (Avakaya)", categorySlug: "pickles-veg", price: "220.00", unit: "500 Grams", image: "/images/produce/mango-pickle.jpg", dietTag: "veg", stock: 50, featured: true, discountPercent: "0.00", description: "Andhra-style spicy mango pickle in cold-pressed oil.", active: true, approvalStatus: "approved" },
  { id: 27, name: "Lemon Pickle", categorySlug: "pickles-veg", price: "180.00", unit: "500 Grams", image: "/images/produce/lemon-pickle.jpg", dietTag: "veg", stock: 50, featured: false, discountPercent: "0.00", description: "Tangy, sun-cured lemon pickle.", active: true, approvalStatus: "approved" },
  { id: 28, name: "Gongura Pickle", categorySlug: "pickles-veg", price: "200.00", unit: "500 Grams", image: "/images/produce/gongura-pickle.jpg", dietTag: "veg", stock: 50, featured: false, discountPercent: "0.00", description: "Classic Andhra gongura (sorrel leaf) pickle.", active: true, approvalStatus: "approved" },
  { id: 29, name: "Chicken Pickle", categorySlug: "pickles-non-veg", price: "420.00", unit: "500 Grams", image: "/images/produce/chicken-pickle.jpg", dietTag: "nonveg", stock: 50, featured: true, discountPercent: "0.00", description: "Boneless chicken pickle in aromatic spices.", active: true, approvalStatus: "approved" },
  { id: 30, name: "Mutton Pickle", categorySlug: "pickles-non-veg", price: "520.00", unit: "500 Grams", image: "/images/produce/mutton-pickle.jpg", dietTag: "nonveg", stock: 50, featured: false, discountPercent: "0.00", description: "Tender mutton pickle, slow-cooked with spices.", active: true, approvalStatus: "approved" },
  { id: 31, name: "Prawn Pickle", categorySlug: "pickles-non-veg", price: "480.00", unit: "500 Grams", image: "/images/produce/prawn-pickle.jpg", dietTag: "nonveg", stock: 50, featured: false, discountPercent: "0.00", description: "Coastal-style prawn pickle.", active: true, approvalStatus: "approved" },

  // Millets & Pulses
  { id: 32, name: "Foxtail Millet", categorySlug: "millets", price: "110.00", unit: "1 Kg", image: "/images/produce/foxtail-millet.jpg", dietTag: "veg", stock: 50, featured: false, discountPercent: "0.00", description: "Wholesome, high-fibre foxtail millet.", active: true, approvalStatus: "approved" },
  { id: 33, name: "Pearl Millet (Bajra)", categorySlug: "millets", price: "90.00", unit: "1 Kg", image: "/images/produce/pearl-millet.jpg", dietTag: "veg", stock: 50, featured: false, discountPercent: "0.00", description: "Nutritious bajra, perfect for rotis.", active: true, approvalStatus: "approved" },
  { id: 34, name: "Finger Millet (Ragi)", categorySlug: "millets", price: "100.00", unit: "1 Kg", image: "/images/produce/finger-millet.jpg", dietTag: "veg", stock: 50, featured: false, discountPercent: "0.00", description: "Calcium-rich ragi flour grade grain.", active: true, approvalStatus: "approved" },
  { id: 35, name: "Toor Dal", categorySlug: "pulses", price: "150.00", unit: "1 Kg", image: "/images/produce/toor-dal.jpg", dietTag: "veg", stock: 50, featured: false, discountPercent: "0.00", description: "Premium unpolished toor dal.", active: true, approvalStatus: "approved" },
  { id: 36, name: "Moong Dal", categorySlug: "pulses", price: "140.00", unit: "1 Kg", image: "/images/produce/moong-dal.jpg", dietTag: "veg", stock: 50, featured: false, discountPercent: "0.00", description: "Split green gram, easy to cook.", active: true, approvalStatus: "approved" },
  { id: 37, name: "Chana Dal", categorySlug: "pulses", price: "130.00", unit: "1 Kg", image: "/images/produce/chana-dal.jpg", dietTag: "veg", stock: 50, featured: false, discountPercent: "0.00", description: "Protein-rich split chickpea lentils.", active: true, approvalStatus: "approved" },

  // Spices
  { id: 38, name: "Red Chilli Powder", categorySlug: "spices", price: "200.00", unit: "500 Grams", image: "/images/produce/red-chilli-powder.jpg", dietTag: "veg", stock: 50, featured: true, discountPercent: "0.00", description: "Pure Guntur red chilli powder.", active: true, approvalStatus: "approved" },
  { id: 39, name: "Turmeric Powder", categorySlug: "spices", price: "120.00", unit: "250 Grams", image: "/images/produce/turmeric-powder.jpg", dietTag: "veg", stock: 50, featured: false, discountPercent: "0.00", description: "Farm-fresh, high-curcumin turmeric.", active: true, approvalStatus: "approved" },
  { id: 40, name: "Coriander Powder", categorySlug: "spices", price: "90.00", unit: "250 Grams", image: "/images/produce/coriander-powder.jpg", dietTag: "veg", stock: 50, featured: false, discountPercent: "0.00", description: "Freshly ground coriander.", active: true, approvalStatus: "approved" },
];

const CATALOG_VERSION_KEY = "fff_catalog_version_v12_macro";

export function getInitialCategories(): Category[] {
  if (typeof window === "undefined") return SEED_CATEGORIES;
  try {
    const curVer = localStorage.getItem("fff_catalog_version");
    if (curVer !== CATALOG_VERSION_KEY) {
      localStorage.removeItem("fff_cached_categories");
      localStorage.removeItem("fff_cached_products");
      localStorage.setItem("fff_catalog_version", CATALOG_VERSION_KEY);
      return SEED_CATEGORIES;
    }
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
    const curVer = localStorage.getItem("fff_catalog_version");
    if (curVer !== CATALOG_VERSION_KEY) {
      localStorage.removeItem("fff_cached_products");
      localStorage.removeItem("fff_cached_categories");
      localStorage.setItem("fff_catalog_version", CATALOG_VERSION_KEY);
      return SEED_PRODUCTS;
    }
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

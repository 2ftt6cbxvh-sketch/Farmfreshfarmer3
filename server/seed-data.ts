/**
 * Seed data (single source of truth) for FarmFreshFarmer.
 * Reused by script/seed.ts. Kept separate so it can be imported without
 * side effects.
 */

export const ADMIN_EMAIL = "admin@farmfreshfarmer.com";
export const ADMIN_DEFAULT_PASSWORD = "1234567"; // change after first login

export const CATEGORY_SEED: {
  name: string; slug: string; dietTag: string; description?: string; image?: string;
}[] = [
  { name: "Fruits", slug: "fruits", dietTag: "veg", image: "/images/cat-fruits.jpg" },
  { name: "Vegetables", slug: "vegetables", dietTag: "veg", image: "/images/cat-vegetables.jpg" },
  { name: "Homemade Sweets", slug: "homemade-sweets", dietTag: "veg", image: "/images/cat-sweets.jpg" },
  { name: "Namkeen", slug: "namkeen", dietTag: "veg", image: "/images/cat-namkeen.jpg" },
  { name: "Pickles (Veg)", slug: "pickles-veg", dietTag: "veg", image: "/images/cat-pickle-veg.jpg" },
  { name: "Pickles (Non-Veg)", slug: "pickles-non-veg", dietTag: "nonveg", image: "/images/cat-pickle-nonveg.jpg" },
  { name: "Millets", slug: "millets", dietTag: "veg", image: "/images/cat-millets.jpg" },
  { name: "Pulses", slug: "pulses", dietTag: "veg", image: "/images/cat-pulses.jpg" },
  { name: "Spices", slug: "spices", dietTag: "veg", image: "/images/cat-spices.jpg" },
];

export interface SeedProduct {
  name: string; categorySlug: string; price: number; unit: string;
  description: string; image: string; dietTag: string; discountPercent?: number; featured?: boolean;
}

export const PRODUCT_SEED: SeedProduct[] = [
  // Fruits
  { name: "Alphonso Mango", categorySlug: "fruits", price: 350, unit: "1 Kg", description: "Sweet, juicy Alphonso mangoes hand-picked at peak ripeness.", image: "/images/p-mango.jpg", dietTag: "veg", discountPercent: 10, featured: true },
  { name: "Sweet Bananas", categorySlug: "fruits", price: 60, unit: "1 Dozen", description: "Naturally ripened farm bananas, perfect for a healthy snack.", image: "/images/cat-fruits.jpg", dietTag: "veg" },
  { name: "Fresh Pomegranate", categorySlug: "fruits", price: 180, unit: "1 Kg", description: "Ruby-red, antioxidant-rich pomegranates.", image: "/images/cat-fruits.jpg", dietTag: "veg" },
  { name: "Seedless Grapes", categorySlug: "fruits", price: 90, unit: "500 Grams", description: "Crisp, sweet seedless grapes.", image: "/images/cat-fruits.jpg", dietTag: "veg" },

  // Vegetables
  { name: "Farm Tomatoes", categorySlug: "vegetables", price: 40, unit: "1 Kg", description: "Plump, vine-ripened tomatoes straight from the farm.", image: "/images/p-tomato.jpg", dietTag: "veg", featured: true },
  { name: "Green Spinach", categorySlug: "vegetables", price: 25, unit: "1 Bunch", description: "Fresh, leafy spinach packed with iron.", image: "/images/cat-vegetables.jpg", dietTag: "veg" },
  { name: "Lady Finger (Okra)", categorySlug: "vegetables", price: 50, unit: "500 Grams", description: "Tender okra, hand-selected for quality.", image: "/images/cat-vegetables.jpg", dietTag: "veg" },
  { name: "Fresh Carrots", categorySlug: "vegetables", price: 45, unit: "500 Grams", description: "Crunchy, sweet carrots.", image: "/images/cat-vegetables.jpg", dietTag: "veg" },

  // Homemade Sweets
  { name: "Boondi Laddu", categorySlug: "homemade-sweets", price: 320, unit: "500 Grams", description: "Traditional ghee boondi laddus made fresh in small batches.", image: "/images/p-laddu.jpg", dietTag: "veg", discountPercent: 5, featured: true },
  { name: "Kaju Katli", categorySlug: "homemade-sweets", price: 650, unit: "500 Grams", description: "Premium cashew fudge with a delicate silver finish.", image: "/images/cat-sweets.jpg", dietTag: "veg" },
  { name: "Mysore Pak", categorySlug: "homemade-sweets", price: 380, unit: "500 Grams", description: "Rich, melt-in-mouth ghee Mysore pak.", image: "/images/cat-sweets.jpg", dietTag: "veg" },

  // Namkeen
  { name: "Special Mixture", categorySlug: "namkeen", price: 160, unit: "500 Grams", description: "Crunchy South-Indian style spicy mixture.", image: "/images/p-mixture.jpg", dietTag: "veg", featured: true },
  { name: "Murukku", categorySlug: "namkeen", price: 140, unit: "500 Grams", description: "Crispy, traditional rice-flour murukku.", image: "/images/cat-namkeen.jpg", dietTag: "veg" },
  { name: "Roasted Chana", categorySlug: "namkeen", price: 120, unit: "500 Grams", description: "Lightly spiced roasted chickpeas.", image: "/images/cat-namkeen.jpg", dietTag: "veg" },

  // Pickles Veg
  { name: "Mango Pickle (Avakaya)", categorySlug: "pickles-veg", price: 220, unit: "500 Grams", description: "Andhra-style spicy mango pickle in cold-pressed oil.", image: "/images/cat-pickle-veg.jpg", dietTag: "veg", featured: true },
  { name: "Lemon Pickle", categorySlug: "pickles-veg", price: 180, unit: "500 Grams", description: "Tangy, sun-cured lemon pickle.", image: "/images/cat-pickle-veg.jpg", dietTag: "veg" },
  { name: "Gongura Pickle", categorySlug: "pickles-veg", price: 200, unit: "500 Grams", description: "Classic Andhra gongura (sorrel leaf) pickle.", image: "/images/cat-pickle-veg.jpg", dietTag: "veg" },

  // Pickles Non-Veg
  { name: "Chicken Pickle", categorySlug: "pickles-non-veg", price: 420, unit: "500 Grams", description: "Boneless chicken pickle in aromatic spices.", image: "/images/cat-pickle-nonveg.jpg", dietTag: "nonveg", featured: true },
  { name: "Mutton Pickle", categorySlug: "pickles-non-veg", price: 520, unit: "500 Grams", description: "Tender mutton pickle, slow-cooked with spices.", image: "/images/cat-pickle-nonveg.jpg", dietTag: "nonveg" },
  { name: "Prawn Pickle", categorySlug: "pickles-non-veg", price: 480, unit: "500 Grams", description: "Coastal-style prawn pickle.", image: "/images/cat-pickle-nonveg.jpg", dietTag: "nonveg" },

  // Millets
  { name: "Foxtail Millet", categorySlug: "millets", price: 110, unit: "1 Kg", description: "Wholesome, high-fibre foxtail millet.", image: "/images/cat-millets.jpg", dietTag: "veg" },
  { name: "Pearl Millet (Bajra)", categorySlug: "millets", price: 90, unit: "1 Kg", description: "Nutritious bajra, perfect for rotis.", image: "/images/cat-millets.jpg", dietTag: "veg" },
  { name: "Finger Millet (Ragi)", categorySlug: "millets", price: 100, unit: "1 Kg", description: "Calcium-rich ragi flour grade grain.", image: "/images/cat-millets.jpg", dietTag: "veg" },

  // Pulses
  { name: "Toor Dal", categorySlug: "pulses", price: 150, unit: "1 Kg", description: "Premium unpolished toor dal.", image: "/images/cat-pulses.jpg", dietTag: "veg" },
  { name: "Moong Dal", categorySlug: "pulses", price: 140, unit: "1 Kg", description: "Split green gram, easy to cook.", image: "/images/cat-pulses.jpg", dietTag: "veg" },
  { name: "Chana Dal", categorySlug: "pulses", price: 130, unit: "1 Kg", description: "Protein-rich split chickpea lentils.", image: "/images/cat-pulses.jpg", dietTag: "veg" },

  // Spices
  { name: "Red Chilli Powder", categorySlug: "spices", price: 200, unit: "500 Grams", description: "Pure Guntur red chilli powder.", image: "/images/cat-spices.jpg", dietTag: "veg", featured: true },
  { name: "Turmeric Powder", categorySlug: "spices", price: 120, unit: "250 Grams", description: "Farm-fresh, high-curcumin turmeric.", image: "/images/cat-spices.jpg", dietTag: "veg" },
  { name: "Coriander Powder", categorySlug: "spices", price: 90, unit: "250 Grams", description: "Freshly ground coriander.", image: "/images/cat-spices.jpg", dietTag: "veg" },
];

/** Default business-rule discount rules seeded into discount_rules. */
export const DISCOUNT_RULE_SEED: {
  name: string; type: string; discountPercent: number; appliesTo: string; maxUsesPerCustomer: number;
}[] = [
  { name: "First Order 10% Off", type: "first_order", discountPercent: 10, appliesTo: "all", maxUsesPerCustomer: 1 },
  { name: "Referral \u2013 New Customer 10% Off", type: "referral_new", discountPercent: 10, appliesTo: "all", maxUsesPerCustomer: 1 },
  { name: "Referral \u2013 Referrer 5% Reward", type: "referral_reward", discountPercent: 5, appliesTo: "all", maxUsesPerCustomer: 0 },
];

/** Default settings key/value pairs. */
export const SETTINGS_SEED: { key: string; value: string }[] = [
  { key: "first_order_discount_enabled", value: "true" },
  { key: "first_order_discount_percent", value: "10" },
  { key: "referral_enabled", value: "true" },
  { key: "referral_new_customer_percent", value: "10" },
  { key: "referral_reward_percent", value: "5" },
  { key: "referral_reward_max_percent_per_order", value: "30" },
  { key: "subscription_delivery_days", value: "both" }, // saturday | sunday | both
  { key: "store_name", value: "FarmFreshFarmer" },
  { key: "store_city", value: "Visakhapatnam" },
];

export const SAMPLE_COUPON = { code: "FRESH10", discountPercent: 10, minOrder: 0 };

/** A default subscription plan (the fixed weekly box). */
export const SUBSCRIPTION_PLAN_SEED = {
  name: "Weekly Fresh Box",
  slug: "weekly-fresh-box",
  description: "A curated weekly box of fresh fruits, vegetables and staples delivered every Saturday and Sunday.",
  price: 499,
  deliveryDays: "both",
  // product names resolved to ids at seed time
  items: [
    { productName: "Farm Tomatoes", qty: 1 },
    { productName: "Green Spinach", qty: 2 },
    { productName: "Fresh Carrots", qty: 1 },
    { productName: "Sweet Bananas", qty: 1 },
    { productName: "Toor Dal", qty: 1 },
  ],
};

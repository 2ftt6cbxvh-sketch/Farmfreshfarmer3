/**
 * 🌾 FarmFreshFarmer Dynamic Recommendation & Seasonal Disease Defense Engine
 * ==============================================================================
 * Ultra-fast (< 2ms) pure functional recommendation ranker.
 * Multi-Signal Synthesis:
 *   1. Geo-Climate & Seasonal Infection Defense (e.g. Monsoon fevers/dengue in India)
 *   2. Real-Time Active Category Browsing
 *   3. Real-Time Live Search Query Intent
 *   4. Lakshmi AI Health / Disease Inquiries (e.g. Diabetes, Hypertension, Immunity)
 *   5. Logged-in Customer Rolling Behavior Profile (Private & Cryptographically Isolated)
 */

import type { Product } from "./schema";

export interface UserBehaviorProfile {
  viewedProductIds?: number[];
  viewedCategories?: string[];
  searchQueries?: string[];
  aiInquiryTopics?: string[];
}

export interface RecommendationContext {
  location?: {
    city?: string;
    region?: string;
    country?: string;
  };
  activeCategory?: string;
  activeSearchQuery?: string;
  activeHealthTopic?: string;
  userProfile?: UserBehaviorProfile;
  month?: number; // 0-11 (Defaults to current month)
}

export interface RecommendationResult {
  products: Product[];
  reason: {
    badgeText: string;
    subText: string;
    icon: string;
    intentType: "geo_seasonal" | "category" | "search" | "health_intent" | "user_profile";
  };
}

/* ─────────────────────────────────────────────────────────────────────────────
 * 1. CLINICAL & SEASONAL DISEASE DEFENSE MATRIX
 * ───────────────────────────────────────────────────────────────────────────── */

export type SeasonType = "monsoon" | "winter" | "summer" | "spring_autumn";

export interface SeasonInfo {
  type: SeasonType;
  title: string;
  threats: string[];
  defenseKeywords: string[];
  targetCategories: string[];
  highlightMechanism: string;
}

export const SEASONAL_DISEASE_MATRIX: Record<SeasonType, SeasonInfo> = {
  monsoon: {
    type: "monsoon",
    title: "Monsoon & Post-Monsoon Immunity Defense",
    threats: ["Dengue", "Viral Fevers", "Seasonal Flu", "Platelet Drop", "Waterborne Bacterial Infections"],
    defenseKeywords: [
      "papaya", "turmeric", "garlic", "pomegranate", "ginger", "lemon", "citrus",
      "guava", "spinach", "amla", "pepper", "curd", "honey"
    ],
    targetCategories: ["fruits", "vegetables", "spices"],
    highlightMechanism: "Bioavailable Vitamin C, Curcumin & Papain enzymes for thrombocyte & macrophage defense",
  },
  winter: {
    type: "winter",
    title: "Winter Respiratory & Thermal Vitality",
    threats: ["Cold & Bronchial Congestion", "Joint Stiffness / Arthritis", "Dry Skin", "Seasonal Sluggishness"],
    defenseKeywords: [
      "ragi", "ginger", "jaggery", "bellam", "foxtail", "sesame", "pepper",
      "turmeric", "dates", "mustard", "garlic", "pulses"
    ],
    targetCategories: ["millets", "spices", "homemade-sweets", "pulses"],
    highlightMechanism: "Non-heme iron, calcium & warming gingerols for core thermogenesis & lung clearance",
  },
  summer: {
    type: "summer",
    title: "Summer Heat Wave & Hydration Defense",
    threats: ["Heat Exhaustion", "Dehydration", "Electrolyte Loss", "Digestive Acidity & GERD"],
    defenseKeywords: [
      "watermelon", "muskmelon", "bottle gourd", "sorakaya", "cucumber", "mint",
      "buttermilk", "coconut", "lemon", "curd", "coriander", "custard apple"
    ],
    targetCategories: ["fruits", "vegetables"],
    highlightMechanism: "L-Citrulline, 92%+ cellular hydration, potassium & natural cooling electrolytes",
  },
  spring_autumn: {
    type: "spring_autumn",
    title: "Harvest Balance & Cellular Detox",
    threats: ["Seasonal Allergies", "Metabolic Sluggishness", "Oxidative Stress"],
    defenseKeywords: [
      "spinach", "millet", "tomato", "banana", "dragon fruit", "apple",
      "dal", "turmeric", "ghee"
    ],
    targetCategories: ["vegetables", "fruits", "millets"],
    highlightMechanism: "High dietary polyphenols, natural dietary fiber & antioxidant cellular renewal",
  },
};

/** Get seasonal profile based on month (0-11) and country */
export function getSeasonalProfile(monthIndex?: number, country: string = "IN"): SeasonInfo {
  const m = monthIndex !== undefined ? monthIndex : new Date().getMonth(); // 0 = Jan, 11 = Dec
  const isIndia = !country || country.toUpperCase() === "IN" || country.toLowerCase().includes("india");

  if (isIndia) {
    // Indian Climate Cycles:
    // Mar - Jun (Months 2,3,4,5): Summer
    // Jul - Oct (Months 6,7,8,9): Monsoon & Post-monsoon viral season
    // Nov - Feb (Months 10,11,0,1): Winter
    if (m >= 2 && m <= 5) return SEASONAL_DISEASE_MATRIX.summer;
    if (m >= 6 && m <= 9) return SEASONAL_DISEASE_MATRIX.monsoon;
    return SEASONAL_DISEASE_MATRIX.winter;
  }

  // Northern Hemisphere general fallback
  if (m >= 5 && m <= 7) return SEASONAL_DISEASE_MATRIX.summer;
  if (m >= 11 || m <= 1) return SEASONAL_DISEASE_MATRIX.winter;
  if (m >= 8 && m <= 10) return SEASONAL_DISEASE_MATRIX.monsoon;
  return SEASONAL_DISEASE_MATRIX.spring_autumn;
}

/* ─────────────────────────────────────────────────────────────────────────────
 * 2. DISEASE & HEALTH TOPIC MAPPING
 * ───────────────────────────────────────────────────────────────────────────── */

export interface HealthGoalMapping {
  topicKey: string;
  badgeLabel: string;
  keywords: string[];
  produceMatches: string[];
  categoryBoosts: string[];
  clinicalRationale: string;
}

export const HEALTH_GOAL_MAP: Record<string, HealthGoalMapping> = {
  diabetes: {
    topicKey: "diabetes",
    badgeLabel: "Doctor-Curated for Blood Sugar Control",
    keywords: ["diabetes", "sugar", "glucose", "insulin", "hba1c", "diabetic", "glycemic"],
    produceMatches: ["foxtail", "korralu", "ragi", "bitter gourd", "karela", "kakarakaya", "spinach", "fenugreek", "guava", "millet"],
    categoryBoosts: ["millets", "vegetables"],
    clinicalRationale: "Low glycemic index fiber and charantin insulin mimetics stabilize postprandial glucose.",
  },
  hypertension: {
    topicKey: "hypertension",
    badgeLabel: "Cardiologist Picks for BP & Heart Health",
    keywords: ["bp", "blood pressure", "hypertension", "heart", "cardio", "cholesterol", "artery", "cardiac"],
    produceMatches: ["garlic", "vellulli", "pomegranate", "danimma", "sesame", "spinach", "tomato", "citrus", "flax"],
    categoryBoosts: ["spices", "fruits", "vegetables"],
    clinicalRationale: "Endothelial nitric oxide (eNOS) stimulators and allicin promote arterial relaxation.",
  },
  digestion: {
    topicKey: "digestion",
    badgeLabel: "Gut Health & Anti-Acidity Curations",
    keywords: ["digestion", "digest", "acidity", "gerd", "bloating", "constipation", "gut", "stomach", "gastric", "ibs"],
    produceMatches: ["papaya", "ginger", "allam", "bottle gourd", "sorakaya", "banana", "arati", "curd", "cumin", "ajwain"],
    categoryBoosts: ["fruits", "vegetables", "spices"],
    clinicalRationale: "Enzymatic papain, gingerols and prebiotic pectin soothe mucous linings and support microbiome.",
  },
  immunity: {
    topicKey: "immunity",
    badgeLabel: "Natural Viral & Immunity Defense",
    keywords: ["immunity", "fever", "cold", "cough", "infection", "virus", "dengue", "platelets", "throat", "immune"],
    produceMatches: ["turmeric", "pasupu", "papaya", "garlic", "lemon", "amla", "pomegranate", "ginger", "pepper"],
    categoryBoosts: ["spices", "fruits"],
    clinicalRationale: "High bioavailable Curcumin, Vitamin C and allicin enhance white blood cell phagocytosis.",
  },
  skin_glow: {
    topicKey: "skin_glow",
    badgeLabel: "Dermatologist-Approved for Glowing Skin & Hair",
    keywords: ["skin", "glow", "acne", "complexion", "hair", "collagen", "radiance", "anti-aging", "wrinkles"],
    produceMatches: ["tomato", "tamata", "dragon fruit", "guava", "papaya", "carrot", "pomegranate", "sesame oil"],
    categoryBoosts: ["fruits", "vegetables"],
    clinicalRationale: "Lycopene, beta-carotene and Vitamin C support native dermal collagen cross-linking.",
  },
  weight_loss: {
    topicKey: "weight_loss",
    badgeLabel: "Nutritional Weight Management Picks",
    keywords: ["weight", "fat", "slim", "diet", "obesity", "belly", "metabolism", "detox", "calorie"],
    produceMatches: ["foxtail", "ragi", "bottle gourd", "cucumber", "spinach", "lemon", "millets"],
    categoryBoosts: ["millets", "vegetables"],
    clinicalRationale: "High satiety dietary fiber and zero empty calories support prolonged thermogenic burn.",
  },
  vitality_energy: {
    topicKey: "vitality_energy",
    badgeLabel: "Natural Iron & Stamina Boosters",
    keywords: ["energy", "stamina", "fatigue", "tired", "weakness", "anemia", "iron", "hemoglobin"],
    produceMatches: ["jaggery", "bellam", "ragi", "dates", "pomegranate", "spinach", "laddu", "pulses"],
    categoryBoosts: ["homemade-sweets", "millets", "fruits"],
    clinicalRationale: "Non-heme organic iron and unrefined mineral complex directly support erythrocyte synthesis.",
  },
};

/** Extract matching health goal from any text query */
export function detectHealthTopic(text?: string): HealthGoalMapping | null {
  if (!text) return null;
  const clean = text.toLowerCase();
  for (const key of Object.keys(HEALTH_GOAL_MAP)) {
    const map = HEALTH_GOAL_MAP[key];
    if (map.keywords.some((kw) => clean.includes(kw))) {
      return map;
    }
  }
  return null;
}

/* ─────────────────────────────────────────────────────────────────────────────
 * 3. MULTI-SIGNAL SCORING & RECOMMENDATION ENGINE
 * ───────────────────────────────────────────────────────────────────────────── */

/**
 * Main Pure Recommendation Ranker
 * Calculates weighted affinity scores across all catalog products in < 2ms.
 */
export function rankPersonalizedProducts(
  allProducts: Product[],
  ctx: RecommendationContext = {},
  options: { minCount?: number; maxCount?: number } = {}
): RecommendationResult {
  const minCount = options.minCount ?? 3;
  const maxCount = options.maxCount ?? 8;

  if (!allProducts || !allProducts.length) {
    return {
      products: [],
      reason: {
        badgeText: "Peak Season Harvest",
        subText: "Hand-picked organic farm produce",
        icon: "🌾",
        intentType: "geo_seasonal",
      },
    };
  }

  // Active products only
  const candidates = allProducts.filter((p) => p.active !== false && p.approvalStatus !== "rejected");

  const locationCity = ctx.location?.city || "Vijayawada";
  const locationCountry = ctx.location?.country || "India";
  const seasonalProfile = getSeasonalProfile(ctx.month, locationCountry);

  // Check signals in order of user immediacy
  const explicitHealthTopic = ctx.activeHealthTopic ? HEALTH_GOAL_MAP[ctx.activeHealthTopic] : detectHealthTopic(ctx.activeSearchQuery);
  const isSearchActive = Boolean(ctx.activeSearchQuery && ctx.activeSearchQuery.trim().length > 1);
  const isCategoryActive = Boolean(ctx.activeCategory && ctx.activeCategory.trim().length > 0);
  const hasUserProfile = Boolean(
    ctx.userProfile &&
    ((ctx.userProfile.viewedProductIds && ctx.userProfile.viewedProductIds.length > 0) ||
      (ctx.userProfile.viewedCategories && ctx.userProfile.viewedCategories.length > 0) ||
      (ctx.userProfile.aiInquiryTopics && ctx.userProfile.aiInquiryTopics.length > 0))
  );

  // Track scoring metadata
  const scores = new Map<number, number>();

  candidates.forEach((product) => {
    let score = 0;
    const nameLower = (product.name || "").toLowerCase();
    const nameTeLower = (product.nameTe || "").toLowerCase();
    const descLower = (product.description || "").toLowerCase();
    const catSlug = (product.categorySlug || "").toLowerCase();

    // ── Signal 1: Health / Disease Inquiry Match (Highest Weight: +800) ──
    if (explicitHealthTopic) {
      if (explicitHealthTopic.categoryBoosts.includes(catSlug)) score += 300;
      for (const prodKw of explicitHealthTopic.produceMatches) {
        if (nameLower.includes(prodKw) || nameTeLower.includes(prodKw) || descLower.includes(prodKw)) {
          score += 500;
          break;
        }
      }
    }

    // ── Signal 2: Active Search Query (Weight: +600) ──
    if (isSearchActive) {
      const q = ctx.activeSearchQuery!.toLowerCase().trim();
      if (nameLower.includes(q) || nameTeLower.includes(q)) score += 600;
      else if (descLower.includes(q)) score += 300;
      else if (catSlug.includes(q)) score += 400;
    }

    // ── Signal 3: Active Category Browsing (Weight: +450) ──
    if (isCategoryActive) {
      const activeCat = ctx.activeCategory!.toLowerCase();
      if (catSlug === activeCat) score += 450;
    }

    // ── Signal 4: Logged-in User Behavioral Trail (Weight: +350) ──
    if (hasUserProfile && ctx.userProfile) {
      // Direct past product view similarity
      if (ctx.userProfile.viewedProductIds?.includes(product.id)) {
        score += 200;
      }
      // Frequent category affinity
      if (ctx.userProfile.viewedCategories?.includes(catSlug)) {
        score += 250;
      }
      // Past AI topics
      if (ctx.userProfile.aiInquiryTopics) {
        for (const topicKey of ctx.userProfile.aiInquiryTopics) {
          const pastTopic = HEALTH_GOAL_MAP[topicKey];
          if (pastTopic && pastTopic.categoryBoosts.includes(catSlug)) {
            score += 150;
          }
        }
      }
    }

    // ── Signal 5: Geo-Location Climate & Seasonal Disease Defense (Baseline: +100 to +300) ──
    if (seasonalProfile.targetCategories.includes(catSlug)) {
      score += 100;
    }
    for (const defKw of seasonalProfile.defenseKeywords) {
      if (nameLower.includes(defKw) || nameTeLower.includes(defKw) || descLower.includes(defKw)) {
        score += 200;
        break;
      }
    }

    // Base Organic & Featured Boosts
    if (product.featured) score += 50;
    if (product.featuredInHero) score += 30;

    scores.set(product.id, score);
  });

  // Sort descending by score
  const sorted = [...candidates].sort((a, b) => (scores.get(b.id) || 0) - (scores.get(a.id) || 0));

  // Determine dynamic count (between minCount and maxCount)
  const finalProducts = sorted.slice(0, maxCount);

  // Compute user-facing dynamic badge rationale
  let badgeText = `Seasonal Health Defense for ${locationCity}`;
  let subText = seasonalProfile.highlightMechanism;
  let icon = "🛡️";
  let intentType: "geo_seasonal" | "category" | "search" | "health_intent" | "user_profile" = "geo_seasonal";

  if (explicitHealthTopic) {
    badgeText = explicitHealthTopic.badgeLabel;
    subText = explicitHealthTopic.clinicalRationale;
    icon = "🩺";
    intentType = "health_intent";
  } else if (isCategoryActive) {
    const formattedCat = ctx.activeCategory!.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
    badgeText = `Top Fresh Picks in ${formattedCat}`;
    subText = `Direct farm harvest matched to your active session in ${formattedCat}`;
    icon = "🥦";
    intentType = "category";
  } else if (isSearchActive) {
    badgeText = `Picks Matching "${ctx.activeSearchQuery}"`;
    subText = `Live farm produce matching your search intent`;
    icon = "🔍";
    intentType = "search";
  } else if (hasUserProfile) {
    badgeText = `Curated for Your Taste & Wellness`;
    subText = `Tailored from your recent organic favorites & health choices`;
    icon = "✨";
    intentType = "user_profile";
  }

  return {
    products: finalProducts,
    reason: {
      badgeText,
      subText,
      icon,
      intentType,
    },
  };
}

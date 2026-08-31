/**
 * Universal FarmFresh Farmer Search Matcher Engine
 * Powers search suggestions, autocomplete, and product search for ALL current and future products.
 * Supports:
 *   - English and Telugu Script (e.g. "వెల్లుల్లి", "టమోటా", "ఆవకాయ")
 *   - Romanized Telugu / Hindi Synonyms (e.g. "vellulli", "tamata", "lahsun", "allam", "avakaya")
 *   - Category matching (e.g. "pickles", "sweets", "millets", "veg")
 *   - Multi-word search (e.g. "organic garlic 1kg", "fresh tomatoes")
 *   - Typo tolerance & prefix matching (e.g. "garilc", "tomatos", "pomegrante")
 */

import { resolveTeluguProductName } from "./telugu-produce-namer";

export interface SearchableProduct {
  id: number;
  name: string;
  nameTe?: string | null;
  categorySlug?: string | null;
  description?: string | null;
  price?: string | number | null;
  unit?: string | null;
  image?: string | null;
  stock?: number;
  active?: boolean | null;
  approvalStatus?: string | null;
  dietTag?: string | null;
  quantityTiers?: any;
}

// Common phonetic & bilingual synonym map (covers produce, sweets, millets, spices, groceries)
export const PRODUCE_SYNONYMS: Record<string, string[]> = {
  garlic: ["vellulli", "vellullipaya", "lahsun", "lehsun", "వెల్లుల్లి", "garlics"],
  tomato: ["tamata", "tamatalu", "tamato", "tomatoes", "టమోటా", "తమట"],
  mango: ["mamidi", "mamidikaya", "aam", "మామిడి", "alphonso", "banginapalli"],
  banana: ["arati", "aratipandu", "kela", "చక్కరకేళి", "అరటి"],
  pomegranate: ["danimma", "anaar", "దానిమ్మ"],
  grapes: ["draksha", "drakshalu", "angoor", "ద్రాక్ష"],
  spinach: ["palak", "palakura", "పాలకూర"],
  okra: ["bhendi", "bendakaya", "ladyfinger", "lady finger", "బెండకాయ"],
  carrot: ["gajjara", "carrots", "క్యారెట్"],
  potato: ["bangaladumpa", "aaloo", "aloo", "బంగాళాదుంప"],
  onion: ["ullipaya", "ullipayalu", "pyaz", "ఉల్లిపాయ"],
  brinjal: ["vankaya", "baingan", "eggplant", "వంకాయ"],
  ginger: ["allam", "adrak", "అల్లం"],
  chilli: ["mirchi", "pachimirchi", "mirapakaya", "మిర్చి"],
  cucumber: ["keera", "dosakaya", "కీర"],
  gourd: ["sorakaya", "anapakaya", "beerakaya", "potlakaya", "kakarakaya"],
  bittergourd: ["kakarakaya", "karela", "కాకరకాయ"],
  bottlegourd: ["sorakaya", "anapakaya", "lauki", "సొరకాయ"],
  ridgegourd: ["beerakaya", "turai", "బీరకాయ"],
  laddu: ["ladoo", "boondi", "ghee laddu", "లడ్డు", "లడ్డూ"],
  mysore: ["mysore pak", "mysorepak", "మైసూర్ పాక్"],
  katli: ["kaju katli", "cashew sweet", "కాజు కత్లీ"],
  pickle: ["avakaya", "pachadi", "ooragaya", "aachar", "achar", "ఊరగాయ", "పచ్చడి", "ఆవకాయ"],
  gongura: ["gongura pachadi", "గోంగూర"],
  lemon: ["nimmakaya", "nimbu", "నిమ్మకాయ"],
  chicken: ["kodi", "chicken pickle", "చికెన్"],
  mutton: ["mutton pickle", "గోరింటాకు", "మటన్"],
  prawn: ["royyalu", "prawn pickle", "రొయ్యలు"],
  ragi: ["finger millet", "taidalu", "రాగులు"],
  foxtail: ["korralu", "కొర్రలు"],
  pearl: ["sajjalu", "bajra", "సజ్జలు"],
  millet: ["millets", "siridhanyalu", "మిల్లెట్", "సిరిధాన్యాలు"],
  toor: ["kandi pappu", "arhar", "కంది పప్పు"],
  moong: ["pesara pappu", "moong dal", "పెసర పప్పు"],
  chana: ["senagalu", "chana dal", "శనగలు"],
  turmeric: ["pasupu", "haldi", "పసుపు"],
  chilli_powder: ["karam", "mirchi podi", "కారం పొడి"],
  coriander: ["dhaniyalu", "kotthimeera", "ధనియాల పొడి"],
};

/**
 * Normalizes a text string for fuzzy search
 */
export function normalizeSearchString(str: string): string {
  if (!str) return "";
  return str
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\w\s\u0C00-\u0C7F]/gi, " ") // preserves English and Telugu Unicode
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Levenshtein Distance for typo tolerance (e.g. "garilc" -> "garlic")
 */
function levenshteinDistance(a: string, b: string): number {
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;

  const matrix: number[][] = [];
  for (let i = 0; i <= b.length; i++) matrix[i] = [i];
  for (let j = 0; j <= a.length; j++) matrix[0][j] = j;

  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1, // substitution
          matrix[i][j - 1] + 1,     // insertion
          matrix[i - 1][j] + 1      // deletion
        );
      }
    }
  }
  return matrix[b.length][a.length];
}

/**
 * Checks if a search token matches a target word either by substring, prefix, or typo tolerance
 */
function isTokenMatch(token: string, targetWords: string[]): boolean {
  if (!token || targetWords.length === 0) return false;

  for (const target of targetWords) {
    if (!target) continue;

    // Exact or prefix or substring match
    if (target.includes(token) || token.includes(target)) {
      return true;
    }

    // Typo tolerance: only for words with length >= 4
    if (token.length >= 4 && target.length >= 4) {
      const maxDistance = token.length > 6 ? 2 : 1;
      if (levenshteinDistance(token, target) <= maxDistance) {
        return true;
      }
    }
  }

  return false;
}

/**
 * Computes a relevance score (0 = no match, 100+ = strongest match) for a product against a search query
 */
export function scoreProductSearch(product: SearchableProduct, query: string): number {
  if (!query || !query.trim()) return 0;
  if (product.active === false || product.approvalStatus === "pending") return 0;

  const cleanQuery = normalizeSearchString(query);
  if (!cleanQuery) return 0;

  const queryTokens = cleanQuery.split(" ").filter((t) => t.length > 0);
  if (queryTokens.length === 0) return 0;

  // Build searchable text vectors for the product
  const pName = normalizeSearchString(product.name || "");
  const pNameTe = normalizeSearchString(product.nameTe || resolveTeluguProductName(product.name || "", product.categorySlug || ""));
  const pCat = normalizeSearchString(product.categorySlug || "");
  const pDesc = normalizeSearchString(product.description || "");
  const pDiet = normalizeSearchString(product.dietTag || "");
  const pUnit = normalizeSearchString(product.unit || "");

  // Collect all searchable target words
  const targetWords = [
    ...pName.split(" "),
    ...pNameTe.split(" "),
    ...pCat.split(" "),
    ...pDesc.split(" "),
    ...pDiet.split(" "),
    ...pUnit.split(" "),
  ].filter(Boolean);

  // Collect synonyms dynamically from synonym map
  const synonyms: string[] = [];
  for (const [key, synList] of Object.entries(PRODUCE_SYNONYMS)) {
    if (pName.includes(key) || pCat.includes(key) || pDesc.includes(key) || pNameTe.includes(key)) {
      synonyms.push(...synList.map(normalizeSearchString));
    }
  }

  const allSearchTargets = [...targetWords, ...synonyms];

  // 1. Direct whole-query match in title (Highest Score: 150)
  if (pName.includes(cleanQuery) || pNameTe.includes(cleanQuery)) {
    return 150 - (pName.indexOf(cleanQuery) * 2);
  }

  // 2. Token-by-token matching
  let matchedTokensCount = 0;
  let score = 0;

  for (const token of queryTokens) {
    if (isTokenMatch(token, allSearchTargets)) {
      matchedTokensCount++;
      // Give higher weight if token matches name or Telugu name directly
      if (pName.includes(token) || pNameTe.includes(token)) {
        score += 30;
      } else if (pCat.includes(token)) {
        score += 20;
      } else {
        score += 10;
      }
    }
  }

  // All tokens in query matched!
  if (matchedTokensCount === queryTokens.length) {
    return 100 + score;
  }

  // Partial match: at least 1 token matched in multi-token query
  if (matchedTokensCount > 0 && queryTokens.length > 1) {
    return Math.floor((matchedTokensCount / queryTokens.length) * 80);
  }

  return 0;
}

/**
 * Filters and sorts products for live search suggestions
 */
export function filterProductsUniversal<T extends SearchableProduct>(
  products: T[],
  query: string,
  limit: number = 6
): T[] {
  if (!query || !query.trim() || !Array.isArray(products)) return [];

  const scored: Array<{ product: T; score: number }> = [];

  for (const product of products) {
    const score = scoreProductSearch(product, query);
    if (score > 0) {
      scored.push({ product, score });
    }
  }

  // Sort descending by score, then by stock availability
  scored.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    return (b.product.stock || 0) - (a.product.stock || 0);
  });

  return scored.slice(0, limit).map((s) => s.product);
}

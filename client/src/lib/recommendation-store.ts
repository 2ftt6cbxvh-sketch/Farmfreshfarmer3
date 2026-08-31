/**
 * 🌾 Client-Side Reactive Recommendation Store & Real-Time Signal Broadcaster
 * ==============================================================================
 * Dispatches and listens to live in-memory events with 0ms lag:
 *   - Search inputs (Navbar & SearchPage)
 *   - Category navigation
 *   - Lakshmi AI disease & nutrition questions
 *   - Product detail views
 *
 * Automatically triggers instantaneous, zero-refresh UI updates across
 * the homepage "Fresh Picks for You" grid and Lakshmi AI suggested produce cards.
 */

import { useState, useEffect, useMemo, useCallback } from "react";
import {
  rankPersonalizedProducts,
  detectHealthTopic,
  type RecommendationContext,
  type RecommendationResult,
  type UserBehaviorProfile,
} from "@shared/recommendation-engine";
import type { Product } from "@/lib/types";
import { apiRequest } from "./queryClient";

// Browser storage keys
const SESSION_TRAIL_KEY = "fff_session_trail";
const LOCAL_PROFILE_KEY = "fff_behavior_profile";

interface InternalState {
  activeCategory?: string;
  activeSearchQuery?: string;
  activeHealthTopic?: string;
  location: {
    city: string;
    region: string;
    country: string;
    isGps: boolean;
  };
  userProfile: UserBehaviorProfile;
}

// Global In-Memory Reactive State
let globalState: InternalState = {
  activeCategory: undefined,
  activeSearchQuery: undefined,
  activeHealthTopic: undefined,
  location: {
    city: "",
    region: "",
    country: "India",
    isGps: false,
  },
  userProfile: {
    viewedProductIds: [],
    viewedCategories: [],
    searchQueries: [],
    aiInquiryTopics: [],
  },
};

// Global Event Emitter for Zero-Refresh React Subscriptions
const recommendationEmitter = new EventTarget();
const RECOMMENDATION_EVENT = "farmfresh:recommendation_update";

function emitUpdate() {
  recommendationEmitter.dispatchEvent(new CustomEvent(RECOMMENDATION_EVENT));
}

/** Initialize state from local cache & detect Edge Geo-location */
if (typeof window !== "undefined") {
  try {
    const sessionSaved = sessionStorage.getItem(SESSION_TRAIL_KEY);
    if (sessionSaved) {
      const parsed = JSON.parse(sessionSaved);
      globalState.activeCategory = parsed.activeCategory;
      globalState.activeSearchQuery = parsed.activeSearchQuery;
      globalState.activeHealthTopic = parsed.activeHealthTopic;
    }

    const profileSaved = localStorage.getItem(LOCAL_PROFILE_KEY);
    if (profileSaved) {
      globalState.userProfile = JSON.parse(profileSaved);
    }

    // 1. Check user-confirmed delivery resolution from localStorage
    const savedDelivery = localStorage.getItem("deliveryResolution");
    if (savedDelivery) {
      const del = JSON.parse(savedDelivery);
      const delCity = del.city || del.district || del.state || "";
      if (delCity) {
        globalState.location.city = delCity;
        globalState.location.isGps = true;
      }
    }
  } catch {}

  // 2. Listen for live delivery resolution updates
  window.addEventListener("deliveryResolutionUpdated", (e: any) => {
    const del = e?.detail;
    if (del) {
      const delCity = del.city || del.district || del.state || "";
      if (delCity) {
        globalState.location.city = delCity;
        globalState.location.isGps = true;
        emitUpdate();
      }
    }
  });

  // 3. Silent browser geolocation if already granted by user
  if (navigator?.permissions) {
    navigator.permissions.query({ name: "geolocation" as PermissionName }).then((result) => {
      if (result.state === "granted" && navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
          () => {
            globalState.location.isGps = true;
            emitUpdate();
          },
          () => {}
        );
      }
    }).catch(() => {});
  }
}

/* ─────────────────────────────────────────────────────────────────────────────
 * SECURE BACKEND BEHAVIOR SYNC (Logged-In User)
 * ───────────────────────────────────────────────────────────────────────────── */

async function syncBehaviorToBackend(update: Partial<UserBehaviorProfile>) {
  try {
    const token = localStorage.getItem("accessToken") || localStorage.getItem("token");
    if (!token) return; // Guest user — stays local in browser RAM

    await apiRequest("POST", "/api/user/behavior/track", update).catch(() => {});
  } catch {}
}

/* ─────────────────────────────────────────────────────────────────────────────
 * PUBLIC DISPATCHERS (Call anywhere in app)
 * ───────────────────────────────────────────────────────────────────────────── */

/** Record a product view */
export function recordProductView(productId: number, categorySlug?: string) {
  if (!productId) return;

  const viewed = globalState.userProfile.viewedProductIds || [];
  const updatedViewed = [productId, ...viewed.filter((id) => id !== productId)].slice(0, 50);

  globalState.userProfile.viewedProductIds = updatedViewed;
  if (categorySlug) {
    globalState.activeCategory = categorySlug;
    const cats = globalState.userProfile.viewedCategories || [];
    globalState.userProfile.viewedCategories = [categorySlug, ...cats.filter((c) => c !== categorySlug)].slice(0, 20);
  }

  try {
    localStorage.setItem(LOCAL_PROFILE_KEY, JSON.stringify(globalState.userProfile));
    sessionStorage.setItem(
      SESSION_TRAIL_KEY,
      JSON.stringify({
        activeCategory: globalState.activeCategory,
        activeSearchQuery: globalState.activeSearchQuery,
        activeHealthTopic: globalState.activeHealthTopic,
      })
    );
  } catch {}

  emitUpdate();
  syncBehaviorToBackend({ viewedProductIds: updatedViewed, viewedCategories: globalState.userProfile.viewedCategories });
}

/** Record category visit */
export function recordCategoryVisit(categorySlug: string) {
  if (!categorySlug) return;
  globalState.activeCategory = categorySlug;

  const cats = globalState.userProfile.viewedCategories || [];
  const updatedCats = [categorySlug, ...cats.filter((c) => c !== categorySlug)].slice(0, 20);
  globalState.userProfile.viewedCategories = updatedCats;

  try {
    sessionStorage.setItem(
      SESSION_TRAIL_KEY,
      JSON.stringify({
        activeCategory: globalState.activeCategory,
        activeSearchQuery: globalState.activeSearchQuery,
        activeHealthTopic: globalState.activeHealthTopic,
      })
    );
    localStorage.setItem(LOCAL_PROFILE_KEY, JSON.stringify(globalState.userProfile));
  } catch {}

  emitUpdate();
  syncBehaviorToBackend({ viewedCategories: updatedCats });
}

/** Record search query typed in navbar or search page */
export function recordSearchQuery(query: string) {
  const clean = (query || "").trim();
  globalState.activeSearchQuery = clean || undefined;
  // Clear stale category so the live search takes immediate precedence
  globalState.activeCategory = undefined;

  // Check if search contains a known health intent (e.g. 'sinus', 'sugar', 'blood pressure')
  const detectedHealth = detectHealthTopic(clean);
  if (detectedHealth) {
    globalState.activeHealthTopic = detectedHealth.topicKey;
  } else {
    globalState.activeHealthTopic = undefined;
  }

  if (clean.length > 1) {
    const searches = globalState.userProfile.searchQueries || [];
    const updatedSearches = [clean, ...searches.filter((s) => s.toLowerCase() !== clean.toLowerCase())].slice(0, 20);
    globalState.userProfile.searchQueries = updatedSearches;

    try {
      localStorage.setItem(LOCAL_PROFILE_KEY, JSON.stringify(globalState.userProfile));
      sessionStorage.setItem(
        SESSION_TRAIL_KEY,
        JSON.stringify({
          activeCategory: undefined,
          activeSearchQuery: globalState.activeSearchQuery,
          activeHealthTopic: globalState.activeHealthTopic,
        })
      );
    } catch {}
    syncBehaviorToBackend({ searchQueries: updatedSearches });
  }

  emitUpdate();
}

/** Record Lakshmi AI health / produce inquiry */
export function recordHealthInquiry(topicKey: string, queryText?: string) {
  if (!topicKey && !queryText) return;

  const detected = topicKey ? topicKey : detectHealthTopic(queryText)?.topicKey;
  if (detected) {
    globalState.activeHealthTopic = detected;
    // Clear stale category and search so the health query takes immediate top priority on the homepage!
    globalState.activeCategory = undefined;
    globalState.activeSearchQuery = queryText || undefined;

    const topics = globalState.userProfile.aiInquiryTopics || [];
    const updatedTopics = [detected, ...topics.filter((t) => t !== detected)].slice(0, 20);
    globalState.userProfile.aiInquiryTopics = updatedTopics;

    try {
      localStorage.setItem(LOCAL_PROFILE_KEY, JSON.stringify(globalState.userProfile));
      sessionStorage.setItem(
        SESSION_TRAIL_KEY,
        JSON.stringify({
          activeCategory: undefined,
          activeSearchQuery: globalState.activeSearchQuery,
          activeHealthTopic: globalState.activeHealthTopic,
        })
      );
    } catch {}

    emitUpdate();
    syncBehaviorToBackend({ aiInquiryTopics: updatedTopics });
  } else if (queryText) {
    // If it's a general produce inquiry in chat (e.g. "tomatoes", "sweets")
    globalState.activeSearchQuery = queryText;
    globalState.activeCategory = undefined;
    emitUpdate();
  }
}

/** Reset active filters (e.g. user clears search) */
export function clearActiveRecommendationFilters() {
  globalState.activeSearchQuery = undefined;
  globalState.activeHealthTopic = undefined;
  emitUpdate();
}

/* ─────────────────────────────────────────────────────────────────────────────
 * REACT HOOK: usePersonalizedRecommendations
 * ───────────────────────────────────────────────────────────────────────────── */

export function usePersonalizedRecommendations(
  allProducts: Product[],
  options: { minCount?: number; maxCount?: number } = {}
): RecommendationResult {
  const [, setTick] = useState(0);

  useEffect(() => {
    const handleUpdate = () => setTick((t) => t + 1);
    recommendationEmitter.addEventListener(RECOMMENDATION_EVENT, handleUpdate);
    return () => recommendationEmitter.removeEventListener(RECOMMENDATION_EVENT, handleUpdate);
  }, []);

  const result = useMemo(() => {
    const ctx: RecommendationContext = {
      location: globalState.location,
      activeCategory: globalState.activeCategory,
      activeSearchQuery: globalState.activeSearchQuery,
      activeHealthTopic: globalState.activeHealthTopic,
      userProfile: globalState.userProfile,
      month: new Date().getMonth(),
    };
    return rankPersonalizedProducts(allProducts, ctx, options);
  }, [allProducts, options.minCount, options.maxCount, globalState.activeCategory, globalState.activeSearchQuery, globalState.activeHealthTopic, globalState.userProfile]);

  return result;
}

/**
 * Centralized Google Gemini Multi-Agent API Key Cluster
 * ======================================================
 * Resolves dedicated, isolated API keys dynamically from environment or database:
 *  1. Narayana AI (Admin Operations, Sourcing Radar, Harvest Briefings)
 *  2. Lakshmi AI (Customer Assistant, Nutrition & Produce Intelligence)
 *  3. Netra AI (Multimodal Vision: Skin/Wound Doctor, Crop/Plant Doctor, Macro Nutrition, Spoilage & Return Inspection)
 *  4. FarmFresh Master AI (Autonomous Schedulers, Demand Spikes & Universal Fallback)
 */

import { storage } from "../storage";

let _cachedSettings: Record<string, string> | null = null;
let _lastCacheTime = 0;
const CACHE_TTL_MS = 60 * 1000; // 1 minute cache

async function getCachedSettings(): Promise<Record<string, string>> {
  const now = Date.now();
  if (_cachedSettings && now - _lastCacheTime < CACHE_TTL_MS) {
    return _cachedSettings;
  }
  try {
    const all = await storage.settings.all();
    _cachedSettings = (all as any) || {};
    _lastCacheTime = now;
    return _cachedSettings;
  } catch {
    return _cachedSettings || {};
  }
}

/** Fallback Master Key */
export async function getFarmFreshMasterApiKey(): Promise<string> {
  const s = await getCachedSettings();
  return (
    process.env.GEMINI_API_KEY_FARMFRESH ||
    s.gemini_api_key_farmfresh ||
    process.env.GEMINI_API_KEY ||
    s.gemini_api_key ||
    process.env.GOOGLE_API_KEY ||
    ""
  ).trim();
}

/** 1. Narayana AI Dedicated Key */
export async function getNarayanaApiKey(): Promise<string> {
  const s = await getCachedSettings();
  const key =
    process.env.GEMINI_API_KEY_NARAYANA ||
    s.gemini_api_key_narayana ||
    "";

  if (key && key.trim().length > 10) return key.trim();
  return getFarmFreshMasterApiKey();
}

/** 2. Lakshmi AI Dedicated Key */
export async function getLakshmiApiKey(): Promise<string> {
  const s = await getCachedSettings();
  const key =
    process.env.GEMINI_API_KEY_LAKSHMI ||
    s.gemini_api_key_lakshmi ||
    "";

  if (key && key.trim().length > 10) return key.trim();
  return getFarmFreshMasterApiKey();
}

/** 3. Netra Vision AI Dedicated Key (Multimodal Vision) */
export async function getNetraVisionApiKey(): Promise<string> {
  const s = await getCachedSettings();
  const key =
    process.env.GEMINI_API_KEY_NETRA ||
    process.env.GEMINI_API_KEY_VISION ||
    s.gemini_api_key_netra ||
    s.gemini_api_key_vision ||
    "";

  if (key && key.trim().length > 10) return key.trim();
  return getFarmFreshMasterApiKey();
}

/** 4. Imagen / AI Studio Dedicated Multi-Key Pool (Auto-Failover) */
export async function getImagenApiKeyPool(): Promise<string[]> {
  const s = await getCachedSettings();
  return [
    process.env.GEMINI_API_KEY_IMAGEN_1,
    process.env.GEMINI_API_KEY_IMAGEN_2,
    process.env.GEMINI_API_KEY_IMAGEN_3,
    s.gemini_api_key_imagen_1,
    s.gemini_api_key_imagen_2,
    s.gemini_api_key_imagen_3,
    process.env.GEMINI_API_KEY_VISION,
    process.env.GEMINI_API_KEY_FARMFRESH,
    process.env.GEMINI_API_KEY,
  ].filter((k): k is string => Boolean(k && k.trim().length > 10));
}

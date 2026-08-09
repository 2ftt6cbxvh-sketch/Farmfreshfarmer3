/**
 * Delivery fee & ETA calculation service.
 * Uses Haversine formula for distance, per-warehouse speed, and
 * PIN-based packing time to calculate combined delivery ETA in minutes.
 */
import { db } from "../db";
import {
  warehouses, warehousePincodes, deliveryFeeRules, deliverySettings,
  customerLocationLogs,
} from "@shared/schema";
import { eq, and, sql } from "drizzle-orm";

export interface DeliveryResolution {
  serviceable: boolean;
  fee: number;
  etaMinutes: number;
  freeDeliveryAbove?: number;
  packingTimeMinutes?: number;
  travelTimeMinutes?: number;
  warehouseId?: number;
  warehouseName?: string;
  maxRadiusKm?: number;
  locationArea?: string;
  distanceKm?: number;
  reason?: string;
  pincode?: string;
}

// Well-known Andhra Pradesh & Telangana Pincode Centroids Dictionary
const PINCODE_GEO_DB: Record<string, { area: string; lat: number; lng: number }> = {
  // Guntur
  "522001": { area: "Guntur Collectorate", lat: 16.3067, lng: 80.4365 },
  "522002": { area: "Guntur West", lat: 16.3000, lng: 80.4200 },
  "522003": { area: "Guntur East", lat: 16.3150, lng: 80.4500 },
  "522004": { area: "Guntur Medical College Area", lat: 16.2950, lng: 80.4400 },
  "522006": { area: "Guntur Pattabhipuram", lat: 16.3100, lng: 80.4100 },
  "522501": { area: "Mangalagiri, Guntur", lat: 16.4419, lng: 80.5539 },
  "522502": { area: "Tadepalle, Guntur", lat: 16.4805, lng: 80.6050 },
  // Vijayawada
  "520001": { area: "Vijayawada One Town", lat: 16.5193, lng: 80.6150 },
  "520002": { area: "Vijayawada Governorpet", lat: 16.5062, lng: 80.6380 },
  "520003": { area: "Vijayawada Satyanarayanapuram", lat: 16.5200, lng: 80.6300 },
  "520004": { area: "Vijayawada Machavaram", lat: 16.5050, lng: 80.6550 },
  "520007": { area: "Vijayawada Labbipet", lat: 16.4980, lng: 80.6480 },
  "520008": { area: "Vijayawada Kanuru", lat: 16.4880, lng: 80.6800 },
  "520010": { area: "Vijayawada Patamata", lat: 16.4950, lng: 80.6650 },
  "520012": { area: "Vijayawada Auto Nagar", lat: 16.4900, lng: 80.6750 },
  // Visakhapatnam
  "530001": { area: "Visakhapatnam Main Post Office", lat: 17.6868, lng: 83.2185 },
  "530002": { area: "Visakhapatnam Town", lat: 17.6950, lng: 83.2250 },
  "530003": { area: "Visakhapatnam Waltair Uplands", lat: 17.7200, lng: 83.3150 },
  "530013": { area: "Visakhapatnam MVP Colony", lat: 17.7400, lng: 83.3300 },
  "530016": { area: "Visakhapatnam Dwaraka Nagar", lat: 17.7250, lng: 83.3050 },
  "530017": { area: "Visakhapatnam Siripuram", lat: 17.7180, lng: 83.3180 },
  "530026": { area: "Visakhapatnam Gajuwaka", lat: 17.6900, lng: 83.2000 },
  "530048": { area: "Visakhapatnam PM Palem", lat: 17.8000, lng: 83.3500 },
  // Hyderabad / Cyberabad
  "500001": { area: "Hyderabad Abids", lat: 17.3850, lng: 78.4744 },
  "500032": { area: "Hyderabad Gachibowli", lat: 17.4401, lng: 78.3489 },
  "500081": { area: "Hyderabad HITECH City", lat: 17.4435, lng: 78.3772 },
  "500034": { area: "Hyderabad Banjara Hills", lat: 17.4156, lng: 78.4347 },
  // Rajahmundry & Kakinada
  "533101": { area: "Rajahmundry Main", lat: 17.0005, lng: 81.7800 },
  "533001": { area: "Kakinada Town", lat: 16.9891, lng: 82.2475 },
};

async function lookupPincodeGeo(pincode: string): Promise<{ areaName: string; lat: number; lng: number; valid: boolean }> {
  const cleanPin = pincode.trim();
  if (PINCODE_GEO_DB[cleanPin]) {
    const info = PINCODE_GEO_DB[cleanPin];
    return { areaName: info.area, lat: info.lat, lng: info.lng, valid: true };
  }

  // Check if explicitly assigned to a warehouse in DB
  try {
    const [dbPin] = await db.select().from(warehousePincodes).where(eq(warehousePincodes.pincode, cleanPin)).limit(1);
    if (dbPin) {
      const [wh] = await db.select().from(warehouses).where(eq(warehouses.id, dbPin.warehouseId)).limit(1);
      if (wh) {
        return { areaName: `PIN ${cleanPin}`, lat: parseFloat(wh.latitude), lng: parseFloat(wh.longitude), valid: true };
      }
    }
  } catch {}

  const prefix = cleanPin.substring(0, 3);
  const p = parseInt(prefix, 10);
  let baseLat = 0;
  let baseLng = 0;
  let hasKnownPrefix = false;

  if (p === 530 || p === 531) { baseLat = 17.6868; baseLng = 83.2185; hasKnownPrefix = true; }
  else if (p === 532) { baseLat = 18.2949; baseLng = 83.8938; hasKnownPrefix = true; }
  else if (p === 533) { baseLat = 16.9891; baseLng = 82.2475; hasKnownPrefix = true; }
  else if (p === 534) { baseLat = 16.7107; baseLng = 81.1035; hasKnownPrefix = true; }
  else if (p === 535) { baseLat = 18.1066; baseLng = 83.3955; hasKnownPrefix = true; }
  else if (p === 520 || p === 521) { baseLat = 16.5062; baseLng = 80.6480; hasKnownPrefix = true; }
  else if (p === 522) { baseLat = 16.3067; baseLng = 80.4365; hasKnownPrefix = true; }
  else if (p === 523) { baseLat = 15.5057; baseLng = 80.0499; hasKnownPrefix = true; }
  else if (p === 524) { baseLat = 14.4426; baseLng = 79.9865; hasKnownPrefix = true; }
  else if (p === 515) { baseLat = 14.6819; baseLng = 77.6006; hasKnownPrefix = true; }
  else if (p === 516) { baseLat = 14.4673; baseLng = 78.8242; hasKnownPrefix = true; }
  else if (p === 517) { baseLat = 13.6288; baseLng = 79.4192; hasKnownPrefix = true; }
  else if (p === 518) { baseLat = 15.8281; baseLng = 78.0373; hasKnownPrefix = true; }
  else if (p >= 500 && p <= 509) { baseLat = 17.3850; baseLng = 78.4744; hasKnownPrefix = true; }

  // Try Postal Pincode India API fallback
  try {
    const res = await fetch(`https://api.postalpincode.in/pincode/${cleanPin}`);
    const data = await res.json();
    if (Array.isArray(data) && data[0]?.Status === "Success" && data[0]?.PostOffice?.length > 0) {
      const po = data[0].PostOffice[0];
      const areaName = `${po.Name}, ${po.District}`;
      if (!hasKnownPrefix) {
        baseLat = 20.5937;
        baseLng = 78.9629;
      }
      return { areaName, lat: baseLat, lng: baseLng, valid: true };
    } else if (Array.isArray(data) && data[0]?.Status === "Error") {
      return { areaName: `Invalid PIN ${cleanPin}`, lat: 0, lng: 0, valid: false };
    }
  } catch {}

  if (hasKnownPrefix) {
    return { areaName: `PIN ${cleanPin}`, lat: baseLat, lng: baseLng, valid: true };
  }

  return { areaName: `Invalid PIN ${cleanPin}`, lat: 0, lng: 0, valid: false };
}

export function haversineDistanceKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export async function isDeliveryFeatureEnabled(): Promise<boolean> {
  const [setting] = await db.select().from(deliverySettings).limit(1);
  return setting?.featureEnabled ?? false;
}

async function calculateFee(distanceKm: number, orderValue: number): Promise<{ fee: number; freeDeliveryAbove: number }> {
  const rules = await db.select().from(deliveryFeeRules).where(eq(deliveryFeeRules.active, true));
  let freeAbove = 500;
  for (const rule of rules) {
    if (rule.freeDeliveryAboveOrderValue) {
      const val = parseFloat(rule.freeDeliveryAboveOrderValue);
      if (!isNaN(val) && val > 0) { freeAbove = val; break; }
    }
  }

  if (freeAbove > 0 && orderValue > 0 && orderValue >= freeAbove) {
    return { fee: 0, freeDeliveryAbove: freeAbove };
  }

  if (rules.length === 0) {
    return { fee: Math.round(30 + distanceKm * 5), freeDeliveryAbove: freeAbove };
  }

  for (const rule of rules) {
    const min = parseFloat(rule.minDistanceKm || "0");
    const max = parseFloat(rule.maxDistanceKm || "50");
    if (distanceKm >= min && distanceKm <= max) {
      const baseFee = parseFloat(rule.baseFee || "30");
      const perKmRate = parseFloat(rule.perKmFee || "5");
      const fee = baseFee + perKmRate * distanceKm;
      const cap = rule.maxFeeCap ? parseFloat(rule.maxFeeCap) : 150;
      return { fee: Math.min(Math.round(fee), cap), freeDeliveryAbove: freeAbove };
    }
  }
  return { fee: Math.round(30 + distanceKm * 5), freeDeliveryAbove: freeAbove };
}

export async function resolveByPincode(pincode: string, userId?: number, orderValue = 0): Promise<DeliveryResolution> {
  // Self-healing: ensure max_radius_km column exists
  try { await db.execute(sql`ALTER TABLE warehouses ADD COLUMN IF NOT EXISTS max_radius_km NUMERIC(5,2) NOT NULL DEFAULT 30`); } catch {}

  // STRICT INDIAN PINCODE VALIDATION: must be exactly 6 digits, first digit 1-9
  const cleanPin = pincode.trim();
  if (!/^[1-9][0-9]{5}$/.test(cleanPin)) {
    return {
      serviceable: false,
      fee: 0,
      etaMinutes: 0,
      freeDeliveryAbove: 500,
      pincode: cleanPin,
      locationArea: 'Invalid PIN Code',
      reason: 'Please enter a valid 6-digit Indian PIN code (e.g. 522001)',
    };
  }

  const geo = await lookupPincodeGeo(cleanPin);

  if (!geo.valid) {
    return {
      serviceable: false,
      fee: 0,
      etaMinutes: 0,
      pincode: cleanPin,
      locationArea: 'Invalid PIN Code',
      reason: `PIN code ${cleanPin} is not a valid or recognized Indian postal code`,
    };
  }

  let activeWarehouses = await db.select().from(warehouses).where(eq(warehouses.active, true));
  if (activeWarehouses.length === 0) {
    const [hub] = await db.insert(warehouses).values({
      name: "Vijayawada Central Hub",
      latitude: "16.5062",
      longitude: "80.6480",
      maxRadiusKm: "30",
      averageSpeedKmph: "30",
      active: true,
    }).returning();
    const pins = ["520001", "520002", "520003", "520004", "520007", "520008", "520010", "520012", "522501", "522502", "522001", "522002"];
    for (const p of pins) {
      await db.insert(warehousePincodes).values({ warehouseId: hub.id, pincode: p, packingTimeMinutes: 30 });
    }
    activeWarehouses = [hub];
  }

  const [pcRow] = await db.select().from(warehousePincodes)
    .where(and(eq(warehousePincodes.pincode, pincode), eq(warehousePincodes.active, true))).limit(1);

  let warehouse;
  let packingTimeMinutes = 30;

  if (pcRow) {
    const [wh] = await db.select().from(warehouses)
      .where(and(eq(warehouses.id, pcRow.warehouseId), eq(warehouses.active, true))).limit(1);
    if (!wh) {
      await logResolution({ userId, pincode, serviceable: false });
      return { serviceable: false, fee: 0, etaMinutes: 0, pincode, locationArea: geo.areaName, reason: "Assigned warehouse is currently inactive" };
    }
    warehouse = wh;
    packingTimeMinutes = pcRow.packingTimeMinutes || 30;
  } else {
    // dynamically match nearest active warehouse
    let nearestWarehouse = activeWarehouses[0];
    let minDistance = haversineDistanceKm(geo.lat, geo.lng, parseFloat(nearestWarehouse.latitude), parseFloat(nearestWarehouse.longitude));
    for (const wh of activeWarehouses.slice(1)) {
      const d = haversineDistanceKm(geo.lat, geo.lng, parseFloat(wh.latitude), parseFloat(wh.longitude));
      if (d < minDistance) { minDistance = d; nearestWarehouse = wh; }
    }
    warehouse = nearestWarehouse;
  }

  // Calculate distance from Warehouse Lat/Lng to Customer Lat/Lng
  const whLat = parseFloat(warehouse.latitude);
  const whLng = parseFloat(warehouse.longitude);
  const distanceKm = haversineDistanceKm(whLat, whLng, geo.lat, geo.lng);

  const maxRadiusKm = parseFloat(warehouse.maxRadiusKm || 30);
  if (distanceKm > maxRadiusKm) {
    return {
      serviceable: false,
      fee: 0,
      etaMinutes: 0,
      pincode,
      locationArea: geo.areaName,
      maxRadiusKm,
      reason: `Location is ${Math.round(distanceKm)}km away. Exceeds warehouse deliverable radius of ${maxRadiusKm}km`
    };
  }

  // Calculate Travel Duration using Warehouse Rider Speed
  const speedKmph = parseFloat(warehouse.averageSpeedKmph) || 30;
  const travelTimeMinutes = distanceKm > 0 ? Math.ceil((distanceKm / speedKmph) * 60) : 0;

  const etaMinutes = Math.max(30, packingTimeMinutes + travelTimeMinutes);
  const { fee, freeDeliveryAbove } = await calculateFee(distanceKm, orderValue);

  await logResolution({ userId, pincode, serviceable: true, resolvedWarehouseId: warehouse.id, calculatedFee: fee, calculatedTimeMinutes: etaMinutes });

  return {
    serviceable: true,
    fee,
    etaMinutes,
    freeDeliveryAbove,
    packingTimeMinutes,
    travelTimeMinutes,
    distanceKm,
    maxRadiusKm,
    warehouseId: warehouse.id,
    warehouseName: warehouse.name,
    locationArea: `${geo.areaName} (${pincode})`,
  };
}

export async function resolveByCoords(lat: number, lng: number, userId?: number, orderValue = 0): Promise<DeliveryResolution> {
  // Self-healing: ensure max_radius_km column exists
  try { await db.execute(sql`ALTER TABLE warehouses ADD COLUMN IF NOT EXISTS max_radius_km NUMERIC(5,2) NOT NULL DEFAULT 30`); } catch {}

  let detectedPincode = "";
  let detectedArea = "";

  // Attempt live OSM reverse geocoding API lookup for exact street/area/city/pincode
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 2500);
    const osmRes = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1`,
      {
        headers: { "User-Agent": "FarmFreshFarmer/2.7.0 (contact@farmfreshfarmer.com)" },
        signal: controller.signal,
      }
    );
    clearTimeout(timer);
    if (osmRes.ok) {
      const data = await osmRes.json();
      const addr = data?.address || {};
      const pin = addr.postcode ? String(addr.postcode).replace(/\D/g, "").slice(0, 6) : "";
      const area = addr.suburb || addr.neighbourhood || addr.residential || addr.village || addr.town || addr.city_district || addr.city || addr.county || addr.state_district || "";
      const district = addr.state_district || addr.district || addr.county || addr.city || "";
      
      if (pin && pin.length === 6) {
        detectedPincode = pin;
      }
      if (area) {
        detectedArea = district && district !== area ? `${area}, ${district}` : area;
      }
    }
  } catch {}

  // Fallback to closest PINCODE_GEO_DB lookup if live API fails or pin missing
  if (!detectedPincode || !detectedArea) {
    let minPinDist = Infinity;
    for (const [pin, info] of Object.entries(PINCODE_GEO_DB)) {
      const d = haversineDistanceKm(lat, lng, info.lat, info.lng);
      if (d < minPinDist) {
        minPinDist = d;
        if (!detectedPincode) detectedPincode = pin;
        if (!detectedArea) detectedArea = info.area;
      }
    }
  }

  const locationArea = detectedArea
    ? (detectedPincode ? `${detectedArea} (${detectedPincode})` : detectedArea)
    : `GPS Location (${lat.toFixed(3)}°, ${lng.toFixed(3)}°)`;

  let allWarehouses = await db.select().from(warehouses).where(eq(warehouses.active, true));
  if (allWarehouses.length === 0) {
    const [hub] = await db.insert(warehouses).values({
      name: "Vijayawada Central Hub",
      latitude: "16.5062",
      longitude: "80.6480",
      maxRadiusKm: "30",
      averageSpeedKmph: "30",
      active: true,
    }).returning();
    const pins = ["520001", "520002", "520003", "520004", "520007", "520008", "520010", "520012", "522501", "522502", "522001", "522002"];
    for (const p of pins) {
      await db.insert(warehousePincodes).values({ warehouseId: hub.id, pincode: p, packingTimeMinutes: 30 });
    }
    allWarehouses = [hub];
  }

  let nearestWarehouse = allWarehouses[0];
  let minDistance = haversineDistanceKm(lat, lng, parseFloat(nearestWarehouse.latitude), parseFloat(nearestWarehouse.longitude));
  for (const wh of allWarehouses.slice(1)) {
    const d = haversineDistanceKm(lat, lng, parseFloat(wh.latitude), parseFloat(wh.longitude));
    if (d < minDistance) { minDistance = d; nearestWarehouse = wh; }
  }

  const maxRange = parseFloat(nearestWarehouse.maxRadiusKm || 30);
  if (minDistance > maxRange) {
    const distanceKm = Math.round(minDistance * 10) / 10;
    await logResolution({ userId, latitude: lat, longitude: lng, serviceable: false, resolvedWarehouseId: nearestWarehouse.id });
    return {
      serviceable: false,
      fee: 0,
      etaMinutes: 0,
      pincode: detectedPincode || undefined,
      locationArea,
      maxRadiusKm: maxRange,
      reason: `Location is ${Math.round(distanceKm)}km away. Exceeds warehouse deliverable radius of ${maxRange}km`,
      distanceKm
    };
  }

  const speedKmph = parseFloat(nearestWarehouse.averageSpeedKmph) || 30;
  const packingTimeMinutes = 30;
  const distanceKm = Math.round(minDistance * 10) / 10;
  const travelTimeMinutes = Math.ceil((distanceKm / speedKmph) * 60);
  const etaMinutes = Math.max(30, packingTimeMinutes + travelTimeMinutes);
  const { fee, freeDeliveryAbove } = await calculateFee(distanceKm, orderValue);

  await logResolution({ userId, latitude: lat, longitude: lng, source: "gps", serviceable: true, resolvedWarehouseId: nearestWarehouse.id, calculatedFee: fee, calculatedTimeMinutes: etaMinutes });

  return {
    serviceable: true,
    fee,
    etaMinutes,
    freeDeliveryAbove,
    packingTimeMinutes,
    travelTimeMinutes,
    distanceKm,
    maxRadiusKm: maxRange,
    pincode: detectedPincode || undefined,
    warehouseId: nearestWarehouse.id,
    warehouseName: nearestWarehouse.name,
    locationArea,
  };
}

async function logResolution(opts: {
  userId?: number; latitude?: number; longitude?: number; pincode?: string;
  source?: string; serviceable: boolean; resolvedWarehouseId?: number;
  calculatedFee?: number; calculatedTimeMinutes?: number;
}) {
  try {
    await db.insert(customerLocationLogs).values({
      userId: opts.userId, latitude: opts.latitude?.toString(), longitude: opts.longitude?.toString(),
      pincode: opts.pincode, source: opts.source || "manual", serviceable: opts.serviceable,
      resolvedWarehouseId: opts.resolvedWarehouseId, calculatedFee: opts.calculatedFee?.toString(),
      calculatedTimeMinutes: opts.calculatedTimeMinutes,
    });
  } catch (e) {
    console.error("[delivery] Failed to log location resolution:", e);
  }
}

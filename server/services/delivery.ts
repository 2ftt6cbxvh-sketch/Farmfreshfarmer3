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
  packingTimeMinutes?: number;
  travelTimeMinutes?: number;
  warehouseId?: number;
  warehouseName?: string;
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

async function lookupPincodeGeo(pincode: string): Promise<{ areaName: string; lat: number; lng: number }> {
  const cleanPin = pincode.trim();
  if (PINCODE_GEO_DB[cleanPin]) {
    const info = PINCODE_GEO_DB[cleanPin];
    return { areaName: info.area, lat: info.lat, lng: info.lng };
  }

  const prefix = cleanPin.substring(0, 3);
  const p = parseInt(prefix, 10);
  let baseLat = 16.5;
  let baseLng = 80.5;

  if (p === 530 || p === 531) { baseLat = 17.6868; baseLng = 83.2185; }
  else if (p === 532) { baseLat = 18.2949; baseLng = 83.8938; }
  else if (p === 533) { baseLat = 16.9891; baseLng = 82.2475; }
  else if (p === 534) { baseLat = 16.7107; baseLng = 81.1035; }
  else if (p === 535) { baseLat = 18.1066; baseLng = 83.3955; }
  else if (p === 520 || p === 521) { baseLat = 16.5062; baseLng = 80.6480; }
  else if (p === 522) { baseLat = 16.3067; baseLng = 80.4365; }
  else if (p === 523) { baseLat = 15.5057; baseLng = 80.0499; }
  else if (p === 524) { baseLat = 14.4426; baseLng = 79.9865; }
  else if (p === 515) { baseLat = 14.6819; baseLng = 77.6006; }
  else if (p === 516) { baseLat = 14.4673; baseLng = 78.8242; }
  else if (p === 517) { baseLat = 13.6288; baseLng = 79.4192; }
  else if (p === 518) { baseLat = 15.8281; baseLng = 78.0373; }
  else if (p >= 500 && p <= 509) { baseLat = 17.3850; baseLng = 78.4744; }

  // Try Postal Pincode India API fallback
  try {
    const res = await fetch(`https://api.postalpincode.in/pincode/${cleanPin}`);
    const data = await res.json();
    if (Array.isArray(data) && data[0]?.Status === "Success" && data[0]?.PostOffice?.length > 0) {
      const po = data[0].PostOffice[0];
      const areaName = `${po.Name}, ${po.District}`;
      return { areaName, lat: baseLat, lng: baseLng };
    }
  } catch {}

  return { areaName: `PIN ${cleanPin}`, lat: baseLat, lng: baseLng };
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

async function calculateFee(distanceKm: number, orderValue: number): Promise<number> {
  const rules = await db.select().from(deliveryFeeRules).where(eq(deliveryFeeRules.active, true));
  for (const rule of rules) {
    const min = parseFloat(rule.minDistanceKm);
    const max = parseFloat(rule.maxDistanceKm);
    if (distanceKm >= min && distanceKm <= max) {
      if (rule.freeDeliveryAboveOrderValue && orderValue >= parseFloat(rule.freeDeliveryAboveOrderValue)) return 0;
      const fee = parseFloat(rule.baseFee) + parseFloat(rule.perKmFee) * distanceKm;
      const cap = rule.maxFeeCap ? parseFloat(rule.maxFeeCap) : Infinity;
      return Math.min(fee, cap);
    }
  }
  return 0;
}

export async function resolveByPincode(pincode: string, userId?: number, orderValue = 0): Promise<DeliveryResolution> {
  // Self-healing: ensure max_radius_km column exists
  try { await db.execute(sql`ALTER TABLE warehouses ADD COLUMN IF NOT EXISTS max_radius_km NUMERIC(5,2) NOT NULL DEFAULT 30`); } catch {}

  const geo = await lookupPincodeGeo(pincode);

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
    return { serviceable: false, fee: 0, etaMinutes: 0, pincode, locationArea: geo.areaName, reason: `Location is ${Math.round(distanceKm)}km away. Exceeds warehouse deliverable radius of ${warehouse.maxRadiusKm || 30}km` };
  }

  // Calculate Travel Duration using Warehouse Rider Speed
  const speedKmph = parseFloat(warehouse.averageSpeedKmph) || 30;
  const travelTimeMinutes = distanceKm > 0 ? Math.ceil((distanceKm / speedKmph) * 60) : 0;

  const etaMinutes = Math.max(30, packingTimeMinutes + travelTimeMinutes);
  const fee = await calculateFee(distanceKm, orderValue);

  await logResolution({ userId, pincode, serviceable: true, resolvedWarehouseId: warehouse.id, calculatedFee: fee, calculatedTimeMinutes: etaMinutes });

  return {
    serviceable: true,
    fee,
    etaMinutes,
    packingTimeMinutes,
    travelTimeMinutes,
    distanceKm,
    warehouseId: warehouse.id,
    warehouseName: warehouse.name,
    locationArea: `${geo.areaName} (${pincode})`,
  };
}

export async function resolveByCoords(lat: number, lng: number, userId?: number, orderValue = 0): Promise<DeliveryResolution> {
  // Self-healing: ensure max_radius_km column exists
  try { await db.execute(sql`ALTER TABLE warehouses ADD COLUMN IF NOT EXISTS max_radius_km NUMERIC(5,2) NOT NULL DEFAULT 30`); } catch {}

  // Reverse lookup closest pincode and area from PINCODE_GEO_DB
  let detectedPincode = "";
  let detectedArea = "";
  let minPinDist = Infinity;

  for (const [pin, info] of Object.entries(PINCODE_GEO_DB)) {
    const d = haversineDistanceKm(lat, lng, info.lat, info.lng);
    if (d < minPinDist) {
      minPinDist = d;
      detectedPincode = pin;
      detectedArea = info.area;
    }
  }

  const locationArea = minPinDist < 50
    ? `${detectedArea} (${detectedPincode})`
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
      pincode: minPinDist < 50 ? detectedPincode : undefined,
      locationArea,
      reason: `Location is ${Math.round(distanceKm)}km away. Exceeds warehouse deliverable radius of ${nearestWarehouse.maxRadiusKm || 30}km`,
      distanceKm
    };
  }

  const speedKmph = parseFloat(nearestWarehouse.averageSpeedKmph) || 30;
  const packingTimeMinutes = 30;
  const distanceKm = Math.round(minDistance * 10) / 10;
  const travelTimeMinutes = Math.ceil((distanceKm / speedKmph) * 60);
  const etaMinutes = Math.max(30, packingTimeMinutes + travelTimeMinutes);
  const fee = await calculateFee(distanceKm, orderValue);

  await logResolution({ userId, latitude: lat, longitude: lng, source: "gps", serviceable: true, resolvedWarehouseId: nearestWarehouse.id, calculatedFee: fee, calculatedTimeMinutes: etaMinutes });

  return {
    serviceable: true,
    fee,
    etaMinutes,
    packingTimeMinutes,
    travelTimeMinutes,
    distanceKm,
    pincode: minPinDist < 50 ? detectedPincode : undefined,
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

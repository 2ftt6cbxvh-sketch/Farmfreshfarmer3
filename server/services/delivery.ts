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
import { eq, and } from "drizzle-orm";

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

  // Try Postal Pincode India API fallback
  try {
    const res = await fetch(`https://api.postalpincode.in/pincode/${cleanPin}`);
    const data = await res.json();
    if (Array.isArray(data) && data[0]?.Status === "Success" && data[0]?.PostOffice?.length > 0) {
      const po = data[0].PostOffice[0];
      const areaName = `${po.Name}, ${po.District}`;
      // Estimate coords based on district or pincode range
      const districtLat = cleanPin.startsWith("522") ? 16.3067 : cleanPin.startsWith("520") ? 16.5062 : cleanPin.startsWith("530") ? 17.6868 : 16.5;
      const districtLng = cleanPin.startsWith("522") ? 80.4365 : cleanPin.startsWith("520") ? 80.6480 : cleanPin.startsWith("530") ? 83.2185 : 80.5;
      return { areaName, lat: districtLat, lng: districtLng };
    }
  } catch {}

  return { areaName: `PIN ${cleanPin}`, lat: 16.5, lng: 80.5 };
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
  const activeWarehouses = await db.select().from(warehouses).where(eq(warehouses.active, true));
  if (activeWarehouses.length === 0) {
    return { serviceable: false, fee: 0, etaMinutes: 0, reason: "No active warehouses configured" };
  }

  const [pcRow] = await db.select().from(warehousePincodes)
    .where(and(eq(warehousePincodes.pincode, pincode), eq(warehousePincodes.active, true))).limit(1);
  if (!pcRow) {
    await logResolution({ userId, pincode, serviceable: false });
    return { serviceable: false, fee: 0, etaMinutes: 0, reason: "PIN code not in any active warehouse service area" };
  }

  const [warehouse] = await db.select().from(warehouses)
    .where(and(eq(warehouses.id, pcRow.warehouseId), eq(warehouses.active, true))).limit(1);
  if (!warehouse) {
    await logResolution({ userId, pincode, serviceable: false });
    return { serviceable: false, fee: 0, etaMinutes: 0, reason: "Assigned warehouse is currently inactive" };
  }

  // Resolve Customer Location Geo (Area Name + Lat/Lng)
  const geo = await lookupPincodeGeo(pincode);

  // Calculate distance from Warehouse Lat/Lng to Customer Lat/Lng
  const whLat = parseFloat(warehouse.latitude);
  const whLng = parseFloat(warehouse.longitude);
  const distanceKm = Math.round(haversineDistanceKm(whLat, whLng, geo.lat, geo.lng) * 10) / 10;

  // Calculate Travel Duration using Warehouse Rider Speed
  const speedKmph = parseFloat(warehouse.averageSpeedKmph) || 30;
  const travelTimeMinutes = distanceKm > 0 ? Math.ceil((distanceKm / speedKmph) * 60) : 0;
  const packingTimeMinutes = pcRow.packingTimeMinutes || 30;

  const etaMinutes = packingTimeMinutes + travelTimeMinutes;
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
  const allWarehouses = await db.select().from(warehouses).where(eq(warehouses.active, true));
  if (allWarehouses.length === 0) return { serviceable: false, fee: 0, etaMinutes: 0, reason: "No active warehouses configured" };

  let nearestWarehouse = allWarehouses[0];
  let minDistance = haversineDistanceKm(lat, lng, parseFloat(nearestWarehouse.latitude), parseFloat(nearestWarehouse.longitude));
  for (const wh of allWarehouses.slice(1)) {
    const d = haversineDistanceKm(lat, lng, parseFloat(wh.latitude), parseFloat(wh.longitude));
    if (d < minDistance) { minDistance = d; nearestWarehouse = wh; }
  }

  const rules = await db.select().from(deliveryFeeRules).where(eq(deliveryFeeRules.active, true));
  const maxRange = rules.length > 0 ? Math.max(...rules.map((r) => parseFloat(r.maxDistanceKm))) : 100;
  if (minDistance > maxRange) {
    await logResolution({ userId, latitude: lat, longitude: lng, serviceable: false, resolvedWarehouseId: nearestWarehouse.id });
    return { serviceable: false, fee: 0, etaMinutes: 0, reason: "Distance exceeds maximum delivery radius", distanceKm: Math.round(minDistance * 10) / 10 };
  }

  const speedKmph = parseFloat(nearestWarehouse.averageSpeedKmph) || 30;
  const packingTimeMinutes = 30;
  const distanceKm = Math.round(minDistance * 10) / 10;
  const travelTimeMinutes = Math.ceil((distanceKm / speedKmph) * 60);
  const etaMinutes = packingTimeMinutes + travelTimeMinutes;
  const fee = await calculateFee(distanceKm, orderValue);

  await logResolution({ userId, latitude: lat, longitude: lng, source: "gps", serviceable: true, resolvedWarehouseId: nearestWarehouse.id, calculatedFee: fee, calculatedTimeMinutes: etaMinutes });

  return {
    serviceable: true,
    fee,
    etaMinutes,
    packingTimeMinutes,
    travelTimeMinutes,
    distanceKm,
    warehouseId: nearestWarehouse.id,
    warehouseName: nearestWarehouse.name,
    locationArea: `GPS Location (${lat.toFixed(4)}, ${lng.toFixed(4)})`,
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

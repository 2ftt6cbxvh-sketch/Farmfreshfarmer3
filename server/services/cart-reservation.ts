/**
 * Cart Reservation Service (Flash Anti-Hoarding Engine)
 * =====================================================
 * Enforces dynamic 10-minute inventory reservations for perishable and
 * seasonal Andhra/Telangana produce during high-traffic harvest drops.
 *
 * Prevents hoarders and bot scripts from exhausting stock without checkout.
 * Auto-expires held stock after 10 minutes to release back into the catalog.
 */

import { db } from "../db";
import { cartReservations, products } from "@shared/schema";
import { eq, and, gt, lte, sql } from "drizzle-orm";

const RESERVATION_TTL_MINUTES = 10;

export interface ReserveItemRequest {
  productId: number;
  quantity: number;
  unit?: string;
}

export interface ReservationResult {
  success: boolean;
  expiresAt?: string;
  remainingSeconds: number;
  reservedCount: number;
  warnings?: string[];
}

/**
 * Cleanup expired reservations from the database
 */
export async function cleanupExpiredReservations(): Promise<number> {
  try {
    const now = new Date();
    const res = await db
      .delete(cartReservations)
      .where(lte(cartReservations.expiresAt, now));
    return (res as any)?.rowCount || 0;
  } catch (err: any) {
    console.warn("[cart-reservation] cleanup warning:", err.message);
    return 0;
  }
}

/**
 * Get effective stock for a product, taking active holds by others into account
 */
export async function getEffectiveStock(
  productId: number,
  excludeSessionId?: string
): Promise<number> {
  // Prune expired first
  await cleanupExpiredReservations();

  const [prod] = await db
    .select({ stock: products.stock })
    .from(products)
    .where(eq(products.id, productId))
    .limit(1);

  if (!prod) return 0;

  const now = new Date();
  const conditions = [
    eq(cartReservations.productId, productId),
    gt(cartReservations.expiresAt, now),
  ];

  if (excludeSessionId) {
    conditions.push(sql`${cartReservations.sessionId} != ${excludeSessionId}`);
  }

  const activeReservations = await db
    .select({
      totalReserved: sql<number>`COALESCE(SUM(${cartReservations.quantity}), 0)`,
    })
    .from(cartReservations)
    .where(and(...conditions));

  const reservedQty = Number(activeReservations[0]?.totalReserved || 0);
  return Math.max(0, (prod.stock || 0) - reservedQty);
}

/**
 * Reserve cart items for a customer's session (10 minute lock)
 */
export async function reserveCart(
  sessionId: string,
  userId: number | null,
  items: ReserveItemRequest[]
): Promise<ReservationResult> {
  if (!sessionId || !items.length) {
    return { success: false, remainingSeconds: 0, reservedCount: 0 };
  }

  await cleanupExpiredReservations();

  const now = new Date();
  const expiresAt = new Date(now.getTime() + RESERVATION_TTL_MINUTES * 60 * 1000);
  const warnings: string[] = [];

  // Remove existing reservations for this session to reset timer
  await db
    .delete(cartReservations)
    .where(eq(cartReservations.sessionId, sessionId));

  let successfulReserves = 0;

  for (const item of items) {
    if (!item.productId || item.quantity <= 0) continue;

    const availableStock = await getEffectiveStock(item.productId, sessionId);

    if (availableStock < item.quantity) {
      warnings.push(
        `Item ID ${item.productId}: only ${availableStock} units remaining (requested ${item.quantity}).`
      );
    }

    const qtyToReserve = Math.min(item.quantity, Math.max(1, availableStock));

    await db.insert(cartReservations).values({
      sessionId,
      userId: userId || null,
      productId: item.productId,
      quantity: qtyToReserve,
      unit: item.unit || "kg",
      expiresAt,
    });

    successfulReserves++;
  }

  return {
    success: successfulReserves > 0,
    expiresAt: expiresAt.toISOString(),
    remainingSeconds: RESERVATION_TTL_MINUTES * 60,
    reservedCount: successfulReserves,
    warnings: warnings.length > 0 ? warnings : undefined,
  };
}

/**
 * Get active reservation status for a session
 */
export async function getCartReservationStatus(sessionId: string): Promise<{
  active: boolean;
  expiresAt: string | null;
  remainingSeconds: number;
  items: Array<{ productId: number; quantity: number; unit: string | null }>;
}> {
  if (!sessionId) {
    return { active: false, expiresAt: null, remainingSeconds: 0, items: [] };
  }

  await cleanupExpiredReservations();

  const now = new Date();
  const activeItems = await db
    .select({
      productId: cartReservations.productId,
      quantity: cartReservations.quantity,
      unit: cartReservations.unit,
      expiresAt: cartReservations.expiresAt,
    })
    .from(cartReservations)
    .where(
      and(
        eq(cartReservations.sessionId, sessionId),
        gt(cartReservations.expiresAt, now)
      )
    );

  if (!activeItems.length) {
    return { active: false, expiresAt: null, remainingSeconds: 0, items: [] };
  }

  const latestExpiry = activeItems[0].expiresAt;
  const remainingSeconds = Math.max(
    0,
    Math.floor((new Date(latestExpiry).getTime() - now.getTime()) / 1000)
  );

  return {
    active: remainingSeconds > 0,
    expiresAt: latestExpiry ? new Date(latestExpiry).toISOString() : null,
    remainingSeconds,
    items: activeItems.map((it) => ({
      productId: it.productId,
      quantity: it.quantity,
      unit: it.unit,
    })),
  };
}

/**
 * Release reservations upon checkout completion or cart clear
 */
export async function releaseCartReservations(sessionId: string): Promise<void> {
  if (!sessionId) return;
  try {
    await db
      .delete(cartReservations)
      .where(eq(cartReservations.sessionId, sessionId));
  } catch (err: any) {
    console.warn("[cart-reservation] release error:", err.message);
  }
}

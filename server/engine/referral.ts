/**
 * Referral settlement — runs AFTER an order is created/paid.
 * ==========================================================
 * Given a qualifying first order that used a valid referral code, this:
 *   1. Records the referral relationship (referrer -> referred), status converted.
 *   2. Credits the referrer a reward = reward% of the referred order's subtotal.
 *
 * Idempotent: guarded by the unique index on referrals.referred_user_id and by
 * checking for an existing referral before inserting.
 *
 * Also handles reward-credit spending: when a referrer redeems reward credit on
 * their own order, we write a referral_reward_usages ledger row.
 */
import { storage } from "../storage";
import { generateReferralCode } from "../lib/referral-code";

/** Ensure a user has a referral code; create one if missing (with collision retry). */
export async function ensureReferralCode(userId: number): Promise<string> {
  const existing = await storage.referrals.codeForUser(userId);
  if (existing) return existing.code;
  for (let attempt = 0; attempt < 5; attempt++) {
    const code = generateReferralCode();
    const clash = await storage.referrals.findByCode(code);
    if (!clash) {
      const row = await storage.referrals.createCode(userId, code);
      return row.code;
    }
  }
  // extremely unlikely; fall back to a userId-suffixed code
  const fallback = generateReferralCode() + "-" + userId;
  const row = await storage.referrals.createCode(userId, fallback);
  return row.code;
}

/**
 * Settle a qualifying referral for a just-completed first order.
 * `referrerUserId` and `referralCode` come from the pricing engine meta.
 */
export async function settleReferralForOrder(params: {
  referredUserId: number;
  referrerUserId: number;
  referralCode: string;
  orderId: number;
  orderSubtotal: number;
}) {
  const { referredUserId, referrerUserId, referralCode, orderId, orderSubtotal } = params;

  // Guard: self-referral and double-referral.
  if (referrerUserId === referredUserId) return;
  const alreadyReferred = await storage.referrals.wasReferred(referredUserId);
  if (alreadyReferred) {
    // If a pending referral exists, convert it; otherwise skip.
    if (alreadyReferred.status !== "converted") {
      await storage.referrals.convertReferral(alreadyReferred.id, orderId);
      await creditReward(referrerUserId, alreadyReferred.id, orderSubtotal);
    }
    return;
  }

  const referral = await storage.referrals.createReferral({
    referrerUserId, referredUserId, code: referralCode.toUpperCase(), status: "converted",
  });
  await storage.referrals.convertReferral(referral.id, orderId);
  await creditReward(referrerUserId, referral.id, orderSubtotal);
}

async function creditReward(referrerUserId: number, referralId: number, orderSubtotal: number) {
  const settings = await storage.settings.all();
  const rewardPct = Number(settings.referral_reward_percent || 5);
  const amount = Math.round(orderSubtotal * (rewardPct / 100) * 100) / 100;
  if (amount <= 0) return;
  await storage.referrals.createReward({
    referrerUserId, referralId, rewardPercent: rewardPct, amount, status: "approved",
  });
}

/** Record that a referrer spent reward credit on their own order. */
export async function recordRewardSpend(referrerUserId: number, orderId: number, amount: number) {
  if (amount > 0) await storage.referrals.recordRewardUsage(referrerUserId, orderId, amount);
}

/** Build the customer-facing referral summary for the account page + admin. */
export async function referralSummary(userId: number) {
  const code = await ensureReferralCode(userId);
  const referrals = await storage.referrals.referralsByReferrer(userId);
  const rewards = await storage.referrals.rewardsForUser(userId);
  const balance = await storage.referrals.availableBalance(userId);
  const totalEarned = rewards.reduce((s, r) => s + Number(r.amount), 0);
  const converted = referrals.filter((r) => r.status === "converted").length;
  return {
    code,
    totalReferrals: referrals.length,
    successfulReferrals: converted,
    totalEarned: Math.round(totalEarned * 100) / 100,
    availableBalance: balance,
    referrals,
    rewards,
  };
}

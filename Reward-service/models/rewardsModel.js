const crypto = require("crypto");
const db = require("../config/db");

function makeVoucherCode() {
  const raw = crypto.randomBytes(4).toString("hex").toUpperCase();
  return `AIDA-${raw.slice(0, 4)}-${raw.slice(4, 8)}`;
}

// GET active rewards
async function listActiveRewards() {
  const result = await db.query(
    `SELECT id, name, description, cost_points, image_url, stock, is_active,
            fulfilment_type, pickup_location
     FROM public.rewards
     WHERE is_active = TRUE
     ORDER BY cost_points ASC`
  );
  return result.rows;
}

// Lock reward row to prevent race conditions
async function getRewardForUpdate(client, rewardId) {
  const res = await client.query(
    `SELECT id, name, cost_points, stock, is_active, fulfilment_type, pickup_location
     FROM public.rewards
     WHERE id = $1
     FOR UPDATE`,
    [rewardId]
  );
  return res.rows[0];
}

// Sum points from user_points
async function getUserPointsBalance(client, userId) {
  const res = await client.query(
    `SELECT COALESCE(SUM(points), 0) AS total
     FROM public.user_points
     WHERE user_id = $1`,
    [userId]
  );
  return Number(res.rows[0].total);
}

// Insert negative points row
async function insertPointsDeduction(client, userId, points, reason) {
  await client.query(
    `INSERT INTO public.user_points (user_id, points, reason, task_id)
     VALUES ($1, $2, $3, NULL)`,
    [userId, points, reason]
  );
}

async function redeemReward(userId, payload) {
  const {
    rewardId,
    quantity = 1,
    recipientName,
    recipientPhone,
    recipientEmail,
    addressLine1,
    addressLine2,
    postalCode,
  } = payload;

  const client = await db.pool.connect();
  try {
    await client.query("BEGIN");

    const reward = await getRewardForUpdate(client, rewardId);
    if (!reward) throw new Error("Reward not found");
    if (!reward.is_active) throw new Error("Reward not available");

    const qty = Number(quantity) || 1;
    if (qty <= 0) throw new Error("Quantity must be at least 1");

    // Stock check (if limited)
    if (reward.stock !== null && reward.stock < qty) {
      throw new Error("Out of stock");
    }

    const totalCost = Number(reward.cost_points) * qty;

    // Points check
    const balance = await getUserPointsBalance(client, userId);
    if (balance < totalCost) throw new Error("Not enough points");

    // Delivery validation
    if (reward.fulfilment_type === "delivery") {
      if (!recipientName || !recipientPhone || !addressLine1 || !postalCode) {
        throw new Error("Delivery requires name, phone, address and postal code");
      }
    }

    // Voucher code if needed
    const voucherCode =
      reward.fulfilment_type === "voucher" ? makeVoucherCode() : null;

    // Deduct points
    await insertPointsDeduction(
      client,
      userId,
      -totalCost,
      `Redeemed: ${reward.name}`
    );

    // Decrease stock if limited
    if (reward.stock !== null) {
      await client.query(
        `UPDATE public.rewards
         SET stock = stock - $1
         WHERE id = $2`,
        [qty, rewardId]
      );
    }

    // Save redemption record
    const redemptionRes = await client.query(
      `INSERT INTO public.reward_redemptions (
        user_id, reward_id, quantity, points_spent,
        fulfilment_type,
        recipient_name, recipient_phone, recipient_email,
        address_line1, address_line2, postal_code,
        voucher_code, status
      )
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,'pending')
      RETURNING id, redeemed_at, status`,
      [
        userId,
        rewardId,
        qty,
        totalCost,
        reward.fulfilment_type,
        recipientName || null,
        recipientPhone || null,
        recipientEmail || null,
        addressLine1 || null,
        addressLine2 || null,
        postalCode || null,
        voucherCode,
      ]
    );

    await client.query("COMMIT");

    return {
      success: true,
      redemptionId: redemptionRes.rows[0].id,
      status: redemptionRes.rows[0].status,
      redeemedAt: redemptionRes.rows[0].redeemed_at,
      pointsSpent: totalCost,
      voucherCode,
    };
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}

async function getMyRedemptions(userId) {
  const res = await db.query(
    `SELECT rr.id, rr.quantity, rr.points_spent, rr.fulfilment_type, rr.voucher_code,
            rr.status, rr.redeemed_at,
            rr.address_line1, rr.address_line2, rr.postal_code,
            r.name, r.description, r.image_url, r.pickup_location
     FROM public.reward_redemptions rr
     JOIN public.rewards r ON rr.reward_id = r.id
     WHERE rr.user_id = $1
     ORDER BY rr.redeemed_at DESC`,
    [userId]
  );
  return res.rows;
}

module.exports = {
  listActiveRewards,
  redeemReward,
  getMyRedemptions,
};

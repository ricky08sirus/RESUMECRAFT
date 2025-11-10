// routes/payment.js - Razorpay Integration + Credit System (Stable Version)

import express from "express";
import Razorpay from "razorpay";
import crypto from "crypto";
import Bottleneck from "bottleneck";
import { requireAuth, getAuth } from "@clerk/express";
import User from "../models/User.js";

const router = express.Router();

/* -------------------------------------------------------------------------- */
/* 🧠 RAZORPAY INSTANCE                                                       */
/* -------------------------------------------------------------------------- */
const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET,
});

/* -------------------------------------------------------------------------- */
/* ⚙️ RATE LIMITER (Bottleneck-based for fairness)                            */
/* -------------------------------------------------------------------------- */
const limiter = new Bottleneck({
  minTime: 50,
  maxConcurrent: 10,
  highWater: 300,
  strategy: Bottleneck.strategy.OVERFLOW,
  reservoir: 1000,
  reservoirRefreshAmount: 1000,
  reservoirRefreshInterval: 60 * 1000, // Every minute
});

limiter.on("failed", async (error, jobInfo) => {
  if (jobInfo.retryCount < 2) {
    console.warn(`⚠️ Limiter retry ${jobInfo.retryCount + 1}/2`);
    return 500;
  }
});

/* -------------------------------------------------------------------------- */
/* 🧩 CIRCUIT BREAKER (Safe fallback for payment routes)                      */
/* -------------------------------------------------------------------------- */
let paymentFailureCount = 0;
let isPaymentHealthy = true;
const MAX_PAYMENT_FAILURES = 5;

function circuitBreakerFail() {
  paymentFailureCount++;
  if (paymentFailureCount >= MAX_PAYMENT_FAILURES) {
    isPaymentHealthy = false;
    console.error("🚨 Payment routes circuit breaker triggered!");
    setTimeout(() => {
      isPaymentHealthy = true;
      paymentFailureCount = 0;
      console.log("✅ Payment circuit breaker reset");
    }, 30000);
  }
}

/* -------------------------------------------------------------------------- */
/* 💰 POST /create-order (Creates Razorpay Order)                             */
/* -------------------------------------------------------------------------- */
router.post(
  "/create-order",
  requireAuth(),
  limiter.wrap(async (req, res) => {
    try {
      if (!isPaymentHealthy)
        return res.status(503).json({ error: "Payment service unavailable." });

      const { userId: clerkId } = getAuth(req);
      const user = await User.findOne({ clerkId }).select("_id").lean();

      if (!user) return res.status(404).json({ error: "User not found." });

      const options = {
        amount: 200 * 100, // ₹200
        currency: "INR",
        receipt: `order_rcptid_${Date.now()}`,
      };

      const order = await razorpay.orders.create(options);

      console.log(`🪙 Created Razorpay Order: ${order.id} for User ${clerkId}`);

      res.json({
        success: true,
        orderId: order.id,
        amount: order.amount,
        currency: order.currency,
        key: process.env.RAZORPAY_KEY_ID,
      });
    } catch (err) {
      circuitBreakerFail();
      console.error("❌ [CREATE-ORDER] Error:", err.message);
      res.status(500).json({ error: "Failed to create Razorpay order." });
    }
  })
);

/* -------------------------------------------------------------------------- */
/* ✅ POST /verify-payment (Verifies Signature & Updates Credits)             */
/* -------------------------------------------------------------------------- */
router.post(
  "/verify-payment",
  requireAuth(),
  limiter.wrap(async (req, res) => {
    try {
      const clerkId = req.auth.userId;
      const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;

      if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
        return res.status(400).json({ error: "Missing payment parameters." });
      }

      const user = await User.findOne({ clerkId });
      if (!user) {
        console.error("❌ No user found for clerkId:", clerkId);
        return res.status(404).json({ error: "User not found." });
      }

      const generatedSignature = crypto
        .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
        .update(`${razorpay_order_id}|${razorpay_payment_id}`)
        .digest("hex");

      if (generatedSignature.trim() !== razorpay_signature.trim()) {
        console.error("⚠️ Payment signature mismatch!");
        return res.status(400).json({ error: "Invalid signature." });
      }

      // ✅ Add credits & store payment
      user.credits = (user.credits || 0) + 10;
      user.payments.push({
        razorpay_order_id,
        razorpay_payment_id,
        amount: 200,
        creditsAdded: 10,
        status: "success",
        date: new Date(),
      });

      await user.save({ validateBeforeSave: false });

      console.log(`💳 Verified: +10 credits for clerkId=${clerkId}`);

      res.json({
        success: true,
        message: "Payment verified successfully.",
        newCredits: user.credits,
      });
    } catch (err) {
      console.error("❌ [VERIFY-PAYMENT] Error:", err.message);
      res.status(500).json({ error: "Failed to verify payment." });
    }
  })
);

/* -------------------------------------------------------------------------- */
/* 💳 POST /deduct-credits (Deduct credits when user uses AI feature)         */
/* -------------------------------------------------------------------------- */
router.post(
  "/deduct-credits",
  requireAuth(),
  limiter.wrap(async (req, res) => {
    try {
      const { userId: clerkId } = getAuth(req);
      const { amount, reason } = req.body;

      if (!amount || amount <= 0) {
        return res.status(400).json({ error: "Invalid amount." });
      }

      const user = await User.findOne({ clerkId });
      if (!user) {
        return res.status(404).json({ error: "User not found." });
      }

      if ((user.credits || 0) < amount) {
        return res.status(400).json({ error: "Insufficient credits." });
      }

      // ✅ Deduct credits
      user.credits -= amount;

      // 🧾 Log deduction
      user.payments.push({
        razorpay_order_id: `manual_${Date.now()}`,
        razorpay_payment_id: null,
        amount: 0,
        creditsAdded: -amount,
        status: "deducted",
        date: new Date(),
      });

      await user.save({ validateBeforeSave: false });

      console.log(`💸 Deducted ${amount} credit(s) from ${clerkId}. Reason: ${reason}`);

      res.json({
        success: true,
        message: `Deducted ${amount} credit(s).`,
        newCredits: user.credits,
      });
    } catch (err) {
      console.error("❌ [DEDUCT-CREDITS] Error:", err.message);
      res.status(500).json({ error: "Failed to deduct credits." });
    }
  })
);

/* -------------------------------------------------------------------------- */
/* 📜 GET /user-payments (Fetch payment history)                              */
/* -------------------------------------------------------------------------- */
router.get(
  "/user-payments",
  requireAuth(),
  limiter.wrap(async (req, res) => {
    try {
      const { userId: clerkId } = getAuth(req);
      const user = await User.findOne({ clerkId })
        .select("credits payments")
        .lean();

      if (!user) return res.status(404).json({ error: "User not found" });

      res.json({
        success: true,
        credits: user.credits || 0,
        payments: user.payments || [],
      });
    } catch (err) {
      console.error("❌ [USER-PAYMENTS] Error:", err.message);
      res.status(500).json({ error: "Failed to fetch payments." });
    }
  })
);

/* -------------------------------------------------------------------------- */
/* 💡 HEALTH CHECK (Monitor Payment Circuit)                                  */
/* -------------------------------------------------------------------------- */
router.get("/payment-health", requireAuth(), async (req, res) => {
  res.json({
    healthy: isPaymentHealthy,
    failureCount: paymentFailureCount,
    timestamp: new Date().toISOString(),
  });
});

/* -------------------------------------------------------------------------- */
/* 🚀 STARTUP LOGS                                                            */
/* -------------------------------------------------------------------------- */
console.log("\n" + "=".repeat(70));
console.log("💳 RAZORPAY PAYMENT ROUTES LOADED");
console.log("📍 Endpoints:");
console.log("   POST   /create-order");
console.log("   POST   /verify-payment");
console.log("   POST   /deduct-credits");
console.log("   GET    /user-payments");
console.log("   GET    /payment-health");
console.log("🛡️  Features:");
console.log("   • Secure HMAC Signature Verification");
console.log("   • Auto Credit Addition (+10 on success)");
console.log("   • Credit Deduction for AI usage");
console.log("   • Circuit Breaker & Bottleneck Safe");
console.log("   • Razorpay Order Integration");
console.log("=".repeat(70) + "\n");

export default router;

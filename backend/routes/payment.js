// routes/payment.js - Razorpay Integration + Credit System (Enhanced with Testing)

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
    console.log("\n" + "═".repeat(70));
    console.log("📍 CREATE ORDER START");
    console.log("═".repeat(70));
    
    try {
      if (!isPaymentHealthy) {
        console.error("❌ Payment service unavailable (Circuit Breaker)");
        return res.status(503).json({ error: "Payment service unavailable." });
      }

      const { userId: clerkId } = getAuth(req);
      console.log("👤 User ClerkID:", clerkId);
      
      const user = await User.findOne({ clerkId }).select("_id").lean();

      if (!user) {
        console.error("❌ User not found in database");
        return res.status(404).json({ error: "User not found." });
      }

      console.log("✅ User found in database");
      
      // 🧪 TESTING MODE: ₹1 payment
      // 🚀 PRODUCTION MODE: Change to 200 * 100 for ₹200
      const PAYMENT_AMOUNT = 1; // Change this to 200 for production
      
      const options = {
        amount: PAYMENT_AMOUNT * 100, // Convert to paise
        currency: "INR",
        receipt: `order_rcptid_${Date.now()}`,
      };

      console.log("💰 Creating order for ₹" + PAYMENT_AMOUNT);
      console.log("🔑 Using Razorpay Key ID:", process.env.RAZORPAY_KEY_ID);
      
      // Check if using test or live mode
      if (process.env.RAZORPAY_KEY_ID?.startsWith('rzp_test_')) {
        console.log("⚠️  TEST MODE - Using test keys");
      } else if (process.env.RAZORPAY_KEY_ID?.startsWith('rzp_live_')) {
        console.log("🟢 LIVE MODE - Using live keys");
      } else {
        console.error("❌ Invalid Razorpay Key ID format!");
      }

      const order = await razorpay.orders.create(options);

      console.log("✅ Order Created Successfully!");
      console.log("🆔 Order ID:", order.id);
      console.log("💵 Amount:", order.amount, "paise (₹" + (order.amount/100) + ")");
      console.log("═".repeat(70) + "\n");

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
      console.error("📋 Full Error:", err);
      console.log("═".repeat(70) + "\n");
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
    console.log("\n" + "═".repeat(70));
    console.log("📍 VERIFY PAYMENT START");
    console.log("═".repeat(70));
    
    try {
      const clerkId = req.auth.userId;
      const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;

      console.log("👤 User ClerkID:", clerkId);
      console.log("🆔 Order ID:", razorpay_order_id);
      console.log("💳 Payment ID:", razorpay_payment_id);
      console.log("🔐 Signature (first 20 chars):", razorpay_signature?.substring(0, 20) + "...");

      if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
        console.error("❌ Missing payment parameters");
        return res.status(400).json({ error: "Missing payment parameters." });
      }

      const user = await User.findOne({ clerkId });
      if (!user) {
        console.error("❌ No user found for clerkId:", clerkId);
        return res.status(404).json({ error: "User not found." });
      }

      console.log("✅ User found in database");

      // 🛡️ CHECK FOR DUPLICATE PAYMENT (NEW SECURITY FIX)
      const existingPayment = user.payments.find(
        p => p.razorpay_payment_id === razorpay_payment_id
      );

      if (existingPayment) {
        console.warn("⚠️  DUPLICATE PAYMENT DETECTED!");
        console.warn("💳 Payment ID already processed:", razorpay_payment_id);
        console.log("═".repeat(70) + "\n");
        return res.status(400).json({ 
          error: "Payment already processed.",
          credits: user.credits 
        });
      }

      console.log("✅ No duplicate payment found");

      // 🔐 SIGNATURE VERIFICATION
      console.log("🔐 Verifying payment signature...");
      console.log("🔑 Using Key Secret (first 10 chars):", 
        process.env.RAZORPAY_KEY_SECRET?.substring(0, 10) + "...");

      const generatedSignature = crypto
        .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
        .update(`${razorpay_order_id}|${razorpay_payment_id}`)
        .digest("hex");

      console.log("🔐 Generated Signature (first 20 chars):", 
        generatedSignature.substring(0, 20) + "...");
      
      const isSignatureValid = generatedSignature.trim() === razorpay_signature.trim();
      console.log("✅ Signature Match:", isSignatureValid);

      if (!isSignatureValid) {
        console.error("❌ SIGNATURE MISMATCH!");
        console.error("Expected:", generatedSignature.substring(0, 30) + "...");
        console.error("Received:", razorpay_signature.substring(0, 30) + "...");
        console.log("═".repeat(70) + "\n");
        return res.status(400).json({ error: "Invalid signature." });
      }

      // 💰 UPDATE CREDITS
      console.log("💰 Current Credits:", user.credits || 0);
      
      const CREDITS_TO_ADD = 10; // Change this if needed
      user.credits = (user.credits || 0) + CREDITS_TO_ADD;
      
      user.payments.push({
        razorpay_order_id,
        razorpay_payment_id,
        amount: 1, // ₹1 for testing (change to 200 for production)
        creditsAdded: CREDITS_TO_ADD,
        status: "success",
        date: new Date(),
      });

      console.log("💾 Saving to database...");
      await user.save({ validateBeforeSave: false });

      console.log("✅ DATABASE UPDATED SUCCESSFULLY!");
      console.log("💰 New Credits:", user.credits);
      console.log("📊 Total Payments:", user.payments.length);
      console.log("═".repeat(70) + "\n");

      res.json({
        success: true,
        message: "Payment verified successfully.",
        newCredits: user.credits,
      });
    } catch (err) {
      console.error("❌ [VERIFY-PAYMENT] Error:", err.message);
      console.error("📋 Full Error:", err);
      console.error("📚 Stack Trace:", err.stack);
      console.log("═".repeat(70) + "\n");
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
    console.log("\n" + "═".repeat(70));
    console.log("📍 DEDUCT CREDITS START");
    console.log("═".repeat(70));
    
    try {
      const { userId: clerkId } = getAuth(req);
      const { amount, reason } = req.body;

      console.log("👤 User ClerkID:", clerkId);
      console.log("💸 Amount to deduct:", amount);
      console.log("📝 Reason:", reason);

      if (!amount || amount <= 0) {
        console.error("❌ Invalid amount");
        return res.status(400).json({ error: "Invalid amount." });
      }

      const user = await User.findOne({ clerkId });
      if (!user) {
        console.error("❌ User not found");
        return res.status(404).json({ error: "User not found." });
      }

      console.log("💰 Current Credits:", user.credits || 0);

      if ((user.credits || 0) < amount) {
        console.error("❌ Insufficient credits");
        return res.status(400).json({ error: "Insufficient credits." });
      }

      // ✅ Deduct credits
      user.credits -= amount;

      // 🧾 Log deduction
      user.payments.push({
        razorpay_order_id: `deduction_${Date.now()}`,
        razorpay_payment_id: null,
        amount: 0,
        creditsAdded: -amount,
        status: "deducted",
        date: new Date(),
      });

      await user.save({ validateBeforeSave: false });

      console.log("✅ Credits deducted successfully");
      console.log("💰 New Credits:", user.credits);
      console.log("═".repeat(70) + "\n");

      res.json({
        success: true,
        message: `Deducted ${amount} credit(s).`,
        newCredits: user.credits,
      });
    } catch (err) {
      console.error("❌ [DEDUCT-CREDITS] Error:", err.message);
      console.log("═".repeat(70) + "\n");
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
console.log("=".repeat(70));
console.log("📍 Endpoints:");
console.log("   POST   /api/create-order");
console.log("   POST   /api/verify-payment");
console.log("   POST   /api/deduct-credits");
console.log("   GET    /api/user-payments");
console.log("   GET    /api/payment-health");
console.log("=".repeat(70));
console.log("🛡️  Features:");
console.log("   • Secure HMAC Signature Verification");
console.log("   • Duplicate Payment Prevention (NEW!)");
console.log("   • Enhanced Logging for Debugging");
console.log("   • Auto Credit Addition (+10 on success)");
console.log("   • Credit Deduction for AI usage");
console.log("   • Circuit Breaker & Bottleneck Safe");
console.log("=".repeat(70));
console.log("🧪 TESTING MODE:");
console.log("   • Payment Amount: ₹1 (Change to ₹200 for production)");
console.log("   • Credits Added: 10 per payment");
console.log("=".repeat(70));
console.log("🔑 Razorpay Configuration:");
console.log("   • Key ID:", process.env.RAZORPAY_KEY_ID || "❌ NOT SET");
if (process.env.RAZORPAY_KEY_ID?.startsWith('rzp_test_')) {
  console.log("   • Mode: ⚠️  TEST MODE");
} else if (process.env.RAZORPAY_KEY_ID?.startsWith('rzp_live_')) {
  console.log("   • Mode: 🟢 LIVE MODE");
} else {
  console.log("   • Mode: ❌ INVALID KEY FORMAT");
}
console.log("=".repeat(70) + "\n");

export default router;
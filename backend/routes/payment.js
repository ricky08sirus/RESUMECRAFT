// routes/payment.js - Production Ready with Easy Test/Live Switching

import express from "express";
import Razorpay from "razorpay";
import crypto from "crypto";
import Bottleneck from "bottleneck";
import { requireAuth, getAuth } from "@clerk/express";
import User from "../models/User.js";

const router = express.Router();

/* ========================================================================== */
/* 🎯 PAYMENT CONFIGURATION - CHANGE THIS FOR TEST/PRODUCTION                */
/* ========================================================================== */

const PAYMENT_CONFIG = {
  // 🧪 TEST MODE: ₹1
  // 🚀 PRODUCTION MODE: ₹200
  AMOUNT: 1, // 👈 CHANGE THIS: 1 for testing, 200 for production
  
  CREDITS_PER_PAYMENT: 10, // 👈 CHANGE THIS: Credits to add per successful payment
  
  // Don't change below unless you know what you're doing
  CURRENCY: "INR",
};

console.log("\n" + "🎯".repeat(35));
console.log("💰 PAYMENT CONFIGURATION:");
console.log("   Amount: ₹" + PAYMENT_CONFIG.AMOUNT);
console.log("   Credits: " + PAYMENT_CONFIG.CREDITS_PER_PAYMENT + " per payment");
console.log("   Currency: " + PAYMENT_CONFIG.CURRENCY);
if (PAYMENT_CONFIG.AMOUNT === 1) {
  console.log("   Mode: 🧪 TESTING MODE (₹1)");
} else {
  console.log("   Mode: 🚀 PRODUCTION MODE (₹" + PAYMENT_CONFIG.AMOUNT + ")");
}
console.log("🎯".repeat(35) + "\n");

/* ========================================================================== */
/* 🧠 RAZORPAY INSTANCE                                                       */
/* ========================================================================== */
const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET,
});

/* ========================================================================== */
/* ⚙️ RATE LIMITER (Bottleneck-based for fairness)                           */
/* ========================================================================== */
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

/* ========================================================================== */
/* 🧩 CIRCUIT BREAKER (Safe fallback for payment routes)                     */
/* ========================================================================== */
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

/* ========================================================================== */
/* 💰 POST /create-order (Creates Razorpay Order)                            */
/* ========================================================================== */
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
      
      // 💰 Use configured amount
      const options = {
        amount: PAYMENT_CONFIG.AMOUNT * 100, // Convert rupees to paise
        currency: PAYMENT_CONFIG.CURRENCY,
        receipt: `order_rcptid_${Date.now()}`,
      };

      console.log("💰 Creating order for ₹" + PAYMENT_CONFIG.AMOUNT);
      console.log("🎁 Credits to be added: " + PAYMENT_CONFIG.CREDITS_PER_PAYMENT);
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

/* ========================================================================== */
/* ✅ POST /verify-payment (Verifies Signature & Updates Credits)            */
/* ========================================================================== */
router.post(
  "/verify-payment",
  requireAuth(),
  limiter.wrap(async (req, res) => {
    console.log("\n" + "═".repeat(70));
    console.log("📍 VERIFY PAYMENT START");
    console.log("═".repeat(70));
    
    try {
      // ✅ Get Clerk user ID
      const { userId: clerkId } = getAuth(req);
      
      if (!clerkId) {
        console.error("❌ No Clerk ID found in request");
        return res.status(401).json({ error: "Unauthorized - No Clerk ID" });
      }

      const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;

      console.log("👤 User ClerkID:", clerkId);
      console.log("🆔 Order ID:", razorpay_order_id);
      console.log("💳 Payment ID:", razorpay_payment_id);
      console.log("🔐 Signature (first 20 chars):", razorpay_signature?.substring(0, 20) + "...");

      if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
        console.error("❌ Missing payment parameters");
        return res.status(400).json({ error: "Missing payment parameters." });
      }

      // 🔍 Find user in database
      const user = await User.findOne({ clerkId });
      
      if (!user) {
        console.error("❌ No user found for clerkId:", clerkId);
        return res.status(404).json({ error: "User not found." });
      }

      console.log("✅ User found in database");
      console.log("👤 User MongoDB ID:", user._id);
      console.log("💰 Current Credits BEFORE:", user.credits || 0);

      // 🛡️ CHECK FOR DUPLICATE PAYMENT
      const existingPayment = user.payments.find(
        p => p.razorpay_payment_id === razorpay_payment_id
      );

      if (existingPayment) {
        console.warn("⚠️  DUPLICATE PAYMENT DETECTED!");
        console.warn("💳 Payment ID already processed:", razorpay_payment_id);
        console.log("═".repeat(70) + "\n");
        return res.status(400).json({ 
          error: "Payment already processed.",
          newCredits: user.credits 
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

      // 💰 UPDATE CREDITS - CRITICAL SECTION
      console.log("💰 UPDATING CREDITS NOW...");
      
      const oldCredits = user.credits || 0;
      const newCredits = oldCredits + PAYMENT_CONFIG.CREDITS_PER_PAYMENT;
      
      // ✅ Update credits
      user.credits = newCredits;
      
      // ✅ Add payment record
      user.payments.push({
        razorpay_order_id,
        razorpay_payment_id,
        amount: PAYMENT_CONFIG.AMOUNT,
        creditsAdded: PAYMENT_CONFIG.CREDITS_PER_PAYMENT,
        status: "success",
        date: new Date(),
      });

      console.log("💾 Saving to database...");
      console.log("📊 Old Credits:", oldCredits);
      console.log("📊 New Credits:", newCredits);
      console.log("📊 Credits Added:", PAYMENT_CONFIG.CREDITS_PER_PAYMENT);
      
      // ✅ FORCE SAVE with retry mechanism
      try {
        await user.save({ validateBeforeSave: false });
        console.log("✅ First save attempt successful!");
      } catch (saveErr) {
        console.error("❌ First save failed, retrying...", saveErr.message);
        // Retry once more
        await user.save({ validateBeforeSave: false });
        console.log("✅ Second save attempt successful!");
      }

      // 🔍 VERIFY DATABASE UPDATE
      const verifyUser = await User.findOne({ clerkId }).select("credits payments").lean();
      console.log("🔍 VERIFICATION: Credits in DB:", verifyUser.credits);
      console.log("🔍 VERIFICATION: Total Payments:", verifyUser.payments.length);

      if (verifyUser.credits !== newCredits) {
        console.error("❌ DATABASE VERIFICATION FAILED!");
        console.error("Expected:", newCredits);
        console.error("Got:", verifyUser.credits);
        throw new Error("Database verification failed - credits mismatch");
      }

      console.log("✅ DATABASE UPDATED & VERIFIED SUCCESSFULLY!");
      console.log("💰 Final Credits:", verifyUser.credits);
      console.log("📊 Total Payments:", verifyUser.payments.length);
      console.log("═".repeat(70) + "\n");

      // ✅ Return success with verified credits
      return res.status(200).json({
        success: true,
        message: "Payment verified successfully.",
        newCredits: verifyUser.credits,
      });
      
    } catch (err) {
      console.error("❌ [VERIFY-PAYMENT] Error:", err.message);
      console.error("📋 Full Error:", err);
      console.error("📚 Stack Trace:", err.stack);
      console.log("═".repeat(70) + "\n");
      return res.status(500).json({ error: "Failed to verify payment." });
    }
  })
);

/* ========================================================================== */
/* 💳 POST /deduct-credits (Deduct credits when user uses AI feature)        */
/* ========================================================================== */
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

/* ========================================================================== */
/* 📜 GET /user-payments (Fetch payment history)                             */
/* ========================================================================== */
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

/* ========================================================================== */
/* 💡 HEALTH CHECK (Monitor Payment Circuit)                                 */
/* ========================================================================== */
router.get("/payment-health", requireAuth(), async (req, res) => {
  res.json({
    healthy: isPaymentHealthy,
    failureCount: paymentFailureCount,
    timestamp: new Date().toISOString(),
  });
});

/* ========================================================================== */
/* 🚀 STARTUP LOGS                                                           */
/* ========================================================================== */
console.log("\n" + "=".repeat(70));
console.log("💳 RAZORPAY PAYMENT ROUTES LOADED");
console.log("=".repeat(70));
console.log("📍 Endpoints:");
console.log("   POST   /payments/create-order");
console.log("   POST   /payments/verify-payment");
console.log("   POST   /payments/deduct-credits");
console.log("   GET    /payments/user-payments");
console.log("   GET    /payments/payment-health");
console.log("=".repeat(70));
console.log("🛡️  Features:");
console.log("   • Secure HMAC Signature Verification");
console.log("   • Duplicate Payment Prevention");
console.log("   • Database Verification After Save");
console.log("   • Auto Retry on Save Failure");
console.log("   • Circuit Breaker & Rate Limiting");
console.log("   • Enhanced Logging for Debugging");
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
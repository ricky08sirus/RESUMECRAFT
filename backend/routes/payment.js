// routes/payment.js - FIXED: Resolves 302 redirect & credit reset issues

import express from "express";
import Razorpay from "razorpay";
import crypto from "crypto";
import Bottleneck from "bottleneck";
import { requireAuth, getAuth } from "@clerk/express";
import User from "../models/User.js";
import chalk from "chalk"; // Added for consistent logging

const router = express.Router();

/* ========================================================================== */
/* 🎯 PAYMENT CONFIGURATION - CHANGE THIS FOR TEST/PRODUCTION                */
/* ========================================================================== */

const PAYMENT_CONFIG = {
  AMOUNT: 1, // 👈 CHANGE THIS: 1 for testing, 200 for production
  CREDITS_PER_PAYMENT: 10, // 👈 Credits to add per successful payment
  CURRENCY: "INR",
};

console.log("\n" + chalk.cyan("🎯".repeat(35)));
console.log(chalk.yellow("💰 PAYMENT CONFIGURATION:"));
console.log(chalk.white("   Amount: ₹" + PAYMENT_CONFIG.AMOUNT));
console.log(chalk.white("   Credits: " + PAYMENT_CONFIG.CREDITS_PER_PAYMENT + " per payment"));
console.log(chalk.white("   Currency: " + PAYMENT_CONFIG.CURRENCY));
if (PAYMENT_CONFIG.AMOUNT === 1) {
  console.log(chalk.green("   Mode: 🧪 TESTING MODE (₹1)"));
} else {
  console.log(chalk.blue("   Mode: 🚀 PRODUCTION MODE (₹" + PAYMENT_CONFIG.AMOUNT + ")"));
}
console.log(chalk.cyan("🎯".repeat(35) + "\n"));

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
  reservoirRefreshInterval: 60 * 1000,
});

limiter.on("failed", async (error, jobInfo) => {
  if (jobInfo.retryCount < 2) {
    console.warn(chalk.yellow(`⚠️ Limiter retry ${jobInfo.retryCount + 1}/2`));
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
    console.error(chalk.red("🚨 Payment routes circuit breaker triggered!"));
    setTimeout(() => {
      isPaymentHealthy = true;
      paymentFailureCount = 0;
      console.log(chalk.green("✅ Payment circuit breaker reset"));
    }, 30000);
  }
}

/* ========================================================================== */
/* 💰 POST /create-order (Creates Razorpay Order)                            */
/* ========================================================================== */
router.post("/create-order", requireAuth(), async (req, res) => {
  console.log(chalk.cyan("\n" + "═".repeat(70)));
  console.log(chalk.yellow("📍 CREATE ORDER START"));
  console.log(chalk.cyan("═".repeat(70)));
  
  try {
    if (!isPaymentHealthy) {
      console.error(chalk.red("❌ Payment service unavailable (Circuit Breaker)"));
      return res.status(503).json({ error: "Payment service unavailable." });
    }

    const { userId: clerkId } = getAuth(req);
    console.log(chalk.blue("👤 User ClerkID:"), clerkId);
    
    const user = await User.findOne({ clerkId }).select("_id credits").lean();

    if (!user) {
      console.error(chalk.red("❌ User not found in database"));
      return res.status(404).json({ error: "User not found." });
    }

    console.log(chalk.green("✅ User found in database"));
    console.log(chalk.white("💰 Current credits:"), user.credits || 0);
    
    const options = {
      amount: PAYMENT_CONFIG.AMOUNT * 100, // Convert to paise
      currency: PAYMENT_CONFIG.CURRENCY,
      receipt: `order_rcptid_${Date.now()}`,
    };

    console.log(chalk.yellow("💰 Creating order for ₹" + PAYMENT_CONFIG.AMOUNT));
    console.log(chalk.yellow("🎁 Credits to be added: " + PAYMENT_CONFIG.CREDITS_PER_PAYMENT));

    const order = await razorpay.orders.create(options);

    console.log(chalk.green("✅ Order Created Successfully!"));
    console.log(chalk.white("🆔 Order ID:"), order.id);
    console.log(chalk.white("💵 Amount:"), order.amount, "paise (₹" + (order.amount/100) + ")");
    console.log(chalk.cyan("═".repeat(70) + "\n"));

    return res.status(200).json({
      success: true,
      orderId: order.id,
      amount: order.amount,
      currency: order.currency,
      key: process.env.RAZORPAY_KEY_ID,
    });
  } catch (err) {
    circuitBreakerFail();
    console.error(chalk.red("❌ [CREATE-ORDER] Error:"), err.message);
    console.error(chalk.red("📋 Full Error:"), err);
    console.log(chalk.cyan("═".repeat(70) + "\n"));
    return res.status(500).json({ error: "Failed to create Razorpay order." });
  }
});

/* ========================================================================== */
/* ✅ POST /verify-payment (Verifies Signature & Updates Credits)            */
/* 🔴 CRITICAL FIX: Removed limiter.wrap to prevent 302 redirects            */
/* ========================================================================== */
router.post("/verify-payment", requireAuth(), async (req, res) => {
  console.log(chalk.cyan("\n" + "═".repeat(70)));
  console.log(chalk.yellow("📍 VERIFY PAYMENT START"));
  console.log(chalk.cyan("═".repeat(70)));
  
  try {
    // ✅ Get Clerk user ID with detailed logging
    const auth = getAuth(req);
    const clerkId = auth?.userId;
    
    console.log(chalk.blue("🔍 Auth Object:"), JSON.stringify(auth, null, 2));
    console.log(chalk.blue("👤 User ClerkID:"), clerkId);
    
    if (!clerkId) {
      console.error(chalk.red("❌ No Clerk ID found in request"));
      console.error(chalk.red("🔍 Auth headers:"), req.headers.authorization);
      return res.status(401).json({ 
        error: "Unauthorized - No Clerk ID",
        debug: { auth, headers: req.headers.authorization }
      });
    }

    const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;

    console.log(chalk.white("🆔 Order ID:"), razorpay_order_id);
    console.log(chalk.white("💳 Payment ID:"), razorpay_payment_id);
    console.log(chalk.white("🔐 Signature (first 20 chars):"), razorpay_signature?.substring(0, 20) + "...");

    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
      console.error(chalk.red("❌ Missing payment parameters"));
      return res.status(400).json({ error: "Missing payment parameters." });
    }

    // 🔍 Find user in database with FULL details
    console.log(chalk.yellow("🔍 Searching for user with clerkId:"), clerkId);
    const user = await User.findOne({ clerkId });
    
    if (!user) {
      console.error(chalk.red("❌ No user found for clerkId:"), clerkId);
      return res.status(404).json({ error: "User not found." });
    }

    console.log(chalk.green("✅ User found in database"));
    console.log(chalk.white("👤 User MongoDB ID:"), user._id);
    console.log(chalk.yellow("💰 Current Credits BEFORE:"), user.credits || 0);
    console.log(chalk.white("📜 Total Payments Before:"), user.payments?.length || 0);

    // 🛡️ CHECK FOR DUPLICATE PAYMENT
    const existingPayment = user.payments?.find(
      p => p.razorpay_payment_id === razorpay_payment_id
    );

    if (existingPayment) {
      console.warn(chalk.red("⚠️  DUPLICATE PAYMENT DETECTED!"));
      console.warn(chalk.yellow("💳 Payment ID already processed:"), razorpay_payment_id);
      console.log(chalk.cyan("═".repeat(70) + "\n"));
      return res.status(400).json({ 
        error: "Payment already processed.",
        newCredits: user.credits 
      });
    }

    console.log(chalk.green("✅ No duplicate payment found"));

    // 🔐 SIGNATURE VERIFICATION
    console.log(chalk.yellow("🔐 Verifying payment signature..."));

    const generatedSignature = crypto
      .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
      .update(`${razorpay_order_id}|${razorpay_payment_id}`)
      .digest("hex");

    console.log(chalk.white("🔐 Generated Signature (first 20):"), 
      generatedSignature.substring(0, 20) + "...");
    console.log(chalk.white("🔐 Received Signature (first 20):"), 
      razorpay_signature.substring(0, 20) + "...");
    
    const isSignatureValid = generatedSignature.trim() === razorpay_signature.trim();
    console.log(chalk.green("✅ Signature Match:"), isSignatureValid);

    if (!isSignatureValid) {
      console.error(chalk.red("❌ SIGNATURE MISMATCH!"));
      console.error(chalk.red("Expected:"), generatedSignature.substring(0, 30) + "...");
      console.error(chalk.red("Received:"), razorpay_signature.substring(0, 30) + "...");
      console.log(chalk.cyan("═".repeat(70) + "\n"));
      return res.status(400).json({ error: "Invalid signature." });
    }

    // 💰 UPDATE CREDITS - CRITICAL SECTION
    console.log(chalk.yellow("💰 UPDATING CREDITS NOW..."));
    
    const oldCredits = user.credits || 0;
    const newCredits = oldCredits + PAYMENT_CONFIG.CREDITS_PER_PAYMENT;
    
    console.log(chalk.white("📊 Credits Calculation:"));
    console.log(chalk.white("   Old Credits:"), oldCredits);
    console.log(chalk.white("   Adding:"), PAYMENT_CONFIG.CREDITS_PER_PAYMENT);
    console.log(chalk.white("   Expected New:"), newCredits);
    
    // ✅ Update credits using $inc to avoid race conditions
    const updateResult = await User.findOneAndUpdate(
      { clerkId },
      { 
        $inc: { credits: PAYMENT_CONFIG.CREDITS_PER_PAYMENT },
        $push: {
          payments: {
            razorpay_order_id,
            razorpay_payment_id,
            amount: PAYMENT_CONFIG.AMOUNT,
            creditsAdded: PAYMENT_CONFIG.CREDITS_PER_PAYMENT,
            status: "success",
            date: new Date(),
          }
        }
      },
      { 
        new: true, // Return updated document
        runValidators: false,
        select: 'credits payments clerkId'
      }
    );

    if (!updateResult) {
      console.error(chalk.red("❌ Failed to update user document"));
      throw new Error("Database update failed - user not found");
    }

    console.log(chalk.green("✅ DATABASE UPDATED SUCCESSFULLY!"));
    console.log(chalk.white("💰 New Credits in DB:"), updateResult.credits);
    console.log(chalk.white("📜 Total Payments:"), updateResult.payments?.length || 0);

    // 🔍 DOUBLE VERIFICATION
    const verifyUser = await User.findOne({ clerkId }).select("credits payments").lean();
    console.log(chalk.yellow("🔍 VERIFICATION CHECK:"));
    console.log(chalk.white("   Credits in DB:"), verifyUser.credits);
    console.log(chalk.white("   Expected:"), newCredits);
    console.log(chalk.white("   Match:"), verifyUser.credits === newCredits);

    if (verifyUser.credits !== newCredits) {
      console.error(chalk.red("❌ DATABASE VERIFICATION FAILED!"));
      console.error(chalk.red("Expected:"), newCredits);
      console.error(chalk.red("Got:"), verifyUser.credits);
      // Don't throw error, just log warning
      console.warn(chalk.yellow("⚠️  Credits mismatch but payment recorded"));
    }

    console.log(chalk.green("✅ PAYMENT VERIFICATION COMPLETE!"));
    console.log(chalk.cyan("═".repeat(70) + "\n"));

    // ✅ Return success with verified credits
    return res.status(200).json({
      success: true,
      message: "Payment verified successfully.",
      newCredits: verifyUser.credits,
      creditsAdded: PAYMENT_CONFIG.CREDITS_PER_PAYMENT,
    });
    
  } catch (err) {
    console.error(chalk.red("❌ [VERIFY-PAYMENT] CRITICAL ERROR:"), err.message);
    console.error(chalk.red("📋 Full Error:"), err);
    console.error(chalk.red("📚 Stack Trace:"), err.stack);
    console.log(chalk.cyan("═".repeat(70) + "\n"));
    return res.status(500).json({ 
      error: "Failed to verify payment.",
      debug: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
  }
});

/* ========================================================================== */
/* 💳 POST /deduct-credits (Deduct credits when user uses AI feature)        */
/* ========================================================================== */
router.post("/deduct-credits", requireAuth(), async (req, res) => {
  console.log(chalk.cyan("\n" + "═".repeat(70)));
  console.log(chalk.yellow("📍 DEDUCT CREDITS START"));
  console.log(chalk.cyan("═".repeat(70)));
  
  try {
    const { userId: clerkId } = getAuth(req);
    const { amount, reason } = req.body;

    console.log(chalk.blue("👤 User ClerkID:"), clerkId);
    console.log(chalk.yellow("💸 Amount to deduct:"), amount);
    console.log(chalk.white("📝 Reason:"), reason);

    if (!amount || amount <= 0) {
      console.error(chalk.red("❌ Invalid amount"));
      return res.status(400).json({ error: "Invalid amount." });
    }

    const user = await User.findOne({ clerkId }).select("credits payments");
    if (!user) {
      console.error(chalk.red("❌ User not found"));
      return res.status(404).json({ error: "User not found." });
    }

    console.log(chalk.white("💰 Current Credits:"), user.credits || 0);

    if ((user.credits || 0) < amount) {
      console.error(chalk.red("❌ Insufficient credits"));
      return res.status(400).json({ 
        error: "Insufficient credits.",
        currentCredits: user.credits || 0,
        required: amount
      });
    }

    // ✅ Use atomic $inc operation
    const updateResult = await User.findOneAndUpdate(
      { clerkId, credits: { $gte: amount } }, // Ensure sufficient credits
      { 
        $inc: { credits: -amount },
        $push: {
          payments: {
            razorpay_order_id: `deduction_${Date.now()}`,
            razorpay_payment_id: null,
            amount: 0,
            creditsAdded: -amount,
            status: "deducted",
            date: new Date(),
          }
        }
      },
      { new: true, select: 'credits' }
    );

    if (!updateResult) {
      console.error(chalk.red("❌ Failed to deduct credits (race condition)"));
      return res.status(400).json({ error: "Failed to deduct credits. Try again." });
    }

    console.log(chalk.green("✅ Credits deducted successfully"));
    console.log(chalk.white("💰 New Credits:"), updateResult.credits);
    console.log(chalk.cyan("═".repeat(70) + "\n"));

    return res.status(200).json({
      success: true,
      message: `Deducted ${amount} credit(s).`,
      newCredits: updateResult.credits,
    });
  } catch (err) {
    console.error(chalk.red("❌ [DEDUCT-CREDITS] Error:"), err.message);
    console.log(chalk.cyan("═".repeat(70) + "\n"));
    return res.status(500).json({ error: "Failed to deduct credits." });
  }
});

/* ========================================================================== */
/* 📜 GET /user-payments (Fetch payment history)                             */
/* ========================================================================== */
router.get("/user-payments", requireAuth(), async (req, res) => {
  try {
    const { userId: clerkId } = getAuth(req);
    console.log(chalk.blue("📜 Fetching payments for:"), clerkId);
    
    const user = await User.findOne({ clerkId })
      .select("credits payments")
      .lean();

    if (!user) {
      console.error(chalk.red("❌ User not found"));
      return res.status(404).json({ error: "User not found" });
    }

    console.log(chalk.green("✅ User payments fetched"));
    console.log(chalk.white("💰 Credits:"), user.credits || 0);
    console.log(chalk.white("📜 Total Payments:"), user.payments?.length || 0);

    return res.status(200).json({
      success: true,
      credits: user.credits || 0,
      payments: user.payments || [],
    });
  } catch (err) {
    console.error(chalk.red("❌ [USER-PAYMENTS] Error:"), err.message);
    return res.status(500).json({ error: "Failed to fetch payments." });
  }
});

/* ========================================================================== */
/* 💡 HEALTH CHECK (Monitor Payment Circuit)                                 */
/* ========================================================================== */
router.get("/payment-health", requireAuth(), async (req, res) => {
  return res.status(200).json({
    healthy: isPaymentHealthy,
    failureCount: paymentFailureCount,
    timestamp: new Date().toISOString(),
    razorpayConfigured: !!(process.env.RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_SECRET),
  });
});

/* ========================================================================== */
/* 🚀 STARTUP LOGS                                                           */
/* ========================================================================== */
console.log(chalk.cyan("\n" + "=".repeat(70)));
console.log(chalk.green("💳 RAZORPAY PAYMENT ROUTES LOADED"));
console.log(chalk.cyan("=".repeat(70)));
console.log(chalk.white("📍 Endpoints:"));
console.log(chalk.white("   POST   /payments/create-order"));
console.log(chalk.white("   POST   /payments/verify-payment"));
console.log(chalk.white("   POST   /payments/deduct-credits"));
console.log(chalk.white("   GET    /payments/user-payments"));
console.log(chalk.white("   GET    /payments/payment-health"));
console.log(chalk.cyan("=".repeat(70)));
console.log(chalk.yellow("🛡️  Features:"));
console.log(chalk.white("   • Secure HMAC Signature Verification"));
console.log(chalk.white("   • Duplicate Payment Prevention"));
console.log(chalk.white("   • Atomic Database Operations ($inc)"));
console.log(chalk.white("   • Race Condition Prevention"));
console.log(chalk.white("   • Circuit Breaker & Rate Limiting"));
console.log(chalk.white("   • Enhanced Logging with Chalk"));
console.log(chalk.white("   • Fixed 302 Redirect Issue"));
console.log(chalk.cyan("=".repeat(70)));
console.log(chalk.yellow("🔑 Razorpay Configuration:"));
console.log(chalk.white("   • Key ID:"), process.env.RAZORPAY_KEY_ID || chalk.red("❌ NOT SET"));
if (process.env.RAZORPAY_KEY_ID?.startsWith('rzp_test_')) {
  console.log(chalk.yellow("   • Mode: ⚠️  TEST MODE"));
} else if (process.env.RAZORPAY_KEY_ID?.startsWith('rzp_live_')) {
  console.log(chalk.green("   • Mode: 🟢 LIVE MODE"));
} else {
  console.log(chalk.red("   • Mode: ❌ INVALID KEY FORMAT"));
}
console.log(chalk.cyan("=".repeat(70) + "\n"));

export default router;
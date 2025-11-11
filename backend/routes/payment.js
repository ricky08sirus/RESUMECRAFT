// routes/payment.js - FIXED: Handles auth properly, prevents 302 redirects

import express from "express";
import Razorpay from "razorpay";
import crypto from "crypto";
import Bottleneck from "bottleneck";
import { getAuth } from "@clerk/express";
import User from "../models/User.js";
import chalk from "chalk";

const router = express.Router();

/* ========================================================================== */
/* 🔐 CUSTOM AUTH MIDDLEWARE - Prevents 302 redirects                        */
/* ========================================================================== */
const customAuthMiddleware = (req, res, next) => {
  const auth = getAuth(req);
  const clerkId = auth?.userId;
  
  console.log(chalk.yellow("🔐 Auth Check:"), {
    hasAuth: !!auth,
    hasUserId: !!clerkId,
    sessionId: auth?.sessionId?.substring(0, 10) || "none",
    headers: {
      authorization: req.headers.authorization ? "present" : "missing",
      cookie: req.headers.cookie ? "present" : "missing",
    }
  });

  if (!clerkId) {
    console.error(chalk.red("❌ AUTH FAILED: No Clerk ID found"));
    console.error(chalk.red("🔍 Full Auth Object:"), JSON.stringify(auth, null, 2));
    console.error(chalk.red("📋 Request Headers:"), {
      authorization: req.headers.authorization,
      cookie: req.headers.cookie?.substring(0, 50) + "...",
      origin: req.headers.origin,
      referer: req.headers.referer,
    });
    
    return res.status(401).json({ 
      error: "Unauthorized - Please log in again",
      debug: {
        authPresent: !!auth,
        userIdPresent: !!clerkId,
        sessionPresent: !!auth?.sessionId,
      }
    });
  }

  console.log(chalk.green("✅ Auth passed for user:"), clerkId);
  next();
};

/* ========================================================================== */
/* 🎯 PAYMENT CONFIGURATION                                                  */
/* ========================================================================== */
const PAYMENT_CONFIG = {
  AMOUNT: 200, // 👈 CHANGE THIS: 1 for testing, 200 for production
  CREDITS_PER_PAYMENT: 10,
  CURRENCY: "INR",
};

console.log(chalk.cyan("\n🎯".repeat(35)));
console.log(chalk.yellow("💰 PAYMENT CONFIGURATION:"));
console.log(chalk.white("   Amount: ₹" + PAYMENT_CONFIG.AMOUNT));
console.log(chalk.white("   Credits: " + PAYMENT_CONFIG.CREDITS_PER_PAYMENT + " per payment"));
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
/* ⚙️ RATE LIMITER                                                            */
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

/* ========================================================================== */
/* 💰 POST /create-order                                                     */
/* ========================================================================== */
router.post("/create-order", customAuthMiddleware, async (req, res) => {
  console.log(chalk.cyan("\n═".repeat(70)));
  console.log(chalk.yellow("📍 CREATE ORDER START"));
  console.log(chalk.cyan("═".repeat(70)));
  
  try {
    const { userId: clerkId } = getAuth(req);
    console.log(chalk.blue("👤 User ClerkID:"), clerkId);
    
    const user = await User.findOne({ clerkId }).select("_id credits").lean();

    if (!user) {
      console.error(chalk.red("❌ User not found in database"));
      return res.status(404).json({ error: "User not found." });
    }

    console.log(chalk.green("✅ User found"));
    console.log(chalk.white("💰 Current credits:"), user.credits || 0);
    
    const options = {
      amount: PAYMENT_CONFIG.AMOUNT * 100,
      currency: PAYMENT_CONFIG.CURRENCY,
      receipt: `order_rcptid_${Date.now()}`,
    };

    const order = await razorpay.orders.create(options);

    console.log(chalk.green("✅ Order Created!"));
    console.log(chalk.white("🆔 Order ID:"), order.id);
    console.log(chalk.cyan("═".repeat(70) + "\n"));

    return res.status(200).json({
      success: true,
      orderId: order.id,
      amount: order.amount,
      currency: order.currency,
      key: process.env.RAZORPAY_KEY_ID,
    });
  } catch (err) {
    console.error(chalk.red("❌ [CREATE-ORDER] Error:"), err.message);
    console.log(chalk.cyan("═".repeat(70) + "\n"));
    return res.status(500).json({ error: "Failed to create order." });
  }
});

/* ========================================================================== */
/* ✅ POST /verify-payment - CRITICAL: No requireAuth wrapper                */
/* ========================================================================== */
router.post("/verify-payment", customAuthMiddleware, async (req, res) => {
  console.log(chalk.cyan("\n═".repeat(70)));
  console.log(chalk.yellow("📍 VERIFY PAYMENT START"));
  console.log(chalk.cyan("═".repeat(70)));
  
  try {
    // Get auth from request
    const auth = getAuth(req);
    const clerkId = auth?.userId;
    
    console.log(chalk.blue("👤 Clerk ID:"), clerkId);
    console.log(chalk.blue("🔑 Session ID:"), auth?.sessionId?.substring(0, 15) || "none");

    const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;

    console.log(chalk.white("🆔 Order ID:"), razorpay_order_id);
    console.log(chalk.white("💳 Payment ID:"), razorpay_payment_id);
    console.log(chalk.white("🔐 Signature:"), razorpay_signature?.substring(0, 20) + "...");

    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
      console.error(chalk.red("❌ Missing payment parameters"));
      return res.status(400).json({ error: "Missing payment parameters." });
    }

    // Find user
    console.log(chalk.yellow("🔍 Finding user..."));
    const user = await User.findOne({ clerkId });
    
    if (!user) {
      console.error(chalk.red("❌ User not found for clerkId:"), clerkId);
      return res.status(404).json({ error: "User not found." });
    }

    console.log(chalk.green("✅ User found!"));
    console.log(chalk.yellow("💰 Credits BEFORE:"), user.credits || 0);
    console.log(chalk.white("📜 Payments count:"), user.payments?.length || 0);

    // Check for duplicate
    const isDuplicate = user.payments?.some(
      p => p.razorpay_payment_id === razorpay_payment_id
    );

    if (isDuplicate) {
      console.warn(chalk.red("⚠️  DUPLICATE PAYMENT!"));
      return res.status(400).json({ 
        error: "Payment already processed.",
        newCredits: user.credits 
      });
    }

    // Verify signature
    console.log(chalk.yellow("🔐 Verifying signature..."));
    const generatedSignature = crypto
      .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
      .update(`${razorpay_order_id}|${razorpay_payment_id}`)
      .digest("hex");

    const isValid = generatedSignature === razorpay_signature;
    console.log(chalk.green("✅ Signature valid:"), isValid);

    if (!isValid) {
      console.error(chalk.red("❌ INVALID SIGNATURE"));
      return res.status(400).json({ error: "Invalid payment signature." });
    }

    // Update credits atomically
    console.log(chalk.yellow("💰 Updating credits..."));
    
    const oldCredits = user.credits || 0;
    const newCredits = oldCredits + PAYMENT_CONFIG.CREDITS_PER_PAYMENT;
    
    console.log(chalk.white("   Old:"), oldCredits);
    console.log(chalk.white("   Adding:"), PAYMENT_CONFIG.CREDITS_PER_PAYMENT);
    console.log(chalk.white("   Expected:"), newCredits);

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
        new: true,
        select: 'credits payments'
      }
    );

    if (!updateResult) {
      console.error(chalk.red("❌ Update failed!"));
      throw new Error("Failed to update user");
    }

    console.log(chalk.green("✅ UPDATE SUCCESS!"));
    console.log(chalk.green("💰 New credits:"), updateResult.credits);
    console.log(chalk.white("📜 Total payments:"), updateResult.payments.length);

    // Verify
    const verify = await User.findOne({ clerkId }).select("credits").lean();
    console.log(chalk.yellow("🔍 Verification:"), verify.credits);
    console.log(chalk.green("✅ PAYMENT COMPLETE!"));
    console.log(chalk.cyan("═".repeat(70) + "\n"));

    return res.status(200).json({
      success: true,
      message: "Payment verified!",
      newCredits: verify.credits,
      creditsAdded: PAYMENT_CONFIG.CREDITS_PER_PAYMENT,
    });
    
  } catch (err) {
    console.error(chalk.red("❌ [VERIFY-PAYMENT] ERROR:"), err.message);
    console.error(chalk.red("📚 Stack:"), err.stack);
    console.log(chalk.cyan("═".repeat(70) + "\n"));
    return res.status(500).json({ 
      error: "Payment verification failed.",
      details: err.message
    });
  }
});

/* ========================================================================== */
/* 💳 POST /deduct-credits                                                    */
/* ========================================================================== */
router.post("/deduct-credits", customAuthMiddleware, async (req, res) => {
  console.log(chalk.cyan("\n═".repeat(70)));
  console.log(chalk.yellow("📍 DEDUCT CREDITS"));
  console.log(chalk.cyan("═".repeat(70)));
  
  try {
    const { userId: clerkId } = getAuth(req);
    const { amount, reason } = req.body;

    console.log(chalk.blue("👤 User:"), clerkId);
    console.log(chalk.yellow("💸 Amount:"), amount);

    if (!amount || amount <= 0) {
      return res.status(400).json({ error: "Invalid amount." });
    }

    const updateResult = await User.findOneAndUpdate(
      { clerkId, credits: { $gte: amount } },
      { 
        $inc: { credits: -amount },
        $push: {
          payments: {
            razorpay_order_id: `deduction_${Date.now()}`,
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
      console.error(chalk.red("❌ Insufficient credits"));
      return res.status(400).json({ error: "Insufficient credits." });
    }

    console.log(chalk.green("✅ Deducted!"));
    console.log(chalk.white("💰 New credits:"), updateResult.credits);
    console.log(chalk.cyan("═".repeat(70) + "\n"));

    return res.status(200).json({
      success: true,
      message: `Deducted ${amount} credits.`,
      newCredits: updateResult.credits,
    });
  } catch (err) {
    console.error(chalk.red("❌ [DEDUCT] Error:"), err.message);
    console.log(chalk.cyan("═".repeat(70) + "\n"));
    return res.status(500).json({ error: "Failed to deduct credits." });
  }
});

/* ========================================================================== */
/* 📜 GET /user-payments                                                      */
/* ========================================================================== */
router.get("/user-payments", customAuthMiddleware, async (req, res) => {
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

    console.log(chalk.green("✅ Payments fetched"));
    console.log(chalk.white("💰 Credits:"), user.credits || 0);

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
/* 💡 GET /payment-health                                                     */
/* ========================================================================== */
router.get("/payment-health", customAuthMiddleware, async (req, res) => {
  return res.status(200).json({
    healthy: true,
    timestamp: new Date().toISOString(),
    razorpayConfigured: !!(process.env.RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_SECRET),
    mode: process.env.RAZORPAY_KEY_ID?.startsWith('rzp_test_') ? 'test' : 'live',
  });
});

/* ========================================================================== */
/* 🚀 STARTUP LOGS                                                           */
/* ========================================================================== */
console.log(chalk.cyan("\n=".repeat(70)));
console.log(chalk.green("💳 PAYMENT ROUTES LOADED - FIXED VERSION"));
console.log(chalk.cyan("=".repeat(70)));
console.log(chalk.white("📍 Endpoints:"));
console.log(chalk.white("   POST /payments/create-order"));
console.log(chalk.white("   POST /payments/verify-payment (NO 302 REDIRECT)"));
console.log(chalk.white("   POST /payments/deduct-credits"));
console.log(chalk.white("   GET  /payments/user-payments"));
console.log(chalk.white("   GET  /payments/payment-health"));
console.log(chalk.cyan("=".repeat(70)));
console.log(chalk.yellow("🔧 Fixes Applied:"));
console.log(chalk.white("   ✅ Custom auth middleware (no redirects)"));
console.log(chalk.white("   ✅ Detailed auth logging"));
console.log(chalk.white("   ✅ Atomic credit updates"));
console.log(chalk.white("   ✅ All routes return JSON"));
console.log(chalk.cyan("=".repeat(70) + "\n"));

export default router;

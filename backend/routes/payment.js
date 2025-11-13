// routes/payment.js - CRITICAL FIXES FOR CREDIT UPDATE ISSUES

import express from "express";
import Razorpay from "razorpay";
import crypto from "crypto";
import Bottleneck from "bottleneck";
import { getAuth } from "@clerk/express";
import User from "../models/User.js";
import chalk from "chalk";

const router = express.Router();

/* ========================================================================== */
/* 🔐 CUSTOM AUTH MIDDLEWARE                                                 */
/* ========================================================================== */
const customAuthMiddleware = (req, res, next) => {
  const auth = getAuth(req);
  const clerkId = auth?.userId;
  
  console.log(chalk.yellow("🔐 Auth Check:"), {
    hasAuth: !!auth,
    hasUserId: !!clerkId,
    sessionId: auth?.sessionId?.substring(0, 10) || "none",
  });

  if (!clerkId) {
    console.error(chalk.red("❌ AUTH FAILED: No Clerk ID found"));
    return res.status(401).json({ 
      error: "Unauthorized - Please log in again",
    });
  }

  console.log(chalk.green("✅ Auth passed for user:"), clerkId);
  req.clerkId = clerkId; // Attach to request for easy access
  next();
};

/* ========================================================================== */
/* 🎯 PAYMENT CONFIGURATION                                                  */
/* ========================================================================== */
const PAYMENT_CONFIG = {
  AMOUNT: 200, // Change to 1 for testing
  CREDITS_PER_PAYMENT: 10,
  CURRENCY: "INR",
};

console.log(chalk.cyan("\n🎯".repeat(35)));
console.log(chalk.yellow("💰 PAYMENT CONFIGURATION:"));
console.log(chalk.white("   Amount: ₹" + PAYMENT_CONFIG.AMOUNT));
console.log(chalk.white("   Credits: " + PAYMENT_CONFIG.CREDITS_PER_PAYMENT));
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
    const clerkId = req.clerkId;
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
/* ✅ POST /verify-payment - CRITICAL FIX: IMMEDIATE CREDIT UPDATE            */
/* ========================================================================== */
router.post("/verify-payment", customAuthMiddleware, async (req, res) => {
  console.log(chalk.cyan("\n═".repeat(70)));
  console.log(chalk.yellow("📍 VERIFY PAYMENT START"));
  console.log(chalk.cyan("═".repeat(70)));
  
  // 🔥 CRITICAL: Use transaction-like approach
  let creditUpdateSuccess = false;
  let updatedUser = null;
  
  try {
    const clerkId = req.clerkId;
    console.log(chalk.blue("👤 Clerk ID:"), clerkId);

    const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;

    console.log(chalk.white("🆔 Order ID:"), razorpay_order_id);
    console.log(chalk.white("💳 Payment ID:"), razorpay_payment_id);

    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
      console.error(chalk.red("❌ Missing payment parameters"));
      return res.status(400).json({ error: "Missing payment parameters." });
    }

    // 🔥 STEP 1: Find user and check for duplicate FIRST
    console.log(chalk.yellow("🔍 Step 1: Finding user and checking duplicate..."));
    const user = await User.findOne({ clerkId });
    
    if (!user) {
      console.error(chalk.red("❌ User not found for clerkId:"), clerkId);
      return res.status(404).json({ error: "User not found." });
    }

    console.log(chalk.green("✅ User found!"));
    console.log(chalk.yellow("💰 Credits BEFORE:"), user.credits || 0);

    // Check for duplicate payment
    const isDuplicate = user.payments?.some(
      p => p.razorpay_payment_id === razorpay_payment_id
    );

    if (isDuplicate) {
      console.warn(chalk.red("⚠️  DUPLICATE PAYMENT DETECTED!"));
      return res.status(400).json({ 
        error: "Payment already processed.",
        newCredits: user.credits,
        alreadyProcessed: true
      });
    }

    // 🔥 STEP 2: Verify signature BEFORE updating database
    console.log(chalk.yellow("🔐 Step 2: Verifying signature..."));
    const generatedSignature = crypto
      .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
      .update(`${razorpay_order_id}|${razorpay_payment_id}`)
      .digest("hex");

    const isValid = generatedSignature === razorpay_signature;

    if (!isValid) {
      console.error(chalk.red("❌ INVALID SIGNATURE"));
      console.error(chalk.red("Generated:"), generatedSignature);
      console.error(chalk.red("Received:"), razorpay_signature);
      
      // Log failed payment attempt
      await User.findOneAndUpdate(
        { clerkId },
        { 
          $push: {
            payments: {
              razorpay_order_id,
              razorpay_payment_id,
              amount: PAYMENT_CONFIG.AMOUNT,
              creditsAdded: 0,
              status: "failed_signature",
              date: new Date(),
            }
          }
        }
      );
      
      return res.status(400).json({ error: "Invalid payment signature." });
    }

    console.log(chalk.green("✅ Signature valid!"));

    // 🔥 STEP 3: Update credits with retry logic
    console.log(chalk.yellow("💰 Step 3: Updating credits with retry..."));
    
    const maxRetries = 3;
    let retryCount = 0;
    
    while (retryCount < maxRetries && !creditUpdateSuccess) {
      try {
        console.log(chalk.yellow(`   Attempt ${retryCount + 1}/${maxRetries}...`));
        
        updatedUser = await User.findOneAndUpdate(
          { 
            clerkId,
            // Ensure we don't process duplicate if another request came in
            "payments.razorpay_payment_id": { $ne: razorpay_payment_id }
          },
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
                verified: true,
              }
            }
          },
          { 
            new: true,
            select: 'credits payments'
          }
        );

        if (updatedUser) {
          creditUpdateSuccess = true;
          console.log(chalk.green("✅ Credit update SUCCESS!"));
          console.log(chalk.green("💰 New credits:"), updatedUser.credits);
          break;
        } else {
          // User not found or duplicate detected
          console.warn(chalk.yellow("⚠️  Update returned null, checking reason..."));
          
          // Check if it's a duplicate
          const checkUser = await User.findOne({ clerkId });
          const isDup = checkUser.payments?.some(
            p => p.razorpay_payment_id === razorpay_payment_id
          );
          
          if (isDup) {
            console.log(chalk.green("✅ Payment already processed (duplicate caught)"));
            return res.status(200).json({
              success: true,
              message: "Payment already processed",
              newCredits: checkUser.credits,
              creditsAdded: PAYMENT_CONFIG.CREDITS_PER_PAYMENT,
              duplicate: true
            });
          }
        }
        
        retryCount++;
        if (retryCount < maxRetries) {
          await new Promise(resolve => setTimeout(resolve, 100 * retryCount));
        }
        
      } catch (updateError) {
        console.error(chalk.red(`❌ Attempt ${retryCount + 1} failed:`), updateError.message);
        retryCount++;
        
        if (retryCount < maxRetries) {
          await new Promise(resolve => setTimeout(resolve, 100 * retryCount));
        }
      }
    }

    if (!creditUpdateSuccess) {
      console.error(chalk.red("❌ CRITICAL: Failed to update credits after all retries!"));
      console.error(chalk.red("💰 Payment verified but credits not added!"));
      console.error(chalk.red("🆔 Payment ID:"), razorpay_payment_id);
      
      // Send email/notification to admin
      // TODO: Implement admin notification
      
      return res.status(500).json({ 
        error: "Payment verified but credit update failed. Contact support with payment ID.",
        paymentId: razorpay_payment_id,
        verified: true,
        needsManualIntervention: true
      });
    }

    // 🔥 STEP 4: Double-verify the credits were updated
    console.log(chalk.yellow("🔍 Step 4: Double-verifying credit update..."));
    const verifyUser = await User.findOne({ clerkId }).select("credits payments").lean();
    
    if (!verifyUser) {
      console.error(chalk.red("❌ User disappeared after update!"));
      throw new Error("User verification failed");
    }
    
    const expectedCredits = user.credits + PAYMENT_CONFIG.CREDITS_PER_PAYMENT;
    const actualCredits = verifyUser.credits;
    
    console.log(chalk.white("   Expected credits:"), expectedCredits);
    console.log(chalk.white("   Actual credits:"), actualCredits);
    
    if (actualCredits < expectedCredits) {
      console.error(chalk.red("❌ CRITICAL: Credits mismatch after update!"));
      console.error(chalk.red("   This payment needs manual verification"));
      
      return res.status(500).json({
        error: "Credit verification failed. Contact support.",
        paymentId: razorpay_payment_id,
        needsManualIntervention: true
      });
    }

    console.log(chalk.green("✅ VERIFICATION COMPLETE!"));
    console.log(chalk.green("✅ PAYMENT FULLY PROCESSED!"));
    console.log(chalk.cyan("═".repeat(70) + "\n"));

    return res.status(200).json({
      success: true,
      message: "Payment verified and credits added!",
      newCredits: actualCredits,
      creditsAdded: PAYMENT_CONFIG.CREDITS_PER_PAYMENT,
      paymentId: razorpay_payment_id,
      verified: true
    });
    
  } catch (err) {
    console.error(chalk.red("❌ [VERIFY-PAYMENT] CRITICAL ERROR:"), err.message);
    console.error(chalk.red("📚 Stack:"), err.stack);
    console.log(chalk.cyan("═".repeat(70) + "\n"));
    
    // If we got here and payment was verified but credits failed,
    // log it for manual intervention
    if (err.message.includes("signature") === false) {
      console.error(chalk.red("🚨 ALERT: Payment may be verified but credits update failed!"));
      console.error(chalk.red("🆔 Check payment ID in logs above"));
    }
    
    return res.status(500).json({ 
      error: "Payment verification failed.",
      details: err.message,
      needsSupport: true
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
    const clerkId = req.clerkId;
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
            reason: reason || "Service usage",
            date: new Date(),
          }
        }
      },
      { new: true, select: 'credits' }
    );

    if (!updateResult) {
      console.error(chalk.red("❌ Insufficient credits or user not found"));
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
    const clerkId = req.clerkId;
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
/* 🔧 GET /verify-credit-status/:paymentId - NEW: Manual verification        */
/* ========================================================================== */
router.get("/verify-credit-status/:paymentId", customAuthMiddleware, async (req, res) => {
  try {
    const clerkId = req.clerkId;
    const { paymentId } = req.params;
    
    console.log(chalk.blue("🔍 Verifying credit status for payment:"), paymentId);
    
    const user = await User.findOne({ 
      clerkId,
      "payments.razorpay_payment_id": paymentId 
    }).select("credits payments").lean();
    
    if (!user) {
      return res.status(404).json({ 
        error: "Payment not found",
        found: false 
      });
    }
    
    const payment = user.payments.find(p => p.razorpay_payment_id === paymentId);
    
    return res.status(200).json({
      success: true,
      found: true,
      payment: payment,
      currentCredits: user.credits,
      processed: payment?.status === "success"
    });
    
  } catch (err) {
    console.error(chalk.red("❌ [VERIFY-STATUS] Error:"), err.message);
    return res.status(500).json({ error: "Failed to verify status" });
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

console.log(chalk.cyan("\n=".repeat(70)));
console.log(chalk.green("💳 PAYMENT ROUTES LOADED - ULTRA FIXED VERSION"));
console.log(chalk.cyan("=".repeat(70)));
console.log(chalk.yellow("🔧 Critical Fixes:"));
console.log(chalk.white("   ✅ Signature verified BEFORE database update"));
console.log(chalk.white("   ✅ Retry logic for credit updates"));
console.log(chalk.white("   ✅ Double verification after update"));
console.log(chalk.white("   ✅ Duplicate payment detection"));
console.log(chalk.white("   ✅ Manual verification endpoint"));
console.log(chalk.cyan("=".repeat(70) + "\n"));

export default router;
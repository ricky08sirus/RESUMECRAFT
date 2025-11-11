// Payment.jsx - Fixed Version with Enhanced Logging for Live Mode Debugging

import React, { useState, useEffect, useCallback, useMemo } from "react";
import { useAuth } from "@clerk/clerk-react";
import { useNavigate } from "react-router-dom";
import {
  CreditCard, Sparkles, Loader2, AlertCircle, CheckCircle2,
  Zap, Shield, TrendingUp, Star, ArrowRight, Coins, Lock
} from "lucide-react";
import axios from "axios";
import CountUp from "react-countup";

export default function Payment() {
  const { getToken } = useAuth();
  const navigate = useNavigate();

  const [credits, setCredits] = useState(0);
  const [payments, setPayments] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isFetchingData, setIsFetchingData] = useState(true);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [loadingStage, setLoadingStage] = useState(0);

  const API_URL = import.meta.env.VITE_API_URL;
  const RAZORPAY_KEY = import.meta.env.VITE_RAZORPAY_KEY_ID;

  // Log environment on mount
  useEffect(() => {
    console.log("═══════════════════════════════════════");
    console.log("🎨 FRONTEND: Payment Component Mounted");
    console.log("═══════════════════════════════════════");
    console.log("🔑 Razorpay Key:", RAZORPAY_KEY);
    console.log("🌐 API URL:", API_URL);
    
    if (RAZORPAY_KEY?.startsWith('rzp_test_')) {
      console.warn("⚠️  FRONTEND: Using TEST mode key!");
    } else if (RAZORPAY_KEY?.startsWith('rzp_live_')) {
      console.log("🟢 FRONTEND: Using LIVE mode key");
    } else {
      console.error("❌ FRONTEND: Invalid or missing Razorpay key!");
    }
    console.log("═══════════════════════════════════════\n");
  }, [RAZORPAY_KEY, API_URL]);

  const loadingStages = useMemo(() => [
    { icon: Shield, text: "Initializing secure payment...", color: "from-blue-500 to-cyan-500" },
    { icon: CreditCard, text: "Creating payment order...", color: "from-purple-500 to-pink-500" },
    { icon: Lock, text: "Encrypting transaction...", color: "from-orange-500 to-red-500" },
    { icon: CheckCircle2, text: "Processing payment...", color: "from-green-500 to-emerald-500" },
  ], []);

  const fetchUserData = useCallback(async () => {
    try {
      setIsFetchingData(true);
      const token = await getToken();
      
      console.log("📞 FRONTEND: Fetching user data...");
      const response = await axios.get(`${API_URL}/payments/user-payments`, {
        headers: { Authorization: `Bearer ${token}` }
      });

      console.log("✅ FRONTEND: User data fetched");
      console.log("💰 Current Credits:", response.data?.credits || 0);
      console.log("📊 Payment History Count:", response.data?.payments?.length || 0);

      setCredits(response.data?.credits || 0);
      setPayments(response.data?.payments || []);
    } catch (err) {
      console.error("❌ FRONTEND: Failed to fetch user data:", err);
    } finally {
      setIsFetchingData(false);
    }
  }, [getToken, API_URL]);

  useEffect(() => {
    fetchUserData();
  }, [fetchUserData]);

  const loadRazorpayScript = useCallback(() => {
    return new Promise((resolve) => {
      const existingScript = document.getElementById("razorpay-sdk");
      if (existingScript) {
        console.log("✅ FRONTEND: Razorpay script already loaded");
        resolve(true);
        return;
      }

      console.log("📦 FRONTEND: Loading Razorpay SDK...");
      const script = document.createElement("script");
      script.id = "razorpay-sdk";
      script.src = "https://checkout.razorpay.com/v1/checkout.js";
      script.async = true;
      script.onload = () => {
        console.log("✅ FRONTEND: Razorpay SDK loaded successfully");
        resolve(true);
      };
      script.onerror = () => {
        console.error("❌ FRONTEND: Failed to load Razorpay SDK");
        resolve(false);
      };
      document.body.appendChild(script);
    });
  }, []);

  const handlePayment = async () => {
    console.log("\n" + "═".repeat(70));
    console.log("🎯 FRONTEND: PAYMENT PROCESS STARTED");
    console.log("═".repeat(70));
    
    setIsLoading(true);
    setError(null);
    setSuccess(null);
    setLoadingStage(0);

    try {
      // Get auth token
      console.log("🔐 FRONTEND: Getting auth token...");
      const token = await getToken();
      
      if (!token) {
        console.error("❌ FRONTEND: No auth token available");
        throw new Error("Authentication required. Please log in.");
      }
      console.log("✅ FRONTEND: Auth token obtained");

      // Stage 1: Load Razorpay SDK
      setLoadingStage(0);
      const scriptLoaded = await loadRazorpayScript();
      if (!scriptLoaded) {
        console.error("❌ FRONTEND: Razorpay SDK failed to load");
        throw new Error("Failed to load payment gateway");
      }
      await new Promise((resolve) => setTimeout(resolve, 500));

      // Stage 2: Create Razorpay order
      setLoadingStage(1);
      console.log("📞 FRONTEND: Calling create-order API...");
      console.log("🌐 URL:", `${API_URL}/payments/create-order`);
      
      const orderResponse = await axios.post(
        `${API_URL}/payments/create-order`,
        {},
        { 
          headers: { 
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json'
          } 
        }
      );

      console.log("✅ FRONTEND: Order created successfully");
      console.log("📋 Order Response:", orderResponse.data);

      const { orderId, amount, currency, key } = orderResponse.data;
      
      console.log("🆔 Order ID:", orderId);
      console.log("💰 Amount:", amount, "paise (₹" + (amount/100) + ")");
      console.log("💱 Currency:", currency);
      console.log("🔑 Razorpay Key from backend:", key);

      // Verify key format
      if (key?.startsWith('rzp_test_')) {
        console.warn("⚠️  FRONTEND: Backend returned TEST mode key");
      } else if (key?.startsWith('rzp_live_')) {
        console.log("🟢 FRONTEND: Backend returned LIVE mode key");
      }

      await new Promise((resolve) => setTimeout(resolve, 500));

      // Stage 3: Initialize Razorpay
      setLoadingStage(2);
      console.log("🚀 FRONTEND: Initializing Razorpay checkout...");
      
      const options = {
        key: key || RAZORPAY_KEY,
        amount,
        currency,
        name: "Resume Builder Pro",
        description: "10 Resume Credits",
        order_id: orderId,
        
        // ✅ CRITICAL: Payment success handler
        handler: async (response) => {
          console.log("\n" + "═".repeat(70));
          console.log("✅ FRONTEND: PAYMENT SUCCESSFUL!");
          console.log("═".repeat(70));
          console.log("🆔 Order ID:", response.razorpay_order_id);
          console.log("💳 Payment ID:", response.razorpay_payment_id);
          console.log("🔐 Signature (first 20 chars):", response.razorpay_signature?.substring(0, 20) + "...");
          
          setLoadingStage(3);
          await verifyPayment(response, token);
        },
        
        prefill: {
          name: "",
          email: "",
          contact: "",
        },
        theme: {
          color: "#8b5cf6",
        },
        modal: {
          ondismiss: () => {
            console.warn("⚠️  FRONTEND: User closed payment modal");
            setIsLoading(false);
            setLoadingStage(0);
          },
        },
      };

      // Open Razorpay
      console.log("🎨 FRONTEND: Opening Razorpay modal...");
      const razorpay = new window.Razorpay(options);
      
      // Add payment failure handler
      razorpay.on('payment.failed', function (response) {
        console.error("\n" + "═".repeat(70));
        console.error("❌ FRONTEND: PAYMENT FAILED!");
        console.error("═".repeat(70));
        console.error("Error Code:", response.error.code);
        console.error("Error Description:", response.error.description);
        console.error("Error Source:", response.error.source);
        console.error("Error Step:", response.error.step);
        console.error("Error Reason:", response.error.reason);
        console.error("Order ID:", response.error.metadata?.order_id);
        console.error("Payment ID:", response.error.metadata?.payment_id);
        console.error("═".repeat(70) + "\n");
        
        setError(`Payment failed: ${response.error.description}`);
        setIsLoading(false);
        setLoadingStage(0);
      });

      razorpay.open();
      setIsLoading(false);
      console.log("✅ FRONTEND: Razorpay modal opened");
      
    } catch (err) {
      console.error("\n" + "═".repeat(70));
      console.error("❌ FRONTEND: PAYMENT ERROR");
      console.error("═".repeat(70));
      console.error("Error Message:", err.message);
      console.error("Error Response:", err.response?.data);
      console.error("Full Error:", err);
      console.error("═".repeat(70) + "\n");
      
      setError(err.response?.data?.error || err.message || "Payment failed. Please try again.");
      setIsLoading(false);
      setLoadingStage(0);
    }
  };

  // Verify payment on backend
  const verifyPayment = async (paymentResponse, token) => {
    try {
      console.log("📞 FRONTEND: Calling verify-payment API...");
      console.log("🌐 URL:", `${API_URL}/payments/verify-payment`);
      console.log("📦 Payload:", {
        razorpay_order_id: paymentResponse.razorpay_order_id,
        razorpay_payment_id: paymentResponse.razorpay_payment_id,
        razorpay_signature: paymentResponse.razorpay_signature?.substring(0, 20) + "..."
      });

      const response = await axios.post(
        `${API_URL}/payments/verify-payment`,
        {
          razorpay_order_id: paymentResponse.razorpay_order_id,
          razorpay_payment_id: paymentResponse.razorpay_payment_id,
          razorpay_signature: paymentResponse.razorpay_signature,
        },
        { 
          headers: { 
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json'
          } 
        }
      );

      console.log("✅ FRONTEND: Payment verified successfully!");
      console.log("📋 Verification Response:", response.data);
      console.log("💰 New Credits:", response.data?.newCredits);
      console.log("═".repeat(70) + "\n");

      setSuccess("Payment successful! 10 credits added to your account.");
      setCredits(response.data?.newCredits || credits + 10);
      
      // Refresh payment history after delay
      setTimeout(() => {
        console.log("🔄 FRONTEND: Refreshing user data...");
        fetchUserData();
        setSuccess(null);
      }, 3000);
      
    } catch (err) {
      console.error("\n" + "═".repeat(70));
      console.error("❌ FRONTEND: VERIFICATION FAILED!");
      console.error("═".repeat(70));
      console.error("Error Message:", err.message);
      console.error("Error Response:", err.response?.data);
      console.error("Status Code:", err.response?.status);
      console.error("Full Error:", err);
      console.error("═".repeat(70) + "\n");
      
      setError("Payment verification failed. Contact support if amount was deducted.");
    } finally {
      setIsLoading(false);
      setLoadingStage(0);
    }
  };

  const CurrentStageIcon = loadingStages[loadingStage]?.icon || Shield;

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 p-4 sm:p-6 pt-24 sm:pt-32 relative overflow-hidden">
      
      {/* Animated Background Orbs */}
      <div className="absolute top-20 left-10 w-72 h-72 bg-purple-500 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-blob"></div>
      <div className="absolute top-40 right-10 w-72 h-72 bg-violet-500 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-blob animation-delay-2000"></div>
      <div className="absolute -bottom-8 left-20 w-72 h-72 bg-pink-500 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-blob animation-delay-4000"></div>

      <div className="relative z-10 w-full max-w-6xl">
        {/* Header Section */}
        <div className="text-center mb-8">
          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold text-white leading-tight mb-4">
            Unlock Your
            <span className="block bg-gradient-to-r from-violet-400 via-purple-400 to-pink-400 bg-clip-text text-transparent animate-gradient">
              Career Potential
            </span>
          </h1>
          <p className="text-xl text-gray-300 max-w-2xl mx-auto">
            Get more resume customizations and unlock advanced features
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
          {/* Current Credits Card */}
          <div className="relative group">
            <div className="absolute -inset-1 bg-gradient-to-r from-violet-600 to-purple-600 rounded-2xl blur-xl opacity-50 group-hover:opacity-75 transition"></div>
            <div className="relative bg-white/10 backdrop-blur-2xl border border-white/20 rounded-2xl p-6 shadow-2xl">
              {isFetchingData ? (
                <div className="flex items-center justify-center h-32">
                  <Loader2 className="w-8 h-8 animate-spin text-violet-400" />
                </div>
              ) : (
                <>
                  <div className="flex items-center justify-between mb-4">
                    <Coins className="w-8 h-8 text-violet-400" />
                    <span className="text-xs text-gray-400 uppercase tracking-wide">Balance</span>
                  </div>
                  <div className="text-5xl font-bold text-white mb-2">
                    <CountUp end={credits} duration={1.5} />
                  </div>
                  <p className="text-gray-300 text-sm">Available Credits</p>
                </>
              )}
            </div>
          </div>

          {/* Payment Package Card */}
          <div className="relative lg:col-span-2">
            <div className="absolute -inset-1 bg-gradient-to-r from-pink-600 via-purple-600 to-violet-600 rounded-2xl blur-xl opacity-50"></div>
            <div className="relative bg-white/10 backdrop-blur-2xl border border-white/20 rounded-2xl p-8 shadow-2xl">
              
              {/* Loading Overlay */}
              {isLoading && (
                <div className="absolute inset-0 bg-slate-900/95 backdrop-blur-md rounded-2xl flex flex-col items-center justify-center z-50 space-y-6">
                  <div className="relative">
                    <Loader2 className="w-16 h-16 animate-spin text-violet-400" />
                    <div className="absolute inset-0 flex items-center justify-center">
                      <CurrentStageIcon className="w-8 h-8 text-white animate-pulse" />
                    </div>
                  </div>
                  <div className="text-center space-y-2">
                    <p className="text-white text-xl font-semibold animate-pulse">
                      {loadingStages[loadingStage]?.text || "Processing..."}
                    </p>
                    <div className="flex space-x-2 justify-center">
                      {loadingStages.map((_, i) => (
                        <div
                          key={i}
                          className={`h-2 w-2 rounded-full transition-all duration-300 ${
                            i === loadingStage
                              ? "bg-violet-400 scale-125"
                              : i < loadingStage
                              ? "bg-violet-600"
                              : "bg-gray-600"
                          }`}
                        />
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* Package Header */}
              <div className="flex items-start justify-between mb-6">
                <div>
                  <div className="flex items-center space-x-2 mb-2">
                    <Star className="w-6 h-6 text-yellow-400" />
                    <h3 className="text-2xl font-bold text-white">Premium Package</h3>
                  </div>
                  <p className="text-gray-300 text-sm">Perfect for job seekers</p>
                </div>
                <div className="text-right">
                  <div className="text-4xl font-bold text-white">₹1</div>
                  <p className="text-gray-400 text-sm">Testing Mode</p>
                </div>
              </div>

              {/* Features List */}
              <div className="space-y-3 mb-6">
                {[
                  { icon: Zap, text: "10 Resume Customizations" },
                  { icon: TrendingUp, text: "AI-Powered Job Matching" },
                  { icon: Shield, text: "Secure Payment Gateway" },
                  { icon: Sparkles, text: "Priority Processing" },
                ].map((feature, idx) => (
                  <div key={idx} className="flex items-center space-x-3 text-gray-200">
                    <feature.icon className="w-5 h-5 text-violet-400 flex-shrink-0" />
                    <span className="text-sm">{feature.text}</span>
                  </div>
                ))}
              </div>

              {/* Error Message */}
              {error && (
                <div className="mb-4 p-3 bg-red-500/10 border border-red-500/50 rounded-xl flex items-start space-x-3 animate-shake">
                  <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
                  <p className="text-red-300 text-sm">{error}</p>
                </div>
              )}

              {/* Success Message */}
              {success && (
                <div className="mb-4 p-3 bg-green-500/10 border border-green-500/50 rounded-xl flex items-start space-x-3 animate-fadeIn">
                  <CheckCircle2 className="w-5 h-5 text-green-400 flex-shrink-0 mt-0.5" />
                  <p className="text-green-300 text-sm">{success}</p>
                </div>
              )}

              {/* Payment Button */}
              <button
                onClick={handlePayment}
                disabled={isLoading}
                className="group relative w-full py-4 px-6 rounded-xl font-semibold text-lg overflow-hidden transition-all duration-300 bg-gradient-to-r from-violet-600 to-indigo-600 hover:shadow-2xl hover:shadow-violet-500/50 hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <span className="relative z-10 flex items-center justify-center space-x-3 text-white">
                  {isLoading ? (
                    <>
                      <Loader2 className="w-6 h-6 animate-spin" />
                      <span>Processing...</span>
                    </>
                  ) : (
                    <>
                      <CreditCard className="w-6 h-6" />
                      <span>Buy 10 Credits - ₹1 (Test)</span>
                      <ArrowRight className="w-6 h-6 group-hover:translate-x-1 transition-transform" />
                    </>
                  )}
                </span>
              </button>

              <p className="text-center text-xs text-gray-400 mt-4">
                🔒 Secured by Razorpay • 100% Safe & Encrypted
              </p>
            </div>
          </div>
        </div>

        {/* Payment History Section */}
        {payments.length > 0 && (
          <div className="relative">
            <div className="absolute -inset-1 bg-gradient-to-r from-violet-600 to-purple-600 rounded-2xl blur-xl opacity-30"></div>
            <div className="relative bg-white/10 backdrop-blur-2xl border border-white/20 rounded-2xl p-6 shadow-2xl">
              <h3 className="text-xl font-bold text-white mb-4 flex items-center space-x-2">
                <CreditCard className="w-6 h-6 text-violet-400" />
                <span>Payment History</span>
              </h3>
              <div className="space-y-3 max-h-64 overflow-y-auto custom-scrollbar">
                {payments.slice(0, 10).map((payment, idx) => (
                  <div
                    key={idx}
                    className="flex items-center justify-between p-3 bg-white/5 rounded-lg border border-white/10 hover:bg-white/10 transition"
                  >
                    <div>
                      <p className="text-white text-sm font-medium">₹{payment.amount}</p>
                      <p className="text-gray-400 text-xs">
                        {new Date(payment.date).toLocaleDateString("en-IN", {
                          day: "2-digit",
                          month: "short",
                          year: "numeric",
                        })}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-green-400 text-sm font-medium">+{payment.creditsAdded} credits</p>
                      <p className="text-gray-400 text-xs capitalize">{payment.status}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Custom Styles */}
      <style>{`
        @keyframes blob {
          0%, 100% { transform: translate(0, 0) scale(1); }
          33% { transform: translate(30px, -50px) scale(1.1); }
          66% { transform: translate(-20px, 20px) scale(0.9); }
        }
        .animate-blob {
          animation: blob 7s infinite;
          will-change: transform;
        }
        .animation-delay-2000 {
          animation-delay: 2s;
        }
        .animation-delay-4000 {
          animation-delay: 4s;
        }
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .animate-fadeIn {
          animation: fadeIn 0.5s ease-out;
        }
        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          25% { transform: translateX(-5px); }
          75% { transform: translateX(5px); }
        }
        .animate-shake {
          animation: shake 0.3s ease-in-out;
        }
        @keyframes gradient {
          0%, 100% { background-position: 0% 50%; }
          50% { background-position: 100% 50%; }
        }
        .animate-gradient {
          background-size: 200% 200%;
          animation: gradient 3s ease infinite;
        }
        .custom-scrollbar::-webkit-scrollbar {
          width: 6px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: rgba(255, 255, 255, 0.05);
          border-radius: 10px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: rgba(139, 92, 246, 0.5);
          border-radius: 10px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: rgba(139, 92, 246, 0.7);
        }
      `}</style>
    </div>
  );
}
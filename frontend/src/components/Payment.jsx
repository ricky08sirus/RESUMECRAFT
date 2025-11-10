// Payment.jsx - Ultra-Scalable Payment Component
// Copy this entire file to your /src/pages or /src/components directory

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

  // State management - optimized for performance
  const [credits, setCredits] = useState(0);
  const [payments, setPayments] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isFetchingData, setIsFetchingData] = useState(true);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [loadingStage, setLoadingStage] = useState(0);

  const API_URL = import.meta.env.VITE_API_URL;
  const RAZORPAY_KEY = import.meta.env.VITE_RAZORPAY_KEY_ID;

  // Memoized loading stages - prevents unnecessary re-renders
  const loadingStages = useMemo(() => [
    { icon: Shield, text: "Initializing secure payment...", color: "from-blue-500 to-cyan-500" },
    { icon: CreditCard, text: "Creating payment order...", color: "from-purple-500 to-pink-500" },
    { icon: Lock, text: "Encrypting transaction...", color: "from-orange-500 to-red-500" },
    { icon: CheckCircle2, text: "Processing payment...", color: "from-green-500 to-emerald-500" },
  ], []);

  // Fetch user credits and payment history - memoized with useCallback
  const fetchUserData = useCallback(async () => {
    try {
      setIsFetchingData(true);
      const token = await getToken();
      
      const response = await axios.get(`${API_URL}/payments/user-payments`, {
        headers: { Authorization: `Bearer ${token}` }
      });

      setCredits(response.data?.credits || 0);
      setPayments(response.data?.payments || []);
    } catch (err) {
      console.error("❌ Failed to fetch user data:", err);
      // Silent fail for better UX - no intrusive error messages on load
    } finally {
      setIsFetchingData(false);
    }
  }, [getToken, API_URL]);

  // Load data on mount
  useEffect(() => {
    fetchUserData();
  }, [fetchUserData]);

  // Load Razorpay script dynamically - prevents blocking main bundle
  const loadRazorpayScript = useCallback(() => {
    return new Promise((resolve) => {
      // Check if script already exists
      const existingScript = document.getElementById("razorpay-sdk");
      if (existingScript) {
        resolve(true);
        return;
      }

      const script = document.createElement("script");
      script.id = "razorpay-sdk";
      script.src = "https://checkout.razorpay.com/v1/checkout.js";
      script.async = true;
      script.onload = () => resolve(true);
      script.onerror = () => resolve(false);
      document.body.appendChild(script);
    });
  }, []);

  // Main payment handler - highly optimized
  const handlePayment = async () => {
    setIsLoading(true);
    setError(null);
    setSuccess(null);
    setLoadingStage(0);

    try {
      const token = await getToken();
      if (!token) throw new Error("Authentication required. Please log in.");

      // Stage 1: Load Razorpay SDK (async, non-blocking)
      setLoadingStage(0);
      const scriptLoaded = await loadRazorpayScript();
      if (!scriptLoaded) throw new Error("Failed to load payment gateway");

      await new Promise((resolve) => setTimeout(resolve, 500));

      // Stage 2: Create Razorpay order
      setLoadingStage(1);
      const orderResponse = await axios.post(
        `${API_URL}/payments/create-order`,
        {},
        { headers: { Authorization: `Bearer ${token}` } }
      );

      const { orderId, amount, currency, key } = orderResponse.data;
      await new Promise((resolve) => setTimeout(resolve, 500));

      // Stage 3: Initialize Razorpay
      setLoadingStage(2);
      const options = {
        key: key || RAZORPAY_KEY,
        amount,
        currency,
        name: "Resume Builder Pro",
        description: "10 Resume Credits",
        order_id: orderId,
        handler: async (response) => {
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
            setIsLoading(false);
            setLoadingStage(0);
          },
        },
      };

      const razorpay = new window.Razorpay(options);
      razorpay.open();
      setIsLoading(false);
    } catch (err) {
      console.error("❌ Payment Error:", err);
      setError(err.response?.data?.error || err.message || "Payment failed. Please try again.");
      setIsLoading(false);
      setLoadingStage(0);
    }
  };

  // Verify payment on backend
  const verifyPayment = async (paymentResponse, token) => {
    try {
      const response = await axios.post(
        `${API_URL}/payments/verify-payment`,
        paymentResponse,
        { headers: { Authorization: `Bearer ${token}` } }
      );

      setSuccess("Payment successful! 10 credits added to your account.");
      setCredits(response.data?.newCredits || credits + 10);
      
      // Refresh payment history after delay
      setTimeout(() => {
        fetchUserData();
        setSuccess(null);
      }, 3000);
    } catch (err) {
      console.error("❌ Verification Error:", err);
      setError("Payment verification failed. Contact support if amount was deducted.");
    } finally {
      setIsLoading(false);
      setLoadingStage(0);
    }
  };

  const CurrentStageIcon = loadingStages[loadingStage]?.icon || Shield;

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 p-4 sm:p-6 pt-24 sm:pt-32 relative overflow-hidden">
      
      {/* Animated Background Orbs - GPU accelerated */}
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
                  <div className="text-4xl font-bold text-white">₹200</div>
                  <p className="text-gray-400 text-sm">One-time payment</p>
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
                      <span>Buy 10 Credits - ₹200</span>
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
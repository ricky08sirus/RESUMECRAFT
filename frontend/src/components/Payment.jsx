// Payment.jsx - FIXED VERSION with proper polling

import React, { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { useAuth, useUser } from "@clerk/clerk-react";
import { useNavigate } from "react-router-dom";
import {
  CreditCard, Sparkles, Loader2, AlertCircle, CheckCircle2,
  Zap, Shield, TrendingUp, Star, ArrowRight, Coins, Lock
} from "lucide-react";
import axios from "axios";
import CountUp from "react-countup";

export default function Payment() {
  const { getToken, isLoaded: authLoaded, isSignedIn, userId } = useAuth();
  const { user, isLoaded: userLoaded } = useUser();
  const navigate = useNavigate();

  const [credits, setCredits] = useState(0);
  const [payments, setPayments] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isFetchingData, setIsFetchingData] = useState(true);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [loadingStage, setLoadingStage] = useState(0);
  
  // 🔥 NEW: Polling state
  const [isPolling, setIsPolling] = useState(false);
  const [pollCount, setPollCount] = useState(0);
  const pollingIntervalRef = useRef(null);
  const lastPaymentIdRef = useRef(null);

  const API_URL = import.meta.env.VITE_API_URL;
  const RAZORPAY_KEY = import.meta.env.VITE_RAZORPAY_KEY_ID;

  const loadingStages = useMemo(() => [
    { icon: Shield, text: "Initializing secure payment...", color: "from-blue-500 to-cyan-500" },
    { icon: CreditCard, text: "Creating payment order...", color: "from-purple-500 to-pink-500" },
    { icon: Lock, text: "Encrypting transaction...", color: "from-orange-500 to-red-500" },
    { icon: CheckCircle2, text: "Processing payment...", color: "from-green-500 to-emerald-500" },
  ], []);

  // 🔥 NEW: Stop polling function
  const stopPolling = useCallback(() => {
    if (pollingIntervalRef.current) {
      console.log("🛑 FRONTEND: Stopping poll");
      clearInterval(pollingIntervalRef.current);
      pollingIntervalRef.current = null;
      setIsPolling(false);
      setPollCount(0);
    }
  }, []);

  // 🔥 NEW: Poll for credit updates
  const pollForCreditUpdate = useCallback(async (paymentId, expectedCredits) => {
    console.log("🔄 FRONTEND: Starting credit update polling...");
    console.log("   Payment ID:", paymentId);
    console.log("   Expected Credits:", expectedCredits);
    
    setIsPolling(true);
    lastPaymentIdRef.current = paymentId;
    
    const MAX_POLLS = 20; // Poll for 20 seconds max
    let pollAttempt = 0;
    
    pollingIntervalRef.current = setInterval(async () => {
      pollAttempt++;
      setPollCount(pollAttempt);
      
      console.log(`📊 FRONTEND: Poll attempt ${pollAttempt}/${MAX_POLLS}`);
      
      try {
        const token = await getToken();
        if (!token) {
          console.error("❌ FRONTEND: No token during polling");
          stopPolling();
          return;
        }

        // Check credit status
        const response = await axios.get(
          `${API_URL}/payments/user-payments`,
          {
            headers: { 
              Authorization: `Bearer ${token}`,
              'Content-Type': 'application/json'
            },
            timeout: 10000
          }
        );

        const currentCredits = response.data?.credits || 0;
        console.log(`   Current credits: ${currentCredits} (expected: ${expectedCredits})`);

        if (currentCredits >= expectedCredits) {
          console.log("✅ FRONTEND: Credits updated successfully!");
          setCredits(currentCredits);
          setPayments(response.data?.payments || []);
          setSuccess(`Payment successful! ${PAYMENT_CONFIG.CREDITS_PER_PAYMENT} credits added.`);
          setIsLoading(false);
          setLoadingStage(0);
          stopPolling();
          
          // Clear success message after 5 seconds
          setTimeout(() => setSuccess(null), 5000);
        } else if (pollAttempt >= MAX_POLLS) {
          console.error("❌ FRONTEND: Polling timeout - credits not updated");
          setError("Credits not updated. Please refresh or contact support.");
          setIsLoading(false);
          setLoadingStage(0);
          stopPolling();
        }
        
      } catch (err) {
        console.error("❌ FRONTEND: Polling error:", err.message);
        
        if (pollAttempt >= MAX_POLLS) {
          setError("Failed to verify credit update. Please refresh the page.");
          setIsLoading(false);
          setLoadingStage(0);
          stopPolling();
        }
      }
    }, 1000); // Poll every 1 second
    
  }, [getToken, API_URL, stopPolling]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopPolling();
    };
  }, [stopPolling]);

  useEffect(() => {
    console.log("\n" + "═".repeat(70));
    console.log("🎨 FRONTEND: Payment Component Mounted");
    console.log("═".repeat(70));
    console.log("👤 Is Signed In:", isSignedIn);
    console.log("👤 User ID:", userId);
    
    if (authLoaded && !isSignedIn) {
      console.error("❌ FRONTEND: User not authenticated!");
      navigate("/sign-in");
    }
    
    console.log("═".repeat(70) + "\n");
  }, [authLoaded, isSignedIn, userId, navigate]);

  const fetchUserData = useCallback(async () => {
    try {
      setIsFetchingData(true);
      
      if (!isSignedIn) {
        console.error("❌ FRONTEND: Not signed in");
        return;
      }

      const token = await getToken();
      
      if (!token) {
        console.error("❌ FRONTEND: No token");
        setError("Session expired. Please log in again.");
        setTimeout(() => navigate("/sign-in"), 2000);
        return;
      }

      const response = await axios.get(`${API_URL}/payments/user-payments`, {
        headers: { 
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      console.log("✅ FRONTEND: User data fetched");
      console.log("💰 Current Credits:", response.data?.credits || 0);

      setCredits(response.data?.credits || 0);
      setPayments(response.data?.payments || []);
    } catch (err) {
      console.error("❌ FRONTEND: Failed to fetch user data:", err.message);
      
      if (err.response?.status === 401) {
        setError("Session expired. Please log in again.");
        setTimeout(() => navigate("/sign-in"), 2000);
      }
    } finally {
      setIsFetchingData(false);
    }
  }, [getToken, API_URL, isSignedIn, navigate]);

  useEffect(() => {
    if (authLoaded && isSignedIn) {
      fetchUserData();
    }
  }, [authLoaded, isSignedIn, fetchUserData]);

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
        console.log("✅ FRONTEND: Razorpay SDK loaded");
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
    stopPolling(); // Stop any existing polling

    try {
      // Verify auth state
      if (!authLoaded || !isSignedIn || !userId) {
        throw new Error("Please sign in to continue");
      }

      // Get auth token
      const token = await getToken();
      if (!token) {
        throw new Error("Session expired. Please log in again.");
      }

      // Stage 1: Load Razorpay SDK
      setLoadingStage(0);
      const scriptLoaded = await loadRazorpayScript();
      if (!scriptLoaded) {
        throw new Error("Failed to load payment gateway");
      }
      await new Promise((resolve) => setTimeout(resolve, 500));

      // Stage 2: Create order
      setLoadingStage(1);
      console.log("📞 FRONTEND: Creating order...");
      
      const orderResponse = await axios.post(
        `${API_URL}/payments/create-order`,
        {},
        { 
          headers: { 
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json'
          },
          timeout: 30000
        }
      );

      console.log("✅ FRONTEND: Order created");
      const { orderId, amount, currency, key } = orderResponse.data;
      
      if (!orderId) {
        throw new Error("Failed to create payment order");
      }

      await new Promise((resolve) => setTimeout(resolve, 500));

      // Stage 3: Open Razorpay
      setLoadingStage(2);
      
      const options = {
        key: key || RAZORPAY_KEY,
        amount,
        currency,
        name: "Resume Builder Pro",
        description: "10 Resume Credits",
        order_id: orderId,
        
        // 🔥 CRITICAL: Payment success handler
        handler: async (response) => {
          console.log("\n" + "═".repeat(70));
          console.log("✅ FRONTEND: RAZORPAY PAYMENT SUCCESSFUL!");
          console.log("═".repeat(70));
          console.log("🆔 Payment ID:", response.razorpay_payment_id);
          console.log("═".repeat(70) + "\n");
          
          setLoadingStage(3);
          await verifyPayment(response);
        },
        
        prefill: {
          name: user?.fullName || "",
          email: user?.primaryEmailAddress?.emailAddress || "",
          contact: user?.primaryPhoneNumber?.phoneNumber || "",
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

      const razorpay = new window.Razorpay(options);
      
      razorpay.on('payment.failed', function (response) {
        console.error("❌ FRONTEND: RAZORPAY PAYMENT FAILED!");
        console.error("Error:", response.error.description);
        
        setError(`Payment failed: ${response.error.description}`);
        setIsLoading(false);
        setLoadingStage(0);
      });

      razorpay.open();
      setIsLoading(false);
      
    } catch (err) {
      console.error("❌ FRONTEND: PAYMENT ERROR:", err.message);
      
      let errorMessage = "Payment failed. Please try again.";
      
      if (err.response?.status === 401) {
        errorMessage = "Session expired. Please log in again.";
        setTimeout(() => navigate("/sign-in"), 2000);
      } else if (err.message) {
        errorMessage = err.message;
      }
      
      setError(errorMessage);
      setIsLoading(false);
      setLoadingStage(0);
    }
  };

  // 🔥 FIXED: Verify payment with polling
  const verifyPayment = async (paymentResponse) => {
    try {
      console.log("\n" + "═".repeat(70));
      console.log("📞 FRONTEND: Verifying payment...");
      console.log("═".repeat(70));

      const token = await getToken();
      if (!token) {
        throw new Error("Authentication failed");
      }

      const currentCredits = credits;
      const expectedCredits = currentCredits + 10; // PAYMENT_CONFIG.CREDITS_PER_PAYMENT

      console.log("📊 FRONTEND: Credit expectations:");
      console.log("   Current:", currentCredits);
      console.log("   Expected after payment:", expectedCredits);

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
          },
          timeout: 30000
        }
      );

      console.log("✅ FRONTEND: Payment verified!");
      console.log("📋 Response:", response.data);

      // 🔥 NEW: Start polling for credit update
      console.log("🔄 FRONTEND: Starting credit verification polling...");
      await pollForCreditUpdate(paymentResponse.razorpay_payment_id, expectedCredits);
      
    } catch (err) {
      console.error("❌ FRONTEND: VERIFICATION FAILED!");
      console.error("Error:", err.message);
      console.error("Response:", err.response?.data);
      
      let errorMessage = "Payment verification failed.";
      
      if (err.response?.status === 401) {
        errorMessage = "Session expired. Please contact support with your payment ID.";
      } else if (err.response?.data?.error) {
        errorMessage = err.response.data.error;
      }
      
      if (err.response?.data?.needsManualIntervention) {
        errorMessage += " Your payment was processed. If credits don't appear, contact support.";
      }
      
      setError(errorMessage);
      setIsLoading(false);
      setLoadingStage(0);
      stopPolling();
    }
  };

  if (!authLoaded || !userLoaded) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900">
        <div className="text-center">
          <Loader2 className="w-12 h-12 animate-spin text-violet-400 mx-auto mb-4" />
          <p className="text-white text-lg">Loading...</p>
        </div>
      </div>
    );
  }

  if (!isSignedIn) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900">
        <div className="text-center">
          <AlertCircle className="w-12 h-12 text-red-400 mx-auto mb-4" />
          <p className="text-white text-lg mb-4">Please sign in to continue</p>
          <button
            onClick={() => navigate("/sign-in")}
            className="px-6 py-3 bg-violet-600 text-white rounded-lg hover:bg-violet-700"
          >
            Go to Sign In
          </button>
        </div>
      </div>
    );
  }

  const CurrentStageIcon = loadingStages[loadingStage]?.icon || Shield;
  const PAYMENT_CONFIG = { CREDITS_PER_PAYMENT: 10 };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 p-4 sm:p-6 pt-24 sm:pt-32 relative overflow-hidden">
      
      {/* Animated Background */}
      <div className="absolute top-20 left-10 w-72 h-72 bg-purple-500 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-blob"></div>
      <div className="absolute top-40 right-10 w-72 h-72 bg-violet-500 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-blob animation-delay-2000"></div>
      <div className="absolute -bottom-8 left-20 w-72 h-72 bg-pink-500 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-blob animation-delay-4000"></div>

      <div className="relative z-10 w-full max-w-6xl">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold text-white leading-tight mb-4">
            Unlock Your
            <span className="block bg-gradient-to-r from-violet-400 via-purple-400 to-pink-400 bg-clip-text text-transparent">
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

          {/* Payment Card */}
          <div className="relative lg:col-span-2">
            <div className="absolute -inset-1 bg-gradient-to-r from-pink-600 via-purple-600 to-violet-600 rounded-2xl blur-xl opacity-50"></div>
            <div className="relative bg-white/10 backdrop-blur-2xl border border-white/20 rounded-2xl p-8 shadow-2xl">
              
              {/* Loading Overlay */}
              {(isLoading || isPolling) && (
                <div className="absolute inset-0 bg-slate-900/95 backdrop-blur-md rounded-2xl flex flex-col items-center justify-center z-50 space-y-6">
                  <div className="relative">
                    <Loader2 className="w-16 h-16 animate-spin text-violet-400" />
                    <div className="absolute inset-0 flex items-center justify-center">
                      <CurrentStageIcon className="w-8 h-8 text-white animate-pulse" />
                    </div>
                  </div>
                  <div className="text-center space-y-2">
                    <p className="text-white text-xl font-semibold animate-pulse">
                      {isPolling 
                        ? `Verifying credit update... (${pollCount}s)`
                        : loadingStages[loadingStage]?.text || "Processing..."
                      }
                    </p>
                    {isPolling && (
                      <p className="text-gray-400 text-sm">
                        Please wait while we confirm your credits
                      </p>
                    )}
                  </div>
                </div>
              )}

              {/* Package Info */}
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
                  <p className="text-gray-400 text-sm">One-time</p>
                </div>
              </div>

              {/* Features */}
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

              {/* Messages */}
              {error && (
                <div className="mb-4 p-3 bg-red-500/10 border border-red-500/50 rounded-xl flex items-start space-x-3">
                  <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
                  <p className="text-red-300 text-sm">{error}</p>
                </div>
              )}

              {success && (
                <div className="mb-4 p-3 bg-green-500/10 border border-green-500/50 rounded-xl flex items-start space-x-3">
                  <CheckCircle2 className="w-5 h-5 text-green-400 flex-shrink-0 mt-0.5" />
                  <p className="text-green-300 text-sm">{success}</p>
                </div>
              )}

              {/* Payment Button */}
              <button
                onClick={handlePayment}
                disabled={isLoading || !isSignedIn || isPolling}
                className="group relative w-full py-4 px-6 rounded-xl font-semibold text-lg overflow-hidden transition-all duration-300 bg-gradient-to-r from-violet-600 to-indigo-600 hover:shadow-2xl hover:shadow-violet-500/50 hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <span className="relative z-10 flex items-center justify-center space-x-3 text-white">
                  {isLoading || isPolling ? (
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

        {/* Payment History */}
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

      <style>{`
        @keyframes blob {
          0%, 100% { transform: translate(0, 0) scale(1); }
          33% { transform: translate(30px, -50px) scale(1.1); }
          66% { transform: translate(-20px, 20px) scale(0.9); }
        }
        .animate-blob {
          animation: blob 7s infinite;
        }
        .animation-delay-2000 {
          animation-delay: 2s;
        }
        .animation-delay-4000 {
          animation-delay: 4s;
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
      `}</style>
    </div>
  );
}
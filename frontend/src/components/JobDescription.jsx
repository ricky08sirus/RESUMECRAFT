import React, { useState, useEffect } from "react";
import { useAuth } from "@clerk/clerk-react";
import { useNavigate } from "react-router-dom";
import {
  ArrowRightCircle,
  Sparkles,
  Loader2,
  AlertCircle,
  Zap,
  Brain,
  Search,
  BarChart3,
} from "lucide-react";
import axios from "axios";
import CountUp from "react-countup";

export default function JobDescription() {
  const { getToken } = useAuth();
  const navigate = useNavigate();

  const [resumeId, setResumeId] = useState(null);
  const [description, setDescription] = useState("");
  const [charCount, setCharCount] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [loadingStage, setLoadingStage] = useState(0);
  const [error, setError] = useState(null);
  const [matchScore, setMatchScore] = useState(null);
  const [analysisData, setAnalysisData] = useState(null);

  const API_URL = import.meta.env.VITE_API_URL;

  // Fetch user's latest resume
  useEffect(() => {
    const fetchLatestResume = async () => {
      try {
        const token = await getToken();
        const response = await axios.get(`${API_URL}/user/resumes`, {
          headers: { Authorization: `Bearer ${token}` },
        });

        const resumes = response.data?.resumes || response.data?.data || [];
        if (resumes.length > 0) {
          setResumeId(resumes[0]._id || resumes[0].id);
        } else {
          setError("No resume found. Please create a resume first.");
        }
      } catch (err) {
        console.error("❌ Failed to fetch resume:", err);
        setError("Failed to load resume. Please try again.");
      }
    };

    fetchLatestResume();
  }, [getToken, API_URL]);

  const loadingStages = [
    { icon: Search, text: "Extracting key requirements...", color: "from-blue-500 to-cyan-500" },
    { icon: Brain, text: "Analyzing with AI...", color: "from-purple-500 to-pink-500" },
    { icon: Zap, text: "Matching with your resume...", color: "from-orange-500 to-red-500" },
    { icon: BarChart3, text: "Computing match score...", color: "from-green-500 to-emerald-500" },
  ];

  const handleChange = (e) => {
    const text = e.target.value;
    setDescription(text);
    setCharCount(text.length);
    setError(null);
    setMatchScore(null);
    setAnalysisData(null);
  };

  const handleSubmit = async () => {
    if (description.length < 50) {
      setError("Please enter at least 50 characters");
      return;
    }

    setIsLoading(true);
    setError(null);
    setMatchScore(null);
    setAnalysisData(null);
    setLoadingStage(0);

    try {
      const token = await getToken();
      if (!token) throw new Error("No authentication token found. Please log in.");

      // Animate through loading stages
      for (let i = 0; i < loadingStages.length; i++) {
        setLoadingStage(i);
        await new Promise((resolve) => setTimeout(resolve, 700));
      }

      const response = await axios.post(
        `${API_URL}/user/job-description`,
        { jobDescription: description },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      const score = response.data?.data?.matchScore ?? 0;
      setMatchScore(score);
      setAnalysisData(response.data?.data?.jdAnalysis);
    } catch (err) {
      console.error("❌ Analysis Error:", err);
      setError(err.response?.data?.error || err.message || "Failed to analyze job description.");
    } finally {
      setIsLoading(false);
      setLoadingStage(0);
    }
  };

  const handleCustomizeResume = async () => {
    if (!resumeId) {
      setError("Resume ID not found. Please create a resume first.");
      return;
    }

    try {
      setIsLoading(true);
      setError(null);

      const token = await getToken();

      // 💳 Deduct 1 credit before customization
      try {
        const res = await axios.post(
          `${API_URL}/api/payments/deduct-credits`,
          { amount: 1, reason: "Customized resume" },
          { headers: { Authorization: `Bearer ${token}` } }
        );
        console.log("✅ Credits deducted. New balance:", res.data.newCredits);
      } catch (deductErr) {
        console.error("❌ Credit deduction failed:", deductErr);
        setError(
          deductErr.response?.data?.error || "Insufficient credits. Please top up."
        );
        setIsLoading(false);
        return;
      }

      console.log("📤 Sending customization request:", { resumeId, jobDescription: description });

      const response = await axios.post(
        `${API_URL}/customize-resume`,
        { resumeId, jobDescription: description },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      console.log("✅ Customization response:", response.data);

      const { jobId } = response.data;

      navigate("/customize-resume", {
        state: { resumeId, jobDescription: description, jobId },
      });
    } catch (err) {
      console.error("❌ Customize Error:", err);
      console.error("Error response:", err.response?.data);
      setError(err.response?.data?.error || err.message || "Failed to enqueue customization.");
    } finally {
      setIsLoading(false);
    }
  };

  const CurrentStageIcon = loadingStages[loadingStage]?.icon || Search;

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 p-4 sm:p-6 pt-24 sm:pt-32 relative overflow-hidden">
      {/* Animated Background */}
      <div className="absolute top-20 left-10 w-72 h-72 bg-purple-500 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-blob"></div>
      <div className="absolute top-40 right-10 w-72 h-72 bg-violet-500 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-blob animation-delay-2000"></div>
      <div className="absolute -bottom-8 left-20 w-72 h-72 bg-pink-500 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-blob animation-delay-4000"></div>

      <div className="relative z-10 w-full max-w-4xl">
        <div className="text-center mb-8">
          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold text-white leading-tight mb-4">
            Target Job
            <span className="block bg-gradient-to-r from-violet-400 via-purple-400 to-pink-400 bg-clip-text text-transparent animate-gradient">
              Description
            </span>
          </h1>
          <p className="text-xl text-gray-300 max-w-2xl mx-auto">
            Paste the job description you're targeting. Our AI will analyze how well your resume matches.
          </p>
        </div>

        <div className="relative">
          <div className="absolute -inset-1 bg-gradient-to-r from-violet-600 via-purple-600 to-pink-600 rounded-3xl blur-2xl opacity-50"></div>
          <div className="relative bg-white/10 backdrop-blur-2xl border border-white/20 rounded-3xl p-6 sm:p-10 shadow-2xl">
            {isLoading && (
              <div className="absolute inset-0 bg-slate-900/95 backdrop-blur-md rounded-3xl flex flex-col items-center justify-center z-50 space-y-6">
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

            <div className="space-y-6">
              {error && (
                <div className="p-4 bg-red-500/10 border border-red-500/50 rounded-xl flex items-start space-x-3 animate-shake">
                  <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
                  <p className="text-red-300 text-sm">{error}</p>
                </div>
              )}

              {matchScore !== null && !isLoading && (
                <div className="animate-fadeIn">
                  <div className="flex flex-col items-center justify-center space-y-6 p-8 bg-gradient-to-br from-violet-500/10 to-pink-500/10 rounded-2xl border border-violet-500/30">
                    <div className="relative w-48 h-48">
                      <svg className="w-full h-full transform -rotate-90">
                        <circle cx="96" cy="96" r="88" stroke="#ffffff10" strokeWidth="12" fill="none" />
                        <circle
                          cx="96"
                          cy="96"
                          r="88"
                          stroke="url(#scoreGradient)"
                          strokeWidth="12"
                          fill="none"
                          strokeDasharray={2 * Math.PI * 88}
                          strokeDashoffset={(1 - matchScore / 100) * 2 * Math.PI * 88}
                          strokeLinecap="round"
                          className="transition-all duration-2000 ease-out"
                        />
                        <defs>
                          <linearGradient id="scoreGradient" x1="0" y1="0" x2="1" y2="1">
                            <stop offset="0%" stopColor="#8b5cf6" />
                            <stop offset="100%" stopColor="#ec4899" />
                          </linearGradient>
                        </defs>
                      </svg>
                      <div className="absolute inset-0 flex items-center justify-center">
                        <div className="text-center">
                          <h3 className="text-white text-5xl font-bold">
                            <CountUp end={matchScore} duration={2} />%
                          </h3>
                          <p className="text-gray-300 text-sm mt-2">Match Score</p>
                        </div>
                      </div>
                    </div>

                    <div className="text-center">
                      <button
                        onClick={handleCustomizeResume}
                        disabled={isLoading || !resumeId}
                        className="group px-8 py-4 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-xl font-semibold shadow-lg hover:scale-105 transition-transform hover:shadow-2xl hover:shadow-purple-500/50 disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2"
                      >
                        <Sparkles className="w-5 h-5" />
                        <span>Customize Resume</span>
                        <ArrowRightCircle className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                      </button>
                    </div>
                  </div>
                </div>
              )}

              <div className="relative">
                <textarea
                  className="w-full h-64 sm:h-80 p-6 rounded-2xl bg-white/10 text-white border-2 border-white/20 focus:border-violet-500 outline-none transition-all resize-none placeholder-gray-400"
                  placeholder="Paste the complete job description here..."
                  value={description}
                  onChange={handleChange}
                  disabled={isLoading}
                  required
                />
                <div className="absolute bottom-4 right-4 px-3 py-1 bg-white/10 backdrop-blur-sm rounded-lg border border-white/20">
                  <span
                    className={`text-sm font-medium ${
                      charCount > 0 ? "text-violet-300" : "text-gray-400"
                    }`}
                  >
                    {charCount} characters
                  </span>
                </div>
              </div>

              <button
                type="button"
                onClick={handleSubmit}
                disabled={description.length < 50 || isLoading}
                className={`group relative w-full py-5 px-6 rounded-xl font-semibold text-lg overflow-hidden transition-all duration-300
                  ${
                    description.length >= 50 && !isLoading
                      ? "bg-gradient-to-r from-violet-600 to-indigo-600 hover:shadow-2xl hover:shadow-violet-500/50 hover:scale-[1.02] active:scale-[0.98]"
                      : "bg-gray-600 cursor-not-allowed opacity-50"
                  }`}
              >
                <span className="relative z-10 flex items-center justify-center space-x-3 text-white">
                  {isLoading ? (
                    <>
                      <Loader2 className="w-6 h-6 animate-spin" />
                      <span>Analyzing...</span>
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-6 h-6" />
                      <span>Analyze Job Match</span>
                      <ArrowRightCircle className="w-6 h-6 group-hover:translate-x-1 transition-transform" />
                    </>
                  )}
                </span>
              </button>
            </div>
          </div>
        </div>
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
      `}</style>
    </div>
  );
}

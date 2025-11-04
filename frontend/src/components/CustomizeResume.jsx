import React, { useState, useEffect } from "react";
import { useAuth, useUser } from "@clerk/clerk-react";
import { useLocation, useNavigate } from "react-router-dom";
import axios from "axios";
import { jsPDF } from "jspdf";
import {
  CheckCircle2,
  AlertCircle,
  Sparkles,
  ArrowLeft,
  Zap,
  Brain,
  FileText,
  Download,
  TrendingUp,
  Target,
  Award,
  Trophy,
  Star,
  Loader2,
  RefreshCw,
  MessageSquare,
  Send,
  Copy,
  Check,
  BarChart3,
  Mail,
  Linkedin,
} from "lucide-react";

const API_URL = import.meta.env.VITE_API_URL;

export default function CustomizeResume() {
  const { getToken } = useAuth();
  const { user } = useUser();
  const location = useLocation();
  const navigate = useNavigate();

  const {
    resumeId,
    jobDescription: initialJobDescription,
    jobId: initialJobId,
  } = location.state || {};

  const [customizedResume, setCustomizedResume] = useState(null);
  const [matchScore, setMatchScore] = useState(null);
  const [shortlistChance, setShortlistChance] = useState(null);
  const [analysisSummary, setAnalysisSummary] = useState(null);
  const [linkedinTeaser, setLinkedinTeaser] = useState(null);
  const [isLoading, setIsLoading] = useState(!!initialJobId);
  const [isTeaserLoading, setIsTeaserLoading] = useState(false);
  const [error, setError] = useState(null);
  const [progress, setProgress] = useState(0);
  const [copiedTeaser, setCopiedTeaser] = useState(false);
  const [teaserJobId, setTeaserJobId] = useState(null);

  const [retryCount, setRetryCount] = useState(0);
  const MAX_RETRIES = 3;

  const loadingMessages = [
    { icon: Brain, text: "Analyzing job requirements with AI...", progress: 20 },
    { icon: FileText, text: "Processing your professional profile...", progress: 40 },
    { icon: Zap, text: "Optimizing content for maximum impact...", progress: 60 },
    { icon: Sparkles, text: "Enhancing keywords and phrases...", progress: 80 },
    { icon: CheckCircle2, text: "Finalizing your executive resume...", progress: 95 },
  ];

  /* ------------------------ Polling for Job Status ------------------------ */
  useEffect(() => {
    if (!initialJobId) return;

    let messageIndex = 0;
    const messageInterval = setInterval(() => {
      if (messageIndex < loadingMessages.length) {
        setProgress(loadingMessages[messageIndex].progress);
        messageIndex++;
      }
    }, 2500);

    let attempt = 0;
    const pollInterval = setInterval(async () => {
      try {
        const token = await getToken();
        const res = await axios.get(`${API_URL}/resume-job-status/${initialJobId}`, {
          headers: { Authorization: `Bearer ${token}` },
          timeout: 10000,
        });

        if (res.data.status === "completed") {
          setCustomizedResume(res.data.customizedText);
          setMatchScore(res.data.matchScore);
          setShortlistChance(res.data.shortlistChance);
          setAnalysisSummary(res.data.analysisSummary);
          setIsLoading(false);
          setProgress(100);
          clearInterval(pollInterval);
          clearInterval(messageInterval);
        } else if (res.data.status === "failed") {
          throw new Error(res.data.error || "Resume customization failed");
        }

        attempt++;
        if (attempt > 60) {
          throw new Error("Request timed out. Please retry.");
        }
      } catch (err) {
        console.warn("⚠️ Polling error:", err.message);

        if (retryCount < MAX_RETRIES) {
          setRetryCount((r) => r + 1);
        } else {
          setError("Customization took too long or failed. Please retry.");
          setIsLoading(false);
          clearInterval(pollInterval);
          clearInterval(messageInterval);
        }
      }
    }, 3000);

    return () => {
      clearInterval(pollInterval);
      clearInterval(messageInterval);
    };
  }, [initialJobId, getToken, retryCount]);

  /* -------------------- LinkedIn Teaser Generation -------------------- */
  const generateLinkedInTeaser = async () => {
    if (!resumeId) {
      setError("Resume ID not found. Please try again.");
      return;
    }
    
    setIsTeaserLoading(true);
    setLinkedinTeaser(null);
    
    try {
      const token = await getToken();
      
      const res = await axios.post(
        `${API_URL}/generate-linkedin-teaser`,
        { resumeId },
        { 
          headers: { Authorization: `Bearer ${token}` },
          timeout: 15000 
        }
      );

      if (res.data.success && res.data.jobId) {
        const jobId = res.data.jobId;
        setTeaserJobId(jobId);
        pollTeaserStatus(jobId);
      } else {
        throw new Error("Failed to queue teaser generation");
      }
    } catch (err) {
      setIsTeaserLoading(false);
      setError(err.response?.data?.error || "Failed to generate LinkedIn teaser. Please try again.");
    }
  };

  /* -------------------- Poll Teaser Status -------------------- */
  const pollTeaserStatus = (jobId) => {
    let attempt = 0;
    const MAX_ATTEMPTS = 40;
    
    const pollInterval = setInterval(async () => {
      try {
        const token = await getToken();
        
        const res = await axios.get(`${API_URL}/teaser-status/${jobId}`, {
          headers: { Authorization: `Bearer ${token}` },
          timeout: 10000,
        });

        if (res.data.status === "completed") {
          setLinkedinTeaser(res.data.teaser);
          setIsTeaserLoading(false);
          clearInterval(pollInterval);
        } else if (res.data.status === "failed") {
          throw new Error(res.data.error || "Teaser generation failed");
        }

        attempt++;
        if (attempt >= MAX_ATTEMPTS) {
          throw new Error("Teaser generation timed out. Please try again.");
        }
      } catch (err) {
        setIsTeaserLoading(false);
        setError(err.message || "Failed to retrieve teaser. Please retry.");
        clearInterval(pollInterval);
      }
    }, 2000);
  };

  /* ----------------------------- Text Cleaner ----------------------------- */
  const cleanText = (text) => {
    return text
      .replace(/#{1,6}\s+/g, "")
      .replace(/\*\*\*(.+?)\*\*\*/g, "$1")
      .replace(/\*\*(.+?)\*\*/g, "$1")
      .replace(/\*(.+?)\*/g, "$1")
      .replace(/```[\s\S]*?```/g, "")
      .replace(/`(.+?)`/g, "$1")
      .replace(/\[([^\]]+)\]\([^\)]+\)/g, "$1")
      .replace(/[#*_`~]/g, "")
      .trim();
  };

  /* ==================== ULTRA-PREMIUM PDF GENERATION ==================== */
  const handleDownload = () => {
    if (!customizedResume) return;

    const userName = user?.fullName || user?.firstName || "Professional";
    const userEmail = user?.primaryEmailAddress?.emailAddress || "";
    const userPhone = user?.primaryPhoneNumber?.phoneNumber || "";
    const sanitizedName = userName.replace(/[^a-zA-Z0-9]/g, '_');

    const doc = new jsPDF({ 
      orientation: "portrait", 
      unit: "pt", 
      format: "a4",
      compress: true 
    });
    
    // Ultra-Premium Color Palette
    const colors = {
      navy: [31, 41, 55],           // Deep navy
      burgundy: [136, 14, 79],      // Rich burgundy
      gold: [197, 155, 72],         // Luxury gold
      royal: [37, 99, 235],         // Royal blue
      charcoal: [45, 55, 72],       // Charcoal
      slate: [100, 116, 139],       // Slate
      black: [17, 24, 39],          // Rich black
    };

    const margin = 45;
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const contentWidth = pageWidth - (margin * 2);
    let yPos = margin - 10;

    // Watermark at bottom
    const addWatermark = () => {
      doc.saveGraphicsState();
      doc.setGState(new doc.GState({ opacity: 0.03 }));
      doc.setFont("times", "italic");
      doc.setFontSize(9);
      doc.setTextColor(...colors.navy);
      const wm = userName.toUpperCase();
      const wmWidth = doc.getTextWidth(wm);
      doc.text(wm, (pageWidth - wmWidth) / 2, pageHeight - 18);
      doc.restoreGraphicsState();
    };

    // Page number
    const addPageNum = (num) => {
      if (num > 1) {
        doc.setFont("helvetica", "normal");
        doc.setFontSize(8);
        doc.setTextColor(...colors.slate);
        doc.text(`${num}`, pageWidth / 2, pageHeight - 30, { align: "center" });
      }
    };

    // Top accent bar
    doc.setFillColor(...colors.burgundy);
    doc.rect(0, 0, pageWidth, 3, "F");
    
    doc.setFillColor(...colors.gold);
    doc.rect(0, 3, 50, 1, "F");
    doc.rect(pageWidth - 50, 3, 50, 1, "F");

    addWatermark();

    yPos = margin + 15;

    // USER NAME - Large, Bold, Centered
    doc.setFont("times", "bold");
    doc.setFontSize(32);
    doc.setTextColor(...colors.burgundy);
    const nameWidth = doc.getTextWidth(userName.toUpperCase());
    doc.text(userName.toUpperCase(), (pageWidth - nameWidth) / 2, yPos);
    yPos += 20;

    // CONTACT INFO - Centered
    if (userEmail || userPhone) {
      const contact = [];
      if (userEmail) contact.push(userEmail);
      if (userPhone) contact.push(userPhone);
      
      doc.setFont("helvetica", "normal");
      doc.setFontSize(9);
      doc.setTextColor(...colors.charcoal);
      const contactLine = contact.join('  •  ');
      const contactWidth = doc.getTextWidth(contactLine);
      doc.text(contactLine, (pageWidth - contactWidth) / 2, yPos);
      yPos += 16;
    }

    // ELEGANT DIVIDER
    yPos += 5;
    doc.setDrawColor(...colors.burgundy);
    doc.setLineWidth(1.5);
    doc.line(margin, yPos, pageWidth - margin, yPos);
    
    doc.setFillColor(...colors.gold);
    doc.circle(margin, yPos, 2.5, "F");
    doc.circle(pageWidth - margin, yPos, 2.5, "F");
    
    yPos += 22;

    let pageNum = 1;

    // Process resume content
    const cleaned = cleanText(customizedResume);
    const lines = cleaned.split('\n');

    const sections = [
      'SUMMARY', 'PROFILE', 'OBJECTIVE',
      'SKILLS', 'TECHNICAL SKILLS', 'COMPETENCIES',
      'EXPERIENCE', 'WORK EXPERIENCE', 'PROFESSIONAL EXPERIENCE',
      'EDUCATION', 'QUALIFICATIONS',
      'CERTIFICATIONS', 'CERTIFICATES',
      'PROJECTS', 'ACHIEVEMENTS', 'AWARDS'
    ];

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      
      if (!line) {
        yPos += 5;
        continue;
      }

      // Page break check
      if (yPos > pageHeight - 70) {
        addPageNum(pageNum);
        doc.addPage();
        pageNum++;
        doc.setFillColor(...colors.burgundy);
        doc.rect(0, 0, pageWidth, 3, "F");
        doc.setFillColor(...colors.gold);
        doc.rect(0, 3, 50, 1, "F");
        doc.rect(pageWidth - 50, 3, 50, 1, "F");
        addWatermark();
        yPos = margin + 10;
      }

      // Check if section header
      const upper = line.toUpperCase();
      const isSection = sections.some(s => upper === s || upper.startsWith(s + ':'));

      if (isSection) {
        yPos += 12;
        
        // SECTION HEADER
        doc.setFont("helvetica", "bold");
        doc.setFontSize(12);
        doc.setTextColor(...colors.royal);
        doc.text(upper.replace(/[:\-]/g, '').trim(), margin, yPos);
        
        yPos += 4;
        const hw = Math.min(doc.getTextWidth(upper) + 5, contentWidth * 0.4);
        doc.setDrawColor(...colors.royal);
        doc.setLineWidth(1.2);
        doc.line(margin, yPos, margin + hw, yPos);
        
        doc.setFillColor(...colors.gold);
        doc.circle(margin + hw + 3, yPos, 1.5, "F");
        
        yPos += 16;
        
      } else if (line.match(/^[•\-\*]\s/)) {
        // BULLET POINT
        const bulletText = line.replace(/^[•\-\*]\s*/, '').trim();
        const bulletLines = doc.splitTextToSize(bulletText, contentWidth - 18);
        
        doc.setFont("helvetica", "normal");
        doc.setFontSize(10);
        doc.setTextColor(...colors.black);
        
        bulletLines.forEach((bl, idx) => {
          if (yPos > pageHeight - 70) {
            addPageNum(pageNum);
            doc.addPage();
            pageNum++;
            doc.setFillColor(...colors.burgundy);
            doc.rect(0, 0, pageWidth, 3, "F");
            doc.setFillColor(...colors.gold);
            doc.rect(0, 3, 50, 1, "F");
            doc.rect(pageWidth - 50, 3, 50, 1, "F");
            addWatermark();
            yPos = margin + 10;
          }
          
          if (idx === 0) {
            doc.setFillColor(...colors.royal);
            doc.circle(margin + 6, yPos - 3, 2, "F");
            doc.setFillColor(...colors.gold);
            doc.circle(margin + 6, yPos - 3, 0.8, "F");
          }
          
          doc.text(bl, margin + 18, yPos);
          yPos += 13;
        });
        
      } else {
        // REGULAR TEXT - Left aligned (better readability)
        const textLines = doc.splitTextToSize(line, contentWidth);
        
        doc.setFont("helvetica", "normal");
        doc.setFontSize(10);
        doc.setTextColor(...colors.black);
        
        textLines.forEach(tl => {
          if (yPos > pageHeight - 70) {
            addPageNum(pageNum);
            doc.addPage();
            pageNum++;
            doc.setFillColor(...colors.burgundy);
            doc.rect(0, 0, pageWidth, 3, "F");
            doc.setFillColor(...colors.gold);
            doc.rect(0, 3, 50, 1, "F");
            doc.rect(pageWidth - 50, 3, 50, 1, "F");
            addWatermark();
            yPos = margin + 10;
          }
          
          doc.text(tl, margin, yPos);
          yPos += 13;
        });
        
        yPos += 3;
      }
    }

    addPageNum(pageNum);

    doc.save(`${sanitizedName}_Professional_Resume.pdf`);
  };

  /* ----------------------------- Copy Teaser ----------------------------- */
  const copyTeaserToClipboard = () => {
    if (linkedinTeaser) {
      navigator.clipboard.writeText(linkedinTeaser);
      setCopiedTeaser(true);
      setTimeout(() => setCopiedTeaser(false), 2000);
    }
  };

  /* ----------------------------- UI Helpers ----------------------------- */
  const getScoreColor = (score) => {
    if (score >= 80) return "from-emerald-500 to-green-600";
    if (score >= 60) return "from-amber-500 to-yellow-600";
    return "from-rose-500 to-red-600";
  };

  const getScoreBadge = (score) => {
    if (score >= 80) return { text: "Excellent Match", color: "emerald", icon: Trophy };
    if (score >= 60) return { text: "Good Match", color: "amber", icon: Star };
    return { text: "Needs Improvement", color: "rose", icon: Target };
  };

  const getChanceLevel = (chance) => {
    if (chance >= 80) return { text: "Excellent", color: "emerald", icon: Trophy };
    if (chance >= 60) return { text: "Strong", color: "amber", icon: Award };
    if (chance >= 40) return { text: "Moderate", color: "orange", icon: Target };
    return { text: "Low", color: "rose", icon: AlertCircle };
  };

  const currentMessage =
    loadingMessages[Math.floor((progress / 100) * loadingMessages.length)] ||
    loadingMessages[0];
  const CurrentIcon = currentMessage.icon;

  /* ---------------------------- Retry Handling ---------------------------- */
  const handleRetry = () => {
    setError(null);
    setIsLoading(true);
    setRetryCount(0);
    setProgress(0);
  };

  const retryTeaserGeneration = () => {
    setError(null);
    generateLinkedInTeaser();
  };

  /* ----------------------------- UI Rendering ----------------------------- */
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 pt-24 pb-12 px-4 sm:px-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <button
            onClick={() => navigate(-1)}
            className="flex items-center gap-2 text-purple-300 hover:text-white transition-colors group"
          >
            <ArrowLeft className="w-5 h-5 group-hover:-translate-x-1 transition-transform" />
            <span className="font-medium">Back</span>
          </button>
          
          <div className="text-center flex-1">
            <h1 className="text-4xl md:text-5xl font-bold text-white mb-2">
              Resume <span className="text-purple-400">Analysis</span>
            </h1>
            <p className="text-purple-200 text-sm">AI-Powered Professional Optimization</p>
          </div>

          <div className="w-20"></div>
        </div>

        {/* Loading State */}
        {isLoading && (
          <div className="bg-white/10 backdrop-blur-xl rounded-3xl p-12 shadow-2xl border border-white/20">
            <div className="text-center">
              <div className="w-20 h-20 bg-gradient-to-br from-purple-500 to-pink-600 rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-lg animate-pulse">
                <CurrentIcon className="w-10 h-10 text-white" />
              </div>
              
              <h2 className="text-2xl font-bold text-white mb-3">
                {currentMessage.text}
              </h2>
              
              <div className="max-w-md mx-auto">
                <div className="h-3 bg-white/10 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-purple-500 via-pink-500 to-indigo-500 transition-all duration-1000 ease-out rounded-full"
                    style={{ width: `${progress}%` }}
                  />
                </div>
                <p className="text-purple-200 mt-3 text-sm font-medium">
                  {progress}% Complete
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Error State */}
        {error && !isLoading && !customizedResume && (
          <div className="bg-red-500/10 backdrop-blur-xl rounded-3xl p-10 shadow-2xl border-2 border-red-500/30">
            <div className="text-center">
              <div className="w-16 h-16 bg-red-500/20 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <AlertCircle className="w-8 h-8 text-red-400" />
              </div>
              <h3 className="text-2xl font-bold text-white mb-2">
                Something Went Wrong
              </h3>
              <p className="text-red-200 mb-6 max-w-md mx-auto">{error}</p>
              <button
                onClick={handleRetry}
                className="px-8 py-4 bg-gradient-to-r from-purple-600 to-pink-600 rounded-xl text-white font-semibold hover:shadow-lg hover:scale-105 transition-all flex items-center justify-center mx-auto gap-2"
              >
                <RefreshCw className="w-5 h-5" />
                Retry Analysis
              </button>
            </div>
          </div>
        )}

        {/* Success State */}
        {customizedResume && !isLoading && (
          <div className="space-y-6">
            {/* Metrics Cards */}
            {(matchScore || shortlistChance) && (
              <div className="grid md:grid-cols-2 gap-6">
                {matchScore && (
                  <div className="bg-white/10 backdrop-blur-xl rounded-2xl p-8 shadow-xl border border-white/20 hover:bg-white/15 transition-all">
                    <div className="flex items-start justify-between mb-6">
                      <div>
                        <p className="text-sm font-medium text-purple-300 uppercase tracking-wide mb-2">
                          Match Score
                        </p>
                        <div className="flex items-baseline gap-2">
                          <span className={`text-5xl font-bold bg-gradient-to-r ${getScoreColor(matchScore)} bg-clip-text text-transparent`}>
                            {matchScore}
                          </span>
                          <span className="text-2xl font-semibold text-white/50">%</span>
                        </div>
                      </div>
                      <div className={`w-14 h-14 bg-gradient-to-br ${getScoreColor(matchScore)} rounded-xl flex items-center justify-center shadow-lg`}>
                        <BarChart3 className="w-7 h-7 text-white" />
                      </div>
                    </div>
                    
                    {(() => {
                      const badge = getScoreBadge(matchScore);
                      const BadgeIcon = badge.icon;
                      return (
                        <div className={`inline-flex items-center gap-2 px-4 py-2 bg-${badge.color}-500/20 text-${badge.color}-300 rounded-full text-sm font-semibold border border-${badge.color}-500/30`}>
                          <BadgeIcon className="w-4 h-4" />
                          {badge.text}
                        </div>
                      );
                    })()}
                  </div>
                )}

                {shortlistChance && (
                  <div className="bg-white/10 backdrop-blur-xl rounded-2xl p-8 shadow-xl border border-white/20 hover:bg-white/15 transition-all">
                    <div className="flex items-start justify-between mb-6">
                      <div>
                        <p className="text-sm font-medium text-purple-300 uppercase tracking-wide mb-2">
                          Shortlist Probability
                        </p>
                        <div className="flex items-baseline gap-2">
                          <span className={`text-5xl font-bold bg-gradient-to-r ${getScoreColor(shortlistChance)} bg-clip-text text-transparent`}>
                            {shortlistChance}
                          </span>
                          <span className="text-2xl font-semibold text-white/50">%</span>
                        </div>
                      </div>
                      <div className={`w-14 h-14 bg-gradient-to-br ${getScoreColor(shortlistChance)} rounded-xl flex items-center justify-center shadow-lg`}>
                        <TrendingUp className="w-7 h-7 text-white" />
                      </div>
                    </div>
                    
                    {(() => {
                      const level = getChanceLevel(shortlistChance);
                      const LevelIcon = level.icon;
                      return (
                        <div className={`inline-flex items-center gap-2 px-4 py-2 bg-${level.color}-500/20 text-${level.color}-300 rounded-full text-sm font-semibold border border-${level.color}-500/30`}>
                          <LevelIcon className="w-4 h-4" />
                          {level.text} Chance
                        </div>
                      );
                    })()}
                  </div>
                )}
              </div>
            )}

            {/* Analysis Summary */}
            {analysisSummary && (
              <div className="bg-purple-500/10 backdrop-blur-xl rounded-2xl p-8 border border-purple-500/30 shadow-xl">
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 bg-gradient-to-br from-purple-500 to-pink-600 rounded-xl flex items-center justify-center flex-shrink-0 shadow-lg">
                    <Brain className="w-6 h-6 text-white" />
                  </div>
                  <div className="flex-1">
                    <h3 className="text-lg font-bold text-white mb-2">
                      AI Analysis Summary
                    </h3>
                    <p className="text-purple-100 leading-relaxed">
                      {analysisSummary}
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Optimized Resume */}
            <div className="bg-white/10 backdrop-blur-xl rounded-2xl shadow-2xl border border-white/20 overflow-hidden">
              <div className="bg-gradient-to-r from-purple-600 to-indigo-600 px-8 py-6 border-b border-white/10">
                <div className="flex items-center justify-between flex-wrap gap-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-white/20 rounded-lg flex items-center justify-center">
                      <FileText className="w-5 h-5 text-white" />
                    </div>
                    <div>
                      <h2 className="text-xl font-bold text-white">
                        Optimized Resume
                      </h2>
                      <p className="text-purple-100 text-sm">
                        AI-enhanced professional document
                      </p>
                    </div>
                  </div>
                  
                  <button
                    onClick={handleDownload}
                    className="px-6 py-3 bg-white text-purple-600 font-semibold rounded-xl hover:bg-purple-50 transition-all flex items-center gap-2 shadow-lg hover:shadow-xl hover:scale-105"
                  >
                    <Download className="w-5 h-5" />
                    Download PDF
                  </button>
                </div>
              </div>

              <div className="p-8">
                <div className="bg-white/5 rounded-xl p-6 border border-white/10">
                  <pre className="whitespace-pre-wrap font-sans text-white leading-relaxed text-sm max-h-[600px] overflow-y-auto scrollbar-thin scrollbar-thumb-purple-500/50 scrollbar-track-white/5">
{customizedResume}
                  </pre>
                </div>
              </div>
            </div>

            {/* LinkedIn Teaser Section */}
            <div className="bg-white/10 backdrop-blur-xl rounded-2xl shadow-2xl border border-white/20 overflow-hidden">
              <div className="bg-gradient-to-r from-indigo-600 to-purple-600 px-8 py-6 border-b border-white/10">
                <div className="flex items-center justify-between flex-wrap gap-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-white/20 rounded-lg flex items-center justify-center">
                      <Linkedin className="w-5 h-5 text-white" />
                    </div>
                    <div>
                      <h2 className="text-xl font-bold text-white">
                        LinkedIn Outreach Message
                      </h2>
                      <p className="text-purple-100 text-sm">
                        AI-generated professional networking message
                      </p>
                    </div>
                  </div>
                  
                  {!linkedinTeaser && !isTeaserLoading && (
                    <button
                      onClick={generateLinkedInTeaser}
                      className="px-6 py-3 bg-white text-purple-600 font-semibold rounded-xl hover:bg-purple-50 transition-all flex items-center gap-2 shadow-lg hover:shadow-xl hover:scale-105"
                    >
                      <Sparkles className="w-5 h-5" />
                      Generate Message
                    </button>
                  )}
                </div>
              </div>

              <div className="p-8">
                {isTeaserLoading && (
                  <div className="text-center py-12">
                    <div className="relative">
                      <Loader2 className="w-12 h-12 text-purple-400 animate-spin mx-auto mb-4" />
                      <Sparkles className="w-6 h-6 text-pink-300 absolute top-0 right-1/2 transform translate-x-6 animate-pulse" />
                    </div>
                    <h3 className="text-lg font-bold text-white mb-2">
                      Crafting Your Message...
                    </h3>
                    <p className="text-purple-200 text-sm max-w-md mx-auto">
                      Our AI is analyzing your profile to create a compelling, personalized LinkedIn outreach message
                    </p>
                    <div className="mt-4 flex items-center justify-center gap-2">
                      <div className="w-2 h-2 bg-purple-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
                      <div className="w-2 h-2 bg-purple-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
                      <div className="w-2 h-2 bg-purple-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
                    </div>
                  </div>
                )}

                {error && !isTeaserLoading && !linkedinTeaser && customizedResume && (
                  <div className="text-center py-12">
                    <div className="w-16 h-16 bg-red-500/20 rounded-2xl flex items-center justify-center mx-auto mb-4">
                      <AlertCircle className="w-8 h-8 text-red-400" />
                    </div>
                    <h3 className="text-lg font-bold text-white mb-2">
                      Teaser Generation Failed
                    </h3>
                    <p className="text-red-200 mb-6 max-w-md mx-auto">{error}</p>
                    <button
                      onClick={retryTeaserGeneration}
                      className="px-6 py-3 bg-gradient-to-r from-purple-600 to-indigo-600 text-white font-semibold rounded-xl hover:shadow-lg hover:scale-105 transition-all inline-flex items-center gap-2"
                    >
                      <RefreshCw className="w-5 h-5" />
                      Retry Generation
                    </button>
                  </div>
                )}

                {linkedinTeaser && !isTeaserLoading && (
                  <div className="space-y-6">
                    <div className="relative">
                      <div className="absolute -top-3 -left-3 w-16 h-16 bg-gradient-to-br from-purple-500 to-indigo-600 rounded-full opacity-20 blur-xl"></div>
                      <div className="absolute -bottom-3 -right-3 w-20 h-20 bg-gradient-to-br from-purple-500 to-pink-600 rounded-full opacity-20 blur-xl"></div>
                      
                      <div className="relative bg-gradient-to-br from-purple-500/20 to-indigo-500/20 rounded-2xl p-8 border-2 border-purple-400/30 backdrop-blur-sm shadow-xl">
                        <div className="flex items-start gap-3 mb-4">
                          <div className="w-8 h-8 bg-purple-500 rounded-lg flex items-center justify-center flex-shrink-0">
                            <Mail className="w-4 h-4 text-white" />
                          </div>
                          <div className="flex-1">
                            <h4 className="text-sm font-semibold text-purple-300 uppercase tracking-wide mb-1">
                              Your Personalized Message
                            </h4>
                            <p className="text-xs text-purple-200/70">
                              Ready to send to recruiters and hiring managers
                            </p>
                          </div>
                        </div>
                        
                        <div className="bg-white/5 rounded-xl p-6 border border-white/10">
                          <p className="text-white leading-relaxed text-base whitespace-pre-wrap">
                            {linkedinTeaser}
                          </p>
                        </div>

                        <div className="mt-4 flex items-center justify-between text-xs text-purple-300/70">
                          <span className="flex items-center gap-1">
                            <CheckCircle2 className="w-3 h-3" />
                            Optimized for LinkedIn
                          </span>
                          <span>{linkedinTeaser.length} characters</span>
                        </div>
                      </div>
                    </div>

                    <div className="grid md:grid-cols-2 gap-4">
                      <button
                        onClick={copyTeaserToClipboard}
                        className="group px-6 py-4 bg-gradient-to-r from-purple-600 to-indigo-600 text-white font-semibold rounded-xl hover:shadow-lg hover:shadow-purple-500/50 hover:scale-105 transition-all flex items-center justify-center gap-3"
                      >
                        {copiedTeaser ? (
                          <>
                            <div className="w-5 h-5 bg-white/20 rounded-full flex items-center justify-center">
                              <Check className="w-3 h-3" />
                            </div>
                            <span>Copied to Clipboard!</span>
                          </>
                        ) : (
                          <>
                            <Copy className="w-5 h-5 group-hover:scale-110 transition-transform" />
                            <span>Copy Message</span>
                          </>
                        )}
                      </button>
                      
                      <button
                        onClick={() => window.open('https://www.linkedin.com/messaging/', '_blank')}
                        className="group px-6 py-4 bg-white/10 text-white font-semibold rounded-xl hover:bg-white/20 transition-all flex items-center justify-center gap-3 border-2 border-white/20 hover:border-purple-400/50"
                      >
                        <Linkedin className="w-5 h-5 group-hover:scale-110 transition-transform" />
                        <span>Open LinkedIn</span>
                        <Send className="w-4 h-4 opacity-70" />
                      </button>
                    </div>

                    <div className="bg-purple-500/10 rounded-xl p-6 border border-purple-500/20">
                      <div className="flex items-start gap-3">
                        <div className="w-8 h-8 bg-purple-500/20 rounded-lg flex items-center justify-center flex-shrink-0 mt-1">
                          <Sparkles className="w-4 h-4 text-purple-400" />
                        </div>
                        <div className="flex-1">
                          <h4 className="text-sm font-semibold text-purple-300 mb-2">
                            Pro Tips for Maximum Impact
                          </h4>
                          <ul className="space-y-2 text-sm text-purple-100/80">
                            <li className="flex items-start gap-2">
                              <span className="text-purple-400 mt-0.5">•</span>
                              <span>Personalize the message with the recipient's name and company</span>
                            </li>
                            <li className="flex items-start gap-2">
                              <span className="text-purple-400 mt-0.5">•</span>
                              <span>Send connection requests with this message during business hours</span>
                            </li>
                            <li className="flex items-start gap-2">
                              <span className="text-purple-400 mt-0.5">•</span>
                              <span>Follow up 3-5 days later if you don't receive a response</span>
                            </li>
                            <li className="flex items-start gap-2">
                              <span className="text-purple-400 mt-0.5">•</span>
                              <span>Keep your LinkedIn profile updated to match your resume</span>
                            </li>
                          </ul>
                        </div>
                      </div>
                    </div>

                    <div className="text-center pt-4">
                      <button
                        onClick={generateLinkedInTeaser}
                        className="text-purple-300 hover:text-white text-sm font-medium transition-colors inline-flex items-center gap-2 group"
                      >
                        <RefreshCw className="w-4 h-4 group-hover:rotate-180 transition-transform duration-500" />
                        Generate New Message
                      </button>
                    </div>
                  </div>
                )}

                {!linkedinTeaser && !isTeaserLoading && !error && (
                  <div className="text-center py-16">
                    <div className="relative inline-block mb-6">
                      <div className="absolute inset-0 bg-gradient-to-r from-purple-500 to-indigo-600 rounded-3xl blur-2xl opacity-30"></div>
                      <div className="relative w-20 h-20 bg-gradient-to-br from-purple-500 to-indigo-600 rounded-3xl flex items-center justify-center shadow-2xl">
                        <MessageSquare className="w-10 h-10 text-white" />
                      </div>
                    </div>
                    
                    <h3 className="text-2xl font-bold text-white mb-3">
                      Generate Your LinkedIn Message
                    </h3>
                    
                    <p className="text-purple-200 mb-8 max-w-lg mx-auto leading-relaxed">
                      Let our AI craft a compelling, personalized outreach message that highlights your strengths and increases your chances of connecting with recruiters and hiring managers.
                    </p>

                    <div className="grid md:grid-cols-3 gap-4 max-w-3xl mx-auto mb-8">
                      <div className="bg-white/5 rounded-xl p-4 border border-white/10">
                        <div className="w-10 h-10 bg-purple-500/20 rounded-lg flex items-center justify-center mx-auto mb-3">
                          <Brain className="w-5 h-5 text-purple-400" />
                        </div>
                        <h4 className="text-sm font-semibold text-white mb-1">AI-Powered</h4>
                        <p className="text-xs text-purple-200/70">Analyzes your resume to create personalized content</p>
                      </div>
                      
                      <div className="bg-white/5 rounded-xl p-4 border border-white/10">
                        <div className="w-10 h-10 bg-purple-500/20 rounded-lg flex items-center justify-center mx-auto mb-3">
                          <Target className="w-5 h-5 text-purple-400" />
                        </div>
                        <h4 className="text-sm font-semibold text-white mb-1">Professional</h4>
                        <p className="text-xs text-purple-200/70">Optimized for recruiter engagement and response</p>
                      </div>
                      
                      <div className="bg-white/5 rounded-xl p-4 border border-white/10">
                        <div className="w-10 h-10 bg-purple-500/20 rounded-lg flex items-center justify-center mx-auto mb-3">
                          <Zap className="w-5 h-5 text-purple-400" />
                        </div>
                        <h4 className="text-sm font-semibold text-white mb-1">Instant</h4>
                        <p className="text-xs text-purple-200/70">Generated in seconds, ready to send immediately</p>
                      </div>
                    </div>

                    <button
                      onClick={generateLinkedInTeaser}
                      className="group px-10 py-5 bg-gradient-to-r from-purple-600 via-indigo-600 to-purple-600 text-white font-bold rounded-2xl hover:shadow-2xl hover:shadow-purple-500/50 hover:scale-105 transition-all inline-flex items-center gap-3 text-lg"
                    >
                      <Sparkles className="w-6 h-6 group-hover:rotate-12 transition-transform" />
                      <span>Generate Outreach Message</span>
                      <Send className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                    </button>

                    <p className="text-xs text-purple-300/60 mt-6">
                      No LinkedIn account required • Copy and use anywhere
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
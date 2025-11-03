import React, { useState, useRef } from "react";
import axios from "axios";
import { useAuth } from "@clerk/clerk-react";
import { useNavigate } from "react-router-dom"; // 🧭 Added for navigation
import {
  Upload,
  FileText,
  CheckCircle,
  XCircle,
  Loader2,
  Sparkles,
  ArrowRight,
} from "lucide-react";

const API_URL = import.meta.env.VITE_API_URL;

export default function ResumeUpload() {
  const [file, setFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState("");
  const [success, setSuccess] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const fileInputRef = useRef(null);
  const { getToken } = useAuth();
  const navigate = useNavigate(); // 🧭 For redirect

  const handleFileChange = (e) => {
    const selectedFile = e.target.files[0];
    if (selectedFile) {
      setFile(selectedFile);
      setMessage("");
      setSuccess(false);
    }
  };

  const handleDrag = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const droppedFile = e.dataTransfer.files[0];
      const validTypes = [".pdf", ".doc", ".docx"];
      const fileExtension =
        "." + droppedFile.name.split(".").pop().toLowerCase();

      if (validTypes.includes(fileExtension)) {
        setFile(droppedFile);
        setMessage("");
        setSuccess(false);
      } else {
        setMessage("Please upload a PDF, DOC, or DOCX file");
        setSuccess(false);
      }
    }
  };

  const handleUpload = async (e) => {
    e.preventDefault();
    if (!file) {
      setMessage("Please select a resume file first!");
      setSuccess(false);
      return;
    }

    const formData = new FormData();
    formData.append("resume", file);

    try {
      setUploading(true);
      setMessage("");
      setSuccess(false);

      // ✅ Get Clerk token
      const token = await getToken();
      if (!token) {
        setMessage("Authentication failed. Please sign in again.");
        setSuccess(false);
        setUploading(false);
        return;
      }

      console.log("📤 Uploading to:", `${API_URL}/user/upload`);

      const response = await axios.post(`${API_URL}/user/upload`, formData, {
        headers: {
          "Content-Type": "multipart/form-data",
          Authorization: `Bearer ${token}`,
        },
      });

      console.log("✅ Upload response:", response.data);
      setMessage(response.data.message || "Resume uploaded successfully!");
      setSuccess(true);

      setTimeout(() => {
        window.location.href = "/description";
      }, 1500);

      // 🧭 Redirect user to Job Description page
      const resumeId = response.data.resumeId;
      if (resumeId) {
        setTimeout(() => {
          navigate(`/job-description/${resumeId}`, {
            state: { justUploaded: true },
          });
        }, 1200); // small delay for success animation
      }

      // Clear file state
      setTimeout(() => {
        setFile(null);
      }, 2000);
    } catch (err) {
      console.error("❌ Upload error:", err);
      console.error("Error details:", err.response?.data);
      setMessage(
        err.response?.data?.error || "Upload failed. Please try again."
      );
      setSuccess(false);
    } finally {
      setUploading(false);
    }
  };

  const formatFileSize = (bytes) => {
    if (bytes < 1024) return bytes + " B";
    if (bytes < 1048576) return (bytes / 1024).toFixed(1) + " KB";
    return (bytes / 1048576).toFixed(1) + " MB";
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 p-4 sm:p-6 relative overflow-hidden">
      {/* Animated Background */}
      <div className="absolute top-20 left-10 w-72 h-72 bg-purple-500 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-blob"></div>
      <div className="absolute top-40 right-10 w-72 h-72 bg-violet-500 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-blob animation-delay-2000"></div>
      <div className="absolute -bottom-8 left-20 w-72 h-72 bg-pink-500 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-blob animation-delay-4000"></div>

      <div className="relative z-10 w-full max-w-2xl">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center space-x-2 mb-4">
            <div className="p-3 bg-gradient-to-r from-violet-600 to-indigo-600 rounded-2xl">
              <Sparkles className="w-6 h-6 text-white" />
            </div>
          </div>
          <h2 className="text-4xl sm:text-5xl font-bold text-white mb-3">
            Upload Your Resume
          </h2>
          <p className="text-gray-300 text-lg">
            Transform your career with AI-powered resume analysis
          </p>
        </div>

        {/* Main Upload Card */}
        <div className="relative">
          <div className="absolute -inset-1 bg-gradient-to-r from-violet-600 via-purple-600 to-pink-600 rounded-3xl blur-2xl opacity-50"></div>
          <div className="relative bg-white/10 backdrop-blur-2xl border border-white/20 rounded-3xl p-8 sm:p-10 shadow-2xl">
            <div className="space-y-6">
              <div
                onDragEnter={handleDrag}
                onDragLeave={handleDrag}
                onDragOver={handleDrag}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className={`relative border-2 border-dashed rounded-2xl p-8 sm:p-12 transition-all duration-300 cursor-pointer group ${
                  dragActive
                    ? "border-violet-400 bg-violet-500/20 scale-105"
                    : "border-white/30 hover:border-violet-400 hover:bg-white/5"
                }`}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".pdf,.doc,.docx"
                  onChange={handleFileChange}
                  className="hidden"
                />
                <div className="flex flex-col items-center justify-center space-y-4">
                  <div
                    className={`relative transition-transform duration-300 ${
                      dragActive ? "scale-110" : "group-hover:scale-110"
                    }`}
                  >
                    <div className="absolute inset-0 bg-gradient-to-r from-violet-600 to-indigo-600 rounded-full blur-xl opacity-50"></div>
                    <div className="relative bg-gradient-to-r from-violet-600 to-indigo-600 p-6 rounded-full">
                      <Upload className="w-8 h-8 text-white" />
                    </div>
                  </div>
                  <div className="text-center">
                    <p className="text-white text-lg font-semibold mb-1">
                      {dragActive
                        ? "Drop your resume here"
                        : "Drag & drop your resume"}
                    </p>
                    <p className="text-gray-300 text-sm">
                      or{" "}
                      <span className="text-violet-400 font-medium">
                        click to browse
                      </span>
                    </p>
                  </div>
                  <div className="flex items-center space-x-4 text-xs text-gray-400">
                    <span className="px-3 py-1 bg-white/5 rounded-full border border-white/10">
                      PDF
                    </span>
                    <span className="px-3 py-1 bg-white/5 rounded-full border border-white/10">
                      DOC
                    </span>
                    <span className="px-3 py-1 bg-white/5 rounded-full border border-white/10">
                      DOCX
                    </span>
                  </div>
                </div>
              </div>

              {file && (
                <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-2xl p-4 flex items-center justify-between animate-slide-in">
                  <div className="flex items-center space-x-4">
                    <div className="p-3 bg-gradient-to-r from-violet-600 to-indigo-600 rounded-xl">
                      <FileText className="w-5 h-5 text-white" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-white font-medium truncate">
                        {file.name}
                      </p>
                      <p className="text-gray-400 text-sm">
                        {formatFileSize(file.size)}
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setFile(null);
                      setMessage("");
                      setSuccess(false);
                    }}
                    className="p-2 hover:bg-white/10 rounded-lg transition-colors"
                  >
                    <XCircle className="w-5 h-5 text-gray-400 hover:text-red-400" />
                  </button>
                </div>
              )}

              <button
                type="button"
                onClick={handleUpload}
                disabled={!file || uploading}
                className={`group relative w-full py-4 px-6 rounded-xl font-semibold text-lg overflow-hidden transition-all duration-300 ${
                  !file || uploading
                    ? "bg-gray-600 cursor-not-allowed"
                    : "bg-gradient-to-r from-violet-600 to-indigo-600 hover:shadow-2xl hover:shadow-violet-500/50 hover:scale-105"
                }`}
              >
                <span className="relative z-10 flex items-center justify-center space-x-2 text-white">
                  {uploading ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      <span>Uploading...</span>
                    </>
                  ) : (
                    <>
                      <span>Upload Resume</span>
                      <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                    </>
                  )}
                </span>
                {!uploading && file && (
                  <div className="absolute inset-0 bg-gradient-to-r from-violet-700 to-indigo-700 opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
                )}
              </button>

              {message && (
                <div
                  className={`flex items-center space-x-3 p-4 rounded-xl border animate-slide-in ${
                    success
                      ? "bg-green-500/10 border-green-500/30"
                      : "bg-red-500/10 border-red-500/30"
                  }`}
                >
                  {success ? (
                    <CheckCircle className="w-5 h-5 text-green-400 flex-shrink-0" />
                  ) : (
                    <XCircle className="w-5 h-5 text-red-400 flex-shrink-0" />
                  )}
                  <p
                    className={`font-medium ${
                      success ? "text-green-300" : "text-red-300"
                    }`}
                  >
                    {message}
                  </p>
                </div>
              )}
            </div>

            <div className="mt-8 pt-8 border-t border-white/10">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {[
                  { icon: Sparkles, text: "AI Analysis" },
                  { icon: CheckCircle, text: "ATS Optimized" },
                  { icon: FileText, text: "Instant Feedback" },
                ].map((feature, idx) => {
                  const Icon = feature.icon;
                  return (
                    <div
                      key={idx}
                      className="flex items-center space-x-2 text-gray-300"
                    >
                      <Icon className="w-4 h-4 text-violet-400" />
                      <span className="text-sm">{feature.text}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>

        <div className="mt-6 text-center">
          <p className="text-gray-400 text-sm">
            Your resume is secure and will be processed with{" "}
            <span className="text-violet-400">end-to-end encryption</span>
          </p>
        </div>
      </div>

      <style>{`
        @keyframes blob {
          0%, 100% { transform: translate(0, 0) scale(1); }
          25% { transform: translate(20px, -50px) scale(1.1); }
          50% { transform: translate(-20px, 20px) scale(0.9); }
          75% { transform: translate(50px, 50px) scale(1.05); }
        }
        .animate-blob { animation: blob 7s infinite; }
        .animation-delay-2000 { animation-delay: 2s; }
        .animation-delay-4000 { animation-delay: 4s; }
        @keyframes slide-in {
          from { transform: translateY(10px); opacity: 0; }
          to { transform: translateY(0); opacity: 1; }
        }
        .animate-slide-in { animation: slide-in 0.3s ease-out; }
      `}</style>
    </div>
  );
}

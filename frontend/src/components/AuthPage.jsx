import React, { useState, useEffect, useMemo, useCallback } from "react";
import { SignInButton, SignUpButton } from "@clerk/clerk-react";
import { FileText, Zap, CheckCircle, ArrowRight, Star } from "lucide-react";
import logo from '../assets/resunexi.ico';

// Memoized feature item component to prevent re-renders
const FeatureItem = React.memo(({ icon: Icon, text, color }) => (
  <div className="flex items-center space-x-4 group">
    <div className={`p-2 rounded-lg bg-gradient-to-r ${color} bg-opacity-20`}>
      <Icon className="w-5 h-5 text-white" />
    </div>
    <span className="text-gray-200 font-medium group-hover:text-white transition-colors">
      {text}
    </span>
    <CheckCircle className="w-5 h-5 text-green-400 opacity-0 group-hover:opacity-100 transition-opacity" />
  </div>
));

// Memoized testimonial card component
const TestimonialCard = React.memo(({ testimonial }) => (
  <div className="flex-shrink-0 w-64 bg-white/5 backdrop-blur-sm border border-white/10 rounded-2xl p-4">
    <div className="flex items-center space-x-1 mb-2">
      {[...Array(5)].map((_, i) => (
        <Star key={i} className="w-3 h-3 fill-yellow-400 text-yellow-400" />
      ))}
    </div>
    <p className="text-gray-300 text-sm mb-3">"{testimonial.text}"</p>
    <div>
      <p className="text-white font-semibold text-sm">{testimonial.name}</p>
      <p className="text-gray-400 text-xs">{testimonial.role}</p>
    </div>
  </div>
));

export default function AuthPage() {
  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 });
  const [isHovered, setIsHovered] = useState(false);

  // Throttled mouse move handler for better performance
  useEffect(() => {
    let rafId = null;
    let lastX = 0;
    let lastY = 0;

    const handleMouseMove = (e) => {
      if (rafId) return;
      
      rafId = requestAnimationFrame(() => {
        // Only update if moved more than 10px
        if (Math.abs(e.clientX - lastX) > 10 || Math.abs(e.clientY - lastY) > 10) {
          lastX = e.clientX;
          lastY = e.clientY;
          setMousePosition({ x: e.clientX, y: e.clientY });
        }
        rafId = null;
      });
    };

    window.addEventListener("mousemove", handleMouseMove, { passive: true });
    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      if (rafId) cancelAnimationFrame(rafId);
    };
  }, []);

  // Memoized features array
  const features = useMemo(() => [
    { icon: FileText, text: "AI-Powered Resume Builder", color: "from-violet-500 to-purple-500" },
    { icon: FileText, text: "Professional Templates", color: "from-blue-500 to-cyan-500" },
    { icon: Zap, text: "Instant PDF Export", color: "from-orange-500 to-pink-500" },
  ], []);

  // Memoized testimonials array
  const testimonials = useMemo(() => [
    {
      name: "Sarah Chen",
      role: "Software Engineer @ Google",
      text: "I always thought only my technical skills mattered. But this platform taught me that how you present yourself — your words, your story — can be the real game changer. My AI-generated resume literally got me callbacks I'd been dreaming about for years.",
    },
    {
      name: "Michael Ross",
      role: "Product Manager @ Microsoft",
      text: "I realized interviews begin long before you speak — they start with your resume. This tool didn't just help me write better, it helped me express my impact clearly. It's like having a professional storyteller by your side.",
    },
    {
      name: "Emily Davis",
      role: "UX Designer @ Figma",
      text: "I had the skills, but I struggled to put them into words that stood out. The AI suggestions helped me describe my projects in ways that showed creativity and confidence. I finally felt proud of my portfolio and resume.",
    },
    {
      name: "Aarav Mehta",
      role: "Data Analyst @ Deloitte",
      text: "I learned that sometimes it's not about adding more — it's about saying the right things with clarity. This platform helped me simplify my resume, highlight real achievements, and build confidence before every application.",
    },
    {
      name: "Olivia Martinez",
      role: "Marketing Specialist @ HubSpot",
      text: "I didn't have a fancy degree, but this platform helped me tell my journey authentically. My story — not just my experience — is what got me noticed. Sometimes, it's not your skills; it's how your words make others feel.",
    },
    {
      name: "Rohit Sharma",
      role: "Backend Developer @ Amazon",
      text: "Before this, I used to copy generic templates. This tool made me understand that personalization is everything. My resume now reflects who I am, not just what I've done — and recruiters noticed that difference instantly.",
    },
    {
      name: "Mia Thompson",
      role: "AI Research Intern @ OpenAI",
      text: "This isn't just a resume builder — it's a confidence builder. It reminded me that storytelling is a skill every professional needs. I found my voice through this platform.",
    },
    {
      name: "Liam Johnson",
      role: "Cybersecurity Engineer @ Palo Alto Networks",
      text: "I learned that even the best skills can go unnoticed if not communicated well. The AI didn't just fix my words — it helped me express my value like never before. Every job seeker needs this clarity.",
    },
  ], []);

  // Memoized benefits array
  const benefits = useMemo(() => [
    "Unlimited resume versions",
    "ATS-optimized templates",
    "Real-time AI suggestions",
    "One-click PDF export",
  ], []);

  // Callbacks for button handlers
  const handleMouseEnter = useCallback(() => setIsHovered(true), []);
  const handleMouseLeave = useCallback(() => setIsHovered(false), []);

  // Memoized gradient style
  const gradientStyle = useMemo(() => ({
    background: `radial-gradient(600px circle at ${mousePosition.x}px ${mousePosition.y}px, rgba(139, 92, 246, 0.3), transparent 40%)`,
  }), [mousePosition.x, mousePosition.y]);

  return (
    <div className="relative min-h-screen overflow-hidden bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900">
      {/* Animated Background Gradient */}
      <div className="absolute inset-0 opacity-30" style={gradientStyle} />

      {/* Floating Orbs - using will-change for better performance */}
      <div className="absolute top-20 left-10 w-72 h-72 bg-purple-500 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-blob will-change-transform"></div>
      <div className="absolute top-40 right-10 w-72 h-72 bg-violet-500 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-blob animation-delay-2000 will-change-transform"></div>
      <div className="absolute -bottom-8 left-20 w-72 h-72 bg-pink-500 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-blob animation-delay-4000 will-change-transform"></div>

      <div className="relative z-10 flex flex-col lg:flex-row min-h-screen">
        {/* Left Side - Branding & Info */}
        <div className="flex-1 flex flex-col justify-center px-8 sm:px-12 lg:px-20 py-12 lg:py-20">
          {/* Logo */}
          <div className="mb-8">
            <div className="flex items-center space-x-3 mb-3">
              <div className="relative group">
                <img 
                  src={logo} 
                  alt="ResuNexi Logo" 
                  className="w-12 h-12 object-contain drop-shadow-2xl filter brightness-110 transition-all duration-300 group-hover:scale-110 group-hover:drop-shadow-[0_0_15px_rgba(139,92,246,0.8)] will-change-transform"
                  loading="eager"
                  decoding="async"
                  onError={(e) => {
                    e.target.style.display = 'none';
                  }}
                />
              </div>
              <h1 className="text-4xl font-bold text-white">ResuNexi</h1>
            </div>
            <p className="text-violet-300 text-sm font-medium italic ml-14 animate-pulse">
              Your Brand of Second Chance Leading to Success
            </p>
          </div>

          {/* Headline */}
          <h2 className="text-5xl sm:text-6xl lg:text-7xl font-bold text-white leading-tight mb-6">
            Craft Your
            <span className="block bg-gradient-to-r from-violet-400 via-purple-400 to-pink-400 bg-clip-text text-transparent animate-gradient will-change-transform">
              Dream Resume
            </span>
          </h2>

          <p className="text-xl text-gray-300 mb-12 max-w-xl leading-relaxed">
            Create stunning, ATS-friendly resumes in minutes. Stand out from the crowd and land your dream job with our AI-powered platform.
          </p>

          {/* Features */}
          <div className="space-y-4 mb-12">
            {features.map((feature, idx) => (
              <FeatureItem key={idx} {...feature} />
            ))}
          </div>

          {/* Social Proof */}
          <div className="flex items-center space-x-6">
            <div className="flex -space-x-3">
              {[1, 2, 3, 4].map((i) => (
                <div
                  key={i}
                  className="w-10 h-10 rounded-full bg-gradient-to-br from-violet-400 to-purple-600 border-2 border-slate-900 flex items-center justify-center text-white font-semibold"
                >
                  {String.fromCharCode(64 + i)}
                </div>
              ))}
            </div>
            <div className="text-gray-300">
              <div className="flex items-center space-x-1 mb-1">
                {[...Array(5)].map((_, i) => (
                  <Star key={i} className="w-4 h-4 fill-yellow-400 text-yellow-400" />
                ))}
              </div>
              <p className="text-sm">Trusted by 50,000+ professionals</p>
            </div>
          </div>
        </div>

        {/* Right Side - Auth Card */}
        <div className="flex-1 flex items-center justify-center px-8 py-12 lg:py-20">
          <div className="w-full max-w-md">
            {/* Main Auth Card */}
            <div className="relative">
              {/* Glow Effect */}
              <div className="absolute -inset-1 bg-gradient-to-r from-violet-600 via-purple-600 to-pink-600 rounded-3xl blur-2xl opacity-50"></div>
              
              {/* Card Content */}
              <div className="relative bg-white/10 backdrop-blur-2xl border border-white/20 rounded-3xl p-8 sm:p-10 shadow-2xl">
                <div className="text-center mb-8">
                  <h3 className="text-3xl font-bold text-white mb-3">
                    Get Started Today
                  </h3>
                  <p className="text-gray-300">
                    Join thousands of professionals creating amazing resumes
                  </p>
                </div>

                {/* Auth Buttons */}
                <div className="space-y-4">
                  <SignUpButton mode="modal">
                    <button
                      onMouseEnter={handleMouseEnter}
                      onMouseLeave={handleMouseLeave}
                      className="group relative w-full py-4 px-6 bg-gradient-to-r from-violet-600 to-indigo-600 text-white rounded-xl font-semibold text-lg overflow-hidden transition-all duration-300 hover:shadow-2xl hover:shadow-violet-500/50 hover:scale-105 will-change-transform"
                    >
                      <span className="relative z-10 flex items-center justify-center space-x-2">
                        <span>Create Free Account</span>
                        <ArrowRight className={`w-5 h-5 transition-transform duration-300 will-change-transform ${isHovered ? 'translate-x-1' : ''}`} />
                      </span>
                      <div className="absolute inset-0 bg-gradient-to-r from-violet-700 to-indigo-700 opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
                    </button>
                  </SignUpButton>

                  <SignInButton mode="modal">
                    <button className="w-full py-4 px-6 bg-white/10 backdrop-blur-sm border-2 border-white/30 text-white rounded-xl font-semibold text-lg hover:bg-white/20 hover:border-white/50 transition-all duration-300 hover:scale-105 will-change-transform">
                      Sign In to Your Account
                    </button>
                  </SignInButton>
                </div>

                {/* Divider */}
                <div className="relative my-8">
                  <div className="absolute inset-0 flex items-center">
                    <div className="w-full border-t border-white/20"></div>
                  </div>
                  <div className="relative flex justify-center text-sm">
                    <span className="px-4 bg-transparent text-gray-300">
                      What you'll get
                    </span>
                  </div>
                </div>

                {/* Benefits */}
                <div className="space-y-3">
                  {benefits.map((benefit, idx) => (
                    <div key={idx} className="flex items-center space-x-3 text-gray-200">
                      <CheckCircle className="w-5 h-5 text-green-400 flex-shrink-0" />
                      <span>{benefit}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Testimonials Carousel */}
            <div className="mt-8 overflow-hidden">
              <div className="flex space-x-4 animate-scroll will-change-transform">
                {[...testimonials, ...testimonials].map((testimonial, idx) => (
                  <TestimonialCard key={idx} testimonial={testimonial} />
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      <style>{`
        @keyframes blob {
          0%, 100% { transform: translate(0, 0) scale(1); }
          25% { transform: translate(20px, -50px) scale(1.1); }
          50% { transform: translate(-20px, 20px) scale(0.9); }
          75% { transform: translate(50px, 50px) scale(1.05); }
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

        @keyframes gradient {
          0%, 100% { background-position: 0% 50%; }
          50% { background-position: 100% 50%; }
        }

        .animate-gradient {
          background-size: 200% 200%;
          animation: gradient 3s ease infinite;
        }

        @keyframes scroll {
          0% { transform: translateX(0); }
          100% { transform: translateX(-50%); }
        }

        .animate-scroll {
          animation: scroll 20s linear infinite;
        }

        .animate-scroll:hover {
          animation-play-state: paused;
        }
      `}</style>
    </div>
  );
}
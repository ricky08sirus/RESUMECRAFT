import React, { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { UserButton, useUser } from "@clerk/clerk-react";
import { Home, Upload, FileText, Sparkles, CreditCard, User, Menu, X } from "lucide-react";
import logo from "../assets/resunexi.ico";

export default function Navbar() {
  const navigate = useNavigate();
  const location = useLocation();
  const [scrolled, setScrolled] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const { user } = useUser();

  // Scroll effect for navbar
  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 10);
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const navItems = [
    { icon: Home, label: "Dashboard", path: "/" },
    { icon: Upload, label: "Upload", path: "/upload" },
    { icon: FileText, label: "Job Description", path: "/description" },
    { icon: Sparkles, label: "Customize", path: "/customize-resume" },
    { icon: CreditCard, label: "Credits", path: "/payment" },
  ];

  const isActive = (path) => location.pathname === path;

  const handleNavigation = (path) => {
    navigate(path);
    setMobileMenuOpen(false);
  };

  return (
    <>
      {/* Main Navbar */}
      <nav 
        className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
          scrolled 
            ? "bg-slate-950/98 backdrop-blur-2xl shadow-2xl shadow-violet-500/10 border-b border-violet-500/30" 
            : "bg-slate-950/95 backdrop-blur-xl border-b border-violet-500/20"
        }`}
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-20">
            
            {/* Brand Logo & Name */}
            <div 
              className="flex items-center space-x-4 cursor-pointer group"
              onClick={() => handleNavigation("/")}
            >
              {/* Premium Logo Container */}
              <div className="relative">
                {/* Animated Glow Effect */}
                <div className="absolute -inset-2 bg-gradient-to-br from-violet-600 via-purple-600 to-fuchsia-600 rounded-2xl blur-xl opacity-30 group-hover:opacity-50 transition-all duration-500"></div>
                
                {/* Logo - Clean, No Background */}
                <div className="relative group-hover:scale-110 transition-transform duration-300">
                  <img 
                    src={logo}
                    alt="ResuneXi Logo" 
                    className="w-10 h-10 object-contain relative z-10 drop-shadow-2xl filter brightness-110"
                    onError={(e) => {
                      // Fallback to SVG if image fails to load
                      e.target.style.display = 'none';
                      e.target.nextElementSibling.style.display = 'block';
                    }}
                  />
                  {/* Fallback SVG Icon */}
                  <svg 
                    viewBox="0 0 24 24" 
                    className="w-10 h-10 text-violet-400 hidden"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                    <polyline points="14 2 14 8 20 8"></polyline>
                    <line x1="16" y1="13" x2="8" y2="13"></line>
                    <line x1="16" y1="17" x2="8" y2="17"></line>
                  </svg>
                </div>
              </div>
              
              {/* Brand Name with Premium Typography */}
              <div className="flex flex-col">
                <span className="text-2xl font-black bg-gradient-to-r from-violet-400 via-purple-400 to-fuchsia-400 bg-clip-text text-transparent leading-tight tracking-tight group-hover:tracking-wide transition-all duration-300">
                  ResuNexi
                </span>
                <span className="text-[9px] text-violet-400/70 -mt-1 tracking-[0.2em] uppercase font-semibold">
                  Second chance for dreams
                </span>
              </div>
            </div>

            {/* Desktop Navigation - Premium Pills Design */}
            <div className="hidden lg:flex items-center space-x-2 bg-slate-900/50 backdrop-blur-xl rounded-2xl p-2 border border-white/5 shadow-xl">
              {navItems.map((item) => (
                <button
                  key={item.path}
                  onClick={() => handleNavigation(item.path)}
                  className={`
                    relative group flex items-center space-x-2.5 px-5 py-2.5 rounded-xl text-sm font-semibold transition-all duration-300
                    ${isActive(item.path)
                      ? "text-white"
                      : "text-gray-400 hover:text-white"
                    }
                  `}
                >
                  {/* Active State Background with Gradient */}
                  {isActive(item.path) && (
                    <>
                      <div className="absolute inset-0 bg-gradient-to-r from-violet-600 via-purple-600 to-fuchsia-600 rounded-xl shadow-lg shadow-violet-500/50"></div>
                      <div className="absolute inset-0 bg-gradient-to-r from-violet-600/0 via-white/10 to-violet-600/0 rounded-xl animate-pulse"></div>
                    </>
                  )}
                  
                  {/* Hover Effect for Inactive Items */}
                  {!isActive(item.path) && (
                    <div className="absolute inset-0 bg-white/0 group-hover:bg-white/5 rounded-xl transition-all duration-300"></div>
                  )}
                  
                  {/* Icon with Glow Effect */}
                  <item.icon className={`w-4 h-4 relative z-10 transition-transform duration-300 ${
                    isActive(item.path) ? "scale-110" : "group-hover:scale-110"
                  }`} />
                  
                  {/* Label */}
                  <span className="relative z-10">{item.label}</span>
                  
                  {/* Active Indicator Dot */}
                  {isActive(item.path) && (
                    <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-1 h-1 bg-white rounded-full shadow-lg shadow-white/50"></div>
                  )}
                </button>
              ))}
            </div>

            {/* Right Section - User Profile & Actions */}
            <div className="flex items-center space-x-4">
              
              {/* Premium User Info Card - Hidden on Mobile */}
              <div className="hidden md:flex items-center space-x-3 bg-gradient-to-r from-slate-900/80 to-slate-800/80 backdrop-blur-xl border border-violet-500/20 rounded-2xl px-4 py-2.5 shadow-xl shadow-violet-500/5">
                <div className="flex items-center space-x-3">
                  {/* User Avatar with Gradient Ring */}
                  <div className="relative">
                    <div className="absolute inset-0 bg-gradient-to-r from-violet-500 to-fuchsia-500 rounded-full blur-sm"></div>
                    <div className="relative bg-gradient-to-br from-violet-600 to-purple-700 p-2 rounded-full">
                      <User className="w-4 h-4 text-white" />
                    </div>
                  </div>
                  
                  {/* User Details */}
                  <div className="text-left">
                    <p className="text-sm font-bold text-white leading-tight tracking-wide">
                      {user?.firstName || user?.fullName || "User"}
                    </p>
                    <p className="text-[10px] text-violet-300/70 leading-tight font-medium">
                      {user?.primaryEmailAddress?.emailAddress?.split('@')[0]?.substring(0, 15)}
                      {user?.primaryEmailAddress?.emailAddress?.split('@')[0]?.length > 15 ? '...' : ''}
                    </p>
                  </div>
                </div>
              </div>

              {/* Clerk User Button with Premium Styling */}
              <div className="relative group">
                <div className="absolute -inset-1.5 bg-gradient-to-r from-violet-600 via-purple-600 to-fuchsia-600 rounded-full blur-md opacity-40 group-hover:opacity-70 transition-all duration-300"></div>
                <div className="relative">
                  <UserButton 
                    afterSignOutUrl="/sign-in"
                    appearance={{
                      elements: {
                        avatarBox: "w-11 h-11 relative ring-2 ring-violet-500/30 ring-offset-2 ring-offset-slate-950 transition-all hover:ring-violet-400/50",
                        userButtonPopoverCard: "bg-slate-900 border border-violet-500/30 shadow-2xl backdrop-blur-xl",
                        userButtonPopoverActionButton: "hover:bg-violet-600/20 transition-all duration-200",
                        userButtonPopoverActionButtonText: "text-gray-200",
                      }
                    }}
                  />
                </div>
              </div>

              {/* Mobile Menu Toggle Button */}
              <button
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                className="lg:hidden relative p-2.5 rounded-xl bg-slate-900/50 border border-white/10 text-white hover:bg-white/5 transition-all duration-300 active:scale-95"
              >
                {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
              </button>
            </div>
          </div>
        </div>
      </nav>

      {/* Mobile Menu Overlay - Full Screen */}
      <div 
        className={`lg:hidden fixed inset-0 z-40 bg-slate-950/98 backdrop-blur-2xl transition-all duration-300 ${
          mobileMenuOpen ? "opacity-100 visible" : "opacity-0 invisible"
        }`}
        style={{ top: '80px' }}
      >
        <div className="h-full overflow-y-auto p-6 space-y-3">
          
          {/* Mobile User Info Card */}
          <div className="flex items-center space-x-3 p-4 bg-gradient-to-r from-slate-900/80 to-slate-800/80 border border-violet-500/20 rounded-2xl mb-6 shadow-xl">
            <div className="relative">
              <div className="absolute inset-0 bg-gradient-to-r from-violet-500 to-fuchsia-500 rounded-full blur-sm"></div>
              <div className="relative bg-gradient-to-br from-violet-600 to-purple-700 p-2 rounded-full">
                <User className="w-5 h-5 text-white" />
              </div>
            </div>
            <div>
              <p className="text-sm font-bold text-white">
                {user?.firstName || user?.fullName || "User"}
              </p>
              <p className="text-xs text-violet-300/70 truncate max-w-[200px]">
                {user?.primaryEmailAddress?.emailAddress}
              </p>
            </div>
          </div>

          {/* Mobile Navigation Items */}
          {navItems.map((item, index) => (
            <button
              key={item.path}
              onClick={() => handleNavigation(item.path)}
              style={{ animationDelay: `${index * 50}ms` }}
              className={`
                w-full flex items-center space-x-4 p-4 rounded-2xl text-left font-semibold transition-all duration-300 animate-slideIn
                ${isActive(item.path)
                  ? "bg-gradient-to-r from-violet-600 to-purple-600 text-white shadow-lg shadow-violet-500/30 scale-[1.02]"
                  : "bg-slate-900/50 text-gray-400 hover:bg-white/5 hover:text-white border border-white/5 active:scale-95"
                }
              `}
            >
              <item.icon className={`w-5 h-5 transition-transform duration-300 ${
                isActive(item.path) ? "scale-110" : ""
              }`} />
              <span className="flex-1">{item.label}</span>
              {isActive(item.path) && (
                <div className="w-2 h-2 bg-white rounded-full shadow-lg shadow-white/50"></div>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Spacer to prevent content from going under fixed navbar */}
      <div className="h-20"></div>

      {/* Custom CSS for animations */}
      <style jsx>{`
        @keyframes slideIn {
          from {
            opacity: 0;
            transform: translateX(-20px);
          }
          to {
            opacity: 1;
            transform: translateX(0);
          }
        }
        
        .animate-slideIn {
          animation: slideIn 0.3s ease-out forwards;
        }
      `}</style>
    </>
  );
}
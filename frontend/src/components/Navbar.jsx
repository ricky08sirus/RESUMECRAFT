import React, { useState, useEffect } from 'react';
import { UserButton, useUser, useAuth } from '@clerk/clerk-react';
import { Link } from 'react-router-dom';
import { Menu, X, Bell, CreditCard, Coins } from 'lucide-react';
import axios from 'axios';
import logo from '../assets/resunexi.ico';

export default function Navbar() {
  const { user } = useUser();
  const { getToken } = useAuth();
  const [isScrolled, setIsScrolled] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [credits, setCredits] = useState(null); // null = loading, number = loaded
  const [isLoadingCredits, setIsLoadingCredits] = useState(true);

  const API_URL = import.meta.env.VITE_API_URL;

  // Scroll effect
  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 20);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Fetch user credits
  useEffect(() => {
    const fetchCredits = async () => {
      if (!user) return;
      
      try {
        setIsLoadingCredits(true);
        const token = await getToken();
        
        const response = await axios.get(`${API_URL}/api/payments/user-payments`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        
        setCredits(response.data?.credits || 0);
      } catch (err) {
        console.error("❌ Failed to fetch credits:", err);
        setCredits(0); // Set to 0 on error
      } finally {
        setIsLoadingCredits(false);
      }
    };

    fetchCredits();
    
    // Refresh credits every 30 seconds
    const interval = setInterval(fetchCredits, 30000);
    return () => clearInterval(interval);
  }, [user, getToken, API_URL]);

  const navLinks = [
    // { name: 'Dashboard', icon: LayoutDashboard, href: '#' },
  ];

  return (
    <nav
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
        isScrolled
          ? 'bg-white/80 backdrop-blur-xl shadow-lg shadow-black/5'
          : 'bg-transparent'
      }`}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16 md:h-20">
          {/* Logo */}
          <Link to="/" className="flex items-center space-x-2 cursor-pointer group">
            <img 
              src={logo} 
              alt="ResuNexi Logo" 
              className="w-20 h-20 object-contain transition-transform group-hover:scale-110"
              style={{
                imageRendering: 'crisp-edges',
                WebkitFontSmoothing: 'antialiased',
                filter: 'contrast(1.2) saturate(1.3) brightness(1.1)',
              }}
            />
            <span className="text-2xl font-bold bg-gradient-to-r from-pink-600 via-purple-600 to-indigo-600 bg-clip-text text-transparent">
              ResuNexi
            </span>
          </Link>

          {/* Desktop Navigation */}
          <div className="hidden md:flex items-center space-x-1">
            {navLinks.map((link) => {
              const Icon = link.icon;
              return (
                <a
                  key={link.name}
                  href={link.href}
                  className="group relative px-4 py-2 rounded-xl text-gray-700 hover:text-violet-600 transition-colors duration-200"
                >
                  <div className="flex items-center space-x-2">
                    <Icon className="w-4 h-4" />
                    <span className="font-medium">{link.name}</span>
                  </div>
                  <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-gradient-to-r from-violet-600 to-indigo-600 scale-x-0 group-hover:scale-x-100 transition-transform duration-300 rounded-full"></div>
                </a>
              );
            })}
          </div>

          {/* Right Side - User Actions */}
          <div className="flex items-center space-x-3">
            {/* Credits Display & Buy Button - Desktop */}
            {user && (
              <div className="hidden md:flex items-center space-x-2">
                {/* Credits Display */}
                <div className="flex items-center space-x-2 px-3 py-2 rounded-xl bg-gradient-to-r from-violet-50 to-purple-50 border border-violet-100">
                  <Coins className="w-5 h-5 text-violet-600" />
                  <div className="flex flex-col">
                    <span className="text-xs text-gray-500 leading-none">Credits</span>
                    {isLoadingCredits ? (
                      <div className="h-4 w-8 bg-gray-200 animate-pulse rounded mt-0.5"></div>
                    ) : (
                      <span className="text-sm font-bold text-gray-900 leading-none mt-0.5">
                        {credits}
                      </span>
                    )}
                  </div>
                </div>

                {/* Buy Credits Button */}
                <Link
                  to="/payment"
                  className="group flex items-center space-x-2 px-4 py-2 bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-700 hover:to-purple-700 rounded-xl text-white font-semibold shadow-lg shadow-violet-500/30 hover:shadow-violet-500/50 hover:scale-105 active:scale-95 transition-all duration-200"
                >
                  <CreditCard className="w-4 h-4" />
                  <span className="text-sm">Buy Credits</span>
                </Link>
              </div>
            )}

            {/* Notification Bell */}
            <button className="hidden md:block relative p-2 rounded-xl hover:bg-gray-100 transition-colors duration-200">
              <Bell className="w-5 h-5 text-gray-700" />
              <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full animate-pulse"></span>
            </button>

            {/* User Profile */}
            {user && (
              <div className="hidden md:flex items-center space-x-3 px-4 py-2 rounded-xl bg-gradient-to-r from-violet-50 to-indigo-50 border border-violet-100">
                <div className="text-right">
                  <p className="text-sm font-semibold text-gray-900">{user.fullName || 'User'}</p>
                  <p className="text-xs text-gray-600">{user.primaryEmailAddress?.emailAddress}</p>
                </div>
                <div className="relative group">
                  <div className="absolute -inset-1 bg-gradient-to-r from-violet-600 to-indigo-600 rounded-full blur opacity-25 group-hover:opacity-50 transition duration-300"></div>
                  <UserButton 
                    afterSignOutUrl="/"
                    appearance={{
                      elements: {
                        avatarBox: "w-10 h-10 ring-2 ring-violet-200 hover:ring-violet-400 transition-all duration-300"
                      }
                    }}
                  />
                </div>
              </div>
            )}

            {/* Mobile Menu Button */}
            <button
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              className="md:hidden p-2 rounded-xl hover:bg-gray-100 transition-colors duration-200"
            >
              {isMobileMenuOpen ? (
                <X className="w-6 h-6 text-gray-700" />
              ) : (
                <Menu className="w-6 h-6 text-gray-700" />
              )}
            </button>
          </div>
        </div>

        {/* Mobile Menu */}
        {isMobileMenuOpen && (
          <div className="md:hidden absolute top-full left-0 right-0 bg-white/95 backdrop-blur-xl shadow-xl border-t border-gray-100 animate-in slide-in-from-top duration-300">
            <div className="px-4 py-6 space-y-1">
              {/* Credits Display - Mobile */}
              {user && (
                <div className="mb-4 p-4 rounded-xl bg-gradient-to-r from-violet-50 to-purple-50 border border-violet-100">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center space-x-2">
                      <Coins className="w-5 h-5 text-violet-600" />
                      <div>
                        <p className="text-xs text-gray-500">Available Credits</p>
                        {isLoadingCredits ? (
                          <div className="h-5 w-12 bg-gray-200 animate-pulse rounded mt-1"></div>
                        ) : (
                          <p className="text-lg font-bold text-gray-900">{credits}</p>
                        )}
                      </div>
                    </div>
                    <Link
                      to="/payment"
                      onClick={() => setIsMobileMenuOpen(false)}
                      className="flex items-center space-x-2 px-4 py-2 bg-gradient-to-r from-violet-600 to-purple-600 rounded-xl text-white text-sm font-semibold shadow-lg hover:shadow-violet-500/50 active:scale-95 transition-all"
                    >
                      <CreditCard className="w-4 h-4" />
                      <span>Buy</span>
                    </Link>
                  </div>
                </div>
              )}

              {/* Navigation Links */}
              {navLinks.map((link) => {
                const Icon = link.icon;
                return (
                  <a
                    key={link.name}
                    href={link.href}
                    className="flex items-center space-x-3 px-4 py-3 rounded-xl hover:bg-gradient-to-r hover:from-violet-50 hover:to-indigo-50 text-gray-700 hover:text-violet-600 transition-all duration-200"
                  >
                    <Icon className="w-5 h-5" />
                    <span className="font-medium">{link.name}</span>
                  </a>
                );
              })}
              
              {/* User Profile - Mobile */}
              {user && (
                <div className="pt-4 mt-4 border-t border-gray-200">
                  <div className="flex items-center space-x-3 px-4 py-3 rounded-xl bg-gradient-to-r from-violet-50 to-indigo-50">
                    <UserButton 
                      afterSignOutUrl="/"
                      appearance={{
                        elements: {
                          avatarBox: "w-10 h-10 ring-2 ring-violet-200"
                        }
                      }}
                    />
                    <div>
                      <p className="text-sm font-semibold text-gray-900">{user.fullName || 'User'}</p>
                      <p className="text-xs text-gray-600">{user.primaryEmailAddress?.emailAddress}</p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </nav>
  );
}
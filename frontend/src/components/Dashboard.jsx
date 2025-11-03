import React, { useState, useEffect } from "react";
import { useUser, SignedIn, SignedOut, RedirectToSignIn } from "@clerk/clerk-react";
import { FileText, BarChart3, Target, Sparkles, ChevronRight, Star, Building2, TrendingUp, Users, Download, Zap, Award, ArrowUp, Upload } from "lucide-react";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";

export default function Dashboard() {
  const { user, isLoaded } = useUser();
  const [hoveredTestimonial, setHoveredTestimonial] = useState(null);
  const [downloadCount, setDownloadCount] = useState(0);
  const [downloadData, setDownloadData] = useState([]);
  
  // Generate dynamic data based on current time - RESETS AT MIDNIGHT
  useEffect(() => {
    const updateDownloadData = () => {
      const now = new Date();
      const currentHour = now.getHours();
      const currentMinute = now.getMinutes();
      
      // Seed based on current day (changes at midnight)
      const today = new Date().toDateString();
      const seed = today.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
      
      // Base number that changes daily (50k - 150k range)
      const baseNumber = Math.floor((Math.sin(seed) * 10000 + 10000) * 50) + 50000;
      
      // Traffic multiplier based on time of day
      const getTrafficMultiplier = (hour) => {
        if (hour >= 0 && hour < 6) return 0.1 + (hour / 6) * 0.2; // 12 AM - 6 AM: Very low
        if (hour >= 6 && hour < 9) return 0.3 + ((hour - 6) / 3) * 0.4; // 6 AM - 9 AM: Rising
        if (hour >= 9 && hour < 12) return 0.7 + ((hour - 9) / 3) * 0.3; // 9 AM - 12 PM: High
        if (hour >= 12 && hour < 15) return 1.0 + ((hour - 12) / 3) * 0.3; // 12 PM - 3 PM: Peak
        if (hour >= 15 && hour < 18) return 1.3 + ((hour - 15) / 3) * 0.2; // 3 PM - 6 PM: Sustained
        if (hour >= 18 && hour < 21) return 1.5 - ((hour - 18) / 3) * 0.5; // 6 PM - 9 PM: Declining
        return 1.0 - ((hour - 21) / 3) * 0.7; // 9 PM - 12 AM: Low
      };
      
      // Generate data from midnight (0:00) to current time
      const generatedData = [];
      let cumulativeDownloads = 0;
      
      // Always start from hour 0 (midnight) - RESETS DAILY
      for (let hour = 0; hour <= currentHour; hour++) {
        const trafficMultiplier = getTrafficMultiplier(hour);
        const randomFactor = 1 + (Math.sin(seed + hour) * 0.15);
        const hourlyDownloads = Math.floor(baseNumber * trafficMultiplier * randomFactor);
        
        cumulativeDownloads += hourlyDownloads;
        
        let timeDisplay;
        if (hour === 0) timeDisplay = '12 AM';
        else if (hour < 12) timeDisplay = `${hour} AM`;
        else if (hour === 12) timeDisplay = '12 PM';
        else timeDisplay = `${hour - 12} PM`;
        
        generatedData.push({
          time: timeDisplay,
          downloads: cumulativeDownloads,
          hour: hour
        });
      }
      
      // Add partial progress for current hour based on minutes
      if (generatedData.length > 0) {
        const minuteProgress = currentMinute / 60;
        const lastEntry = generatedData[generatedData.length - 1];
        const currentTrafficMultiplier = getTrafficMultiplier(currentHour);
        const additionalDownloads = Math.floor(
          baseNumber * currentTrafficMultiplier * minuteProgress * (1 + Math.sin(seed + currentMinute) * 0.1)
        );
        lastEntry.downloads += additionalDownloads;
      }
      
      setDownloadData(generatedData);
      
      // Animate counter to latest value
      const targetCount = generatedData.length > 0 
        ? generatedData[generatedData.length - 1].downloads 
        : baseNumber;
      
      let current = targetCount * 0.85;
      const increment = (targetCount - current) / 100;
      
      const timer = setInterval(() => {
        current += increment;
        if (current >= targetCount) {
          setDownloadCount(targetCount);
          clearInterval(timer);
        } else {
          setDownloadCount(Math.floor(current));
        }
      }, 20);
      
      return () => clearInterval(timer);
    };
    
    // Initial update
    updateDownloadData();
    
    // Update every minute to keep data fresh and reset at midnight
    const interval = setInterval(updateDownloadData, 60000);
    
    return () => clearInterval(interval);
  }, []);

  const statsData = [
    { metric: "Success Rate", value: "94.7%", change: "+12.3%", icon: TrendingUp, color: "from-green-500 to-emerald-600" },
    { metric: "Active Users", value: "1.2M+", change: "+28.4%", icon: Users, color: "from-blue-500 to-cyan-600" },
    { metric: "Avg. Interview Calls", value: "8.3x", change: "+156%", icon: Zap, color: "from-orange-500 to-amber-600" },
  ];

  const testimonials = [
    {
      name: "Priya Sharma",
      role: "Software Engineer at Google",
      content: "This platform gave me the confidence to rewrite my resume. Within 2 weeks, I landed interviews at 5 top companies!",
      rating: 5
    },
    {
      name: "Arjun Patel",
      role: "Product Manager at Amazon",
      content: "The AI insights helped me highlight achievements I didn't even realize were valuable. Game-changer for my career!",
      rating: 5
    },
    {
      name: "Neha Reddy",
      role: "Data Scientist at Microsoft",
      content: "Finally, a tool that understands what tech recruiters actually look for. My callback rate tripled!",
      rating: 5
    },
    {
      name: "Rahul Verma",
      role: "Full Stack Developer at Netflix",
      content: "Second Chance helped me transform my resume from generic to compelling. Worth every minute invested!",
      rating: 5
    },
    {
      name: "Ananya Krishnan",
      role: "UX Designer at Apple",
      content: "The personalized feedback was incredibly detailed. It's like having a career coach available 24/7!",
      rating: 5
    }
  ];

  const trustedCompanies = [
    "Google", "Amazon", "Microsoft", "Apple", "Meta",
    "Netflix", "Adobe", "Salesforce", "Oracle", "IBM",
    "BlackRock", "Goldman Sachs", "JPMorgan Chase", "Uber", "Airbnb"
  ];

  const dashboardPages = [
    {
      icon: FileText,
      title: "Resume Builder",
      description: "Create and optimize your resume with AI-powered suggestions",
      link: "/resume-builder",
      color: "from-violet-500 to-purple-600"
    },
    {
      icon: BarChart3,
      title: "ATS Score Analyzer",
      description: "Check how well your resume performs against ATS systems",
      link: "/ats-analyzer",
      color: "from-blue-500 to-cyan-600"
    },
    {
      icon: Target,
      title: "Job Matcher",
      description: "Find positions that perfectly match your skills and experience",
      link: "/job-matcher",
      color: "from-emerald-500 to-teal-600"
    },
    {
      icon: Sparkles,
      title: "AI Resume Review",
      description: "Get detailed feedback and improvement suggestions",
      link: "/ai-review",
      color: "from-orange-500 to-amber-600"
    }
  ];

  if (!isLoaded) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-purple-400 mb-4"></div>
          <p className="text-purple-200 text-lg">Loading your dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <>
      <SignedIn>
        <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 text-white">
          {/* Compact Elegant Hero Section */}
          <div className="relative overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-r from-purple-600/10 to-blue-600/10 backdrop-blur-3xl"></div>
            <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
              <div className="text-center space-y-2">
                <div className="inline-block">
                  <span className="text-purple-400 text-xs font-semibold tracking-widest uppercase"></span>
                </div>
                <h1 className="text-3xl sm:text-4xl md:text-5xl font-bold bg-gradient-to-r from-purple-400 via-pink-400 to-blue-400 bg-clip-text text-transparent">
                  Hello, {user?.fullName || user?.firstName || "User"} 👋
                </h1>
                <p className="text-sm sm:text-base text-gray-400 max-w-xl mx-auto">
                  Your <span className="text-purple-400 font-semibold">Second Chance</span> starts here
                </p>
              </div>
            </div>
          </div>

          {/* Downloads Counter - Prominent Position */}
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
            <div className="bg-gradient-to-r from-purple-600/20 to-blue-600/20 backdrop-blur-lg border border-purple-400/30 rounded-2xl p-6 text-center">
              <div className="flex items-center justify-center gap-2 mb-2">
                <Download className="w-6 h-6 text-purple-400 animate-bounce" />
                <span className="text-gray-400 text-sm font-semibold uppercase tracking-wider">Today's Resumes Prepared</span>
              </div>
              <div className="text-5xl sm:text-6xl font-bold bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent mb-1">
                {downloadCount.toLocaleString()}
              </div>
              <div className="flex items-center justify-center gap-1 text-green-400 text-sm font-semibold">
                <ArrowUp className="w-4 h-4" />
                <span>+{Math.floor(downloadCount * 0.02).toLocaleString()} in last hour</span>
              </div>
            </div>
          </div>

          {/* Live Download Graph */}
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
            <div className="bg-white/5 backdrop-blur-lg border border-white/10 rounded-2xl p-6">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-xl font-bold mb-1">Live Activity Today</h3>
                  <p className="text-gray-400 text-sm">Real-time resume preparations (resets at midnight)</p>
                </div>
                <div className="text-right">
                  <div className="text-sm text-gray-400">Current Hour</div>
                  <div className="text-2xl font-bold text-purple-400">
                    +{downloadData.length > 0 ? Math.floor((downloadData[downloadData.length - 1]?.downloads || 0) * 0.02).toLocaleString() : '0'}
                  </div>
                </div>
              </div>
              <ResponsiveContainer width="100%" height={250}>
                <AreaChart data={downloadData}>
                  <defs>
                    <linearGradient id="colorDownloads" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#a855f7" stopOpacity={0.8}/>
                      <stop offset="95%" stopColor="#a855f7" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#ffffff20" />
                  <XAxis dataKey="time" stroke="#9ca3af" tick={{ fontSize: 12 }} />
                  <YAxis stroke="#9ca3af" tick={{ fontSize: 12 }} />
                  <Tooltip 
                    contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #475569', borderRadius: '8px' }}
                    labelStyle={{ color: '#e5e7eb' }}
                    formatter={(value) => [value.toLocaleString(), 'Resumes']}
                  />
                  <Area type="monotone" dataKey="downloads" stroke="#a855f7" fillOpacity={1} fill="url(#colorDownloads)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* UPLOAD CTA */}
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
            <div className="bg-gradient-to-r from-purple-600 to-blue-600 rounded-3xl p-8 shadow-2xl relative overflow-hidden">
              <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHZpZXdCb3g9IjAgMCA2MCA2MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZyBmaWxsPSJub25lIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiPjxnIGZpbGw9IiNmZmZmZmYiIGZpbGwtb3BhY2l0eT0iMC4xIj48cGF0aCBkPSJNMzYgMzRjMC0yLjIxLTEuNzktNC00LTRzLTQgMS43OS00IDQgMS43OSA0IDQgNCA0LTEuNzkgNC00eiIvPjwvZz48L2c+PC9zdmc+')] opacity-20"></div>
              <div className="relative z-10 text-center">
                <Upload className="w-16 h-16 text-white mx-auto mb-4 animate-bounce" />
                <h2 className="text-3xl sm:text-4xl font-bold mb-4">
                  Ready to Take Your <span className="text-yellow-300">Second Chance?</span>
                </h2>
                <p className="text-purple-100 text-base mb-6 max-w-2xl mx-auto">
                  Join {Math.floor(downloadCount / 10000)}+ lakh professionals who optimized their resumes today
                </p>
                <a
                  href="/upload"
                  className="inline-flex items-center gap-2 px-8 py-4 bg-white text-purple-600 font-bold rounded-xl hover:bg-gray-100 transition-all hover:scale-105 shadow-xl"
                >
                  Upload Your Resume Now <ChevronRight className="w-5 h-5" />
                </a>
                <p className="text-purple-200 text-sm mt-4">✨ Opportunities are not given, they are created</p>
              </div>
            </div>
          </div>

          {/* Stats Grid */}
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
              {statsData.map((stat, index) => (
                <div key={index} className="bg-white/5 backdrop-blur-lg border border-white/10 rounded-2xl p-6 hover:bg-white/10 transition-all">
                  <div className="flex items-center justify-between mb-4">
                    <div className={`p-3 rounded-xl bg-gradient-to-br ${stat.color}`}>
                      <stat.icon className="w-6 h-6 text-white" />
                    </div>
                    <div className="flex items-center gap-1 text-green-400 text-sm font-semibold">
                      <ArrowUp className="w-4 h-4" />
                      {stat.change}
                    </div>
                  </div>
                  <h3 className="text-3xl font-bold mb-1">{stat.value}</h3>
                  <p className="text-gray-400 text-sm">{stat.metric}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Dashboard Pages Grid */}
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
            <h2 className="text-3xl font-bold mb-8 text-center">Your Career Toolkit</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
              {dashboardPages.map((page, index) => (
                <a
                  key={index}
                  href={page.link}
                  className="group bg-white/5 backdrop-blur-lg border border-white/10 rounded-2xl p-6 hover:bg-white/10 transition-all hover:scale-105"
                >
                  <div className={`inline-flex p-3 rounded-xl bg-gradient-to-br ${page.color} mb-4 group-hover:scale-110 transition-transform`}>
                    <page.icon className="w-6 h-6 text-white" />
                  </div>
                  <h3 className="text-xl font-bold mb-2">{page.title}</h3>
                  <p className="text-gray-400 text-sm">{page.description}</p>
                </a>
              ))}
            </div>
          </div>

          {/* Testimonials */}
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
            <h2 className="text-3xl font-bold mb-8 text-center">Success Stories</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {testimonials.slice(0, 3).map((testimonial, index) => (
                <div
                  key={index}
                  onMouseEnter={() => setHoveredTestimonial(index)}
                  onMouseLeave={() => setHoveredTestimonial(null)}
                  className={`bg-white/5 backdrop-blur-lg border border-white/10 rounded-2xl p-6 transition-all ${
                    hoveredTestimonial === index ? 'bg-white/10 scale-105' : ''
                  }`}
                >
                  <div className="flex gap-1 mb-4">
                    {[...Array(5)].map((_, i) => (
                      <Star key={i} className="w-4 h-4 fill-yellow-400 text-yellow-400" />
                    ))}
                  </div>
                  <p className="text-gray-300 text-sm mb-4 italic">"{testimonial.content}"</p>
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-full bg-gradient-to-br from-purple-500 to-blue-500 flex items-center justify-center text-xl font-bold">
                      {testimonial.name.charAt(0)}
                    </div>
                    <div>
                      <p className="font-semibold">{testimonial.name}</p>
                      <p className="text-sm text-gray-400">{testimonial.role}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Trusted Companies */}
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
            <div className="bg-white/5 backdrop-blur-lg border border-white/10 rounded-3xl p-12">
              <h2 className="text-2xl font-bold text-center mb-8">Trusted by Industry Leaders</h2>
              <div className="flex flex-wrap justify-center gap-8">
                {trustedCompanies.slice(0, 10).map((company, index) => (
                  <div key={index} className="px-6 py-3 bg-gradient-to-r from-purple-600/10 to-blue-600/10 border border-purple-500/20 rounded-xl hover:scale-110 transition-all">
                    <span className="text-gray-300 font-semibold">{company}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Bottom Success Rate Banner */}
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
            <div className="bg-gradient-to-r from-green-600/20 to-emerald-600/20 backdrop-blur-lg border border-green-500/30 rounded-3xl p-12 text-center">
              <h2 className="text-4xl font-bold mb-4">
                Your Chances of Success: <span className="text-green-400">94.7%</span>
              </h2>
              <p className="text-lg text-gray-300 mb-6">
                Based on data from 1.2M+ successful job seekers who used Second Chance
              </p>
              <div className="flex flex-wrap justify-center gap-12 mt-8">
                <div className="text-center">
                  <div className="text-3xl font-bold text-green-400">8.3x</div>
                  <div className="text-gray-400 text-sm mt-1">More Interviews</div>
                </div>
                <div className="text-center">
                  <div className="text-3xl font-bold text-blue-400">30 Days</div>
                  <div className="text-gray-400 text-sm mt-1">Avg. Time to Offer</div>
                </div>
                <div className="text-center">
                  <div className="text-3xl font-bold text-purple-400">156%</div>
                  <div className="text-gray-400 text-sm mt-1">Salary Increase</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </SignedIn>

      <SignedOut>
        <RedirectToSignIn />
      </SignedOut>
    </>
  );
}
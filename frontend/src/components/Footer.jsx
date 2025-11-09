import React, { useState } from 'react';
import { MapPin, ChevronRight, X } from 'lucide-react';

export default function Footer() {
  const [modalContent, setModalContent] = useState(null);

  const openModal = (type) => {
    setModalContent(type);
  };

  const closeModal = () => {
    setModalContent(null);
  };

  const modalData = {
    privacy: {
      title: "Privacy Policy",
      content: `Last Updated: ${new Date().toLocaleDateString()}

1. Information We Collect
We collect information you provide directly, including name, email, resume data, and usage information.

2. How We Use Your Information
- To provide and improve our services
- To personalize your experience
- To communicate with you about updates and offers
- To analyze usage patterns and optimize our platform

3. Data Security
We implement industry-standard security measures to protect your personal information and resume data.

4. Third-Party Services
We may use third-party services for analytics and payment processing. These services have their own privacy policies.

5. Your Rights
You have the right to access, modify, or delete your personal information at any time.

6. Contact Us
For privacy concerns, contact us at support@secondchance.com`
    },
    terms: {
      title: "Terms of Service",
      content: `Last Updated: ${new Date().toLocaleDateString()}

1. Acceptance of Terms
By accessing Second Chance, you agree to these Terms of Service.

2. Use License
We grant you a limited, non-exclusive license to use our platform for personal career development.

3. User Responsibilities
- Provide accurate information
- Keep your account secure
- Use the service lawfully
- Respect intellectual property rights

4. Service Availability
We strive for 99.9% uptime but do not guarantee uninterrupted service.

5. Limitation of Liability
Second Chance is not liable for indirect, incidental, or consequential damages.

6. Modifications
We reserve the right to modify these terms at any time.`
    },
    cookies: {
      title: "Cookie Policy",
      content: `Last Updated: ${new Date().toLocaleDateString()}

1. What Are Cookies
Cookies are small text files stored on your device to enhance your experience.

2. How We Use Cookies
- Essential cookies for platform functionality
- Analytics cookies to understand usage patterns
- Preference cookies to remember your settings
- Marketing cookies for personalized content

3. Managing Cookies
You can control cookies through your browser settings.

4. Third-Party Cookies
Some cookies are placed by third-party services we use.

5. Your Consent
By using our site, you consent to our use of cookies as described.`
    }
  };

  const footerLinks = {
    product: [
      { name: 'Dashboard', href: '/' },
      { name: 'Upload Resume', href: '/upload' },
      { name: 'Job Description', href: '/description' },
      { name: 'Customize Resume', href: '/customize-resume' },
      { name: 'Payment', href: '/payment' }
    ],
    legal: [
      { name: 'Privacy Policy', action: () => openModal('privacy') },
      { name: 'Terms of Service', action: () => openModal('terms') },
      { name: 'Cookie Policy', action: () => openModal('cookies') }
    ]
  };

  return (
    <>
      <footer className="bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 text-gray-300 border-t border-purple-500/20 mt-auto">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-8">
            {/* Company Info */}
            <div>
              <h2 className="text-2xl font-bold bg-gradient-to-r from-violet-400 via-purple-400 to-pink-400 bg-clip-text text-transparent mb-3">
                Second Chance
              </h2>
              <p className="text-gray-400 text-sm leading-relaxed">
                Empowering careers with AI-powered resume optimization and job matching.
              </p>
            </div>

            {/* Product Links */}
            <div>
              <h3 className="text-white font-semibold mb-4 text-sm uppercase tracking-wider">
                Product
              </h3>
              <ul className="space-y-2">
                {footerLinks.product.map((link, index) => (
                  <li key={index}>
                    <a
                      href={link.href}
                      className="text-sm text-gray-400 hover:text-purple-400 transition-colors flex items-center gap-1 group"
                    >
                      <ChevronRight className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity" />
                      {link.name}
                    </a>
                  </li>
                ))}
              </ul>
            </div>

            {/* Legal Links */}
            <div>
              <h3 className="text-white font-semibold mb-4 text-sm uppercase tracking-wider">
                Legal
              </h3>
              <ul className="space-y-2">
                {footerLinks.legal.map((link, index) => (
                  <li key={index}>
                    <button
                      onClick={link.action}
                      className="text-sm text-gray-400 hover:text-purple-400 transition-colors flex items-center gap-1 group text-left"
                    >
                      <ChevronRight className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity" />
                      {link.name}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {/* Headquarters */}
          <div className="border-t border-purple-500/20 pt-8 mb-8">
            <div className="max-w-md">
              <div className="bg-white/5 backdrop-blur-lg border border-purple-500/20 rounded-xl p-5 hover:bg-white/10 transition-all">
                <div className="flex items-start gap-3">
                  <div className="p-2 bg-purple-600/20 rounded-lg flex-shrink-0">
                    <MapPin className="w-5 h-5 text-purple-400" />
                  </div>
                  <div>
                    <h4 className="text-white font-semibold mb-2 text-sm">Headquarters</h4>
                    <p className="text-gray-400 text-sm leading-relaxed">
                      Bay Adelaide Centre<br />
                      333 Bay Street, Suite 3400<br />
                      Toronto, ON M5H 2R2<br />
                      Canada
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Copyright */}
          <div className="border-t border-purple-500/20 pt-6">
            <div className="text-center">
              <p className="text-gray-400 text-sm">
                © {new Date().getFullYear()} Second Chance. All rights reserved.
              </p>
            </div>
          </div>
        </div>

        {/* Bottom Accent Bar */}
        <div className="h-1 bg-gradient-to-r from-violet-600 via-purple-600 to-pink-600"></div>
      </footer>

      {/* Modal */}
      {modalContent && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fadeIn" 
          onClick={closeModal}
        >
          <div 
            className="bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 border-2 border-purple-500/30 rounded-2xl max-w-2xl w-full max-h-[80vh] overflow-hidden shadow-2xl shadow-purple-500/20 animate-scaleIn" 
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="flex items-center justify-between p-6 border-b border-purple-500/20 bg-white/5">
              <h2 className="text-2xl font-bold bg-gradient-to-r from-violet-400 to-pink-400 bg-clip-text text-transparent">
                {modalData[modalContent].title}
              </h2>
              <button
                onClick={closeModal}
                className="p-2 hover:bg-white/10 rounded-lg transition-all hover:rotate-90 duration-300"
                aria-label="Close modal"
              >
                <X className="w-5 h-5 text-gray-400 hover:text-white" />
              </button>
            </div>
            
            {/* Modal Content */}
            <div className="p-6 overflow-y-auto max-h-[60vh] custom-scrollbar">
              <pre className="text-gray-300 text-sm whitespace-pre-wrap font-sans leading-relaxed">
                {modalData[modalContent].content}
              </pre>
            </div>

            {/* Modal Footer */}
            <div className="p-6 border-t border-purple-500/20 bg-white/5">
              <button
                onClick={closeModal}
                className="w-full px-6 py-3 bg-gradient-to-r from-violet-600 to-purple-600 rounded-xl text-white font-semibold hover:from-violet-500 hover:to-purple-500 transition-all hover:shadow-lg hover:shadow-purple-500/50 hover:scale-[1.02] active:scale-[0.98]"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes scaleIn {
          from { opacity: 0; transform: scale(0.9); }
          to { opacity: 1; transform: scale(1); }
        }
        .animate-fadeIn {
          animation: fadeIn 0.2s ease-out;
        }
        .animate-scaleIn {
          animation: scaleIn 0.3s ease-out;
        }
        .custom-scrollbar::-webkit-scrollbar {
          width: 8px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: rgba(255, 255, 255, 0.05);
          border-radius: 10px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: rgba(168, 85, 247, 0.5);
          border-radius: 10px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: rgba(168, 85, 247, 0.7);
        }
      `}</style>
    </>
  );
}
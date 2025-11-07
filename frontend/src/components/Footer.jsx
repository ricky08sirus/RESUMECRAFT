import React, { useState } from 'react';
import { Mail, Phone, MapPin, Send, Linkedin, Twitter, Facebook, Instagram, ChevronRight, Building2, Clock, Shield, Award, X } from 'lucide-react';

export default function Footer() {
  const [email, setEmail] = useState('');
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [modalContent, setModalContent] = useState(null);

  const handleNewsletterSubmit = () => {
    if (email && email.includes('@')) {
      setIsSubmitted(true);
      setTimeout(() => {
        setIsSubmitted(false);
        setEmail('');
      }, 3000);
    }
  };

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
For privacy concerns, contact us at emma.roberts@resunexi.com`
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
    },
    gdpr: {
      title: "GDPR Compliance",
      content: `Last Updated: ${new Date().toLocaleDateString()}

Second Chance is committed to GDPR compliance.

1. Legal Basis for Processing
We process your data based on consent, contract necessity, and legitimate interests.

2. Your GDPR Rights
- Right to access your data
- Right to rectification
- Right to erasure
- Right to data portability
- Right to object to processing

3. Data Protection Officer
Contact our DPO at emma.roberts@resunexi.com

4. International Transfers
We ensure appropriate safeguards for data transfers outside the EU.

5. Complaints
You have the right to lodge a complaint with your local supervisory authority.`
    },
    accessibility: {
      title: "Accessibility Statement",
      content: `Last Updated: ${new Date().toLocaleDateString()}

Second Chance is committed to digital accessibility.

1. Our Commitment
We strive to make our platform accessible to all users, including those with disabilities.

2. Standards
We aim to conform to WCAG 2.1 Level AA standards.

3. Features
- Keyboard navigation support
- Screen reader compatibility
- High contrast mode
- Adjustable text sizes

4. Ongoing Efforts
We continuously test and improve accessibility.

5. Feedback
Report accessibility issues to emma.roberts@resunexi.com`
    }
  };

  const footerLinks = {
    product: [
      { name: 'Dashboard', href: '/' },
      { name: 'Upload Resume', href: '/upload' },
      { name: 'Job Description', href: '/description' },
      { name: 'Customize Resume', href: '/customize-resume' }
    ],
    company: [
      { name: 'About Us', href: '/about' },
      { name: 'Careers', href: '/careers' },
      { name: 'Blog', href: '/blog' }
    ],
    legal: [
      { name: 'Privacy Policy', action: () => openModal('privacy') },
      { name: 'Terms of Service', action: () => openModal('terms') },
      { name: 'Cookie Policy', action: () => openModal('cookies') },
      { name: 'GDPR Compliance', action: () => openModal('gdpr') },
      { name: 'Accessibility', action: () => openModal('accessibility') }
    ]
  };

  const socialLinks = [
    { icon: Linkedin, href: 'https://linkedin.com/company/secondchance', label: 'LinkedIn' },
    { icon: Twitter, href: 'https://twitter.com/secondchance', label: 'Twitter' },
    { icon: Facebook, href: 'https://facebook.com/secondchance', label: 'Facebook' },
    { icon: Instagram, href: 'https://instagram.com/secondchance', label: 'Instagram' }
  ];

  const trustIndicators = [
    { icon: Shield, text: 'SOC 2 Certified' },
    { icon: Award, text: 'ISO 27001' }
  ];

  return (
    <>
      <footer className="bg-gradient-to-br from-slate-950 via-indigo-950 to-slate-950 text-gray-300 border-t border-indigo-500/20 mt-auto">
        {/* Main Footer Content */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8 mb-10">
            {/* Company Info & Newsletter */}
            <div className="lg:col-span-1">
              <h2 className="text-2xl font-bold bg-gradient-to-r from-indigo-400 to-purple-400 bg-clip-text text-transparent mb-3">
                Second Chance
              </h2>
              <p className="text-gray-400 text-xs leading-relaxed mb-4">
                Empowering careers with AI-powered resume optimization.
              </p>

              {/* Newsletter */}
              <div className="bg-white/5 backdrop-blur-lg border border-indigo-500/20 rounded-lg p-3 mb-4">
                <h3 className="text-white font-semibold mb-2 text-xs flex items-center gap-2">
                  <Mail className="w-3 h-3 text-indigo-400" />
                  Newsletter
                </h3>
                {isSubmitted ? (
                  <div className="bg-green-500/20 border border-green-500/50 rounded-lg p-2 text-center">
                    <p className="text-green-400 text-xs font-semibold">✓ Subscribed!</p>
                  </div>
                ) : (
                  <div className="flex gap-2">
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      onKeyPress={(e) => e.key === 'Enter' && handleNewsletterSubmit()}
                      placeholder="your@email.com"
                      className="flex-1 px-2 py-1.5 bg-white/10 border border-indigo-500/30 rounded text-white text-xs placeholder-gray-500 focus:outline-none focus:border-indigo-400"
                    />
                    <button
                      onClick={handleNewsletterSubmit}
                      className="px-3 py-1.5 bg-gradient-to-r from-indigo-600 to-purple-600 rounded hover:from-indigo-500 hover:to-purple-500 transition-all"
                    >
                      <Send className="w-3 h-3" />
                    </button>
                  </div>
                )}
              </div>

              {/* Trust Indicators */}
              <div className="flex flex-wrap gap-2">
                {trustIndicators.map((item, index) => (
                  <div key={index} className="flex items-center gap-1 text-xs text-gray-400">
                    <item.icon className="w-3 h-3 text-indigo-400" />
                    <span className="text-xs">{item.text}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Product Links */}
            <div>
              <h3 className="text-white font-semibold mb-3 text-xs uppercase tracking-wider">Product</h3>
              <ul className="space-y-2">
                {footerLinks.product.map((link, index) => (
                  <li key={index}>
                    <a
                      href={link.href}
                      className="text-xs text-gray-400 hover:text-indigo-400 transition-colors flex items-center gap-1 group"
                    >
                      <ChevronRight className="w-2.5 h-2.5 opacity-0 group-hover:opacity-100 transition-opacity" />
                      {link.name}
                    </a>
                  </li>
                ))}
              </ul>
            </div>

            {/* Company Links */}
            <div>
              <h3 className="text-white font-semibold mb-3 text-xs uppercase tracking-wider">Company</h3>
              <ul className="space-y-2">
                {footerLinks.company.map((link, index) => (
                  <li key={index}>
                    <a
                      href={link.href}
                      className="text-xs text-gray-400 hover:text-indigo-400 transition-colors flex items-center gap-1 group"
                    >
                      <ChevronRight className="w-2.5 h-2.5 opacity-0 group-hover:opacity-100 transition-opacity" />
                      {link.name}
                    </a>
                  </li>
                ))}
              </ul>
            </div>

            {/* Legal Links */}
            <div>
              <h3 className="text-white font-semibold mb-3 text-xs uppercase tracking-wider">Legal</h3>
              <ul className="space-y-2">
                {footerLinks.legal.map((link, index) => (
                  <li key={index}>
                    <button
                      onClick={link.action}
                      className="text-xs text-gray-400 hover:text-indigo-400 transition-colors flex items-center gap-1 group text-left"
                    >
                      <ChevronRight className="w-2.5 h-2.5 opacity-0 group-hover:opacity-100 transition-opacity" />
                      {link.name}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {/* Contact Information */}
          <div className="border-t border-indigo-500/20 pt-6 mb-6">
            <h3 className="text-white font-semibold mb-4 text-sm flex items-center gap-2">
              <Building2 className="w-4 h-4 text-indigo-400" />
              Contact Us
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Headquarters */}
              <div className="bg-white/5 backdrop-blur-lg border border-indigo-500/20 rounded-lg p-4 hover:bg-white/10 transition-all">
                <div className="flex items-start gap-2">
                  <div className="p-1.5 bg-indigo-600/20 rounded-lg">
                    <MapPin className="w-4 h-4 text-indigo-400" />
                  </div>
                  <div>
                    <h4 className="text-white font-semibold mb-1 text-xs">Headquarters</h4>
                    <p className="text-gray-400 text-xs leading-relaxed">
                      Bay Adelaide Centre<br />
                      333 Bay Street, Suite 3400<br />
                      Toronto, ON M5H 2R2<br />
                      Canada
                    </p>
                  </div>
                </div>
              </div>

              {/* Email */}
              <div className="bg-white/5 backdrop-blur-lg border border-indigo-500/20 rounded-lg p-4 hover:bg-white/10 transition-all">
                <div className="flex items-start gap-2">
                  <div className="p-1.5 bg-indigo-600/20 rounded-lg">
                    <Mail className="w-4 h-4 text-indigo-400" />
                  </div>
                  <div>
                    <h4 className="text-white font-semibold mb-1 text-xs">Email Support</h4>
                    <a href="mailto:emma.roberts@resunexi.com" className="text-indigo-400 hover:text-indigo-300 text-xs block">
                      emma.roberts@resunexi.com
                    </a>
                    <p className="text-gray-500 text-xs mt-1">Response in 24 hours</p>
                  </div>
                </div>
              </div>

              {/* Phone */}
              <div className="bg-white/5 backdrop-blur-lg border border-indigo-500/20 rounded-lg p-4 hover:bg-white/10 transition-all">
                <div className="flex items-start gap-2">
                  <div className="p-1.5 bg-indigo-600/20 rounded-lg">
                    <Phone className="w-4 h-4 text-indigo-400" />
                  </div>
                  <div>
                    <h4 className="text-white font-semibold mb-1 text-xs">Phone Support</h4>
                    <a href="tel:+15875550298" className="text-indigo-400 hover:text-indigo-300 text-xs block">
                      +1 (587) 555-0298
                    </a>
                    <p className="text-gray-400 text-xs mt-1 flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      Mon-Fri: 9 AM - 6 PM EST
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Social & Copyright */}
          <div className="border-t border-indigo-500/20 pt-6">
            <div className="flex flex-col md:flex-row justify-between items-center gap-4">
              {/* Social Media */}
              <div className="flex items-center gap-3">
                <span className="text-gray-400 text-xs font-medium">Follow Us:</span>
                <div className="flex gap-2">
                  {socialLinks.map((social, index) => (
                    <a
                      key={index}
                      href={social.href}
                      target="_blank"
                      rel="noopener noreferrer"
                      aria-label={social.label}
                      className="p-1.5 bg-white/5 hover:bg-indigo-600/30 border border-indigo-500/20 hover:border-indigo-400/50 rounded-lg transition-all hover:scale-110"
                    >
                      <social.icon className="w-3.5 h-3.5 text-gray-400 hover:text-indigo-400" />
                    </a>
                  ))}
                </div>
              </div>

              {/* Copyright */}
              <div className="text-center md:text-right">
                <p className="text-gray-400 text-xs">
                  © {new Date().getFullYear()} ResuNexi Inc. All rights reserved.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Bottom Accent Bar */}
        <div className="h-0.5 bg-gradient-to-r from-indigo-600 via-purple-600 to-indigo-600"></div>
      </footer>

      {/* Modal */}
      {modalContent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm" onClick={closeModal}>
          <div className="bg-gradient-to-br from-slate-900 via-indigo-900 to-slate-900 border border-indigo-500/30 rounded-2xl max-w-2xl w-full max-h-[80vh] overflow-hidden shadow-2xl" onClick={(e) => e.stopPropagation()}>
            {/* Modal Header */}
            <div className="flex items-center justify-between p-6 border-b border-indigo-500/20">
              <h2 className="text-2xl font-bold text-white">{modalData[modalContent].title}</h2>
              <button
                onClick={closeModal}
                className="p-2 hover:bg-white/10 rounded-lg transition-colors"
              >
                <X className="w-5 h-5 text-gray-400 hover:text-white" />
              </button>
            </div>
            
            {/* Modal Content */}
            <div className="p-6 overflow-y-auto max-h-[60vh]">
              <pre className="text-gray-300 text-sm whitespace-pre-wrap font-sans leading-relaxed">
                {modalData[modalContent].content}
              </pre>
            </div>

            {/* Modal Footer */}
            <div className="p-6 border-t border-indigo-500/20">
              <button
                onClick={closeModal}
                className="w-full px-4 py-2 bg-gradient-to-r from-indigo-600 to-purple-600 rounded-lg text-white font-semibold hover:from-indigo-500 hover:to-purple-500 transition-all"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
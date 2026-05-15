import { useState, useEffect, useRef } from "react";
import { motion, useInView } from "framer-motion";
import { Link, useLocation } from "wouter";
import {
  ArrowRight,
  Menu,
  X,
  Facebook,
  Twitter,
  Instagram,
  Linkedin,
  MapPin,
  Phone,
  Mail,
} from "lucide-react";

export const COLORS = {
  navy: "#0B1D2E",
  navyLight: "#132D46",
  gold: "#C9A96E",
  goldLight: "#D4B87A",
  goldMuted: "rgba(201,169,110,0.15)",
  cream: "#FAF8F5",
  creamDark: "#F3F0EB",
  warmGray: "#8B8680",
  charcoal: "#2C2824",
  navyDark: "#0D1B2A",
  navyDeep: "#081420",
  navySoft: "#162A3F",
  orange: "#E8530A",
  orangeDark: "#C24308",
  orangeLight: "#FF6B22",
  orangeMuted: "rgba(232,83,10,0.12)",
  slate: "#475569",
  slateLight: "#64748B",
  surface: "#F8FAFC",
  surfaceDark: "#EEF2F6",
  border: "#E2E8F0",
};

export const fadeUp = {
  hidden: { opacity: 0, y: 30 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.7, ease: [0.22, 1, 0.36, 1] } },
};

export const stagger = {
  visible: { transition: { staggerChildren: 0.12 } },
};

export function useScrollInView(threshold = 0.15) {
  const ref = useRef<HTMLDivElement>(null);
  const isInView = useInView(ref, { once: true, amount: threshold });
  return { ref, isInView };
}

export const serifFont = "'Georgia', 'Times New Roman', serif";
export const sansFont = "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif";

const navLinks = [
  { label: "Home", href: "/travana" },
  { label: "Destinations", href: "/travana/destinations" },
  { label: "For Advisors", href: "/travana/advisors" },
  { label: "About", href: "/travana/about" },
  { label: "Contact", href: "/travana/contact" },
];

export function Navbar() {
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [location] = useLocation();

  useEffect(() => {
    const handler = () => setScrolled(window.scrollY > 20);
    window.addEventListener("scroll", handler, { passive: true });
    return () => window.removeEventListener("scroll", handler);
  }, []);

  useEffect(() => {
    setMobileOpen(false);
  }, [location]);

  return (
    <nav
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-500 ${
        scrolled || mobileOpen ? "bg-white/95 backdrop-blur-xl shadow-sm" : "bg-transparent"
      }`}
      data-testid="nav-travana"
    >
      <div className="max-w-7xl mx-auto px-5 md:px-8 py-4 flex items-center justify-between">
        <Link href="/travana">
          <span
            className={`text-2xl font-light tracking-[0.15em] uppercase transition-colors duration-500 cursor-pointer ${
              scrolled || mobileOpen ? "text-gray-900" : "text-white"
            }`}
            style={{ fontFamily: serifFont }}
            data-testid="link-logo"
          >
            Travana
          </span>
        </Link>

        <div className="hidden md:flex items-center gap-6">
          {navLinks.map((link) => (
            <Link key={link.href} href={link.href}>
              <span
                className={`text-sm font-medium tracking-wide transition-colors cursor-pointer ${
                  scrolled
                    ? location === link.href
                      ? "text-gray-900"
                      : "text-gray-600 hover:text-gray-900"
                    : location === link.href
                    ? "text-white"
                    : "text-white/70 hover:text-white"
                }`}
                data-testid={`link-nav-${link.label.toLowerCase().replace(/\s+/g, "-")}`}
              >
                {link.label}
              </span>
            </Link>
          ))}
          <Link href="/travana/advisors">
            <span
              className="inline-flex items-center gap-2 px-6 py-2.5 text-sm font-semibold tracking-wide transition-all duration-300 cursor-pointer text-white"
              style={{ backgroundColor: COLORS.gold, borderRadius: "2px" }}
              onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = COLORS.goldLight)}
              onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = COLORS.gold)}
              data-testid="button-nav-join"
            >
              Join Us
              <ArrowRight className="w-4 h-4" />
            </span>
          </Link>
        </div>

        <button
          className="md:hidden w-10 h-10 flex items-center justify-center"
          onClick={() => setMobileOpen(!mobileOpen)}
          data-testid="button-mobile-menu"
        >
          {mobileOpen ? (
            <X className={`w-6 h-6 ${scrolled || mobileOpen ? "text-gray-900" : "text-white"}`} />
          ) : (
            <Menu className={`w-6 h-6 ${scrolled ? "text-gray-900" : "text-white"}`} />
          )}
        </button>
      </div>

      {mobileOpen && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="md:hidden bg-white border-t border-gray-100 px-5 pb-6"
        >
          <div className="flex flex-col gap-1 pt-2">
            {navLinks.map((link) => (
              <Link key={link.href} href={link.href}>
                <span
                  className={`block py-3 text-base font-medium cursor-pointer ${
                    location === link.href ? "text-gray-900" : "text-gray-600"
                  }`}
                  data-testid={`link-mobile-${link.label.toLowerCase().replace(/\s+/g, "-")}`}
                >
                  {link.label}
                </span>
              </Link>
            ))}
            <Link href="/travana/advisors">
              <span
                className="mt-3 w-full py-3 font-semibold text-white text-center block cursor-pointer"
                style={{ backgroundColor: COLORS.gold, borderRadius: "2px" }}
                data-testid="button-mobile-join"
              >
                Join Us
              </span>
            </Link>
          </div>
        </motion.div>
      )}
    </nav>
  );
}

export function Footer() {
  const footerLinks = {
    explore: [
      { label: "Home", href: "/travana" },
      { label: "Destinations", href: "/travana/destinations" },
      { label: "For Advisors", href: "/travana/advisors" },
    ],
    company: [
      { label: "About Us", href: "/travana/about" },
      { label: "Contact", href: "/travana/contact" },
    ],
  };

  return (
    <footer style={{ backgroundColor: COLORS.navy }} data-testid="footer-travana">
      <div className="max-w-7xl mx-auto px-5 md:px-8 py-16">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-10 mb-12">
          <div className="md:col-span-1">
            <span
              className="text-2xl font-light tracking-[0.15em] uppercase text-white block mb-4"
              style={{ fontFamily: serifFont }}
            >
              Travana
            </span>
            <p className="text-sm leading-relaxed" style={{ color: "rgba(255,255,255,0.45)" }}>
              The modern travel agency empowering advisors to build extraordinary careers in luxury travel.
            </p>
          </div>

          <div>
            <h4
              className="text-sm font-semibold uppercase tracking-[0.15em] mb-4"
              style={{ color: COLORS.gold }}
            >
              Explore
            </h4>
            <div className="space-y-3">
              {footerLinks.explore.map((link) => (
                <Link key={link.href} href={link.href}>
                  <span
                    className="block text-sm transition-colors cursor-pointer"
                    style={{ color: "rgba(255,255,255,0.5)" }}
                    onMouseEnter={(e) => (e.currentTarget.style.color = "rgba(255,255,255,0.9)")}
                    onMouseLeave={(e) => (e.currentTarget.style.color = "rgba(255,255,255,0.5)")}
                    data-testid={`link-footer-${link.label.toLowerCase().replace(/\s+/g, "-")}`}
                  >
                    {link.label}
                  </span>
                </Link>
              ))}
            </div>
          </div>

          <div>
            <h4
              className="text-sm font-semibold uppercase tracking-[0.15em] mb-4"
              style={{ color: COLORS.gold }}
            >
              Company
            </h4>
            <div className="space-y-3">
              {footerLinks.company.map((link) => (
                <Link key={link.href} href={link.href}>
                  <span
                    className="block text-sm transition-colors cursor-pointer"
                    style={{ color: "rgba(255,255,255,0.5)" }}
                    onMouseEnter={(e) => (e.currentTarget.style.color = "rgba(255,255,255,0.9)")}
                    onMouseLeave={(e) => (e.currentTarget.style.color = "rgba(255,255,255,0.5)")}
                    data-testid={`link-footer-${link.label.toLowerCase().replace(/\s+/g, "-")}`}
                  >
                    {link.label}
                  </span>
                </Link>
              ))}
            </div>
          </div>

          <div>
            <h4
              className="text-sm font-semibold uppercase tracking-[0.15em] mb-4"
              style={{ color: COLORS.gold }}
            >
              Get in Touch
            </h4>
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <Mail className="w-4 h-4" style={{ color: "rgba(255,255,255,0.4)" }} />
                <span className="text-sm" style={{ color: "rgba(255,255,255,0.5)" }}>
                  hello@travana.com
                </span>
              </div>
              <div className="flex items-center gap-2">
                <Phone className="w-4 h-4" style={{ color: "rgba(255,255,255,0.4)" }} />
                <span className="text-sm" style={{ color: "rgba(255,255,255,0.5)" }}>
                  +44 20 7946 0958
                </span>
              </div>
              <div className="flex items-center gap-2">
                <MapPin className="w-4 h-4" style={{ color: "rgba(255,255,255,0.4)" }} />
                <span className="text-sm" style={{ color: "rgba(255,255,255,0.5)" }}>
                  London, United Kingdom
                </span>
              </div>
            </div>

            <div className="flex gap-3 mt-5">
              {[Facebook, Twitter, Instagram, Linkedin].map((Icon, i) => (
                <a
                  key={i}
                  href="#"
                  className="w-9 h-9 flex items-center justify-center transition-all"
                  style={{ backgroundColor: "rgba(255,255,255,0.08)" }}
                  onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = COLORS.gold)}
                  onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "rgba(255,255,255,0.08)")}
                  data-testid={`link-social-${i}`}
                >
                  <Icon className="w-4 h-4 text-white" />
                </a>
              ))}
            </div>
          </div>
        </div>

        <div
          className="pt-8 flex flex-col md:flex-row items-center justify-between gap-4"
          style={{ borderTop: "1px solid rgba(255,255,255,0.1)" }}
        >
          <p className="text-sm" style={{ color: "rgba(255,255,255,0.3)" }}>
            &copy; 2026 Travana. All rights reserved.
          </p>
          <div className="flex gap-6">
            {["Privacy Policy", "Terms of Service"].map((text) => (
              <a
                key={text}
                href="#"
                className="text-sm transition-colors"
                style={{ color: "rgba(255,255,255,0.3)" }}
                onMouseEnter={(e) => (e.currentTarget.style.color = "rgba(255,255,255,0.7)")}
                onMouseLeave={(e) => (e.currentTarget.style.color = "rgba(255,255,255,0.3)")}
              >
                {text}
              </a>
            ))}
          </div>
        </div>
      </div>
    </footer>
  );
}

export function PageWrapper({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  return (
    <div
      className="min-h-screen bg-white"
      style={{ fontFamily: sansFont }}
    >
      <Navbar />
      {children}
      <Footer />
    </div>
  );
}

export function PageHero({
  title,
  subtitle,
  imageSrc,
}: {
  title: string;
  subtitle: string;
  imageSrc: string;
}) {
  return (
    <section className="relative min-h-[50vh] flex items-center justify-center overflow-hidden" data-testid="section-page-hero">
      <div className="absolute inset-0">
        <img
          src={imageSrc}
          alt={title}
          className="w-full h-full object-cover"
        />
        <div
          className="absolute inset-0"
          style={{ background: `linear-gradient(to bottom, ${COLORS.navy}dd 0%, ${COLORS.navy}99 100%)` }}
        />
      </div>
      <div className="relative z-10 max-w-4xl mx-auto px-5 md:px-8 text-center pt-32 pb-20">
        <motion.h1
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
          className="text-4xl sm:text-5xl md:text-6xl text-white leading-tight mb-5"
          style={{ fontFamily: serifFont, fontWeight: 400 }}
        >
          {title}
        </motion.h1>
        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.2 }}
          className="text-lg sm:text-xl max-w-2xl mx-auto leading-relaxed"
          style={{ color: "rgba(255,255,255,0.6)" }}
        >
          {subtitle}
        </motion.p>
      </div>
    </section>
  );
}

import travanaLogo from "@assets/ChatGPT_Image_May_6,_2026,_03_08_35_PM_(2)_1778078778188.png";

export { travanaLogo };

const growthNavLinks = [
  { label: "Product", href: "#solution" },
  { label: "CRM", href: "#crm" },
  { label: "Training", href: "#training" },
  { label: "Community", href: "#community" },
  { label: "Pricing", href: "#pricing" },
  { label: "Book Demo", href: "#book-demo" },
];

function smoothScroll(href: string) {
  if (!href.startsWith("#")) return;
  const el = document.querySelector(href);
  if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
}

export function GrowthNavbar() {
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    const handler = () => setScrolled(window.scrollY > 20);
    window.addEventListener("scroll", handler, { passive: true });
    return () => window.removeEventListener("scroll", handler);
  }, []);

  return (
    <nav
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
        scrolled || mobileOpen ? "bg-white/95 backdrop-blur-xl shadow-sm border-b" : "bg-transparent"
      }`}
      style={{ borderColor: scrolled || mobileOpen ? COLORS.border : "transparent" }}
      data-testid="nav-growth"
    >
      <div className="max-w-7xl mx-auto px-5 md:px-8 py-3 flex items-center justify-between">
        <Link href="/travana">
          <span className="flex items-center gap-2.5 cursor-pointer" data-testid="link-growth-logo">
            <img src={travanaLogo} alt="Travana" className="h-9 w-auto" />
            <span
              className={`text-lg font-bold tracking-tight hidden sm:inline transition-colors ${
                scrolled || mobileOpen ? "" : "text-white"
              }`}
              style={{ color: scrolled || mobileOpen ? COLORS.navyDark : undefined }}
            >
              Travana
            </span>
          </span>
        </Link>

        <div className="hidden lg:flex items-center gap-7">
          {growthNavLinks.map((link) => (
            <button
              key={link.href}
              onClick={() => smoothScroll(link.href)}
              className={`text-sm font-medium tracking-wide transition-colors cursor-pointer ${
                scrolled ? "text-slate-700 hover:text-slate-900" : "text-white/80 hover:text-white"
              }`}
              data-testid={`link-growth-nav-${link.label.toLowerCase().replace(/\s+/g, "-")}`}
            >
              {link.label}
            </button>
          ))}
        </div>

        <div className="hidden lg:flex items-center gap-3">
          <Link href="/">
            <span
              className={`text-sm font-medium tracking-wide transition-colors cursor-pointer px-3 py-2 ${
                scrolled ? "text-slate-700 hover:text-slate-900" : "text-white/80 hover:text-white"
              }`}
              data-testid="link-growth-login"
            >
              Login
            </span>
          </Link>
          <button
            onClick={() => smoothScroll("#book-demo")}
            className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-semibold tracking-wide transition-all duration-200 cursor-pointer text-white rounded-lg shadow-sm hover:shadow-md hover:-translate-y-0.5"
            style={{ backgroundColor: COLORS.orange }}
            onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = COLORS.orangeDark)}
            onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = COLORS.orange)}
            data-testid="button-growth-nav-demo"
          >
            Book a Demo
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>

        <button
          className="lg:hidden w-10 h-10 flex items-center justify-center"
          onClick={() => setMobileOpen(!mobileOpen)}
          data-testid="button-growth-mobile-menu"
        >
          {mobileOpen ? (
            <X className="w-6 h-6" style={{ color: COLORS.navyDark }} />
          ) : (
            <Menu className={`w-6 h-6 ${scrolled ? "" : "text-white"}`} style={{ color: scrolled ? COLORS.navyDark : undefined }} />
          )}
        </button>
      </div>

      {mobileOpen && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="lg:hidden bg-white border-t px-5 pb-6"
          style={{ borderColor: COLORS.border }}
        >
          <div className="flex flex-col gap-1 pt-2">
            {growthNavLinks.map((link) => (
              <button
                key={link.href}
                onClick={() => { smoothScroll(link.href); setMobileOpen(false); }}
                className="block text-left py-3 text-base font-medium text-slate-700"
                data-testid={`link-growth-mobile-${link.label.toLowerCase().replace(/\s+/g, "-")}`}
              >
                {link.label}
              </button>
            ))}
            <Link href="/">
              <span className="block py-3 text-base font-medium text-slate-700 cursor-pointer" data-testid="link-growth-mobile-login">
                Login
              </span>
            </Link>
            <button
              onClick={() => { smoothScroll("#book-demo"); setMobileOpen(false); }}
              className="mt-3 w-full py-3 font-semibold text-white text-center rounded-lg"
              style={{ backgroundColor: COLORS.orange }}
              data-testid="button-growth-mobile-demo"
            >
              Book a Demo
            </button>
          </div>
        </motion.div>
      )}
    </nav>
  );
}

export function GrowthFooter() {
  const cols = {
    Product: ["Features", "CRM", "Training", "Community", "Pricing"],
    Company: ["About", "Contact", "Careers", "Blog"],
    Resources: ["Help Center", "Documentation", "Webinars", "Case Studies"],
    Legal: ["Privacy Policy", "Terms of Service", "GDPR", "Security"],
  };

  return (
    <footer style={{ backgroundColor: COLORS.navyDark }} data-testid="footer-growth">
      <div className="max-w-7xl mx-auto px-5 md:px-8 py-16">
        <div className="grid grid-cols-2 md:grid-cols-6 gap-10 mb-12">
          <div className="col-span-2">
            <div className="flex items-center gap-2.5 mb-5">
              <img src={travanaLogo} alt="Travana" className="h-10 w-auto" />
              <span className="text-xl font-bold text-white">Travana</span>
            </div>
            <p className="text-sm leading-relaxed mb-5" style={{ color: "rgba(255,255,255,0.6)" }}>
              The Operating System for Travel Agents. Built for bookings, follow-up, and growth.
            </p>
            <button
              onClick={() => smoothScroll("#book-demo")}
              className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-semibold text-white rounded-lg transition-colors"
              style={{ backgroundColor: COLORS.orange }}
              onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = COLORS.orangeDark)}
              onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = COLORS.orange)}
              data-testid="button-footer-demo"
            >
              Book a Demo
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>

          {Object.entries(cols).map(([title, items]) => (
            <div key={title}>
              <h4 className="text-sm font-semibold uppercase tracking-wider mb-4" style={{ color: COLORS.orange }}>
                {title}
              </h4>
              <div className="space-y-2.5">
                {items.map((label) => (
                  <a
                    key={label}
                    href="#"
                    className="block text-sm transition-colors"
                    style={{ color: "rgba(255,255,255,0.55)" }}
                    onMouseEnter={(e) => (e.currentTarget.style.color = "#fff")}
                    onMouseLeave={(e) => (e.currentTarget.style.color = "rgba(255,255,255,0.55)")}
                  >
                    {label}
                  </a>
                ))}
              </div>
            </div>
          ))}
        </div>

        <div
          className="pt-8 flex flex-col md:flex-row items-center justify-between gap-4"
          style={{ borderTop: "1px solid rgba(255,255,255,0.1)" }}
        >
          <p className="text-sm" style={{ color: "rgba(255,255,255,0.4)" }}>
            &copy; 2026 Travana. The Operating System for Travel Agents.
          </p>
          <div className="flex gap-3">
            {[Facebook, Twitter, Instagram, Linkedin].map((Icon, i) => (
              <a
                key={i}
                href="#"
                className="w-9 h-9 flex items-center justify-center rounded-lg transition-all"
                style={{ backgroundColor: "rgba(255,255,255,0.06)" }}
                onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = COLORS.orange)}
                onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "rgba(255,255,255,0.06)")}
                data-testid={`link-growth-social-${i}`}
              >
                <Icon className="w-4 h-4 text-white" />
              </a>
            ))}
          </div>
        </div>
      </div>
    </footer>
  );
}

export function GrowthPageWrapper({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  return (
    <div className="min-h-screen bg-white" style={{ fontFamily: sansFont }}>
      <GrowthNavbar />
      {children}
      <GrowthFooter />
    </div>
  );
}

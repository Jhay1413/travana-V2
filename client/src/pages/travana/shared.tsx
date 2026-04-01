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

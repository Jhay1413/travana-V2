import { useState, useRef, useEffect } from "react";
import { motion, useInView, AnimatePresence } from "framer-motion";
import { AxiosError } from "axios";
import { useRegisterAgent } from "@/hooks/mutations";
import {
  Globe,
  Users,
  Wallet,
  BookOpen,
  Headphones,
  BarChart3,
  CheckCircle2,
  ArrowRight,
  ChevronRight,
  MapPin,
  Star,
  Sparkles,
  TrendingUp,
  Heart,
  Compass,
  X,
  Loader2,
} from "lucide-react";

function useScrollInView(threshold = 0.15) {
  const ref = useRef<HTMLDivElement>(null);
  const isInView = useInView(ref, { once: true, amount: threshold });
  return { ref, isInView };
}

const fadeUp = {
  hidden: { opacity: 0, y: 30 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.7, ease: [0.22, 1, 0.36, 1] } },
};

const stagger = {
  visible: { transition: { staggerChildren: 0.12 } },
};

const COLORS = {
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

function Navbar({ onJoinClick }: { onJoinClick: () => void }) {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const handler = () => setScrolled(window.scrollY > 20);
    window.addEventListener("scroll", handler, { passive: true });
    return () => window.removeEventListener("scroll", handler);
  }, []);

  return (
    <nav
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-500 ${
        scrolled ? "bg-white/95 backdrop-blur-xl shadow-sm" : "bg-transparent"
      }`}
      data-testid="nav-travana"
    >
      <div className="max-w-7xl mx-auto px-5 md:px-8 py-4 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <span
            className={`text-2xl font-light tracking-[0.15em] uppercase transition-colors duration-500 ${
              scrolled ? "text-gray-900" : "text-white"
            }`}
            style={{ fontFamily: "'Georgia', 'Times New Roman', serif" }}
          >
            Travana
          </span>
        </div>
        <div className="flex items-center gap-6">
          <a
            href="#how-it-works"
            className={`hidden md:inline text-sm font-medium tracking-wide transition-colors ${
              scrolled ? "text-gray-600 hover:text-gray-900" : "text-white/70 hover:text-white"
            }`}
          >
            How It Works
          </a>
          <a
            href="#features"
            className={`hidden md:inline text-sm font-medium tracking-wide transition-colors ${
              scrolled ? "text-gray-600 hover:text-gray-900" : "text-white/70 hover:text-white"
            }`}
          >
            Benefits
          </a>
          <button
            onClick={onJoinClick}
            className="hidden md:inline-flex items-center gap-2 px-6 py-2.5 text-sm font-semibold tracking-wide transition-all duration-300"
            style={{
              backgroundColor: COLORS.gold,
              color: "#fff",
              borderRadius: "2px",
            }}
            onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = COLORS.goldLight)}
            onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = COLORS.gold)}
            data-testid="button-nav-join"
          >
            Become an Advisor
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </nav>
  );
}

function HeroSection({
  onJoinClick,
  onLearnMore,
}: {
  onJoinClick: () => void;
  onLearnMore: () => void;
}) {
  return (
    <section className="relative min-h-[100svh] flex items-center justify-center overflow-hidden" data-testid="section-hero">
      <div className="absolute inset-0">
        <img src="/images/hero-bg.jpg" alt="" className="w-full h-full object-cover" />
      </div>
      <div className="absolute inset-0" style={{ background: `linear-gradient(165deg, rgba(11,29,46,0.82) 0%, rgba(19,45,70,0.75) 50%, rgba(26,58,92,0.7) 100%)` }} />
      <div className="absolute inset-0 opacity-30" style={{ backgroundImage: "radial-gradient(circle at 70% 30%, rgba(201,169,110,0.15), transparent 50%)" }} />

      <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-white/10 to-transparent" />

      <div className="relative z-10 max-w-4xl mx-auto px-5 md:px-8 text-center pt-24 pb-16">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="inline-flex items-center gap-2.5 px-5 py-2 mb-10"
          style={{
            border: `1px solid rgba(201,169,110,0.3)`,
            color: COLORS.gold,
            letterSpacing: "0.15em",
            fontSize: "12px",
            fontWeight: 500,
            textTransform: "uppercase",
          }}
        >
          <Sparkles className="w-3.5 h-3.5" />
          The Modern Travel Agency
        </motion.div>

        <motion.h1
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.15 }}
          className="text-4xl sm:text-5xl md:text-7xl text-white leading-[1.08] mb-7"
          style={{ fontFamily: "'Georgia', 'Times New Roman', serif", fontWeight: 400, letterSpacing: "-0.01em" }}
        >
          We're not for
          <br />
          <span className="italic" style={{ color: COLORS.gold }}>everyone.</span>
        </motion.h1>

        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.3 }}
          className="text-lg sm:text-xl md:text-2xl max-w-2xl mx-auto mb-12 leading-relaxed"
          style={{ color: "rgba(255,255,255,0.55)", fontWeight: 300 }}
        >
          But you're not just anyone. Join a purpose-driven community of travel advisors who are rewriting the rules.
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.45 }}
          className="flex flex-col sm:flex-row items-center justify-center gap-4"
        >
          <button
            onClick={onJoinClick}
            className="w-full sm:w-auto px-10 py-4 font-semibold text-base tracking-wide transition-all duration-300 flex items-center justify-center gap-2.5"
            style={{ backgroundColor: COLORS.gold, color: "#fff", borderRadius: "2px" }}
            onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = COLORS.goldLight)}
            onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = COLORS.gold)}
            data-testid="button-hero-join"
          >
            Become an Advisor
            <ArrowRight className="w-5 h-5" />
          </button>
          <button
            onClick={onLearnMore}
            className="w-full sm:w-auto px-10 py-4 font-medium text-base tracking-wide transition-all duration-300 flex items-center justify-center gap-2"
            style={{ border: "1px solid rgba(255,255,255,0.2)", color: "rgba(255,255,255,0.7)", borderRadius: "2px" }}
            onMouseEnter={(e) => { e.currentTarget.style.borderColor = "rgba(255,255,255,0.4)"; e.currentTarget.style.color = "#fff"; }}
            onMouseLeave={(e) => { e.currentTarget.style.borderColor = "rgba(255,255,255,0.2)"; e.currentTarget.style.color = "rgba(255,255,255,0.7)"; }}
            data-testid="button-hero-learn"
          >
            Learn More
            <ChevronRight className="w-5 h-5" />
          </button>
        </motion.div>
      </div>

      <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-white/10 to-transparent" />
    </section>
  );
}

function TrustBar() {
  const { ref, isInView } = useScrollInView();
  const stats = [
    { value: "2,500+", label: "Active Advisors" },
    { value: "£12M+", label: "Commissions Earned" },
    { value: "98%", label: "Satisfaction Rate" },
    { value: "45+", label: "Countries Covered" },
  ];

  return (
    <section ref={ref} className="py-14 md:py-20" style={{ backgroundColor: COLORS.cream, borderBottom: `1px solid ${COLORS.creamDark}` }} data-testid="section-trust">
      <div className="max-w-6xl mx-auto px-5 md:px-8">
        <motion.div
          initial="hidden"
          animate={isInView ? "visible" : "hidden"}
          variants={stagger}
          className="grid grid-cols-2 md:grid-cols-4 gap-8 md:gap-12"
        >
          {stats.map((stat, i) => (
            <motion.div key={i} variants={fadeUp} className="text-center">
              <p className="text-3xl md:text-4xl font-light mb-1" style={{ color: COLORS.navy, fontFamily: "'Georgia', 'Times New Roman', serif" }} data-testid={`text-stat-value-${i}`}>
                {stat.value}
              </p>
              <p className="text-sm tracking-wider uppercase" style={{ color: COLORS.warmGray, fontWeight: 500, letterSpacing: "0.1em" }}>{stat.label}</p>
            </motion.div>
          ))}
        </motion.div>
      </div>
    </section>
  );
}

function HowItWorks() {
  const { ref, isInView } = useScrollInView();
  const steps = [
    {
      icon: BookOpen,
      title: "Apply Online",
      description: "Fill out our simple application form. No experience needed — we'll teach you everything.",
      num: "01",
    },
    {
      icon: Headphones,
      title: "Get Trained",
      description: "Access our comprehensive training platform, mentorship program, and live support from day one.",
      num: "02",
    },
    {
      icon: Wallet,
      title: "Start Earning",
      description: "Book holidays for clients and earn generous commission on every single sale you make.",
      num: "03",
    },
  ];

  return (
    <section ref={ref} className="py-20 md:py-28 bg-white" id="how-it-works" data-testid="section-how-it-works">
      <div className="max-w-6xl mx-auto px-5 md:px-8">
        <motion.div
          initial="hidden"
          animate={isInView ? "visible" : "hidden"}
          variants={stagger}
          className="text-center mb-16"
        >
          <motion.p variants={fadeUp} className="text-sm font-semibold uppercase tracking-[0.2em] mb-4" style={{ color: COLORS.gold }}>
            How It Works
          </motion.p>
          <motion.h2 variants={fadeUp} className="text-3xl md:text-5xl tracking-tight" style={{ fontFamily: "'Georgia', 'Times New Roman', serif", color: COLORS.navy, fontWeight: 400 }}>
            Three Simple Steps
          </motion.h2>
        </motion.div>

        <div className="flex md:grid md:grid-cols-3 gap-6 overflow-x-auto pb-4 md:pb-0 snap-x snap-mandatory -mx-5 px-5 md:mx-0 md:px-0 scrollbar-hide">
          {steps.map((step, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 30 }}
              animate={isInView ? { opacity: 1, y: 0 } : {}}
              transition={{ duration: 0.6, delay: i * 0.15 }}
              className="min-w-[280px] md:min-w-0 snap-center p-8 group transition-all duration-500"
              style={{
                backgroundColor: COLORS.cream,
                border: `1px solid ${COLORS.creamDark}`,
              }}
              onMouseEnter={(e) => { e.currentTarget.style.borderColor = COLORS.gold; e.currentTarget.style.backgroundColor = "#fff"; }}
              onMouseLeave={(e) => { e.currentTarget.style.borderColor = COLORS.creamDark; e.currentTarget.style.backgroundColor = COLORS.cream; }}
              data-testid={`card-step-${i}`}
            >
              <div className="flex items-center justify-between mb-6">
                <div className="w-12 h-12 flex items-center justify-center" style={{ backgroundColor: COLORS.goldMuted }}>
                  <step.icon className="w-5 h-5" style={{ color: COLORS.gold }} />
                </div>
                <span className="text-5xl font-light" style={{ color: COLORS.creamDark, fontFamily: "'Georgia', serif" }}>
                  {step.num}
                </span>
              </div>
              <h3 className="text-lg font-semibold mb-2" style={{ color: COLORS.navy }}>{step.title}</h3>
              <p className="leading-relaxed text-[15px]" style={{ color: COLORS.warmGray }}>{step.description}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}

function LifestyleSection() {
  const { ref, isInView } = useScrollInView();

  return (
    <section ref={ref} className="py-20 md:py-28 overflow-hidden" style={{ backgroundColor: COLORS.navy }} data-testid="section-lifestyle">
      <div className="max-w-7xl mx-auto px-5 md:px-8">
        <div className="grid md:grid-cols-2 gap-12 md:gap-20 items-center">
          <motion.div
            initial={{ opacity: 0, x: -40 }}
            animate={isInView ? { opacity: 1, x: 0 } : {}}
            transition={{ duration: 0.8 }}
            className="relative order-2 md:order-1"
          >
            <div className="aspect-[4/3] overflow-hidden relative" style={{ backgroundColor: COLORS.navyLight }}>
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="text-center space-y-5 p-8">
                  <div className="w-20 h-20 mx-auto flex items-center justify-center" style={{ backgroundColor: COLORS.goldMuted }}>
                    <Globe className="w-10 h-10" style={{ color: COLORS.gold }} />
                  </div>
                  <p className="text-2xl text-white" style={{ fontFamily: "'Georgia', serif", fontWeight: 400 }}>Work From Paradise</p>
                  <p style={{ color: "rgba(255,255,255,0.45)" }}>Your office could be anywhere in the world</p>
                </div>
              </div>
            </div>
            <motion.div
              className="absolute -bottom-4 -right-4 p-5"
              style={{ backgroundColor: "#fff", border: `1px solid ${COLORS.creamDark}` }}
              initial={{ opacity: 0, scale: 0.8 }}
              animate={isInView ? { opacity: 1, scale: 1 } : {}}
              transition={{ duration: 0.5, delay: 0.4 }}
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 flex items-center justify-center" style={{ backgroundColor: COLORS.goldMuted }}>
                  <TrendingUp className="w-5 h-5" style={{ color: COLORS.gold }} />
                </div>
                <div>
                  <p className="text-sm font-bold" style={{ color: COLORS.navy }}>Avg. £3,200/mo</p>
                  <p className="text-xs" style={{ color: COLORS.warmGray }}>Advisor earnings</p>
                </div>
              </div>
            </motion.div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, x: 40 }}
            animate={isInView ? { opacity: 1, x: 0 } : {}}
            transition={{ duration: 0.8, delay: 0.15 }}
            className="order-1 md:order-2"
          >
            <p className="text-sm font-semibold uppercase tracking-[0.2em] mb-4" style={{ color: COLORS.gold }}>Freedom & Flexibility</p>
            <h2 className="text-3xl md:text-4xl tracking-tight mb-6 leading-tight text-white" style={{ fontFamily: "'Georgia', serif", fontWeight: 400 }}>
              Design the Life
              <br />
              <span className="italic" style={{ color: COLORS.gold }}>You've Always Wanted</span>
            </h2>
            <p className="text-lg leading-relaxed mb-8" style={{ color: "rgba(255,255,255,0.5)" }}>
              No more 9 to 5. As a Travana advisor, you choose when and where you work. Build a business around your life — not the other way around.
            </p>
            <div className="space-y-4">
              {[
                "Set your own schedule and work hours",
                "No commute — work from home or anywhere",
                "Uncapped earning potential with generous commissions",
                "Access exclusive travel deals and FAM trips",
              ].map((item, i) => (
                <div key={i} className="flex items-start gap-3">
                  <CheckCircle2 className="w-5 h-5 mt-0.5 flex-shrink-0" style={{ color: COLORS.gold }} />
                  <span style={{ color: "rgba(255,255,255,0.7)" }}>{item}</span>
                </div>
              ))}
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
}

function FeaturesGrid() {
  const { ref, isInView } = useScrollInView();
  const features = [
    {
      icon: Globe,
      title: "Booking Platform",
      description: "Access our powerful booking system with thousands of suppliers and real-time availability.",
    },
    {
      icon: BookOpen,
      title: "Training Academy",
      description: "Comprehensive online courses, webinars, and certifications to sharpen your skills.",
    },
    {
      icon: Users,
      title: "Mentorship",
      description: "Get paired with an experienced advisor mentor who guides you through your first months.",
    },
    {
      icon: BarChart3,
      title: "CRM & Tools",
      description: "Professional CRM, quote builder, and marketing tools included at no extra cost.",
    },
    {
      icon: Headphones,
      title: "24/7 Support",
      description: "Dedicated support team available around the clock to help you and your clients.",
    },
    {
      icon: Heart,
      title: "Community",
      description: "Join a vibrant community of advisors sharing tips, celebrating wins, and supporting each other.",
    },
  ];

  return (
    <section ref={ref} className="py-20 md:py-28" id="features" style={{ backgroundColor: COLORS.cream }} data-testid="section-features">
      <div className="max-w-6xl mx-auto px-5 md:px-8">
        <motion.div
          initial="hidden"
          animate={isInView ? "visible" : "hidden"}
          variants={stagger}
          className="text-center mb-16"
        >
          <motion.p variants={fadeUp} className="text-sm font-semibold uppercase tracking-[0.2em] mb-4" style={{ color: COLORS.gold }}>
            What You Get
          </motion.p>
          <motion.h2 variants={fadeUp} className="text-3xl md:text-5xl tracking-tight" style={{ fontFamily: "'Georgia', serif", color: COLORS.navy, fontWeight: 400 }}>
            Everything You Need to Succeed
          </motion.h2>
        </motion.div>

        <motion.div
          initial="hidden"
          animate={isInView ? "visible" : "hidden"}
          variants={stagger}
          className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6"
        >
          {features.map((feature, i) => (
            <motion.div
              key={i}
              variants={fadeUp}
              className="bg-white p-7 transition-all duration-500 cursor-default group"
              style={{ border: `1px solid ${COLORS.creamDark}` }}
              onMouseEnter={(e) => { e.currentTarget.style.borderColor = COLORS.gold; e.currentTarget.style.transform = "translateY(-4px)"; e.currentTarget.style.boxShadow = "0 12px 40px rgba(0,0,0,0.06)"; }}
              onMouseLeave={(e) => { e.currentTarget.style.borderColor = COLORS.creamDark; e.currentTarget.style.transform = "translateY(0)"; e.currentTarget.style.boxShadow = "none"; }}
              data-testid={`card-feature-${i}`}
            >
              <div className="w-12 h-12 flex items-center justify-center mb-5" style={{ backgroundColor: COLORS.goldMuted }}>
                <feature.icon className="w-5 h-5" style={{ color: COLORS.gold }} />
              </div>
              <h3 className="text-lg font-semibold mb-2" style={{ color: COLORS.navy }}>{feature.title}</h3>
              <p className="leading-relaxed text-sm" style={{ color: COLORS.warmGray }}>{feature.description}</p>
            </motion.div>
          ))}
        </motion.div>
      </div>
    </section>
  );
}

function CommunitySection() {
  const { ref, isInView } = useScrollInView();
  const testimonials = [
    {
      name: "Sarah Mitchell",
      role: "Advisor since 2023",
      location: "Manchester, UK",
      quote: "I left my corporate job and haven't looked back. Last month I earned more than my old salary while working half the hours.",
      rating: 5,
    },
    {
      name: "James Okafor",
      role: "Advisor since 2024",
      location: "London, UK",
      quote: "The training and support from Travana made all the difference. I booked my first holiday within my first week!",
      rating: 5,
    },
    {
      name: "Emma Chen",
      role: "Advisor since 2022",
      location: "Bristol, UK",
      quote: "Being able to work around my kids' schedule is priceless. Travana gave me the freedom I'd been searching for.",
      rating: 5,
    },
  ];

  return (
    <section ref={ref} className="py-20 md:py-28 bg-white" data-testid="section-community">
      <div className="max-w-6xl mx-auto px-5 md:px-8">
        <motion.div
          initial="hidden"
          animate={isInView ? "visible" : "hidden"}
          variants={stagger}
          className="text-center mb-16"
        >
          <motion.p variants={fadeUp} className="text-sm font-semibold uppercase tracking-[0.2em] mb-4" style={{ color: COLORS.gold }}>
            Our Community
          </motion.p>
          <motion.h2 variants={fadeUp} className="text-3xl md:text-5xl tracking-tight mb-4" style={{ fontFamily: "'Georgia', serif", color: COLORS.navy, fontWeight: 400 }}>
            We're Loved by Industry Leaders
          </motion.h2>
          <motion.p variants={fadeUp} className="text-lg max-w-2xl mx-auto" style={{ color: COLORS.warmGray }}>
            Real stories from real people who transformed their lives with Travana.
          </motion.p>
        </motion.div>

        <motion.div
          initial="hidden"
          animate={isInView ? "visible" : "hidden"}
          variants={stagger}
          className="grid grid-cols-1 md:grid-cols-3 gap-6"
        >
          {testimonials.map((t, i) => (
            <motion.div
              key={i}
              variants={fadeUp}
              className="p-7 transition-all duration-300"
              style={{ backgroundColor: COLORS.cream, border: `1px solid ${COLORS.creamDark}` }}
              data-testid={`card-testimonial-${i}`}
            >
              <div className="flex gap-1 mb-5">
                {Array.from({ length: t.rating }).map((_, j) => (
                  <Star key={j} className="w-4 h-4" style={{ fill: COLORS.gold, color: COLORS.gold }} />
                ))}
              </div>
              <p className="leading-relaxed mb-6 text-[15px] italic" style={{ color: COLORS.charcoal, fontFamily: "'Georgia', serif" }}>
                "{t.quote}"
              </p>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 flex items-center justify-center text-white font-semibold text-sm" style={{ backgroundColor: COLORS.navy }}>
                  {t.name.split(" ").map((n) => n[0]).join("")}
                </div>
                <div>
                  <p className="font-semibold text-sm" style={{ color: COLORS.navy }}>{t.name}</p>
                  <div className="flex items-center gap-1 text-xs" style={{ color: COLORS.warmGray }}>
                    <MapPin className="w-3 h-3" />
                    {t.location} · {t.role}
                  </div>
                </div>
              </div>
            </motion.div>
          ))}
        </motion.div>
      </div>
    </section>
  );
}

function FirstSaleSection() {
  const { ref, isInView } = useScrollInView();
  const steps = [
    {
      step: "1",
      title: "Find a Client",
      description: "Start with friends, family, or your social network. Everyone books holidays!",
      icon: Users,
    },
    {
      step: "2",
      title: "Build a Quote",
      description: "Use our platform to create a stunning, personalised travel quote in minutes.",
      icon: BookOpen,
    },
    {
      step: "3",
      title: "Earn Commission",
      description: "Once they book, you earn commission. It's that simple. No caps, no limits.",
      icon: Wallet,
    },
  ];

  return (
    <section ref={ref} className="py-20 md:py-28" style={{ background: `linear-gradient(180deg, ${COLORS.cream} 0%, #fff 100%)` }} data-testid="section-first-sale">
      <div className="max-w-5xl mx-auto px-5 md:px-8">
        <motion.div
          initial="hidden"
          animate={isInView ? "visible" : "hidden"}
          variants={stagger}
          className="text-center mb-16"
        >
          <motion.p variants={fadeUp} className="text-sm font-semibold uppercase tracking-[0.2em] mb-4" style={{ color: COLORS.gold }}>
            Your First Sale
          </motion.p>
          <motion.h2 variants={fadeUp} className="text-3xl md:text-5xl tracking-tight" style={{ fontFamily: "'Georgia', serif", color: COLORS.navy, fontWeight: 400 }}>
            Simplified to Three Steps
          </motion.h2>
        </motion.div>

        <div className="relative">
          <div className="hidden md:block absolute top-16 left-[16.67%] right-[16.67%] h-px" style={{ backgroundColor: COLORS.creamDark }} />

          <motion.div
            initial="hidden"
            animate={isInView ? "visible" : "hidden"}
            variants={stagger}
            className="grid grid-cols-1 md:grid-cols-3 gap-8"
          >
            {steps.map((s, i) => (
              <motion.div key={i} variants={fadeUp} className="text-center relative" data-testid={`card-first-sale-${i}`}>
                <div className="w-14 h-14 mx-auto flex items-center justify-center mb-5 relative z-10" style={{ backgroundColor: COLORS.navy }}>
                  <s.icon className="w-6 h-6" style={{ color: COLORS.gold }} />
                </div>
                <h3 className="text-lg font-semibold mb-2" style={{ color: COLORS.navy }}>{s.title}</h3>
                <p className="text-sm leading-relaxed max-w-xs mx-auto" style={{ color: COLORS.warmGray }}>{s.description}</p>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </div>
    </section>
  );
}

function OnboardingWizard({
  isOpen,
  onClose,
}: {
  isOpen: boolean;
  onClose: () => void;
}) {
  const [step, setStep] = useState(0);
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    phone: "",
    location: "",
    motivation: "",
  });

  const registerMutation = useRegisterAgent();

  const updateField = (field: string, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const canProceed = () => {
    switch (step) {
      case 0:
        return formData.name.trim().length > 0 && formData.email.trim().length > 0 && formData.email.includes("@");
      case 1:
        return formData.phone.trim().length > 0 && formData.location.trim().length > 0;
      case 2:
        return true;
      case 3:
        return true;
      default:
        return false;
    }
  };

  const handleNext = () => {
    if (step < 3) {
      setStep(step + 1);
    } else if (step === 3) {
      registerMutation.mutate(formData, {
        onSuccess: () => setStep(4),
      });
    }
  };

  const handleClose = () => {
    onClose();
    setTimeout(() => {
      setStep(0);
      setFormData({ name: "", email: "", phone: "", location: "", motivation: "" });
      registerMutation.reset();
    }, 300);
  };

  const stepLabels = ["Your Details", "Contact Info", "Motivation", "Confirm"];

  const inputStyle = {
    border: `1px solid ${COLORS.creamDark}`,
    outline: "none",
    borderRadius: "2px",
    color: COLORS.navy,
  };

  const inputFocusStyle = `1px solid ${COLORS.gold}`;

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center p-0 sm:p-4"
          style={{ backgroundColor: "rgba(11,29,46,0.7)", backdropFilter: "blur(8px)" }}
          onClick={(e) => e.target === e.currentTarget && handleClose()}
          onKeyDown={(e) => e.key === "Escape" && handleClose()}
          role="dialog"
          aria-modal="true"
          aria-label="Join Travana"
          data-testid="modal-onboarding"
        >
          <motion.div
            initial={{ opacity: 0, y: 100 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 100 }}
            transition={{ type: "spring", damping: 25, stiffness: 300 }}
            className="bg-white w-full sm:max-w-lg overflow-hidden max-h-[90svh] flex flex-col"
            style={{ borderRadius: "0 0 0 0", ...(typeof window !== "undefined" && window.innerWidth >= 640 ? {} : {}) }}
          >
            <div className="flex items-center justify-between px-6 pt-6 pb-4">
              <h3 className="text-lg font-semibold" style={{ color: COLORS.navy, fontFamily: "'Georgia', serif" }}>
                {step < 4 ? `Step ${step + 1} of 4` : ""}
              </h3>
              <button
                onClick={handleClose}
                className="w-8 h-8 flex items-center justify-center transition-colors"
                style={{ backgroundColor: COLORS.cream }}
                onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = COLORS.creamDark)}
                onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = COLORS.cream)}
                data-testid="button-close-wizard"
                aria-label="Close"
              >
                <X className="w-4 h-4" style={{ color: COLORS.warmGray }} />
              </button>
            </div>

            {step < 4 && (
              <div className="px-6 pb-4">
                <div className="flex gap-2">
                  {[0, 1, 2, 3].map((s) => (
                    <div
                      key={s}
                      className="h-1 flex-1 transition-all duration-500"
                      style={{ backgroundColor: s <= step ? COLORS.gold : COLORS.creamDark }}
                      data-testid={`progress-step-${s}`}
                    />
                  ))}
                </div>
                <p className="text-sm mt-2" style={{ color: COLORS.warmGray }}>{stepLabels[step]}</p>
              </div>
            )}

            <div className="px-6 pb-6 flex-1 overflow-y-auto">
              <AnimatePresence mode="wait">
                {step === 0 && (
                  <motion.div
                    key="step-0"
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    transition={{ duration: 0.3 }}
                    className="space-y-5"
                  >
                    <div>
                      <label htmlFor="wizard-name" className="block text-sm font-semibold mb-2" style={{ color: COLORS.navy }}>Full Name</label>
                      <input
                        id="wizard-name"
                        type="text"
                        value={formData.name}
                        onChange={(e) => updateField("name", e.target.value)}
                        placeholder="e.g. Sarah Mitchell"
                        className="w-full px-4 py-3.5 transition-all"
                        style={inputStyle}
                        onFocus={(e) => (e.target.style.border = inputFocusStyle)}
                        onBlur={(e) => (e.target.style.border = `1px solid ${COLORS.creamDark}`)}
                        data-testid="input-name"
                      />
                    </div>
                    <div>
                      <label htmlFor="wizard-email" className="block text-sm font-semibold mb-2" style={{ color: COLORS.navy }}>Email Address</label>
                      <input
                        id="wizard-email"
                        type="email"
                        value={formData.email}
                        onChange={(e) => updateField("email", e.target.value)}
                        placeholder="sarah@example.com"
                        className="w-full px-4 py-3.5 transition-all"
                        style={inputStyle}
                        onFocus={(e) => (e.target.style.border = inputFocusStyle)}
                        onBlur={(e) => (e.target.style.border = `1px solid ${COLORS.creamDark}`)}
                        data-testid="input-email"
                      />
                    </div>
                  </motion.div>
                )}

                {step === 1 && (
                  <motion.div
                    key="step-1"
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    transition={{ duration: 0.3 }}
                    className="space-y-5"
                  >
                    <div>
                      <label htmlFor="wizard-phone" className="block text-sm font-semibold mb-2" style={{ color: COLORS.navy }}>Phone Number</label>
                      <input
                        id="wizard-phone"
                        type="tel"
                        value={formData.phone}
                        onChange={(e) => updateField("phone", e.target.value)}
                        placeholder="+44 7700 900000"
                        className="w-full px-4 py-3.5 transition-all"
                        style={inputStyle}
                        onFocus={(e) => (e.target.style.border = inputFocusStyle)}
                        onBlur={(e) => (e.target.style.border = `1px solid ${COLORS.creamDark}`)}
                        data-testid="input-phone"
                      />
                    </div>
                    <div>
                      <label htmlFor="wizard-location" className="block text-sm font-semibold mb-2" style={{ color: COLORS.navy }}>Your Location</label>
                      <input
                        id="wizard-location"
                        type="text"
                        value={formData.location}
                        onChange={(e) => updateField("location", e.target.value)}
                        placeholder="e.g. Manchester, UK"
                        className="w-full px-4 py-3.5 transition-all"
                        style={inputStyle}
                        onFocus={(e) => (e.target.style.border = inputFocusStyle)}
                        onBlur={(e) => (e.target.style.border = `1px solid ${COLORS.creamDark}`)}
                        data-testid="input-location"
                      />
                    </div>
                  </motion.div>
                )}

                {step === 2 && (
                  <motion.div
                    key="step-2"
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    transition={{ duration: 0.3 }}
                    className="space-y-5"
                  >
                    <div>
                      <label htmlFor="wizard-motivation" className="block text-sm font-semibold mb-2" style={{ color: COLORS.navy }}>
                        What excites you about becoming a travel advisor?
                      </label>
                      <textarea
                        id="wizard-motivation"
                        value={formData.motivation}
                        onChange={(e) => updateField("motivation", e.target.value)}
                        placeholder="Tell us what motivates you... (optional)"
                        rows={5}
                        className="w-full px-4 py-3.5 transition-all resize-none"
                        style={inputStyle}
                        onFocus={(e) => (e.target.style.border = inputFocusStyle)}
                        onBlur={(e) => (e.target.style.border = `1px solid ${COLORS.creamDark}`)}
                        data-testid="input-motivation"
                      />
                    </div>
                  </motion.div>
                )}

                {step === 3 && (
                  <motion.div
                    key="step-3"
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    transition={{ duration: 0.3 }}
                    className="space-y-4"
                  >
                    <p className="text-sm mb-2" style={{ color: COLORS.warmGray }}>Please review your details before submitting:</p>
                    <div className="p-5 space-y-3" style={{ backgroundColor: COLORS.cream }} data-testid="confirmation-details">
                      <div className="flex justify-between items-start">
                        <span className="text-sm" style={{ color: COLORS.warmGray }}>Name</span>
                        <span className="text-sm font-semibold text-right" style={{ color: COLORS.navy }}>{formData.name}</span>
                      </div>
                      <div style={{ borderTop: `1px solid ${COLORS.creamDark}` }} />
                      <div className="flex justify-between items-start">
                        <span className="text-sm" style={{ color: COLORS.warmGray }}>Email</span>
                        <span className="text-sm font-semibold text-right" style={{ color: COLORS.navy }}>{formData.email}</span>
                      </div>
                      <div style={{ borderTop: `1px solid ${COLORS.creamDark}` }} />
                      <div className="flex justify-between items-start">
                        <span className="text-sm" style={{ color: COLORS.warmGray }}>Phone</span>
                        <span className="text-sm font-semibold text-right" style={{ color: COLORS.navy }}>{formData.phone}</span>
                      </div>
                      <div style={{ borderTop: `1px solid ${COLORS.creamDark}` }} />
                      <div className="flex justify-between items-start">
                        <span className="text-sm" style={{ color: COLORS.warmGray }}>Location</span>
                        <span className="text-sm font-semibold text-right" style={{ color: COLORS.navy }}>{formData.location}</span>
                      </div>
                      {formData.motivation && (
                        <>
                          <div style={{ borderTop: `1px solid ${COLORS.creamDark}` }} />
                          <div className="flex justify-between items-start">
                            <span className="text-sm" style={{ color: COLORS.warmGray }}>Motivation</span>
                            <span className="text-sm font-semibold text-right max-w-[200px]" style={{ color: COLORS.navy }}>{formData.motivation}</span>
                          </div>
                        </>
                      )}
                    </div>
                  </motion.div>
                )}

                {step === 4 && (
                  <motion.div
                    key="step-4"
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ duration: 0.4 }}
                    className="text-center py-8"
                  >
                    <div className="w-20 h-20 mx-auto flex items-center justify-center mb-6" style={{ backgroundColor: COLORS.goldMuted }}>
                      <CheckCircle2 className="w-10 h-10" style={{ color: COLORS.gold }} />
                    </div>
                    <h3 className="text-2xl font-semibold mb-3" style={{ color: COLORS.navy, fontFamily: "'Georgia', serif" }} data-testid="text-success-title">
                      Welcome to Travana
                    </h3>
                    <p className="leading-relaxed max-w-sm mx-auto" style={{ color: COLORS.warmGray }} data-testid="text-success-message">
                      Your application has been submitted successfully. We'll be in touch shortly to get you started on your journey.
                    </p>
                  </motion.div>
                )}
              </AnimatePresence>

              {registerMutation.isError && step < 4 && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="mt-4 p-3"
                  style={{ backgroundColor: "#FEF2F2", border: "1px solid #FECACA" }}
                >
                  <p className="text-red-600 text-sm" data-testid="text-error">
                    {registerMutation.error instanceof AxiosError &&
                    registerMutation.error.response?.data &&
                    typeof registerMutation.error.response.data === "object" &&
                    "message" in registerMutation.error.response.data
                      ? String(registerMutation.error.response.data.message)
                      : "Something went wrong. Please try again."}
                  </p>
                </motion.div>
              )}
            </div>

            <div className="px-6 pb-6 pt-2">
              {step < 4 ? (
                <div className="flex gap-3">
                  {step > 0 && (
                    <button
                      onClick={() => setStep(step - 1)}
                      className="flex-1 py-3.5 font-semibold transition-colors"
                      style={{ border: `1px solid ${COLORS.creamDark}`, color: COLORS.navy }}
                      onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = COLORS.cream)}
                      onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "transparent")}
                      data-testid="button-back"
                    >
                      Back
                    </button>
                  )}
                  <button
                    onClick={handleNext}
                    disabled={!canProceed() || registerMutation.isPending}
                    className="flex-1 py-3.5 font-semibold text-white transition-colors flex items-center justify-center gap-2 disabled:opacity-40"
                    style={{ backgroundColor: canProceed() && !registerMutation.isPending ? COLORS.gold : COLORS.creamDark, color: canProceed() && !registerMutation.isPending ? "#fff" : COLORS.warmGray }}
                    data-testid="button-next"
                  >
                    {registerMutation.isPending ? (
                      <Loader2 className="w-5 h-5 animate-spin" />
                    ) : step === 3 ? (
                      "Submit Application"
                    ) : (
                      <>
                        Continue
                        <ArrowRight className="w-4 h-4" />
                      </>
                    )}
                  </button>
                </div>
              ) : (
                <button
                  onClick={handleClose}
                  className="w-full py-3.5 font-semibold text-white transition-colors"
                  style={{ backgroundColor: COLORS.gold }}
                  data-testid="button-done"
                >
                  Done
                </button>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function FinalCTA({ onJoinClick }: { onJoinClick: () => void }) {
  const { ref, isInView } = useScrollInView();

  return (
    <section ref={ref} className="relative overflow-hidden py-24 md:py-32" data-testid="section-final-cta">
      <div className="absolute inset-0" style={{ background: `linear-gradient(165deg, ${COLORS.navy} 0%, ${COLORS.navyLight} 100%)` }} />
      <div className="absolute inset-0 opacity-20" style={{ backgroundImage: "radial-gradient(circle at 50% 50%, rgba(201,169,110,0.2), transparent 60%)" }} />

      <div className="relative z-10 max-w-3xl mx-auto px-5 md:px-8 text-center">
        <motion.div
          initial="hidden"
          animate={isInView ? "visible" : "hidden"}
          variants={stagger}
        >
          <motion.h2
            variants={fadeUp}
            className="text-3xl md:text-5xl text-white tracking-tight mb-6"
            style={{ fontFamily: "'Georgia', serif", fontWeight: 400 }}
          >
            Your seat at our
            <br />
            <span className="italic" style={{ color: COLORS.gold }}>table awaits.</span>
          </motion.h2>
          <motion.p variants={fadeUp} className="text-xl mb-12 max-w-xl mx-auto" style={{ color: "rgba(255,255,255,0.5)" }}>
            Join thousands of advisors who are already living the life they love. Your journey starts here.
          </motion.p>
          <motion.div variants={fadeUp}>
            <button
              onClick={onJoinClick}
              className="px-12 py-4 font-semibold text-base tracking-wide transition-all duration-300 inline-flex items-center gap-2.5"
              style={{ backgroundColor: COLORS.gold, color: "#fff" }}
              onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = COLORS.goldLight)}
              onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = COLORS.gold)}
              data-testid="button-final-join"
            >
              Become an Advisor
              <ArrowRight className="w-5 h-5" />
            </button>
          </motion.div>
        </motion.div>
      </div>
    </section>
  );
}

function StickyMobileCTA({ onJoinClick }: { onJoinClick: () => void }) {
  return (
    <div
      className="fixed bottom-0 left-0 right-0 z-50 md:hidden px-5 py-3"
      style={{ backgroundColor: "rgba(255,255,255,0.95)", backdropFilter: "blur(20px)", borderTop: `1px solid ${COLORS.creamDark}`, paddingBottom: "max(0.75rem, env(safe-area-inset-bottom))" }}
      data-testid="sticky-mobile-cta"
    >
      <button
        onClick={onJoinClick}
        className="w-full py-3.5 font-semibold text-base text-white transition-colors flex items-center justify-center gap-2"
        style={{ backgroundColor: COLORS.gold }}
        data-testid="button-sticky-join"
      >
        Become an Advisor
        <ArrowRight className="w-4 h-4" />
      </button>
    </div>
  );
}

function Footer() {
  return (
    <footer className="py-12 pb-24 md:pb-12" style={{ backgroundColor: COLORS.navy }} data-testid="footer-travana">
      <div className="max-w-6xl mx-auto px-5 md:px-8">
        <div className="flex flex-col md:flex-row items-center justify-between gap-6">
          <span
            className="text-xl font-light tracking-[0.15em] uppercase text-white"
            style={{ fontFamily: "'Georgia', 'Times New Roman', serif" }}
          >
            Travana
          </span>
          <p className="text-sm" style={{ color: "rgba(255,255,255,0.35)" }}>&copy; 2026 Travana. All rights reserved.</p>
        </div>
      </div>
    </footer>
  );
}

export default function TravanaPage() {
  const [wizardOpen, setWizardOpen] = useState(false);

  const openWizard = () => setWizardOpen(true);
  const scrollToHowItWorks = () => {
    document.getElementById("how-it-works")?.scrollIntoView({ behavior: "smooth" });
  };

  return (
    <div
      className="min-h-screen bg-white"
      style={{ fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif" }}
    >
      <Navbar onJoinClick={openWizard} />
      <HeroSection onJoinClick={openWizard} onLearnMore={scrollToHowItWorks} />
      <TrustBar />
      <HowItWorks />
      <LifestyleSection />
      <FeaturesGrid />
      <CommunitySection />
      <FirstSaleSection />
      <FinalCTA onJoinClick={openWizard} />
      <Footer />
      <StickyMobileCTA onJoinClick={openWizard} />
      <OnboardingWizard isOpen={wizardOpen} onClose={() => setWizardOpen(false)} />
    </div>
  );
}

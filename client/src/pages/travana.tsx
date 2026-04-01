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
  visible: { opacity: 1, y: 0, transition: { duration: 0.6, ease: "easeOut" } },
};

const stagger = {
  visible: { transition: { staggerChildren: 0.12 } },
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
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
        scrolled ? "bg-white/90 backdrop-blur-xl shadow-sm" : "bg-transparent"
      }`}
      data-testid="nav-travana"
    >
      <div className="max-w-7xl mx-auto px-5 md:px-8 py-4 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-sky-500 to-blue-600 flex items-center justify-center">
            <Compass className="w-5 h-5 text-white" />
          </div>
          <span
            className={`text-xl font-bold tracking-tight transition-colors ${
              scrolled ? "text-gray-900" : "text-white"
            }`}
            style={{ fontFamily: "'Inter', sans-serif" }}
          >
            Travana
          </span>
        </div>
        <button
          onClick={onJoinClick}
          className="hidden md:inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-sky-500 hover:bg-sky-600 text-white text-sm font-semibold transition-colors shadow-lg shadow-sky-500/25"
          data-testid="button-nav-join"
        >
          Join Now
          <ArrowRight className="w-4 h-4" />
        </button>
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
      <div className="absolute inset-0 bg-gradient-to-br from-sky-600 via-blue-700 to-indigo-800" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,rgba(56,189,248,0.3),transparent_50%)]" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_bottom_left,rgba(99,102,241,0.25),transparent_50%)]" />

      <motion.div
        className="absolute top-20 right-[15%] w-72 h-72 rounded-full bg-sky-400/20 blur-3xl"
        animate={{ y: [0, -20, 0], scale: [1, 1.05, 1] }}
        transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
      />
      <motion.div
        className="absolute bottom-20 left-[10%] w-96 h-96 rounded-full bg-indigo-500/15 blur-3xl"
        animate={{ y: [0, 15, 0], scale: [1, 0.95, 1] }}
        transition={{ duration: 10, repeat: Infinity, ease: "easeInOut" }}
      />
      <motion.div
        className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full bg-blue-300/10 blur-3xl"
        animate={{ rotate: [0, 360] }}
        transition={{ duration: 60, repeat: Infinity, ease: "linear" }}
      />

      <div className="relative z-10 max-w-4xl mx-auto px-5 md:px-8 text-center pt-24 pb-16">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/15 backdrop-blur-md border border-white/20 text-white/90 text-sm font-medium mb-8"
        >
          <Sparkles className="w-4 h-4" />
          Start your travel business today
        </motion.div>

        <motion.h1
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.1 }}
          className="text-4xl sm:text-5xl md:text-7xl font-extrabold text-white leading-[1.08] tracking-tight mb-6"
          style={{ fontFamily: "'Inter', sans-serif" }}
        >
          Turn Your Passion for
          <br />
          <span className="bg-gradient-to-r from-sky-200 via-white to-sky-200 bg-clip-text text-transparent">
            Travel Into Income
          </span>
        </motion.h1>

        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.25 }}
          className="text-lg sm:text-xl md:text-2xl text-white/70 max-w-2xl mx-auto mb-10 leading-relaxed"
        >
          Join Travana as a self-employed travel agent. Work from anywhere, set your own hours, and earn commission on every booking.
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.4 }}
          className="flex flex-col sm:flex-row items-center justify-center gap-4"
        >
          <button
            onClick={onJoinClick}
            className="w-full sm:w-auto px-8 py-4 rounded-full bg-white text-sky-700 font-bold text-lg hover:bg-sky-50 transition-all shadow-2xl shadow-black/20 flex items-center justify-center gap-2"
            data-testid="button-hero-join"
          >
            Join Now
            <ArrowRight className="w-5 h-5" />
          </button>
          <button
            onClick={onLearnMore}
            className="w-full sm:w-auto px-8 py-4 rounded-full bg-white/10 backdrop-blur-md border border-white/25 text-white font-semibold text-lg hover:bg-white/20 transition-all flex items-center justify-center gap-2"
            data-testid="button-hero-learn"
          >
            See How It Works
            <ChevronRight className="w-5 h-5" />
          </button>
        </motion.div>
      </div>
    </section>
  );
}

function TrustBar() {
  const { ref, isInView } = useScrollInView();
  const stats = [
    { value: "2,500+", label: "Active Agents" },
    { value: "£12M+", label: "Commissions Paid" },
    { value: "98%", label: "Satisfaction Rate" },
    { value: "45+", label: "Countries Covered" },
  ];

  return (
    <section ref={ref} className="bg-white py-12 md:py-16 border-b border-gray-100" data-testid="section-trust">
      <div className="max-w-6xl mx-auto px-5 md:px-8">
        <motion.div
          initial="hidden"
          animate={isInView ? "visible" : "hidden"}
          variants={stagger}
          className="grid grid-cols-2 md:grid-cols-4 gap-8 md:gap-12"
        >
          {stats.map((stat, i) => (
            <motion.div key={i} variants={fadeUp} className="text-center">
              <p className="text-3xl md:text-4xl font-extrabold text-gray-900 mb-1" data-testid={`text-stat-value-${i}`}>
                {stat.value}
              </p>
              <p className="text-sm md:text-base text-gray-500 font-medium">{stat.label}</p>
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
      color: "from-sky-400 to-blue-500",
    },
    {
      icon: Headphones,
      title: "Get Trained",
      description: "Access our comprehensive training platform, mentorship program, and live support from day one.",
      color: "from-blue-500 to-indigo-500",
    },
    {
      icon: Wallet,
      title: "Start Earning",
      description: "Book holidays for clients and earn generous commission on every single sale you make.",
      color: "from-indigo-500 to-purple-500",
    },
  ];

  return (
    <section ref={ref} className="bg-gray-50 py-20 md:py-28" id="how-it-works" data-testid="section-how-it-works">
      <div className="max-w-6xl mx-auto px-5 md:px-8">
        <motion.div
          initial="hidden"
          animate={isInView ? "visible" : "hidden"}
          variants={stagger}
          className="text-center mb-14"
        >
          <motion.p variants={fadeUp} className="text-sky-600 font-semibold text-sm uppercase tracking-wider mb-3">
            How It Works
          </motion.p>
          <motion.h2 variants={fadeUp} className="text-3xl md:text-5xl font-extrabold text-gray-900 tracking-tight">
            Three Simple Steps
          </motion.h2>
        </motion.div>

        <div className="flex md:grid md:grid-cols-3 gap-6 overflow-x-auto pb-4 md:pb-0 snap-x snap-mandatory -mx-5 px-5 md:mx-0 md:px-0 scrollbar-hide">
          {steps.map((step, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 30 }}
              animate={isInView ? { opacity: 1, y: 0 } : {}}
              transition={{ duration: 0.5, delay: i * 0.15 }}
              className="min-w-[280px] md:min-w-0 snap-center bg-white rounded-2xl p-8 shadow-sm border border-gray-100 hover:shadow-lg hover:border-sky-100 transition-all duration-300 group"
              data-testid={`card-step-${i}`}
            >
              <div className="flex items-center gap-4 mb-5">
                <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${step.color} flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform`}>
                  <step.icon className="w-6 h-6 text-white" />
                </div>
                <span className="text-5xl font-extrabold text-gray-100 group-hover:text-sky-100 transition-colors">
                  {String(i + 1).padStart(2, "0")}
                </span>
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-2">{step.title}</h3>
              <p className="text-gray-500 leading-relaxed">{step.description}</p>
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
    <section ref={ref} className="bg-white py-20 md:py-28 overflow-hidden" data-testid="section-lifestyle">
      <div className="max-w-7xl mx-auto px-5 md:px-8">
        <div className="grid md:grid-cols-2 gap-12 md:gap-20 items-center">
          <motion.div
            initial={{ opacity: 0, x: -40 }}
            animate={isInView ? { opacity: 1, x: 0 } : {}}
            transition={{ duration: 0.7 }}
            className="relative order-2 md:order-1"
          >
            <div className="aspect-[4/3] rounded-3xl overflow-hidden bg-gradient-to-br from-sky-100 via-blue-50 to-indigo-100 relative">
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="text-center space-y-4 p-8">
                  <div className="w-20 h-20 mx-auto rounded-2xl bg-gradient-to-br from-sky-400 to-blue-500 flex items-center justify-center shadow-xl">
                    <Globe className="w-10 h-10 text-white" />
                  </div>
                  <p className="text-2xl font-bold text-gray-800">Work From Paradise</p>
                  <p className="text-gray-500">Your office could be anywhere in the world</p>
                </div>
              </div>
            </div>
            <motion.div
              className="absolute -bottom-4 -right-4 bg-white rounded-2xl shadow-xl p-4 border border-gray-100"
              initial={{ opacity: 0, scale: 0.8 }}
              animate={isInView ? { opacity: 1, scale: 1 } : {}}
              transition={{ duration: 0.5, delay: 0.4 }}
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center">
                  <TrendingUp className="w-5 h-5 text-green-600" />
                </div>
                <div>
                  <p className="text-sm font-bold text-gray-900">Avg. £3,200/mo</p>
                  <p className="text-xs text-gray-500">Agent earnings</p>
                </div>
              </div>
            </motion.div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, x: 40 }}
            animate={isInView ? { opacity: 1, x: 0 } : {}}
            transition={{ duration: 0.7, delay: 0.15 }}
            className="order-1 md:order-2"
          >
            <p className="text-sky-600 font-semibold text-sm uppercase tracking-wider mb-3">Freedom & Flexibility</p>
            <h2 className="text-3xl md:text-4xl font-extrabold text-gray-900 tracking-tight mb-6 leading-tight">
              Design the Life
              <br />
              You've Always Wanted
            </h2>
            <p className="text-lg text-gray-500 leading-relaxed mb-8">
              No more 9 to 5. As a Travana agent, you choose when and where you work. Build a business around your life — not the other way around.
            </p>
            <div className="space-y-4">
              {[
                "Set your own schedule and work hours",
                "No commute — work from home or anywhere",
                "Uncapped earning potential with generous commissions",
                "Access exclusive travel deals and FAM trips",
              ].map((item, i) => (
                <div key={i} className="flex items-start gap-3">
                  <CheckCircle2 className="w-5 h-5 text-sky-500 mt-0.5 flex-shrink-0" />
                  <span className="text-gray-700">{item}</span>
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
      description: "Get paired with an experienced agent mentor who guides you through your first months.",
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
      description: "Join a vibrant community of agents sharing tips, celebrating wins, and supporting each other.",
    },
  ];

  return (
    <section ref={ref} className="bg-gray-50 py-20 md:py-28" data-testid="section-features">
      <div className="max-w-6xl mx-auto px-5 md:px-8">
        <motion.div
          initial="hidden"
          animate={isInView ? "visible" : "hidden"}
          variants={stagger}
          className="text-center mb-14"
        >
          <motion.p variants={fadeUp} className="text-sky-600 font-semibold text-sm uppercase tracking-wider mb-3">
            What You Get
          </motion.p>
          <motion.h2 variants={fadeUp} className="text-3xl md:text-5xl font-extrabold text-gray-900 tracking-tight">
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
              className="bg-white rounded-2xl p-7 border border-gray-100 hover:shadow-lg hover:border-sky-100 hover:-translate-y-1 transition-all duration-300 group cursor-default"
              data-testid={`card-feature-${i}`}
            >
              <div className="w-12 h-12 rounded-xl bg-sky-50 group-hover:bg-sky-100 flex items-center justify-center mb-5 transition-colors">
                <feature.icon className="w-6 h-6 text-sky-600" />
              </div>
              <h3 className="text-lg font-bold text-gray-900 mb-2">{feature.title}</h3>
              <p className="text-gray-500 leading-relaxed text-sm">{feature.description}</p>
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
      role: "Agent since 2023",
      location: "Manchester, UK",
      quote: "I left my corporate job and haven't looked back. Last month I earned more than my old salary while working half the hours.",
      rating: 5,
    },
    {
      name: "James Okafor",
      role: "Agent since 2024",
      location: "London, UK",
      quote: "The training and support from Travana made all the difference. I booked my first holiday within my first week!",
      rating: 5,
    },
    {
      name: "Emma Chen",
      role: "Agent since 2022",
      location: "Bristol, UK",
      quote: "Being able to work around my kids' schedule is priceless. Travana gave me the freedom I'd been searching for.",
      rating: 5,
    },
  ];

  return (
    <section ref={ref} className="bg-white py-20 md:py-28" data-testid="section-community">
      <div className="max-w-6xl mx-auto px-5 md:px-8">
        <motion.div
          initial="hidden"
          animate={isInView ? "visible" : "hidden"}
          variants={stagger}
          className="text-center mb-14"
        >
          <motion.p variants={fadeUp} className="text-sky-600 font-semibold text-sm uppercase tracking-wider mb-3">
            Our Community
          </motion.p>
          <motion.h2 variants={fadeUp} className="text-3xl md:text-5xl font-extrabold text-gray-900 tracking-tight mb-4">
            Hear From Our Agents
          </motion.h2>
          <motion.p variants={fadeUp} className="text-gray-500 text-lg max-w-2xl mx-auto">
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
              className="bg-gray-50 rounded-2xl p-7 border border-gray-100 hover:shadow-md transition-all"
              data-testid={`card-testimonial-${i}`}
            >
              <div className="flex gap-1 mb-4">
                {Array.from({ length: t.rating }).map((_, j) => (
                  <Star key={j} className="w-4 h-4 fill-amber-400 text-amber-400" />
                ))}
              </div>
              <p className="text-gray-700 leading-relaxed mb-6 text-[15px]">"{t.quote}"</p>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-sky-400 to-blue-500 flex items-center justify-center text-white font-bold text-sm">
                  {t.name.split(" ").map((n) => n[0]).join("")}
                </div>
                <div>
                  <p className="font-semibold text-gray-900 text-sm">{t.name}</p>
                  <div className="flex items-center gap-1 text-xs text-gray-500">
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
    <section ref={ref} className="bg-gradient-to-b from-gray-50 to-white py-20 md:py-28" data-testid="section-first-sale">
      <div className="max-w-5xl mx-auto px-5 md:px-8">
        <motion.div
          initial="hidden"
          animate={isInView ? "visible" : "hidden"}
          variants={stagger}
          className="text-center mb-14"
        >
          <motion.p variants={fadeUp} className="text-sky-600 font-semibold text-sm uppercase tracking-wider mb-3">
            Your First Sale
          </motion.p>
          <motion.h2 variants={fadeUp} className="text-3xl md:text-5xl font-extrabold text-gray-900 tracking-tight">
            Simplified to Three Steps
          </motion.h2>
        </motion.div>

        <div className="relative">
          <div className="hidden md:block absolute top-16 left-[16.67%] right-[16.67%] h-0.5 bg-gradient-to-r from-sky-200 via-blue-200 to-indigo-200" />

          <motion.div
            initial="hidden"
            animate={isInView ? "visible" : "hidden"}
            variants={stagger}
            className="grid grid-cols-1 md:grid-cols-3 gap-8"
          >
            {steps.map((s, i) => (
              <motion.div key={i} variants={fadeUp} className="text-center relative" data-testid={`card-first-sale-${i}`}>
                <div className="w-14 h-14 mx-auto rounded-2xl bg-gradient-to-br from-sky-400 to-blue-500 flex items-center justify-center text-white shadow-lg shadow-sky-500/25 mb-5 relative z-10">
                  <s.icon className="w-7 h-7" />
                </div>
                <h3 className="text-lg font-bold text-gray-900 mb-2">{s.title}</h3>
                <p className="text-gray-500 text-sm leading-relaxed max-w-xs mx-auto">{s.description}</p>
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

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-sm p-0 sm:p-4"
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
            className="bg-white w-full sm:max-w-lg sm:rounded-3xl rounded-t-3xl shadow-2xl overflow-hidden max-h-[90svh] flex flex-col"
          >
            <div className="flex items-center justify-between px-6 pt-6 pb-4">
              <h3 className="text-xl font-bold text-gray-900">
                {step < 4 ? `Step ${step + 1} of 4` : ""}
              </h3>
              <button
                onClick={handleClose}
                className="w-8 h-8 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center transition-colors"
                data-testid="button-close-wizard"
                aria-label="Close"
              >
                <X className="w-4 h-4 text-gray-600" />
              </button>
            </div>

            {step < 4 && (
              <div className="px-6 pb-4">
                <div className="flex gap-2">
                  {[0, 1, 2, 3].map((s) => (
                    <div
                      key={s}
                      className={`h-1.5 flex-1 rounded-full transition-all duration-500 ${
                        s <= step ? "bg-sky-500" : "bg-gray-200"
                      }`}
                      data-testid={`progress-step-${s}`}
                    />
                  ))}
                </div>
                <p className="text-sm text-gray-500 mt-2">{stepLabels[step]}</p>
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
                      <label htmlFor="wizard-name" className="block text-sm font-semibold text-gray-700 mb-2">Full Name</label>
                      <input
                        id="wizard-name"
                        type="text"
                        value={formData.name}
                        onChange={(e) => updateField("name", e.target.value)}
                        placeholder="e.g. Sarah Mitchell"
                        className="w-full px-4 py-3.5 rounded-xl border border-gray-200 focus:border-sky-400 focus:ring-2 focus:ring-sky-100 outline-none transition-all text-gray-900 placeholder:text-gray-400"
                        data-testid="input-name"
                      />
                    </div>
                    <div>
                      <label htmlFor="wizard-email" className="block text-sm font-semibold text-gray-700 mb-2">Email Address</label>
                      <input
                        id="wizard-email"
                        type="email"
                        value={formData.email}
                        onChange={(e) => updateField("email", e.target.value)}
                        placeholder="sarah@example.com"
                        className="w-full px-4 py-3.5 rounded-xl border border-gray-200 focus:border-sky-400 focus:ring-2 focus:ring-sky-100 outline-none transition-all text-gray-900 placeholder:text-gray-400"
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
                      <label htmlFor="wizard-phone" className="block text-sm font-semibold text-gray-700 mb-2">Phone Number</label>
                      <input
                        id="wizard-phone"
                        type="tel"
                        value={formData.phone}
                        onChange={(e) => updateField("phone", e.target.value)}
                        placeholder="+44 7700 900000"
                        className="w-full px-4 py-3.5 rounded-xl border border-gray-200 focus:border-sky-400 focus:ring-2 focus:ring-sky-100 outline-none transition-all text-gray-900 placeholder:text-gray-400"
                        data-testid="input-phone"
                      />
                    </div>
                    <div>
                      <label htmlFor="wizard-location" className="block text-sm font-semibold text-gray-700 mb-2">Your Location</label>
                      <input
                        id="wizard-location"
                        type="text"
                        value={formData.location}
                        onChange={(e) => updateField("location", e.target.value)}
                        placeholder="e.g. Manchester, UK"
                        className="w-full px-4 py-3.5 rounded-xl border border-gray-200 focus:border-sky-400 focus:ring-2 focus:ring-sky-100 outline-none transition-all text-gray-900 placeholder:text-gray-400"
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
                      <label htmlFor="wizard-motivation" className="block text-sm font-semibold text-gray-700 mb-2">
                        What excites you about becoming a travel agent?
                      </label>
                      <textarea
                        id="wizard-motivation"
                        value={formData.motivation}
                        onChange={(e) => updateField("motivation", e.target.value)}
                        placeholder="Tell us what motivates you... (optional)"
                        rows={5}
                        className="w-full px-4 py-3.5 rounded-xl border border-gray-200 focus:border-sky-400 focus:ring-2 focus:ring-sky-100 outline-none transition-all text-gray-900 placeholder:text-gray-400 resize-none"
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
                    <p className="text-sm text-gray-500 mb-2">Please review your details before submitting:</p>
                    <div className="bg-gray-50 rounded-xl p-5 space-y-3" data-testid="confirmation-details">
                      <div className="flex justify-between items-start">
                        <span className="text-sm text-gray-500">Name</span>
                        <span className="text-sm font-semibold text-gray-900 text-right">{formData.name}</span>
                      </div>
                      <div className="border-t border-gray-100" />
                      <div className="flex justify-between items-start">
                        <span className="text-sm text-gray-500">Email</span>
                        <span className="text-sm font-semibold text-gray-900 text-right">{formData.email}</span>
                      </div>
                      <div className="border-t border-gray-100" />
                      <div className="flex justify-between items-start">
                        <span className="text-sm text-gray-500">Phone</span>
                        <span className="text-sm font-semibold text-gray-900 text-right">{formData.phone}</span>
                      </div>
                      <div className="border-t border-gray-100" />
                      <div className="flex justify-between items-start">
                        <span className="text-sm text-gray-500">Location</span>
                        <span className="text-sm font-semibold text-gray-900 text-right">{formData.location}</span>
                      </div>
                      {formData.motivation && (
                        <>
                          <div className="border-t border-gray-100" />
                          <div className="flex justify-between items-start">
                            <span className="text-sm text-gray-500">Motivation</span>
                            <span className="text-sm font-semibold text-gray-900 text-right max-w-[200px]">{formData.motivation}</span>
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
                    <div className="w-20 h-20 mx-auto rounded-full bg-green-100 flex items-center justify-center mb-6">
                      <CheckCircle2 className="w-10 h-10 text-green-600" />
                    </div>
                    <h3 className="text-2xl font-bold text-gray-900 mb-3" data-testid="text-success-title">
                      Welcome to Travana!
                    </h3>
                    <p className="text-gray-500 leading-relaxed max-w-sm mx-auto" data-testid="text-success-message">
                      Your application has been submitted successfully. We'll be in touch shortly to get you started on your journey.
                    </p>
                  </motion.div>
                )}
              </AnimatePresence>

              {registerMutation.isError && step < 4 && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="mt-4 p-3 rounded-xl bg-red-50 border border-red-100"
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
                      className="flex-1 py-3.5 rounded-xl border border-gray-200 text-gray-700 font-semibold hover:bg-gray-50 transition-colors"
                      data-testid="button-back"
                    >
                      Back
                    </button>
                  )}
                  <button
                    onClick={handleNext}
                    disabled={!canProceed() || registerMutation.isPending}
                    className="flex-1 py-3.5 rounded-xl bg-sky-500 hover:bg-sky-600 disabled:bg-gray-200 disabled:text-gray-400 text-white font-semibold transition-colors flex items-center justify-center gap-2"
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
                  className="w-full py-3.5 rounded-xl bg-sky-500 hover:bg-sky-600 text-white font-semibold transition-colors"
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
    <section ref={ref} className="relative overflow-hidden py-20 md:py-28" data-testid="section-final-cta">
      <div className="absolute inset-0 bg-gradient-to-br from-sky-600 via-blue-700 to-indigo-800" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(56,189,248,0.2),transparent_60%)]" />

      <div className="relative z-10 max-w-3xl mx-auto px-5 md:px-8 text-center">
        <motion.div
          initial="hidden"
          animate={isInView ? "visible" : "hidden"}
          variants={stagger}
        >
          <motion.h2
            variants={fadeUp}
            className="text-3xl md:text-5xl font-extrabold text-white tracking-tight mb-6"
          >
            Ready to Start Your
            <br />
            Travel Business?
          </motion.h2>
          <motion.p variants={fadeUp} className="text-xl text-white/70 mb-10 max-w-xl mx-auto">
            Join thousands of agents who are already living the life they love. Your journey starts here.
          </motion.p>
          <motion.div variants={fadeUp}>
            <button
              onClick={onJoinClick}
              className="px-10 py-4 rounded-full bg-white text-sky-700 font-bold text-lg hover:bg-sky-50 transition-all shadow-2xl shadow-black/20 inline-flex items-center gap-2"
              data-testid="button-final-join"
            >
              Join Travana Now
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
      className="fixed bottom-0 left-0 right-0 z-50 md:hidden bg-white/95 backdrop-blur-xl border-t border-gray-200 px-5 py-3"
      style={{ paddingBottom: "max(0.75rem, env(safe-area-inset-bottom))" }}
      data-testid="sticky-mobile-cta"
    >
      <button
        onClick={onJoinClick}
        className="w-full py-3.5 rounded-full bg-sky-500 hover:bg-sky-600 text-white font-bold text-base transition-colors shadow-lg shadow-sky-500/25 flex items-center justify-center gap-2"
        data-testid="button-sticky-join"
      >
        Join Travana
        <ArrowRight className="w-4 h-4" />
      </button>
    </div>
  );
}

function Footer() {
  return (
    <footer className="bg-gray-900 py-12 pb-24 md:pb-12" data-testid="footer-travana">
      <div className="max-w-6xl mx-auto px-5 md:px-8">
        <div className="flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-sky-500 to-blue-600 flex items-center justify-center">
              <Compass className="w-4 h-4 text-white" />
            </div>
            <span className="text-white font-bold text-lg">Travana</span>
          </div>
          <p className="text-gray-500 text-sm text-center">&copy; 2026 Travana. All rights reserved.</p>
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

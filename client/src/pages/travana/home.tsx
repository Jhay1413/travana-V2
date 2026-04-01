import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Link } from "wouter";
import {
  Globe,
  Wallet,
  BookOpen,
  Headphones,
  ArrowRight,
  ChevronRight,
  ChevronLeft,
  MapPin,
  Star,
  Sparkles,
  Heart,
  Shield,
} from "lucide-react";
import { COLORS, fadeUp, stagger, useScrollInView, serifFont, PageWrapper } from "./shared";

function HeroSection() {
  return (
    <section className="relative min-h-[100svh] flex items-center justify-center overflow-hidden" data-testid="section-hero">
      <div className="absolute inset-0">
        <img
          src="https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=1920&q=80"
          alt="Luxury beach destination"
          className="w-full h-full object-cover"
        />
        <div
          className="absolute inset-0"
          style={{ background: `linear-gradient(165deg, ${COLORS.navy}ee 0%, ${COLORS.navyLight}cc 50%, ${COLORS.navy}bb 100%)` }}
        />
      </div>
      <div className="absolute inset-0 opacity-30" style={{ backgroundImage: "radial-gradient(circle at 70% 30%, rgba(201,169,110,0.15), transparent 50%)" }} />

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
          style={{ fontFamily: serifFont, fontWeight: 400, letterSpacing: "-0.01em" }}
        >
          Curate Extraordinary
          <br />
          <span className="italic" style={{ color: COLORS.gold }}>Journeys.</span>
        </motion.h1>

        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.3 }}
          className="text-lg sm:text-xl md:text-2xl max-w-2xl mx-auto mb-12 leading-relaxed"
          style={{ color: "rgba(255,255,255,0.55)", fontWeight: 300 }}
        >
          Join a purpose-driven community of travel advisors who are rewriting the rules of luxury travel.
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.45 }}
          className="flex flex-col sm:flex-row items-center justify-center gap-4"
        >
          <Link href="/travana/advisors">
            <span
              className="w-full sm:w-auto px-10 py-4 font-semibold text-base tracking-wide transition-all duration-300 flex items-center justify-center gap-2.5 cursor-pointer text-white"
              style={{ backgroundColor: COLORS.gold, borderRadius: "2px" }}
              onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = COLORS.goldLight)}
              onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = COLORS.gold)}
              data-testid="button-hero-join"
            >
              Join Us
              <ArrowRight className="w-5 h-5" />
            </span>
          </Link>
          <Link href="/travana/destinations">
            <span
              className="w-full sm:w-auto px-10 py-4 font-medium text-base tracking-wide transition-all duration-300 flex items-center justify-center gap-2 cursor-pointer"
              style={{ border: "1px solid rgba(255,255,255,0.2)", color: "rgba(255,255,255,0.7)", borderRadius: "2px" }}
              onMouseEnter={(e) => { e.currentTarget.style.borderColor = "rgba(255,255,255,0.4)"; e.currentTarget.style.color = "#fff"; }}
              onMouseLeave={(e) => { e.currentTarget.style.borderColor = "rgba(255,255,255,0.2)"; e.currentTarget.style.color = "rgba(255,255,255,0.7)"; }}
              data-testid="button-hero-explore"
            >
              Explore Destinations
              <ChevronRight className="w-5 h-5" />
            </span>
          </Link>
        </motion.div>
      </div>
    </section>
  );
}

function TrustBar() {
  const { ref, isInView } = useScrollInView();
  const stats = [
    { value: "2,500+", label: "Active Advisors" },
    { value: "£12M+", label: "Commissions Earned" },
    { value: "120+", label: "Destinations" },
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
              <p className="text-3xl md:text-4xl font-light mb-1" style={{ color: COLORS.navy, fontFamily: serifFont }} data-testid={`text-stat-value-${i}`}>
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

function PopularDestinations() {
  const { ref, isInView } = useScrollInView();
  const destinations = [
    { name: "Santorini", region: "Europe", image: "https://images.unsplash.com/photo-1570077188670-e3a8d69ac5ff?w=600&q=80" },
    { name: "Bali", region: "Asia", image: "https://images.unsplash.com/photo-1537996194471-e657df975ab4?w=600&q=80" },
    { name: "Maldives", region: "Indian Ocean", image: "https://images.unsplash.com/photo-1514282401047-d79a71a590e8?w=600&q=80" },
    { name: "Barbados", region: "Caribbean", image: "https://images.unsplash.com/photo-1548574505-5e239809ee19?w=600&q=80" },
    { name: "Marrakech", region: "Africa", image: "https://images.unsplash.com/photo-1489749798305-4fea3ae63d43?w=600&q=80" },
    { name: "Tokyo", region: "Asia", image: "https://images.unsplash.com/photo-1540959733332-eab4deabeeaf?w=600&q=80" },
  ];

  return (
    <section ref={ref} className="py-20 md:py-28 bg-white" data-testid="section-destinations-preview">
      <div className="max-w-7xl mx-auto px-5 md:px-8">
        <motion.div
          initial="hidden"
          animate={isInView ? "visible" : "hidden"}
          variants={stagger}
          className="text-center mb-16"
        >
          <motion.p variants={fadeUp} className="text-sm font-semibold uppercase tracking-[0.2em] mb-4" style={{ color: COLORS.gold }}>
            Popular Destinations
          </motion.p>
          <motion.h2 variants={fadeUp} className="text-3xl md:text-5xl tracking-tight" style={{ fontFamily: serifFont, color: COLORS.navy, fontWeight: 400 }}>
            Where Will You Send Them?
          </motion.h2>
        </motion.div>

        <motion.div
          initial="hidden"
          animate={isInView ? "visible" : "hidden"}
          variants={stagger}
          className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6"
        >
          {destinations.map((dest, i) => (
            <motion.div
              key={i}
              variants={fadeUp}
              className="group relative overflow-hidden cursor-pointer"
              style={{ aspectRatio: "4/3" }}
              data-testid={`card-destination-preview-${i}`}
            >
              <img
                src={dest.image}
                alt={dest.name}
                className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
              />
              <div
                className="absolute inset-0 transition-opacity duration-500"
                style={{ background: `linear-gradient(to top, ${COLORS.navy}cc 0%, transparent 60%)` }}
              />
              <div className="absolute bottom-0 left-0 right-0 p-6">
                <span className="text-xs font-semibold uppercase tracking-[0.15em] mb-1 block" style={{ color: COLORS.gold }}>
                  {dest.region}
                </span>
                <h3 className="text-xl text-white font-light" style={{ fontFamily: serifFont }}>
                  {dest.name}
                </h3>
              </div>
            </motion.div>
          ))}
        </motion.div>

        <div className="text-center mt-10">
          <Link href="/travana/destinations">
            <span
              className="inline-flex items-center gap-2 px-8 py-3.5 font-semibold text-sm tracking-wide transition-all duration-300 cursor-pointer"
              style={{ border: `1px solid ${COLORS.navy}`, color: COLORS.navy, borderRadius: "2px" }}
              onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = COLORS.navy; e.currentTarget.style.color = "#fff"; }}
              onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = "transparent"; e.currentTarget.style.color = COLORS.navy; }}
              data-testid="button-view-all-destinations"
            >
              View All Destinations
              <ArrowRight className="w-4 h-4" />
            </span>
          </Link>
        </div>
      </div>
    </section>
  );
}

function WhyTravana() {
  const { ref, isInView } = useScrollInView();
  const features = [
    { icon: Globe, title: "Global Network", description: "Access thousands of suppliers and premium travel products across 120+ destinations worldwide." },
    { icon: Wallet, title: "Top Commissions", description: "Earn industry-leading commissions with uncapped potential and transparent payout schedules." },
    { icon: BookOpen, title: "Training Academy", description: "Comprehensive online courses, webinars, and certifications to sharpen your expertise." },
    { icon: Headphones, title: "24/7 Support", description: "Dedicated support team available around the clock to help you and your clients." },
    { icon: Shield, title: "ATOL Protected", description: "Full financial protection for your clients with ATOL and ABTA membership included." },
    { icon: Heart, title: "Community", description: "Join a vibrant community of advisors sharing tips, celebrating wins, and growing together." },
  ];

  return (
    <section ref={ref} className="py-20 md:py-28" style={{ backgroundColor: COLORS.cream }} data-testid="section-why-travana">
      <div className="max-w-6xl mx-auto px-5 md:px-8">
        <motion.div
          initial="hidden"
          animate={isInView ? "visible" : "hidden"}
          variants={stagger}
          className="text-center mb-16"
        >
          <motion.p variants={fadeUp} className="text-sm font-semibold uppercase tracking-[0.2em] mb-4" style={{ color: COLORS.gold }}>
            Why Travana
          </motion.p>
          <motion.h2 variants={fadeUp} className="text-3xl md:text-5xl tracking-tight" style={{ fontFamily: serifFont, color: COLORS.navy, fontWeight: 400 }}>
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

function Testimonials() {
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
    {
      name: "David Patel",
      role: "Advisor since 2023",
      location: "Birmingham, UK",
      quote: "The technology platform is incredible. I can build beautiful quotes in minutes and my clients are always impressed.",
      rating: 5,
    },
    {
      name: "Lucy Thompson",
      role: "Advisor since 2024",
      location: "Edinburgh, UK",
      quote: "The community here is unlike anything I've experienced. Everyone genuinely wants to see each other succeed.",
      rating: 5,
    },
  ];

  const [activeIndex, setActiveIndex] = useState(0);

  const goNext = useCallback(() => {
    setActiveIndex((prev) => (prev + 1) % testimonials.length);
  }, [testimonials.length]);

  const goPrev = useCallback(() => {
    setActiveIndex((prev) => (prev - 1 + testimonials.length) % testimonials.length);
  }, [testimonials.length]);

  useEffect(() => {
    const timer = setInterval(goNext, 5000);
    return () => clearInterval(timer);
  }, [goNext]);

  const visibleIndices = [
    activeIndex,
    (activeIndex + 1) % testimonials.length,
    (activeIndex + 2) % testimonials.length,
  ];

  return (
    <section ref={ref} className="py-20 md:py-28 bg-white" data-testid="section-testimonials">
      <div className="max-w-6xl mx-auto px-5 md:px-8">
        <motion.div
          initial="hidden"
          animate={isInView ? "visible" : "hidden"}
          variants={stagger}
          className="text-center mb-16"
        >
          <motion.p variants={fadeUp} className="text-sm font-semibold uppercase tracking-[0.2em] mb-4" style={{ color: COLORS.gold }}>
            Advisor Stories
          </motion.p>
          <motion.h2 variants={fadeUp} className="text-3xl md:text-5xl tracking-tight mb-4" style={{ fontFamily: serifFont, color: COLORS.navy, fontWeight: 400 }}>
            Trusted by Industry Leaders
          </motion.h2>
          <motion.p variants={fadeUp} className="text-lg max-w-2xl mx-auto" style={{ color: COLORS.warmGray }}>
            Real stories from real people who transformed their lives with Travana.
          </motion.p>
        </motion.div>

        <div className="relative">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {visibleIndices.map((idx, pos) => {
              const t = testimonials[idx];
              return (
                <AnimatePresence mode="wait" key={pos}>
                  <motion.div
                    key={idx}
                    initial={{ opacity: 0, x: 30 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -30 }}
                    transition={{ duration: 0.5 }}
                    className="p-7 transition-all duration-300"
                    style={{ backgroundColor: COLORS.cream, border: `1px solid ${COLORS.creamDark}` }}
                    data-testid={`card-testimonial-${idx}`}
                  >
                    <div className="flex gap-1 mb-5">
                      {Array.from({ length: t.rating }).map((_, j) => (
                        <Star key={j} className="w-4 h-4" style={{ fill: COLORS.gold, color: COLORS.gold }} />
                      ))}
                    </div>
                    <p className="leading-relaxed mb-6 text-[15px] italic" style={{ color: COLORS.charcoal, fontFamily: serifFont }}>
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
                </AnimatePresence>
              );
            })}
          </div>

          <div className="flex items-center justify-center gap-4 mt-10">
            <button
              onClick={goPrev}
              className="w-10 h-10 flex items-center justify-center transition-all duration-300"
              style={{ border: `1px solid ${COLORS.creamDark}`, backgroundColor: "#fff" }}
              onMouseEnter={(e) => { e.currentTarget.style.borderColor = COLORS.gold; }}
              onMouseLeave={(e) => { e.currentTarget.style.borderColor = COLORS.creamDark; }}
              data-testid="button-testimonial-prev"
              aria-label="Previous testimonial"
            >
              <ChevronLeft className="w-5 h-5" style={{ color: COLORS.navy }} />
            </button>

            <div className="flex gap-2">
              {testimonials.map((_, i) => (
                <button
                  key={i}
                  onClick={() => setActiveIndex(i)}
                  className="w-2.5 h-2.5 rounded-full transition-all duration-300"
                  style={{ backgroundColor: i === activeIndex ? COLORS.gold : COLORS.creamDark }}
                  data-testid={`button-testimonial-dot-${i}`}
                  aria-label={`Go to testimonial ${i + 1}`}
                />
              ))}
            </div>

            <button
              onClick={goNext}
              className="w-10 h-10 flex items-center justify-center transition-all duration-300"
              style={{ border: `1px solid ${COLORS.creamDark}`, backgroundColor: "#fff" }}
              onMouseEnter={(e) => { e.currentTarget.style.borderColor = COLORS.gold; }}
              onMouseLeave={(e) => { e.currentTarget.style.borderColor = COLORS.creamDark; }}
              data-testid="button-testimonial-next"
              aria-label="Next testimonial"
            >
              <ChevronRight className="w-5 h-5" style={{ color: COLORS.navy }} />
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}

function FinalCTA() {
  const { ref, isInView } = useScrollInView();

  return (
    <section ref={ref} className="relative overflow-hidden py-24 md:py-32" data-testid="section-final-cta">
      <div className="absolute inset-0">
        <img
          src="https://images.unsplash.com/photo-1476514525535-07fb3b4ae5f1?w=1920&q=80"
          alt="Travel scenery"
          className="w-full h-full object-cover"
        />
        <div className="absolute inset-0" style={{ background: `linear-gradient(165deg, ${COLORS.navy}ee 0%, ${COLORS.navyLight}dd 100%)` }} />
      </div>

      <div className="relative z-10 max-w-3xl mx-auto px-5 md:px-8 text-center">
        <motion.div
          initial="hidden"
          animate={isInView ? "visible" : "hidden"}
          variants={stagger}
        >
          <motion.h2
            variants={fadeUp}
            className="text-3xl md:text-5xl text-white tracking-tight mb-6"
            style={{ fontFamily: serifFont, fontWeight: 400 }}
          >
            Your seat at our
            <br />
            <span className="italic" style={{ color: COLORS.gold }}>table is waiting.</span>
          </motion.h2>
          <motion.p
            variants={fadeUp}
            className="text-lg mb-10 max-w-xl mx-auto"
            style={{ color: "rgba(255,255,255,0.5)" }}
          >
            Take the first step toward a career you'll love. Join thousands of advisors who chose freedom, flexibility, and fulfilment.
          </motion.p>
          <motion.div variants={fadeUp}>
            <Link href="/travana/advisors">
              <span
                className="inline-flex items-center gap-2.5 px-10 py-4 font-semibold text-base tracking-wide transition-all duration-300 cursor-pointer text-white"
                style={{ backgroundColor: COLORS.gold, borderRadius: "2px" }}
                onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = COLORS.goldLight)}
                onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = COLORS.gold)}
                data-testid="button-final-join"
              >
                Join Us Today
                <ArrowRight className="w-5 h-5" />
              </span>
            </Link>
          </motion.div>
        </motion.div>
      </div>
    </section>
  );
}

export default function TravanaHome() {
  return (
    <PageWrapper>
      <HeroSection />
      <TrustBar />
      <PopularDestinations />
      <WhyTravana />
      <Testimonials />
      <FinalCTA />
    </PageWrapper>
  );
}

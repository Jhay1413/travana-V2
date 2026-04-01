import { motion } from "framer-motion";
import { Compass, Heart, Users, Globe, Shield, Sparkles } from "lucide-react";
import { COLORS, fadeUp, stagger, useScrollInView, serifFont, PageWrapper, PageHero } from "./shared";

function MissionSection() {
  const { ref, isInView } = useScrollInView();

  return (
    <section ref={ref} className="py-20 md:py-28 bg-white" data-testid="section-mission">
      <div className="max-w-6xl mx-auto px-5 md:px-8">
        <div className="grid md:grid-cols-2 gap-12 md:gap-20 items-center">
          <motion.div
            initial={{ opacity: 0, x: -40 }}
            animate={isInView ? { opacity: 1, x: 0 } : {}}
            transition={{ duration: 0.8 }}
          >
            <p className="text-sm font-semibold uppercase tracking-[0.2em] mb-4" style={{ color: COLORS.gold }}>
              Our Mission
            </p>
            <h2 className="text-3xl md:text-4xl tracking-tight mb-6 leading-tight" style={{ fontFamily: serifFont, color: COLORS.navy, fontWeight: 400 }}>
              Empowering Advisors to
              <br />
              <span className="italic" style={{ color: COLORS.gold }}>Transform Lives</span>
            </h2>
            <p className="text-lg leading-relaxed mb-6" style={{ color: COLORS.warmGray }}>
              Travana was founded with a simple belief: that everyone deserves the freedom to build a career they love. We created a platform that removes the barriers to becoming a successful travel advisor.
            </p>
            <p className="text-lg leading-relaxed" style={{ color: COLORS.warmGray }}>
              Today, we're proud to support over 2,500 advisors across the UK, providing them with the tools, training, and community they need to thrive in the luxury travel industry.
            </p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, x: 40 }}
            animate={isInView ? { opacity: 1, x: 0 } : {}}
            transition={{ duration: 0.8, delay: 0.15 }}
            className="relative"
          >
            <div className="aspect-[4/3] overflow-hidden">
              <img
                src="https://images.unsplash.com/photo-1522202176988-66273c2fd55f?w=800&q=80"
                alt="Team collaboration"
                className="w-full h-full object-cover"
              />
            </div>
            <div
              className="absolute -bottom-4 -left-4 p-5 bg-white"
              style={{ border: `1px solid ${COLORS.creamDark}` }}
            >
              <p className="text-2xl font-light" style={{ color: COLORS.navy, fontFamily: serifFont }}>Since 2019</p>
              <p className="text-sm" style={{ color: COLORS.warmGray }}>Helping advisors succeed</p>
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
}

function StorySection() {
  const { ref, isInView } = useScrollInView();

  return (
    <section ref={ref} className="py-20 md:py-28" style={{ backgroundColor: COLORS.cream }} data-testid="section-story">
      <div className="max-w-4xl mx-auto px-5 md:px-8 text-center">
        <motion.div
          initial="hidden"
          animate={isInView ? "visible" : "hidden"}
          variants={stagger}
        >
          <motion.p variants={fadeUp} className="text-sm font-semibold uppercase tracking-[0.2em] mb-4" style={{ color: COLORS.gold }}>
            Our Story
          </motion.p>
          <motion.h2 variants={fadeUp} className="text-3xl md:text-5xl tracking-tight mb-8" style={{ fontFamily: serifFont, color: COLORS.navy, fontWeight: 400 }}>
            Born from a Love of Travel
          </motion.h2>
          <motion.p variants={fadeUp} className="text-lg leading-relaxed mb-6" style={{ color: COLORS.warmGray }}>
            Travana began when our founders — seasoned travel industry veterans — saw an opportunity to reimagine how people enter and thrive in the travel business. They noticed that talented, passionate individuals were being held back by outdated structures, high entry costs, and limited support.
          </motion.p>
          <motion.p variants={fadeUp} className="text-lg leading-relaxed mb-6" style={{ color: COLORS.warmGray }}>
            So they built something different. A modern travel agency that puts advisors first, offering industry-leading commissions, world-class technology, and a genuine community of support. No franchise fees. No hidden costs. Just a fair, transparent partnership.
          </motion.p>
          <motion.p variants={fadeUp} className="text-lg leading-relaxed" style={{ color: COLORS.warmGray }}>
            Today, Travana is one of the UK's fastest-growing travel agencies, trusted by thousands of advisors who share our vision for what the travel industry can be.
          </motion.p>
        </motion.div>
      </div>
    </section>
  );
}

function ValuesGrid() {
  const { ref, isInView } = useScrollInView();
  const values = [
    { icon: Heart, title: "People First", description: "Our advisors are our partners, not our employees. Every decision we make starts with what's best for them." },
    { icon: Shield, title: "Trust & Transparency", description: "No hidden fees, no small print. We believe in honest, open relationships built on mutual respect." },
    { icon: Sparkles, title: "Excellence", description: "We set the highest standards in everything we do, from training to technology to customer service." },
    { icon: Globe, title: "Global Perspective", description: "We celebrate diversity and believe that travel connects us, broadens horizons, and breaks down barriers." },
    { icon: Users, title: "Community", description: "We're stronger together. Our community of advisors supports, inspires, and celebrates each other." },
    { icon: Compass, title: "Innovation", description: "We continuously invest in cutting-edge tools and technology to keep our advisors ahead of the curve." },
  ];

  return (
    <section ref={ref} className="py-20 md:py-28 bg-white" data-testid="section-values">
      <div className="max-w-6xl mx-auto px-5 md:px-8">
        <motion.div
          initial="hidden"
          animate={isInView ? "visible" : "hidden"}
          variants={stagger}
          className="text-center mb-16"
        >
          <motion.p variants={fadeUp} className="text-sm font-semibold uppercase tracking-[0.2em] mb-4" style={{ color: COLORS.gold }}>
            Our Values
          </motion.p>
          <motion.h2 variants={fadeUp} className="text-3xl md:text-5xl tracking-tight" style={{ fontFamily: serifFont, color: COLORS.navy, fontWeight: 400 }}>
            What We Stand For
          </motion.h2>
        </motion.div>

        <motion.div
          initial="hidden"
          animate={isInView ? "visible" : "hidden"}
          variants={stagger}
          className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6"
        >
          {values.map((value, i) => (
            <motion.div
              key={i}
              variants={fadeUp}
              className="p-7 transition-all duration-500"
              style={{ backgroundColor: COLORS.cream, border: `1px solid ${COLORS.creamDark}` }}
              onMouseEnter={(e) => { e.currentTarget.style.borderColor = COLORS.gold; e.currentTarget.style.transform = "translateY(-4px)"; }}
              onMouseLeave={(e) => { e.currentTarget.style.borderColor = COLORS.creamDark; e.currentTarget.style.transform = "translateY(0)"; }}
              data-testid={`card-value-${i}`}
            >
              <div className="w-12 h-12 flex items-center justify-center mb-5" style={{ backgroundColor: COLORS.goldMuted }}>
                <value.icon className="w-5 h-5" style={{ color: COLORS.gold }} />
              </div>
              <h3 className="text-lg font-semibold mb-2" style={{ color: COLORS.navy }}>{value.title}</h3>
              <p className="leading-relaxed text-sm" style={{ color: COLORS.warmGray }}>{value.description}</p>
            </motion.div>
          ))}
        </motion.div>
      </div>
    </section>
  );
}

function TeamCulture() {
  const { ref, isInView } = useScrollInView();

  return (
    <section ref={ref} className="py-20 md:py-28" style={{ backgroundColor: COLORS.navy }} data-testid="section-team">
      <div className="max-w-7xl mx-auto px-5 md:px-8">
        <div className="grid md:grid-cols-2 gap-12 md:gap-16 items-center">
          <motion.div
            initial={{ opacity: 0, x: -40 }}
            animate={isInView ? { opacity: 1, x: 0 } : {}}
            transition={{ duration: 0.8 }}
          >
            <p className="text-sm font-semibold uppercase tracking-[0.2em] mb-4" style={{ color: COLORS.gold }}>
              Our Culture
            </p>
            <h2 className="text-3xl md:text-4xl tracking-tight mb-6 leading-tight text-white" style={{ fontFamily: serifFont, fontWeight: 400 }}>
              More Than a Company.
              <br />
              <span className="italic" style={{ color: COLORS.gold }}>A Community.</span>
            </h2>
            <p className="text-lg leading-relaxed mb-6" style={{ color: "rgba(255,255,255,0.5)" }}>
              At Travana, we believe that the best work happens when people feel supported, valued, and inspired. Our team is passionate about travel and even more passionate about helping our advisors succeed.
            </p>
            <p className="text-lg leading-relaxed" style={{ color: "rgba(255,255,255,0.5)" }}>
              From annual retreats and regional meetups to daily virtual support, we foster genuine connections that go beyond business. When you join Travana, you're not just joining an agency — you're joining a family.
            </p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, x: 40 }}
            animate={isInView ? { opacity: 1, x: 0 } : {}}
            transition={{ duration: 0.8, delay: 0.15 }}
            className="grid grid-cols-2 gap-4"
          >
            <div className="space-y-4">
              <div className="overflow-hidden" style={{ aspectRatio: "3/4" }}>
                <img
                  src="https://images.unsplash.com/photo-1529156069898-49953e39b3ac?w=400&q=80"
                  alt="Team culture"
                  className="w-full h-full object-cover"
                />
              </div>
              <div className="overflow-hidden" style={{ aspectRatio: "4/3" }}>
                <img
                  src="https://images.unsplash.com/photo-1517457373958-b7bdd4587205?w=400&q=80"
                  alt="Team event"
                  className="w-full h-full object-cover"
                />
              </div>
            </div>
            <div className="space-y-4 pt-8">
              <div className="overflow-hidden" style={{ aspectRatio: "4/3" }}>
                <img
                  src="https://images.unsplash.com/photo-1522071820081-009f0129c71c?w=400&q=80"
                  alt="Collaboration"
                  className="w-full h-full object-cover"
                />
              </div>
              <div className="overflow-hidden" style={{ aspectRatio: "3/4" }}>
                <img
                  src="https://images.unsplash.com/photo-1552664730-d307ca884978?w=400&q=80"
                  alt="Team meeting"
                  className="w-full h-full object-cover"
                />
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
}

export default function TravanaAbout() {
  return (
    <PageWrapper>
      <PageHero
        title="About Travana"
        subtitle="We're on a mission to empower travel advisors with the tools, training, and community they need to thrive."
        imageSrc="https://images.unsplash.com/photo-1488085061387-422e29b40080?w=1920&q=80"
      />
      <MissionSection />
      <StorySection />
      <ValuesGrid />
      <TeamCulture />
    </PageWrapper>
  );
}

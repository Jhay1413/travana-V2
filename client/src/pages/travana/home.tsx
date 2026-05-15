import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Link } from "wouter";
import {
  ArrowRight,
  ChevronDown,
  Sparkles,
  Check,
  Users,
  Inbox,
  Bell,
  Target,
  CheckSquare,
  Tags,
  GraduationCap,
  Lightbulb,
  MessageSquare,
  TrendingUp,
  Eye,
  Award,
  Calendar,
  Clock,
  Trophy,
  HeartHandshake,
  Zap,
  BarChart3,
  Shield,
  Layers,
  PlayCircle,
  Copy,
  Heart,
  Plane,
  Briefcase,
  Flame,
  Compass,
  Quote,
} from "lucide-react";
import {
  COLORS,
  fadeUp,
  stagger,
  useScrollInView,
  sansFont,
  GrowthPageWrapper,
  travanaLogo,
} from "./shared";

const scrollTo = (id: string) => {
  const el = document.querySelector(id);
  if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
};

// ====== Animated Dashboard Mockup ======
function DashboardMockup() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 40, scale: 0.96 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 1, delay: 0.6, ease: [0.22, 1, 0.36, 1] }}
      className="relative mx-auto w-full max-w-4xl"
      data-testid="hero-dashboard-mockup"
    >
      <div
        className="relative rounded-2xl overflow-hidden border shadow-2xl"
        style={{ borderColor: "rgba(255,255,255,0.12)", background: "linear-gradient(180deg, #fff 0%, #F8FAFC 100%)" }}
      >
        <div className="flex items-center gap-2 px-4 py-3 border-b" style={{ borderColor: COLORS.border, backgroundColor: "#fff" }}>
          <div className="flex gap-1.5">
            <div className="w-2.5 h-2.5 rounded-full bg-red-400" />
            <div className="w-2.5 h-2.5 rounded-full bg-yellow-400" />
            <div className="w-2.5 h-2.5 rounded-full bg-green-400" />
          </div>
          <div className="ml-3 text-xs font-medium" style={{ color: COLORS.slate }}>
            travana.app / dashboard
          </div>
        </div>

        <div className="grid grid-cols-12 gap-3 p-4">
          <div className="col-span-3 space-y-3">
            <div className="rounded-lg border p-3" style={{ borderColor: COLORS.border }}>
              <div className="text-[10px] uppercase font-bold mb-2" style={{ color: COLORS.slateLight }}>This Week</div>
              <div className="text-2xl font-bold" style={{ color: COLORS.navyDark }}>£24,580</div>
              <div className="text-[11px] mt-1" style={{ color: COLORS.orange }}>↑ 18% vs last week</div>
            </div>
            <div className="rounded-lg border p-3" style={{ borderColor: COLORS.border }}>
              <div className="text-[10px] uppercase font-bold mb-2" style={{ color: COLORS.slateLight }}>Live Leads</div>
              <div className="text-2xl font-bold" style={{ color: COLORS.navyDark }}>47</div>
              <div className="flex gap-1 mt-2">
                {[1,2,3,4,5,6,7].map(i => <div key={i} className="flex-1 h-1.5 rounded-full" style={{ backgroundColor: i <= 5 ? COLORS.orange : COLORS.surfaceDark }} />)}
              </div>
            </div>
          </div>

          <div className="col-span-6">
            <div className="text-xs font-bold mb-2" style={{ color: COLORS.navyDark }}>Pipeline</div>
            <div className="grid grid-cols-3 gap-2">
              {[
                { stage: "New Enquiry", count: 12, color: "#3B82F6" },
                { stage: "Quote Sent", count: 8, color: "#8B5CF6" },
                { stage: "Hot Lead", count: 5, color: COLORS.orange },
              ].map((col, i) => (
                <div key={i} className="rounded-lg p-2" style={{ backgroundColor: COLORS.surface }}>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[10px] font-semibold uppercase" style={{ color: col.color }}>{col.stage}</span>
                    <span className="text-[10px] font-bold" style={{ color: COLORS.slate }}>{col.count}</span>
                  </div>
                  <div className="space-y-1.5">
                    {Array.from({ length: 3 }).map((_, j) => (
                      <motion.div
                        key={j}
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: 1 + i * 0.15 + j * 0.08 }}
                        className="bg-white rounded-md p-2 border"
                        style={{ borderColor: COLORS.border }}
                      >
                        <div className="text-[10px] font-semibold" style={{ color: COLORS.navyDark }}>
                          {["Sarah J.", "Mike T.", "Emma K.", "James W.", "Lily R.", "Tom B.", "Anna G.", "Olly P.", "Mia D."][i*3+j]}
                        </div>
                        <div className="text-[9px]" style={{ color: COLORS.slateLight }}>
                          £{(2500 + (i+j)*340).toLocaleString()}
                        </div>
                      </motion.div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="col-span-3 space-y-2">
            <div className="text-xs font-bold mb-2" style={{ color: COLORS.navyDark }}>Follow-ups Today</div>
            {[
              { name: "Call back John", time: "10:30 AM", urgent: true },
              { name: "Quote f/u Sarah", time: "12:00 PM", urgent: false },
              { name: "Send brochure", time: "2:00 PM", urgent: false },
              { name: "Confirm dates", time: "4:30 PM", urgent: true },
            ].map((task, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, x: 10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 1.2 + i * 0.1 }}
                className="rounded-lg border p-2 flex items-center gap-2"
                style={{ borderColor: COLORS.border, backgroundColor: "#fff" }}
              >
                <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: task.urgent ? COLORS.orange : "#10B981" }} />
                <div className="flex-1 min-w-0">
                  <div className="text-[10px] font-semibold truncate" style={{ color: COLORS.navyDark }}>{task.name}</div>
                  <div className="text-[9px]" style={{ color: COLORS.slateLight }}>{task.time}</div>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </div>

      <motion.div
        animate={{ y: [0, -8, 0] }}
        transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
        className="absolute -top-8 -right-4 md:-right-12 bg-white rounded-xl shadow-xl px-4 py-3 border hidden sm:flex items-center gap-2"
        style={{ borderColor: COLORS.border }}
      >
        <div className="w-8 h-8 rounded-full flex items-center justify-center" style={{ backgroundColor: COLORS.orangeMuted }}>
          <Trophy className="w-4 h-4" style={{ color: COLORS.orange }} />
        </div>
        <div>
          <div className="text-[11px] font-bold" style={{ color: COLORS.navyDark }}>New booking!</div>
          <div className="text-[10px]" style={{ color: COLORS.slateLight }}>Maldives · £4,800</div>
        </div>
      </motion.div>

      <motion.div
        animate={{ y: [0, 8, 0] }}
        transition={{ duration: 5, repeat: Infinity, ease: "easeInOut" }}
        className="absolute -bottom-6 -left-4 md:-left-10 bg-white rounded-xl shadow-xl px-4 py-3 border hidden sm:flex items-center gap-2"
        style={{ borderColor: COLORS.border }}
      >
        <div className="w-8 h-8 rounded-full flex items-center justify-center bg-green-50">
          <TrendingUp className="w-4 h-4 text-green-600" />
        </div>
        <div>
          <div className="text-[11px] font-bold" style={{ color: COLORS.navyDark }}>Conversion +24%</div>
          <div className="text-[10px]" style={{ color: COLORS.slateLight }}>This month</div>
        </div>
      </motion.div>
    </motion.div>
  );
}

function HeroSection() {
  return (
    <section className="relative min-h-screen flex items-center overflow-hidden pt-24 pb-20" data-testid="section-hero">
      <div className="absolute inset-0" style={{ background: `linear-gradient(135deg, ${COLORS.navyDeep} 0%, ${COLORS.navyDark} 50%, ${COLORS.navySoft} 100%)` }} />
      <div className="absolute inset-0 opacity-30" style={{ backgroundImage: `radial-gradient(circle at 20% 20%, ${COLORS.orange}33, transparent 40%), radial-gradient(circle at 80% 60%, ${COLORS.orange}22, transparent 50%)` }} />
      <div className="absolute inset-0 opacity-[0.04]" style={{ backgroundImage: "linear-gradient(rgba(255,255,255,1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,1) 1px, transparent 1px)", backgroundSize: "60px 60px" }} />

      <div className="relative z-10 max-w-7xl mx-auto px-5 md:px-8 w-full">
        <div className="text-center max-w-4xl mx-auto mb-14">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="inline-flex items-center gap-2 px-4 py-2 mb-8 rounded-full"
            style={{ backgroundColor: "rgba(232,83,10,0.15)", border: `1px solid ${COLORS.orange}55` }}
            data-testid="hero-eyebrow"
          >
            <Sparkles className="w-3.5 h-3.5" style={{ color: COLORS.orangeLight }} />
            <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: COLORS.orangeLight }}>Travel Agent Growth Hub by Travana</span>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.6, delay: 0.1 }}
            className="flex justify-center mb-8"
          >
            <img src={travanaLogo} alt="Travana" className="h-20 md:h-24 w-auto" data-testid="img-hero-logo" />
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.2 }}
            className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-bold text-white leading-[1.1] mb-6 tracking-tight"
            data-testid="text-hero-headline"
          >
            The Operating System Built for{" "}
            <span style={{ color: COLORS.orangeLight }}>Travel Agents</span>{" "}
            Who Want More Bookings, Better Follow-Up, and Less Chaos.
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.35 }}
            className="text-lg md:text-xl max-w-2xl mx-auto mb-10 leading-relaxed"
            style={{ color: "rgba(255,255,255,0.7)" }}
            data-testid="text-hero-subhead"
          >
            One platform to capture every enquiry, follow up like clockwork, train your agents to close, and grow a booking-first travel business.
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.5 }}
            className="flex flex-col sm:flex-row items-center justify-center gap-3 mb-6"
          >
            <button
              onClick={() => scrollTo("#book-demo")}
              className="w-full sm:w-auto px-8 py-3.5 font-semibold text-base rounded-lg transition-all duration-200 flex items-center justify-center gap-2 text-white shadow-lg hover:shadow-xl hover:-translate-y-0.5"
              style={{ backgroundColor: COLORS.orange }}
              onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = COLORS.orangeDark)}
              onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = COLORS.orange)}
              data-testid="button-hero-demo"
            >
              Book a Demo
              <ArrowRight className="w-4 h-4" />
            </button>
            <button
              onClick={() => scrollTo("#problem")}
              className="w-full sm:w-auto px-8 py-3.5 font-semibold text-base rounded-lg transition-all duration-200 flex items-center justify-center gap-2"
              style={{ border: "1px solid rgba(255,255,255,0.25)", color: "#fff", backgroundColor: "rgba(255,255,255,0.05)" }}
              onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = "rgba(255,255,255,0.12)"; }}
              onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = "rgba(255,255,255,0.05)"; }}
              data-testid="button-hero-how"
            >
              <PlayCircle className="w-4 h-4" />
              See How It Works
            </button>
          </motion.div>

          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.6, delay: 0.7 }}
            className="text-sm"
            style={{ color: "rgba(255,255,255,0.5)" }}
          >
            Built specifically for travel agents, not generic sales teams.
          </motion.p>
        </div>

        <DashboardMockup />
      </div>
    </section>
  );
}

// ====== Problem Section ======
function ProblemSection() {
  const { ref, isInView } = useScrollInView();
  const pains = [
    { icon: Inbox, title: "Lost Leads", text: "Enquiries slip through cracks across WhatsApp, Messenger, email and SMS." },
    { icon: Bell, title: "Forgotten Follow-Ups", text: "You meant to chase them — three weeks ago. Now they've booked elsewhere." },
    { icon: Clock, title: "Cold Enquiries", text: "Hot leads go cold because nobody had time to circle back." },
    { icon: Layers, title: "No Pipeline Visibility", text: "You can't see what's quoted, what's hot, or what's about to close." },
    { icon: MessageSquare, title: "Repetitive Messaging", text: "Your team rewrites the same quote, follow-up, and objection scripts every day." },
    { icon: Target, title: "No Conversion System", text: "You hope agents close — there's no repeatable framework that actually works." },
    { icon: Eye, title: "Owners Flying Blind", text: "You don't know which agents are performing, which leads are stuck, or where money is leaking." },
  ];

  return (
    <section ref={ref} id="problem" className="py-24 md:py-32 bg-white" data-testid="section-problem">
      <div className="max-w-7xl mx-auto px-5 md:px-8">
        <motion.div initial="hidden" animate={isInView ? "visible" : "hidden"} variants={stagger} className="text-center max-w-3xl mx-auto mb-16">
          <motion.p variants={fadeUp} className="text-sm font-bold uppercase tracking-[0.2em] mb-4" style={{ color: COLORS.orange }}>
            The Real Problem
          </motion.p>
          <motion.h2 variants={fadeUp} className="text-3xl md:text-5xl font-bold tracking-tight mb-5" style={{ color: COLORS.navyDark }}>
            Most Travel Agents Don't Have a Lead Problem.<br />
            <span style={{ color: COLORS.orange }}>They Have a Follow-Up Problem.</span>
          </motion.h2>
          <motion.p variants={fadeUp} className="text-lg" style={{ color: COLORS.slate }}>
            Bookings aren't lost because the lead was bad. They're lost because nobody followed up properly, fast enough, or with the right script.
          </motion.p>
        </motion.div>

        <motion.div initial="hidden" animate={isInView ? "visible" : "hidden"} variants={stagger} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {pains.map((p, i) => (
            <motion.div
              key={i}
              variants={fadeUp}
              className="p-6 rounded-xl border bg-white transition-all duration-300 hover:shadow-lg hover:-translate-y-1"
              style={{ borderColor: COLORS.border }}
              data-testid={`card-problem-${i}`}
            >
              <div className="w-11 h-11 rounded-lg flex items-center justify-center mb-4" style={{ backgroundColor: COLORS.orangeMuted }}>
                <p.icon className="w-5 h-5" style={{ color: COLORS.orange }} />
              </div>
              <h3 className="text-base font-bold mb-2" style={{ color: COLORS.navyDark }}>{p.title}</h3>
              <p className="text-sm leading-relaxed" style={{ color: COLORS.slate }}>{p.text}</p>
            </motion.div>
          ))}
        </motion.div>

        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ delay: 0.6 }}
          className="text-center mt-14 text-xl md:text-2xl font-bold max-w-3xl mx-auto"
          style={{ color: COLORS.navyDark }}
          data-testid="text-problem-disrupt"
        >
          You don't need more leads. You need a system that turns the leads you already have into bookings.
        </motion.p>
      </div>
    </section>
  );
}

// ====== Solution Section ======
function SolutionSection() {
  const { ref, isInView } = useScrollInView();
  const features = [
    { icon: Users, title: "Built-In CRM", text: "Every client, lead and booking in one organised hub." },
    { icon: Bell, title: "Smart Follow-Up", text: "Automated reminders so no enquiry ever falls through." },
    { icon: Layers, title: "Visual Pipeline", text: "See every deal stage at a glance — never lose track." },
    { icon: CheckSquare, title: "Daily Tasks", text: "Each agent knows exactly what to do today to close more." },
    { icon: Tags, title: "Deal Status Tracking", text: "Hot, cold, objection, ready to book — colour-coded clarity." },
    { icon: GraduationCap, title: "Training Library", text: "Weekly webinars and on-demand sales training for your team." },
    { icon: Lightbulb, title: "Sales Coaching", text: "1-to-1 coaching frameworks and group accountability." },
    { icon: MessageSquare, title: "Script Library", text: "Proven message templates that actually convert enquiries." },
    { icon: TrendingUp, title: "Industry Updates", text: "Know what's trending and selling before your customers ask." },
    { icon: HeartHandshake, title: "Growth Community", text: "Network with ambitious agents and share what works." },
    { icon: Eye, title: "Owner Visibility", text: "Dashboards for leaders — agent performance, conversion, revenue." },
    { icon: Award, title: "Conversion Frameworks", text: "Repeatable closing systems that any agent can execute." },
  ];

  return (
    <section ref={ref} id="solution" className="py-24 md:py-32" style={{ backgroundColor: COLORS.surface }} data-testid="section-solution">
      <div className="max-w-7xl mx-auto px-5 md:px-8">
        <motion.div initial="hidden" animate={isInView ? "visible" : "hidden"} variants={stagger} className="text-center max-w-3xl mx-auto mb-16">
          <motion.p variants={fadeUp} className="text-sm font-bold uppercase tracking-[0.2em] mb-4" style={{ color: COLORS.orange }}>
            The Solution
          </motion.p>
          <motion.h2 variants={fadeUp} className="text-3xl md:text-5xl font-bold tracking-tight mb-5" style={{ color: COLORS.navyDark }}>
            One Platform. Every Enquiry.<br />Every Follow-Up. <span style={{ color: COLORS.orange }}>Every Booking Opportunity.</span>
          </motion.h2>
          <motion.p variants={fadeUp} className="text-lg" style={{ color: COLORS.slate }}>
            Travana brings everything you need to turn enquiries into bookings into one place — built around how travel agents actually work.
          </motion.p>
        </motion.div>

        <motion.div initial="hidden" animate={isInView ? "visible" : "hidden"} variants={stagger} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {features.map((f, i) => (
            <motion.div
              key={i}
              variants={fadeUp}
              className="p-6 rounded-xl bg-white border transition-all duration-300 hover:shadow-lg hover:-translate-y-1 group"
              style={{ borderColor: COLORS.border }}
              data-testid={`card-solution-${i}`}
            >
              <div className="w-11 h-11 rounded-lg flex items-center justify-center mb-4 transition-colors" style={{ backgroundColor: COLORS.orangeMuted }}>
                <f.icon className="w-5 h-5 transition-colors" style={{ color: COLORS.orange }} />
              </div>
              <h3 className="text-base font-bold mb-1.5" style={{ color: COLORS.navyDark }}>{f.title}</h3>
              <p className="text-sm leading-relaxed" style={{ color: COLORS.slate }}>{f.text}</p>
            </motion.div>
          ))}
        </motion.div>
      </div>
    </section>
  );
}

// ====== CRM Pipeline Mockup ======
function PipelineMockup() {
  const stages = [
    { name: "New Enquiry", count: 14, color: "#3B82F6", deals: ["Sarah Mitchell — £3,200", "James Wilson — £4,800"] },
    { name: "Quote Sent", count: 9, color: "#8B5CF6", deals: ["Emma Patel — £6,400", "Tom Roberts — £2,950"] },
    { name: "Follow-up Due", count: 6, color: "#F59E0B", deals: ["Lily Chen — £5,100", "Mark Davis — £3,800"] },
    { name: "Hot Lead", count: 4, color: COLORS.orange, deals: ["Anna Brooks — £7,200", "Peter Hall — £4,600"] },
    { name: "Price Objection", count: 3, color: "#EC4899", deals: ["Olivia Wood — £4,300"] },
    { name: "Ready to Book", count: 5, color: "#10B981", deals: ["Mia Garcia — £5,800", "Noah Bell — £3,400"] },
    { name: "Booked", count: 12, color: "#059669", deals: ["Ben Knight — £6,900"] },
    { name: "Lost / Nurture", count: 7, color: "#94A3B8", deals: ["Zoe Hart — £2,100"] },
  ];

  return (
    <div className="rounded-2xl border bg-white shadow-2xl p-5" style={{ borderColor: COLORS.border }} data-testid="crm-pipeline-mockup">
      <div className="flex items-center justify-between mb-4">
        <div>
          <div className="text-xs font-bold uppercase tracking-wider" style={{ color: COLORS.slateLight }}>Sales Pipeline</div>
          <div className="text-lg font-bold" style={{ color: COLORS.navyDark }}>This Month · £148,300 in flight</div>
        </div>
        <div className="px-3 py-1.5 rounded-full text-xs font-bold" style={{ backgroundColor: COLORS.orangeMuted, color: COLORS.orange }}>+24% MoM</div>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
        {stages.map((s, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, y: 10 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: i * 0.05 }}
            className="rounded-lg p-2.5"
            style={{ backgroundColor: COLORS.surface }}
          >
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-1.5">
                <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: s.color }} />
                <span className="text-[10px] font-semibold uppercase tracking-wide" style={{ color: s.color }}>{s.name}</span>
              </div>
              <span className="text-[10px] font-bold" style={{ color: COLORS.slate }}>{s.count}</span>
            </div>
            <div className="space-y-1.5">
              {s.deals.map((d, j) => (
                <motion.div
                  key={j}
                  animate={{ y: [0, -2, 0] }}
                  transition={{ duration: 3 + j, repeat: Infinity, ease: "easeInOut", delay: i * 0.2 + j * 0.3 }}
                  className="bg-white rounded-md p-2 border text-[10px] font-medium"
                  style={{ borderColor: COLORS.border, color: COLORS.navyDark }}
                >
                  {d}
                </motion.div>
              ))}
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
}

function CRMSection() {
  const { ref, isInView } = useScrollInView();
  return (
    <section ref={ref} id="crm" className="py-24 md:py-32 bg-white" data-testid="section-crm">
      <div className="max-w-7xl mx-auto px-5 md:px-8">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-16 items-center">
          <motion.div initial="hidden" animate={isInView ? "visible" : "hidden"} variants={stagger}>
            <motion.p variants={fadeUp} className="text-sm font-bold uppercase tracking-[0.2em] mb-4" style={{ color: COLORS.orange }}>
              The CRM
            </motion.p>
            <motion.h2 variants={fadeUp} className="text-3xl md:text-5xl font-bold tracking-tight mb-6 leading-[1.15]" style={{ color: COLORS.navyDark }}>
              A Sales-Focused CRM Built Around How Travel Agents Actually Work.
            </motion.h2>
            <motion.p variants={fadeUp} className="text-lg leading-relaxed mb-7" style={{ color: COLORS.slate }}>
              Forget generic sales tools designed for SaaS reps. Travana's CRM understands enquiries, quotes, deposits, follow-up windows, peak season urgency, and the messy reality of selling holidays. Every lead has a stage. Every stage has a next action. Every action moves a booking closer.
            </motion.p>
            <motion.ul variants={stagger} className="space-y-3 mb-8">
              {[
                "Stage-based pipeline tuned to travel sales",
                "Next-action prompts on every deal — no more guessing",
                "Quote-to-booking timelines that match real customer behaviour",
                "Built-in messaging history across every channel",
              ].map((item, i) => (
                <motion.li key={i} variants={fadeUp} className="flex items-start gap-3 text-base" style={{ color: COLORS.navyDark }}>
                  <div className="w-5 h-5 rounded-full flex items-center justify-center mt-0.5 flex-shrink-0" style={{ backgroundColor: COLORS.orange }}>
                    <Check className="w-3 h-3 text-white" strokeWidth={3} />
                  </div>
                  <span>{item}</span>
                </motion.li>
              ))}
            </motion.ul>
            <motion.div variants={fadeUp}>
              <button
                onClick={() => scrollTo("#book-demo")}
                className="inline-flex items-center gap-2 px-6 py-3 font-semibold text-base text-white rounded-lg transition-all hover:-translate-y-0.5 shadow-lg"
                style={{ backgroundColor: COLORS.orange }}
                onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = COLORS.orangeDark)}
                onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = COLORS.orange)}
                data-testid="button-crm-demo"
              >
                See the CRM in Action
                <ArrowRight className="w-4 h-4" />
              </button>
            </motion.div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, x: 40 }}
            animate={isInView ? { opacity: 1, x: 0 } : {}}
            transition={{ duration: 0.8, delay: 0.2 }}
          >
            <PipelineMockup />
          </motion.div>
        </div>
      </div>
    </section>
  );
}

// ====== Training Section ======
function TrainingSection() {
  const { ref, isInView } = useScrollInView();
  const tiles = [
    { icon: Calendar, title: "Weekly Live Webinars", text: "Join expert-led sessions every week on what's working right now in travel sales." },
    { icon: Target, title: "Closing Techniques", text: "Battle-tested frameworks for moving prospects from quote to deposit." },
    { icon: MessageSquare, title: "Messenger Strategies", text: "Convert WhatsApp and Messenger leads with high-intent conversation playbooks." },
    { icon: Shield, title: "Objection Handling", text: "Turn 'too expensive', 'we'll think about it', and 'no time' into bookings." },
    { icon: Bell, title: "Follow-Up Systems", text: "Cadence templates so no lead ever cools off — no matter how busy you are." },
    { icon: Briefcase, title: "Booking Frameworks", text: "Step-by-step processes that any agent can execute, regardless of experience." },
  ];

  return (
    <section ref={ref} id="training" className="py-24 md:py-32 relative overflow-hidden" style={{ background: `linear-gradient(135deg, ${COLORS.navyDark} 0%, ${COLORS.navySoft} 100%)` }} data-testid="section-training">
      <div className="absolute inset-0 opacity-20" style={{ backgroundImage: `radial-gradient(circle at 80% 20%, ${COLORS.orange}44, transparent 50%)` }} />
      <div className="relative max-w-7xl mx-auto px-5 md:px-8">
        <motion.div initial="hidden" animate={isInView ? "visible" : "hidden"} variants={stagger} className="text-center max-w-3xl mx-auto mb-16">
          <motion.p variants={fadeUp} className="text-sm font-bold uppercase tracking-[0.2em] mb-4" style={{ color: COLORS.orangeLight }}>
            Training & Coaching
          </motion.p>
          <motion.h2 variants={fadeUp} className="text-3xl md:text-5xl font-bold tracking-tight mb-5 text-white">
            Train Your Agents to Sell With <span style={{ color: COLORS.orangeLight }}>Confidence</span>, Not Guesswork.
          </motion.h2>
          <motion.p variants={fadeUp} className="text-lg" style={{ color: "rgba(255,255,255,0.7)" }}>
            Travana isn't just software — it's an ongoing growth program with weekly training, scripts and coaching that turns every agent into a closer.
          </motion.p>
        </motion.div>

        <motion.div initial="hidden" animate={isInView ? "visible" : "hidden"} variants={stagger} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {tiles.map((t, i) => (
            <motion.div
              key={i}
              variants={fadeUp}
              className="p-6 rounded-xl transition-all duration-300 hover:-translate-y-1"
              style={{ backgroundColor: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)" }}
              data-testid={`card-training-${i}`}
            >
              <div className="w-11 h-11 rounded-lg flex items-center justify-center mb-4" style={{ backgroundColor: COLORS.orange }}>
                <t.icon className="w-5 h-5 text-white" />
              </div>
              <h3 className="text-lg font-bold mb-2 text-white">{t.title}</h3>
              <p className="text-sm leading-relaxed" style={{ color: "rgba(255,255,255,0.65)" }}>{t.text}</p>
            </motion.div>
          ))}
        </motion.div>
      </div>
    </section>
  );
}

// ====== Script Library Section ======
function ScriptSection() {
  const { ref, isInView } = useScrollInView();
  const scripts = [
    {
      type: "New Enquiry",
      color: "#3B82F6",
      messages: [
        { from: "agent", text: "Hi Sarah! 👋 Saw your enquiry for the Maldives — fab choice. Quick Q before I send options: are you flexible on dates, or are those locked in?" },
      ],
    },
    {
      type: "Follow-up",
      color: "#8B5CF6",
      messages: [
        { from: "agent", text: "Hi Sarah, just circling back on the Maldives quote 🌴 the resort I sent has 2 rooms left at that price. Want me to hold one while you decide?" },
      ],
    },
    {
      type: "Objection Handling",
      color: COLORS.orange,
      messages: [
        { from: "client", text: "It's a bit more than I wanted to spend." },
        { from: "agent", text: "Totally understand. Let me show you what we get for the extra £400 — half board, transfers, and ocean view. If it's still not right I'll find you a better-priced option same week." },
      ],
    },
    {
      type: "Closing",
      color: "#10B981",
      messages: [
        { from: "agent", text: "Right Sarah — shall we lock it in today? Just need a £200 deposit and I'll have your confirmation in the next hour ✨" },
      ],
    },
  ];

  return (
    <section ref={ref} className="py-24 md:py-32 bg-white" data-testid="section-scripts">
      <div className="max-w-7xl mx-auto px-5 md:px-8">
        <motion.div initial="hidden" animate={isInView ? "visible" : "hidden"} variants={stagger} className="text-center max-w-3xl mx-auto mb-16">
          <motion.p variants={fadeUp} className="text-sm font-bold uppercase tracking-[0.2em] mb-4" style={{ color: COLORS.orange }}>
            Script Library
          </motion.p>
          <motion.h2 variants={fadeUp} className="text-3xl md:text-5xl font-bold tracking-tight mb-5" style={{ color: COLORS.navyDark }}>
            Stop Rewriting the Same Messages.<br /><span style={{ color: COLORS.orange }}>Use Scripts That Convert.</span>
          </motion.h2>
          <motion.p variants={fadeUp} className="text-lg" style={{ color: COLORS.slate }}>
            Hundreds of proven message templates for every stage of every sale — copy, paste, personalise, send.
          </motion.p>
        </motion.div>

        <motion.div initial="hidden" animate={isInView ? "visible" : "hidden"} variants={stagger} className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {scripts.map((s, i) => (
            <motion.div
              key={i}
              variants={fadeUp}
              className="rounded-2xl border bg-white p-5 transition-all duration-300 hover:shadow-xl"
              style={{ borderColor: COLORS.border }}
              data-testid={`card-script-${i}`}
            >
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full" style={{ backgroundColor: s.color }} />
                  <span className="text-xs font-bold uppercase tracking-wider" style={{ color: s.color }}>{s.type}</span>
                </div>
                <button
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-md transition-colors"
                  style={{ backgroundColor: COLORS.orangeMuted, color: COLORS.orange }}
                  onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = COLORS.orange; e.currentTarget.style.color = "#fff"; }}
                  onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = COLORS.orangeMuted; e.currentTarget.style.color = COLORS.orange; }}
                  data-testid={`button-copy-script-${i}`}
                >
                  <Copy className="w-3 h-3" />
                  Copy Script
                </button>
              </div>
              <div className="space-y-3">
                {s.messages.map((m, j) => (
                  <div key={j} className={`flex ${m.from === "agent" ? "justify-end" : "justify-start"}`}>
                    <div
                      className={`max-w-[85%] px-4 py-2.5 text-sm leading-relaxed ${m.from === "agent" ? "rounded-2xl rounded-tr-md text-white" : "rounded-2xl rounded-tl-md"}`}
                      style={{
                        backgroundColor: m.from === "agent" ? COLORS.orange : COLORS.surface,
                        color: m.from === "agent" ? "#fff" : COLORS.navyDark,
                      }}
                    >
                      {m.text}
                    </div>
                  </div>
                ))}
              </div>
            </motion.div>
          ))}
        </motion.div>
      </div>
    </section>
  );
}

// ====== Industry Updates ======
function UpdatesSection() {
  const { ref, isInView } = useScrollInView();
  const items = [
    { icon: Flame, title: "Trending Destinations", text: "Weekly briefings on where customers are searching and booking right now." },
    { icon: Briefcase, title: "Supplier Insights", text: "Inside intel from tour operators, hotels and airlines before it goes public." },
    { icon: Plane, title: "Travel Updates", text: "Visa changes, weather, currency, strikes — everything you need to advise confidently." },
    { icon: BarChart3, title: "Sales Trends", text: "Real numbers on what's converting across the network this week." },
    { icon: TrendingUp, title: "What's Selling Now", text: "Specific products and packages converting at the highest rate today." },
    { icon: MessageSquare, title: "Market Talking Points", text: "Conversation starters and angles that get clients engaged and buying." },
  ];

  return (
    <section ref={ref} className="py-24 md:py-32" style={{ backgroundColor: COLORS.surface }} data-testid="section-updates">
      <div className="max-w-7xl mx-auto px-5 md:px-8">
        <motion.div initial="hidden" animate={isInView ? "visible" : "hidden"} variants={stagger} className="text-center max-w-3xl mx-auto mb-16">
          <motion.p variants={fadeUp} className="text-sm font-bold uppercase tracking-[0.2em] mb-4" style={{ color: COLORS.orange }}>
            Industry Intelligence
          </motion.p>
          <motion.h2 variants={fadeUp} className="text-3xl md:text-5xl font-bold tracking-tight mb-5" style={{ color: COLORS.navyDark }}>
            Know What's Selling <span style={{ color: COLORS.orange }}>Before Your Customers Ask.</span>
          </motion.h2>
          <motion.p variants={fadeUp} className="text-lg" style={{ color: COLORS.slate }}>
            Stop reacting to the market. With weekly intelligence built in, your agents speak with authority and close with confidence.
          </motion.p>
        </motion.div>

        <motion.div initial="hidden" animate={isInView ? "visible" : "hidden"} variants={stagger} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {items.map((it, i) => (
            <motion.div
              key={i}
              variants={fadeUp}
              className="p-6 rounded-xl bg-white border transition-all duration-300 hover:shadow-lg hover:-translate-y-1"
              style={{ borderColor: COLORS.border }}
              data-testid={`card-update-${i}`}
            >
              <div className="w-11 h-11 rounded-lg flex items-center justify-center mb-4" style={{ backgroundColor: COLORS.orangeMuted }}>
                <it.icon className="w-5 h-5" style={{ color: COLORS.orange }} />
              </div>
              <h3 className="text-base font-bold mb-2" style={{ color: COLORS.navyDark }}>{it.title}</h3>
              <p className="text-sm leading-relaxed" style={{ color: COLORS.slate }}>{it.text}</p>
            </motion.div>
          ))}
        </motion.div>
      </div>
    </section>
  );
}

// ====== Community Section ======
function CommunitySection() {
  const { ref, isInView } = useScrollInView();
  const wins = [
    { name: "Rachel M.", avatar: "RM", win: "Just closed a £14k Maldives booking using the objection script 🎉", time: "2h ago", likes: 47 },
    { name: "Daniel K.", avatar: "DK", win: "Hit £30k month — 3x my best ever. The pipeline tool changed everything.", time: "5h ago", likes: 89 },
    { name: "Sophie L.", avatar: "SL", win: "Follow-up cadence rescued a deal I thought was dead. £6k booked today.", time: "1d ago", likes: 34 },
  ];
  const threads = [
    { topic: "How are you handling Easter price objections?", replies: 23 },
    { topic: "Best WhatsApp opener for cold leads?", replies: 41 },
    { topic: "Cruise commissions — Carnival vs Royal?", replies: 18 },
  ];

  return (
    <section ref={ref} id="community" className="py-24 md:py-32 relative overflow-hidden" style={{ background: `linear-gradient(135deg, ${COLORS.navyDeep} 0%, ${COLORS.navyDark} 100%)` }} data-testid="section-community">
      <div className="absolute inset-0 opacity-20" style={{ backgroundImage: `radial-gradient(circle at 20% 80%, ${COLORS.orange}55, transparent 50%)` }} />
      <div className="relative max-w-7xl mx-auto px-5 md:px-8">
        <motion.div initial="hidden" animate={isInView ? "visible" : "hidden"} variants={stagger} className="text-center max-w-3xl mx-auto mb-16">
          <motion.p variants={fadeUp} className="text-sm font-bold uppercase tracking-[0.2em] mb-4" style={{ color: COLORS.orangeLight }}>
            The Community
          </motion.p>
          <motion.h2 variants={fadeUp} className="text-3xl md:text-5xl font-bold tracking-tight mb-5 text-white">
            A Growth Community for <span style={{ color: COLORS.orangeLight }}>Ambitious Travel Agents.</span>
          </motion.h2>
          <motion.p variants={fadeUp} className="text-lg" style={{ color: "rgba(255,255,255,0.7)" }}>
            Surround yourself with agents and owners winning right now. Share scripts, celebrate bookings, and grow alongside people who get it.
          </motion.p>
        </motion.div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <motion.div initial="hidden" animate={isInView ? "visible" : "hidden"} variants={stagger} className="lg:col-span-2 space-y-4">
            <motion.div variants={fadeUp} className="text-xs font-bold uppercase tracking-wider mb-2" style={{ color: COLORS.orangeLight }}>Recent Wins</motion.div>
            {wins.map((w, i) => (
              <motion.div
                key={i}
                variants={fadeUp}
                className="p-5 rounded-xl"
                style={{ backgroundColor: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)" }}
                data-testid={`card-community-win-${i}`}
              >
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-full flex items-center justify-center font-bold text-white flex-shrink-0" style={{ backgroundColor: COLORS.orange }}>
                    {w.avatar}
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-bold text-white text-sm">{w.name}</span>
                      <span className="text-xs" style={{ color: "rgba(255,255,255,0.4)" }}>· {w.time}</span>
                    </div>
                    <p className="text-base leading-relaxed mb-3" style={{ color: "rgba(255,255,255,0.85)" }}>{w.win}</p>
                    <div className="flex items-center gap-4 text-xs" style={{ color: "rgba(255,255,255,0.5)" }}>
                      <span className="flex items-center gap-1.5"><Heart className="w-3.5 h-3.5" /> {w.likes}</span>
                      <span className="flex items-center gap-1.5"><MessageSquare className="w-3.5 h-3.5" /> Comment</span>
                    </div>
                  </div>
                </div>
              </motion.div>
            ))}
          </motion.div>

          <motion.div initial="hidden" animate={isInView ? "visible" : "hidden"} variants={stagger} className="space-y-4">
            <motion.div variants={fadeUp} className="text-xs font-bold uppercase tracking-wider mb-2" style={{ color: COLORS.orangeLight }}>Live Discussions</motion.div>
            {threads.map((t, i) => (
              <motion.div
                key={i}
                variants={fadeUp}
                className="p-4 rounded-xl"
                style={{ backgroundColor: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)" }}
                data-testid={`card-community-thread-${i}`}
              >
                <p className="font-semibold text-sm text-white mb-2 leading-snug">{t.topic}</p>
                <div className="text-xs" style={{ color: COLORS.orangeLight }}>{t.replies} replies</div>
              </motion.div>
            ))}
            <motion.div
              variants={fadeUp}
              className="p-5 rounded-xl"
              style={{ background: `linear-gradient(135deg, ${COLORS.orange} 0%, ${COLORS.orangeDark} 100%)` }}
            >
              <Lightbulb className="w-6 h-6 text-white mb-3" />
              <p className="font-bold text-white text-sm mb-1">Coaching Prompt</p>
              <p className="text-xs leading-relaxed" style={{ color: "rgba(255,255,255,0.9)" }}>This week: review one lost deal and identify where the follow-up broke down. Share in the group.</p>
            </motion.div>
          </motion.div>
        </div>
      </div>
    </section>
  );
}

// ====== Benefits ======
function BenefitsSection() {
  const { ref, isInView } = useScrollInView();
  const benefits = [
    { icon: TrendingUp, title: "More Bookings", text: "Convert more of the leads you already get." },
    { icon: Bell, title: "Zero Lost Leads", text: "Every enquiry tracked, every follow-up reminded." },
    { icon: Clock, title: "Hours Back Each Week", text: "Stop juggling spreadsheets, sticky notes and chats." },
    { icon: Users, title: "Stronger Team Performance", text: "Every agent sells like your top performer." },
    { icon: Eye, title: "Total Visibility", text: "Know exactly what's happening across your business." },
    { icon: Zap, title: "Faster Quote-to-Book", text: "Shorter sales cycles, quicker cash in." },
    { icon: HeartHandshake, title: "Happier Clients", text: "Faster replies, better service, more rebookings." },
    { icon: Trophy, title: "Higher Average Order Value", text: "Upsell systems built into every conversation." },
    { icon: Shield, title: "Less Owner Stress", text: "A business that runs without you in the middle of every deal." },
    { icon: Compass, title: "Predictable Growth", text: "A repeatable system that scales as you hire more agents." },
  ];

  return (
    <section ref={ref} className="py-24 md:py-32 bg-white" data-testid="section-benefits">
      <div className="max-w-7xl mx-auto px-5 md:px-8">
        <motion.div initial="hidden" animate={isInView ? "visible" : "hidden"} variants={stagger} className="text-center max-w-3xl mx-auto mb-16">
          <motion.p variants={fadeUp} className="text-sm font-bold uppercase tracking-[0.2em] mb-4" style={{ color: COLORS.orange }}>
            The Outcomes
          </motion.p>
          <motion.h2 variants={fadeUp} className="text-3xl md:text-5xl font-bold tracking-tight mb-5" style={{ color: COLORS.navyDark }}>
            Built to Help Travel Businesses<br /><span style={{ color: COLORS.orange }}>Sell More With Less Stress.</span>
          </motion.h2>
        </motion.div>

        <motion.div initial="hidden" animate={isInView ? "visible" : "hidden"} variants={stagger} className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-5">
          {benefits.map((b, i) => (
            <motion.div
              key={i}
              variants={fadeUp}
              className="p-5 rounded-xl text-center transition-all duration-300 hover:-translate-y-1 hover:shadow-lg"
              style={{ backgroundColor: COLORS.surface, border: `1px solid ${COLORS.border}` }}
              data-testid={`card-benefit-${i}`}
            >
              <div className="w-12 h-12 rounded-xl flex items-center justify-center mx-auto mb-3" style={{ backgroundColor: COLORS.orange }}>
                <b.icon className="w-6 h-6 text-white" />
              </div>
              <h3 className="text-sm font-bold mb-1.5" style={{ color: COLORS.navyDark }}>{b.title}</h3>
              <p className="text-xs leading-relaxed" style={{ color: COLORS.slate }}>{b.text}</p>
            </motion.div>
          ))}
        </motion.div>
      </div>
    </section>
  );
}

// ====== Pricing ======
function PricingSection() {
  const { ref, isInView } = useScrollInView();
  const tiers = [
    {
      name: "Starter Growth Plan",
      price: "£99",
      period: "/month",
      tagline: "For solo agents and small teams ready to grow.",
      features: [
        "Full CRM & pipeline",
        "Smart follow-up reminders",
        "Script library access",
        "Weekly training webinars",
        "Community access",
        "Email support",
      ],
      cta: "Start Free Trial",
      featured: false,
    },
    {
      name: "Agency Growth Plan",
      price: "Book a Demo",
      period: "",
      tagline: "For agencies scaling teams of agents.",
      features: [
        "Everything in Starter",
        "Multi-agent dashboards & permissions",
        "Owner visibility reports",
        "Group coaching calls",
        "Onboarding for your whole team",
        "Priority support",
        "Custom conversion frameworks",
      ],
      cta: "Book a Demo",
      featured: true,
    },
    {
      name: "Premium Implementation",
      price: "Custom",
      period: " pricing",
      tagline: "For established agencies wanting white-glove rollout.",
      features: [
        "Everything in Agency Growth",
        "Dedicated implementation manager",
        "Custom pipeline & script build",
        "1-to-1 owner coaching",
        "Quarterly business reviews",
        "Bespoke training program",
        "SLA-backed support",
      ],
      cta: "Talk to Us",
      featured: false,
    },
  ];

  return (
    <section ref={ref} id="pricing" className="py-24 md:py-32" style={{ backgroundColor: COLORS.surface }} data-testid="section-pricing">
      <div className="max-w-7xl mx-auto px-5 md:px-8">
        <motion.div initial="hidden" animate={isInView ? "visible" : "hidden"} variants={stagger} className="text-center max-w-3xl mx-auto mb-16">
          <motion.p variants={fadeUp} className="text-sm font-bold uppercase tracking-[0.2em] mb-4" style={{ color: COLORS.orange }}>
            Pricing
          </motion.p>
          <motion.h2 variants={fadeUp} className="text-3xl md:text-5xl font-bold tracking-tight mb-5" style={{ color: COLORS.navyDark }}>
            Simple Pricing for <span style={{ color: COLORS.orange }}>Serious Travel Businesses.</span>
          </motion.h2>
          <motion.p variants={fadeUp} className="text-lg" style={{ color: COLORS.slate }}>
            Pick the plan that matches where you are now. Move up as you grow.
          </motion.p>
        </motion.div>

        <motion.div initial="hidden" animate={isInView ? "visible" : "hidden"} variants={stagger} className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {tiers.map((t, i) => (
            <motion.div
              key={i}
              variants={fadeUp}
              className={`relative p-7 rounded-2xl transition-all duration-300 ${t.featured ? "shadow-2xl lg:-translate-y-3 hover:-translate-y-4" : "shadow-sm hover:shadow-lg hover:-translate-y-1 bg-white"}`}
              style={t.featured ? { background: `linear-gradient(180deg, ${COLORS.navyDark} 0%, ${COLORS.navySoft} 100%)`, border: `1px solid ${COLORS.orange}` } : { border: `1px solid ${COLORS.border}` }}
              data-testid={`card-pricing-${i}`}
            >
              {t.featured && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider text-white" style={{ backgroundColor: COLORS.orange }}>
                  Most Popular
                </div>
              )}
              <h3 className={`text-lg font-bold mb-2 ${t.featured ? "text-white" : ""}`} style={!t.featured ? { color: COLORS.navyDark } : {}}>{t.name}</h3>
              <p className={`text-sm mb-6 leading-relaxed`} style={{ color: t.featured ? "rgba(255,255,255,0.65)" : COLORS.slate }}>{t.tagline}</p>
              <div className="mb-6">
                <span className={`text-4xl font-bold ${t.featured ? "text-white" : ""}`} style={!t.featured ? { color: COLORS.navyDark } : {}}>{t.price}</span>
                <span className="text-sm" style={{ color: t.featured ? "rgba(255,255,255,0.5)" : COLORS.slateLight }}>{t.period}</span>
              </div>
              <ul className="space-y-3 mb-7">
                {t.features.map((f, j) => (
                  <li key={j} className="flex items-start gap-2.5 text-sm" style={{ color: t.featured ? "rgba(255,255,255,0.85)" : COLORS.navyDark }}>
                    <Check className="w-4 h-4 flex-shrink-0 mt-0.5" style={{ color: COLORS.orange }} strokeWidth={3} />
                    <span>{f}</span>
                  </li>
                ))}
              </ul>
              <button
                onClick={() => scrollTo("#book-demo")}
                className="w-full py-3 font-semibold text-sm rounded-lg transition-all duration-200 text-white"
                style={{ backgroundColor: t.featured ? COLORS.orange : COLORS.navyDark }}
                onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = t.featured ? COLORS.orangeDark : COLORS.navyDeep)}
                onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = t.featured ? COLORS.orange : COLORS.navyDark)}
                data-testid={`button-pricing-${i}`}
              >
                {t.cta}
              </button>
            </motion.div>
          ))}
        </motion.div>

        <motion.p
          initial={{ opacity: 0 }}
          animate={isInView ? { opacity: 1 } : {}}
          transition={{ delay: 0.6 }}
          className="text-center mt-10 text-sm"
          style={{ color: COLORS.slate }}
        >
          All plans include free onboarding, no setup fees, and you can cancel anytime. VAT not included.
        </motion.p>
      </div>
    </section>
  );
}

// ====== Testimonials ======
function TestimonialsSection() {
  const { ref, isInView } = useScrollInView();
  const items = [
    {
      quote: "We doubled our monthly bookings within 90 days. The follow-up system alone paid for the platform 10 times over.",
      name: "Karen Thompson",
      role: "Owner, Thompson Travel",
      avatar: "KT",
    },
    {
      quote: "I finally have visibility into what every agent is doing. Travana turned chaos into a real business I can scale.",
      name: "Marcus Reid",
      role: "Director, Reid Holiday Co.",
      avatar: "MR",
    },
    {
      quote: "The scripts and training are gold. My new agents close like they've been doing this for years. Game changer.",
      name: "Priya Shah",
      role: "Owner, Shah Travel Group",
      avatar: "PS",
    },
  ];

  const [active, setActive] = useState(0);

  const next = useCallback(() => setActive((p) => (p + 1) % items.length), [items.length]);

  useEffect(() => {
    const t = setInterval(next, 6000);
    return () => clearInterval(t);
  }, [next]);

  return (
    <section ref={ref} className="py-24 md:py-32 bg-white" data-testid="section-testimonials">
      <div className="max-w-5xl mx-auto px-5 md:px-8">
        <motion.div initial="hidden" animate={isInView ? "visible" : "hidden"} variants={stagger} className="text-center mb-12">
          <motion.p variants={fadeUp} className="text-sm font-bold uppercase tracking-[0.2em] mb-4" style={{ color: COLORS.orange }}>
            Loved By Agency Owners
          </motion.p>
          <motion.h2 variants={fadeUp} className="text-3xl md:text-5xl font-bold tracking-tight" style={{ color: COLORS.navyDark }}>
            Real Owners. Real Results.
          </motion.h2>
        </motion.div>

        <div className="relative min-h-[280px]">
          <AnimatePresence mode="wait">
            <motion.div
              key={active}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.5 }}
              className="p-8 md:p-12 rounded-2xl text-center"
              style={{ background: `linear-gradient(135deg, ${COLORS.surface} 0%, ${COLORS.surfaceDark} 100%)`, border: `1px solid ${COLORS.border}` }}
              data-testid={`card-testimonial-${active}`}
            >
              <Quote className="w-10 h-10 mx-auto mb-5" style={{ color: COLORS.orange }} />
              <p className="text-xl md:text-2xl font-medium leading-relaxed mb-7" style={{ color: COLORS.navyDark }}>
                "{items[active].quote}"
              </p>
              <div className="flex flex-col items-center gap-3">
                <div className="w-14 h-14 rounded-full flex items-center justify-center font-bold text-white text-lg" style={{ backgroundColor: COLORS.orange }}>
                  {items[active].avatar}
                </div>
                <div>
                  <div className="font-bold" style={{ color: COLORS.navyDark }}>{items[active].name}</div>
                  <div className="text-sm" style={{ color: COLORS.slate }}>{items[active].role}</div>
                </div>
              </div>
            </motion.div>
          </AnimatePresence>
        </div>

        <div className="flex justify-center gap-2 mt-8">
          {items.map((_, i) => (
            <button
              key={i}
              onClick={() => setActive(i)}
              className="h-2 rounded-full transition-all duration-300"
              style={{ width: i === active ? 32 : 8, backgroundColor: i === active ? COLORS.orange : COLORS.border }}
              data-testid={`button-testimonial-dot-${i}`}
              aria-label={`Testimonial ${i + 1}`}
            />
          ))}
        </div>
      </div>
    </section>
  );
}

// ====== FAQ ======
function FAQSection() {
  const { ref, isInView } = useScrollInView();
  const faqs = [
    { q: "Is Travana built for solo agents or only big agencies?", a: "Both. The Starter plan is perfect for solo agents and small teams. As you grow, the Agency and Premium plans scale with multi-agent dashboards, owner visibility, and custom frameworks." },
    { q: "How is this different from a generic CRM like HubSpot or Salesforce?", a: "Travana is built around the way travel agents actually work — enquiries, quotes, deposits, peak season pressure, supplier follow-up. Generic CRMs need months of customisation to do badly what we do natively on day one." },
    { q: "Do I need technical skills to set it up?", a: "No. Onboarding is included on every plan. Most agencies are fully live within a week, with all your existing client data imported and your team trained." },
    { q: "Can I import my existing client list?", a: "Yes. We support imports from spreadsheets, other CRMs, and most legacy systems. Our team handles the migration for you." },
    { q: "What's included in the training?", a: "Weekly live webinars, an on-demand library of closing techniques, objection handling, follow-up systems, Messenger and WhatsApp scripts — all updated as the market shifts." },
    { q: "How does the community work?", a: "It's a private space for travel agency owners and agents. Share wins, ask questions, get scripts, see what's converting in other agencies, and get coaching prompts every week." },
    { q: "Is there a contract or can I cancel anytime?", a: "No long-term contract. Monthly plans cancel anytime. Annual plans get a discount and prepay for 12 months." },
    { q: "Do you support multiple branches or locations?", a: "Yes. The Agency and Premium plans include multi-location/branch support with consolidated owner reporting." },
    { q: "What kind of support do I get?", a: "Email support on Starter, priority chat support on Agency, and a dedicated implementation manager plus SLA-backed support on Premium." },
    { q: "Can I see it in action before committing?", a: "Absolutely. Book a demo and we'll walk you through the platform with your real workflow in mind. No pressure, no scripts." },
  ];

  const [open, setOpen] = useState<number | null>(0);

  return (
    <section ref={ref} className="py-24 md:py-32" style={{ backgroundColor: COLORS.surface }} data-testid="section-faq">
      <div className="max-w-3xl mx-auto px-5 md:px-8">
        <motion.div initial="hidden" animate={isInView ? "visible" : "hidden"} variants={stagger} className="text-center mb-14">
          <motion.p variants={fadeUp} className="text-sm font-bold uppercase tracking-[0.2em] mb-4" style={{ color: COLORS.orange }}>
            FAQ
          </motion.p>
          <motion.h2 variants={fadeUp} className="text-3xl md:text-5xl font-bold tracking-tight" style={{ color: COLORS.navyDark }}>
            Questions, Answered.
          </motion.h2>
        </motion.div>

        <div className="space-y-3">
          {faqs.map((f, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 10 }}
              animate={isInView ? { opacity: 1, y: 0 } : {}}
              transition={{ delay: i * 0.04 }}
              className="rounded-xl bg-white border overflow-hidden"
              style={{ borderColor: COLORS.border }}
              data-testid={`card-faq-${i}`}
            >
              <button
                onClick={() => setOpen(open === i ? null : i)}
                className="w-full px-5 py-4 flex items-center justify-between gap-4 text-left"
                data-testid={`button-faq-${i}`}
              >
                <span className="font-semibold text-base" style={{ color: COLORS.navyDark }}>{f.q}</span>
                <ChevronDown
                  className="w-5 h-5 flex-shrink-0 transition-transform"
                  style={{ color: COLORS.orange, transform: open === i ? "rotate(180deg)" : "rotate(0)" }}
                />
              </button>
              <AnimatePresence initial={false}>
                {open === i && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.25 }}
                  >
                    <p className="px-5 pb-5 text-sm leading-relaxed" style={{ color: COLORS.slate }}>{f.a}</p>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ====== Final CTA ======
function FinalCTASection() {
  const { ref, isInView } = useScrollInView();

  return (
    <section
      ref={ref}
      id="book-demo"
      className="py-24 md:py-32 relative overflow-hidden"
      style={{ background: `linear-gradient(135deg, ${COLORS.navyDeep} 0%, ${COLORS.navyDark} 50%, ${COLORS.navySoft} 100%)` }}
      data-testid="section-final-cta"
    >
      <div className="absolute inset-0 opacity-25" style={{ backgroundImage: `radial-gradient(circle at 30% 50%, ${COLORS.orange}66, transparent 50%), radial-gradient(circle at 70% 30%, ${COLORS.orange}44, transparent 50%)` }} />
      <div className="relative max-w-4xl mx-auto px-5 md:px-8 text-center">
        <motion.div initial="hidden" animate={isInView ? "visible" : "hidden"} variants={stagger}>
          <motion.div
            variants={fadeUp}
            className="inline-flex items-center gap-2 px-4 py-2 mb-7 rounded-full"
            style={{ backgroundColor: "rgba(232,83,10,0.15)", border: `1px solid ${COLORS.orange}55` }}
          >
            <Sparkles className="w-3.5 h-3.5" style={{ color: COLORS.orangeLight }} />
            <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: COLORS.orangeLight }}>Let's grow your agency</span>
          </motion.div>
          <motion.h2 variants={fadeUp} className="text-4xl md:text-6xl font-bold text-white tracking-tight mb-6 leading-[1.1]" data-testid="text-final-headline">
            Ready to Stop Losing Leads<br />and <span style={{ color: COLORS.orangeLight }}>Start Closing More Bookings?</span>
          </motion.h2>
          <motion.p variants={fadeUp} className="text-lg md:text-xl mb-10 max-w-2xl mx-auto" style={{ color: "rgba(255,255,255,0.7)" }}>
            Join the travel agencies using Travana to turn enquiries into bookings — with the system, the training, and the community that makes it happen.
          </motion.p>
          <motion.div variants={fadeUp} className="flex flex-col sm:flex-row items-center justify-center gap-3 mb-6">
            <button
              onClick={() => scrollTo("#book-demo")}
              className="w-full sm:w-auto px-8 py-3.5 font-semibold text-base rounded-lg text-white shadow-lg transition-all hover:-translate-y-0.5"
              style={{ backgroundColor: COLORS.orange }}
              onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = COLORS.orangeDark)}
              onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = COLORS.orange)}
              data-testid="button-final-demo"
            >
              Book a Demo
            </button>
            <button
              onClick={() => scrollTo("#pricing")}
              className="w-full sm:w-auto px-8 py-3.5 font-semibold text-base rounded-lg transition-all"
              style={{ border: "1px solid rgba(255,255,255,0.25)", color: "#fff", backgroundColor: "rgba(255,255,255,0.05)" }}
              onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = "rgba(255,255,255,0.12)"; }}
              onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = "rgba(255,255,255,0.05)"; }}
              data-testid="button-final-pricing"
            >
              View Pricing
            </button>
          </motion.div>
          <motion.p variants={fadeUp} className="text-sm" style={{ color: "rgba(255,255,255,0.5)" }}>
            Built specifically for travel agents · Free onboarding · Cancel anytime
          </motion.p>
        </motion.div>
      </div>
    </section>
  );
}

export default function TravanaHome() {
  return (
    <GrowthPageWrapper>
      <HeroSection />
      <ProblemSection />
      <SolutionSection />
      <CRMSection />
      <TrainingSection />
      <ScriptSection />
      <UpdatesSection />
      <CommunitySection />
      <BenefitsSection />
      <PricingSection />
      <TestimonialsSection />
      <FAQSection />
      <FinalCTASection />
    </GrowthPageWrapper>
  );
}

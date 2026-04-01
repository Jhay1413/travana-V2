import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { AxiosError } from "axios";
import { useRegisterAgent } from "@/hooks/mutations";
import {
  BookOpen,
  Headphones,
  Wallet,
  Users,
  Globe,
  BarChart3,
  Heart,
  Shield,
  ArrowRight,
  CheckCircle2,
  X,
  Loader2,
  TrendingUp,
} from "lucide-react";
import { COLORS, fadeUp, stagger, useScrollInView, serifFont, PageWrapper, PageHero } from "./shared";

function HowItWorks() {
  const { ref, isInView } = useScrollInView();
  const steps = [
    { icon: BookOpen, title: "Apply Online", description: "Fill out our simple application form. No experience needed — we'll teach you everything.", num: "01" },
    { icon: Headphones, title: "Get Trained", description: "Access our comprehensive training platform, mentorship program, and live support from day one.", num: "02" },
    { icon: Wallet, title: "Start Earning", description: "Book holidays for clients and earn generous commission on every single sale you make.", num: "03" },
  ];

  return (
    <section ref={ref} className="py-20 md:py-28 bg-white" data-testid="section-how-it-works">
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
          <motion.h2 variants={fadeUp} className="text-3xl md:text-5xl tracking-tight" style={{ fontFamily: serifFont, color: COLORS.navy, fontWeight: 400 }}>
            Three Simple Steps
          </motion.h2>
        </motion.div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {steps.map((step, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 30 }}
              animate={isInView ? { opacity: 1, y: 0 } : {}}
              transition={{ duration: 0.6, delay: i * 0.15 }}
              className="p-8 group transition-all duration-500"
              style={{ backgroundColor: COLORS.cream, border: `1px solid ${COLORS.creamDark}` }}
              onMouseEnter={(e) => { e.currentTarget.style.borderColor = COLORS.gold; e.currentTarget.style.backgroundColor = "#fff"; }}
              onMouseLeave={(e) => { e.currentTarget.style.borderColor = COLORS.creamDark; e.currentTarget.style.backgroundColor = COLORS.cream; }}
              data-testid={`card-step-${i}`}
            >
              <div className="flex items-center justify-between mb-6">
                <div className="w-12 h-12 flex items-center justify-center" style={{ backgroundColor: COLORS.goldMuted }}>
                  <step.icon className="w-5 h-5" style={{ color: COLORS.gold }} />
                </div>
                <span className="text-5xl font-light" style={{ color: COLORS.creamDark, fontFamily: serifFont }}>
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

function BenefitsGrid() {
  const { ref, isInView } = useScrollInView();
  const benefits = [
    { icon: Wallet, title: "Industry-Leading Commission", description: "Earn up to 80% commission on every booking. No caps, no limits. The more you sell, the more you keep." },
    { icon: BookOpen, title: "Training Academy", description: "Comprehensive online courses, live webinars, destination training, and industry certifications — all included." },
    { icon: Globe, title: "Booking Platform", description: "Access our powerful booking system with thousands of suppliers, real-time availability, and competitive rates." },
    { icon: BarChart3, title: "CRM & Tech Tools", description: "Professional CRM, automated quote builder, social media assets, and marketing tools at no extra cost." },
    { icon: Users, title: "Community & Mentorship", description: "Get paired with an experienced mentor and join a vibrant community of advisors sharing tips and wins." },
    { icon: Headphones, title: "Dedicated Support", description: "24/7 support team available around the clock to help you and your clients with any query." },
    { icon: Shield, title: "Full Financial Protection", description: "ATOL and ABTA membership included, giving your clients complete peace of mind when booking." },
    { icon: Heart, title: "FAM Trips & Perks", description: "Exclusive access to familiarisation trips, industry events, and special advisor-only travel deals." },
  ];

  return (
    <section ref={ref} className="py-20 md:py-28" style={{ backgroundColor: COLORS.cream }} data-testid="section-benefits">
      <div className="max-w-6xl mx-auto px-5 md:px-8">
        <motion.div
          initial="hidden"
          animate={isInView ? "visible" : "hidden"}
          variants={stagger}
          className="text-center mb-16"
        >
          <motion.p variants={fadeUp} className="text-sm font-semibold uppercase tracking-[0.2em] mb-4" style={{ color: COLORS.gold }}>
            Your Benefits
          </motion.p>
          <motion.h2 variants={fadeUp} className="text-3xl md:text-5xl tracking-tight" style={{ fontFamily: serifFont, color: COLORS.navy, fontWeight: 400 }}>
            Everything You Need to Thrive
          </motion.h2>
        </motion.div>

        <motion.div
          initial="hidden"
          animate={isInView ? "visible" : "hidden"}
          variants={stagger}
          className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6"
        >
          {benefits.map((b, i) => (
            <motion.div
              key={i}
              variants={fadeUp}
              className="bg-white p-6 transition-all duration-500"
              style={{ border: `1px solid ${COLORS.creamDark}` }}
              onMouseEnter={(e) => { e.currentTarget.style.borderColor = COLORS.gold; e.currentTarget.style.transform = "translateY(-4px)"; e.currentTarget.style.boxShadow = "0 12px 40px rgba(0,0,0,0.06)"; }}
              onMouseLeave={(e) => { e.currentTarget.style.borderColor = COLORS.creamDark; e.currentTarget.style.transform = "translateY(0)"; e.currentTarget.style.boxShadow = "none"; }}
              data-testid={`card-benefit-${i}`}
            >
              <div className="w-11 h-11 flex items-center justify-center mb-4" style={{ backgroundColor: COLORS.goldMuted }}>
                <b.icon className="w-5 h-5" style={{ color: COLORS.gold }} />
              </div>
              <h3 className="text-base font-semibold mb-2" style={{ color: COLORS.navy }}>{b.title}</h3>
              <p className="leading-relaxed text-sm" style={{ color: COLORS.warmGray }}>{b.description}</p>
            </motion.div>
          ))}
        </motion.div>
      </div>
    </section>
  );
}

function IncomePotential() {
  const { ref, isInView } = useScrollInView();
  const tiers = [
    { level: "Part-Time", hours: "10-15 hrs/week", income: "£1,000 — £2,500/mo", description: "Perfect for those starting out or working alongside another job." },
    { level: "Full-Time", hours: "30-40 hrs/week", income: "£3,000 — £6,000/mo", description: "Dedicated advisors building a serious travel business." },
    { level: "Top Performer", hours: "40+ hrs/week", income: "£8,000+/mo", description: "Elite advisors with established client bases and repeat bookings." },
  ];

  return (
    <section ref={ref} className="py-20 md:py-28 bg-white" data-testid="section-income">
      <div className="max-w-5xl mx-auto px-5 md:px-8">
        <motion.div
          initial="hidden"
          animate={isInView ? "visible" : "hidden"}
          variants={stagger}
          className="text-center mb-16"
        >
          <motion.p variants={fadeUp} className="text-sm font-semibold uppercase tracking-[0.2em] mb-4" style={{ color: COLORS.gold }}>
            Income Potential
          </motion.p>
          <motion.h2 variants={fadeUp} className="text-3xl md:text-5xl tracking-tight" style={{ fontFamily: serifFont, color: COLORS.navy, fontWeight: 400 }}>
            Earn What You Deserve
          </motion.h2>
        </motion.div>

        <motion.div
          initial="hidden"
          animate={isInView ? "visible" : "hidden"}
          variants={stagger}
          className="grid grid-cols-1 md:grid-cols-3 gap-6"
        >
          {tiers.map((tier, i) => (
            <motion.div
              key={i}
              variants={fadeUp}
              className="p-8 text-center transition-all duration-500"
              style={{
                backgroundColor: i === 1 ? COLORS.navy : COLORS.cream,
                border: i === 1 ? "none" : `1px solid ${COLORS.creamDark}`,
              }}
              data-testid={`card-tier-${i}`}
            >
              <div
                className="inline-flex items-center gap-1.5 px-4 py-1.5 text-xs font-semibold uppercase tracking-wider mb-5"
                style={{
                  backgroundColor: i === 1 ? COLORS.goldMuted : "transparent",
                  border: i === 1 ? "none" : `1px solid ${COLORS.creamDark}`,
                  color: i === 1 ? COLORS.gold : COLORS.warmGray,
                }}
              >
                {i === 1 && <TrendingUp className="w-3 h-3" />}
                {tier.level}
              </div>
              <p className="text-sm mb-2" style={{ color: i === 1 ? "rgba(255,255,255,0.5)" : COLORS.warmGray }}>
                {tier.hours}
              </p>
              <p className="text-2xl md:text-3xl font-light mb-4" style={{ color: i === 1 ? "#fff" : COLORS.navy, fontFamily: serifFont }}>
                {tier.income}
              </p>
              <p className="text-sm leading-relaxed" style={{ color: i === 1 ? "rgba(255,255,255,0.5)" : COLORS.warmGray }}>
                {tier.description}
              </p>
            </motion.div>
          ))}
        </motion.div>
      </div>
    </section>
  );
}

function JoinCTA() {
  const { ref, isInView } = useScrollInView();
  const [wizardOpen, setWizardOpen] = useState(false);

  return (
    <>
      <section ref={ref} className="relative overflow-hidden py-24 md:py-32" data-testid="section-join-cta">
        <div className="absolute inset-0">
          <img
            src="https://images.unsplash.com/photo-1476514525535-07fb3b4ae5f1?w=1920&q=80"
            alt="Travel landscape"
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
              Ready to Start Your
              <br />
              <span className="italic" style={{ color: COLORS.gold }}>Journey?</span>
            </motion.h2>
            <motion.p
              variants={fadeUp}
              className="text-lg mb-10 max-w-xl mx-auto"
              style={{ color: "rgba(255,255,255,0.5)" }}
            >
              Apply today and join thousands of advisors who chose freedom, flexibility, and fulfilment.
            </motion.p>
            <motion.div variants={fadeUp}>
              <button
                onClick={() => setWizardOpen(true)}
                className="inline-flex items-center gap-2.5 px-10 py-4 font-semibold text-base tracking-wide transition-all duration-300 text-white"
                style={{ backgroundColor: COLORS.gold, borderRadius: "2px" }}
                onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = COLORS.goldLight)}
                onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = COLORS.gold)}
                data-testid="button-apply-now"
              >
                Apply Now
                <ArrowRight className="w-5 h-5" />
              </button>
            </motion.div>
          </motion.div>
        </div>
      </section>
      <OnboardingWizard isOpen={wizardOpen} onClose={() => setWizardOpen(false)} />
    </>
  );
}

function OnboardingWizard({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const [step, setStep] = useState(0);
  const [formData, setFormData] = useState({ name: "", email: "", phone: "", location: "", motivation: "" });
  const registerMutation = useRegisterAgent();

  const updateField = (field: string, value: string) => setFormData((prev) => ({ ...prev, [field]: value }));

  const canProceed = () => {
    switch (step) {
      case 0: return formData.name.trim().length > 0 && formData.email.trim().length > 0 && formData.email.includes("@");
      case 1: return formData.phone.trim().length > 0 && formData.location.trim().length > 0;
      default: return true;
    }
  };

  const handleNext = () => {
    if (step < 3) setStep(step + 1);
    else if (step === 3) registerMutation.mutate(formData, { onSuccess: () => setStep(4) });
  };

  const handleClose = () => {
    onClose();
    setTimeout(() => { setStep(0); setFormData({ name: "", email: "", phone: "", location: "", motivation: "" }); registerMutation.reset(); }, 300);
  };

  const stepLabels = ["Your Details", "Contact Info", "Motivation", "Confirm"];
  const inputStyle = { border: `1px solid ${COLORS.creamDark}`, outline: "none", borderRadius: "2px", color: COLORS.navy };
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
          >
            <div className="flex items-center justify-between px-6 pt-6 pb-4">
              <h3 className="text-lg font-semibold" style={{ color: COLORS.navy, fontFamily: serifFont }}>
                {step < 4 ? `Step ${step + 1} of 4` : ""}
              </h3>
              <button
                onClick={handleClose}
                className="w-8 h-8 flex items-center justify-center transition-colors"
                style={{ backgroundColor: COLORS.cream }}
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
                    <div key={s} className="h-1 flex-1 transition-all duration-500" style={{ backgroundColor: s <= step ? COLORS.gold : COLORS.creamDark }} data-testid={`progress-step-${s}`} />
                  ))}
                </div>
                <p className="text-sm mt-2" style={{ color: COLORS.warmGray }}>{stepLabels[step]}</p>
              </div>
            )}

            <div className="px-6 pb-6 flex-1 overflow-y-auto">
              <AnimatePresence mode="wait">
                {step === 0 && (
                  <motion.div key="step-0" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} transition={{ duration: 0.3 }} className="space-y-5">
                    <div>
                      <label htmlFor="wizard-name" className="block text-sm font-semibold mb-2" style={{ color: COLORS.navy }}>Full Name</label>
                      <input id="wizard-name" type="text" value={formData.name} onChange={(e) => updateField("name", e.target.value)} placeholder="e.g. Sarah Mitchell" className="w-full px-4 py-3.5 transition-all" style={inputStyle} onFocus={(e) => (e.target.style.border = inputFocusStyle)} onBlur={(e) => (e.target.style.border = `1px solid ${COLORS.creamDark}`)} data-testid="input-name" />
                    </div>
                    <div>
                      <label htmlFor="wizard-email" className="block text-sm font-semibold mb-2" style={{ color: COLORS.navy }}>Email Address</label>
                      <input id="wizard-email" type="email" value={formData.email} onChange={(e) => updateField("email", e.target.value)} placeholder="sarah@example.com" className="w-full px-4 py-3.5 transition-all" style={inputStyle} onFocus={(e) => (e.target.style.border = inputFocusStyle)} onBlur={(e) => (e.target.style.border = `1px solid ${COLORS.creamDark}`)} data-testid="input-email" />
                    </div>
                  </motion.div>
                )}
                {step === 1 && (
                  <motion.div key="step-1" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} transition={{ duration: 0.3 }} className="space-y-5">
                    <div>
                      <label htmlFor="wizard-phone" className="block text-sm font-semibold mb-2" style={{ color: COLORS.navy }}>Phone Number</label>
                      <input id="wizard-phone" type="tel" value={formData.phone} onChange={(e) => updateField("phone", e.target.value)} placeholder="+44 7700 900000" className="w-full px-4 py-3.5 transition-all" style={inputStyle} onFocus={(e) => (e.target.style.border = inputFocusStyle)} onBlur={(e) => (e.target.style.border = `1px solid ${COLORS.creamDark}`)} data-testid="input-phone" />
                    </div>
                    <div>
                      <label htmlFor="wizard-location" className="block text-sm font-semibold mb-2" style={{ color: COLORS.navy }}>Your Location</label>
                      <input id="wizard-location" type="text" value={formData.location} onChange={(e) => updateField("location", e.target.value)} placeholder="e.g. Manchester, UK" className="w-full px-4 py-3.5 transition-all" style={inputStyle} onFocus={(e) => (e.target.style.border = inputFocusStyle)} onBlur={(e) => (e.target.style.border = `1px solid ${COLORS.creamDark}`)} data-testid="input-location" />
                    </div>
                  </motion.div>
                )}
                {step === 2 && (
                  <motion.div key="step-2" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} transition={{ duration: 0.3 }} className="space-y-5">
                    <div>
                      <label htmlFor="wizard-motivation" className="block text-sm font-semibold mb-2" style={{ color: COLORS.navy }}>What excites you about becoming a travel advisor?</label>
                      <textarea id="wizard-motivation" value={formData.motivation} onChange={(e) => updateField("motivation", e.target.value)} placeholder="Tell us what motivates you... (optional)" rows={5} className="w-full px-4 py-3.5 transition-all resize-none" style={inputStyle} onFocus={(e) => (e.target.style.border = inputFocusStyle)} onBlur={(e) => (e.target.style.border = `1px solid ${COLORS.creamDark}`)} data-testid="input-motivation" />
                    </div>
                  </motion.div>
                )}
                {step === 3 && (
                  <motion.div key="step-3" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} transition={{ duration: 0.3 }} className="space-y-4">
                    <p className="text-sm mb-2" style={{ color: COLORS.warmGray }}>Please review your details before submitting:</p>
                    <div className="p-5 space-y-3" style={{ backgroundColor: COLORS.cream }} data-testid="confirmation-details">
                      {[
                        { label: "Name", value: formData.name },
                        { label: "Email", value: formData.email },
                        { label: "Phone", value: formData.phone },
                        { label: "Location", value: formData.location },
                      ].map((item, i) => (
                        <div key={i}>
                          {i > 0 && <div style={{ borderTop: `1px solid ${COLORS.creamDark}` }} className="mb-3" />}
                          <div className="flex justify-between items-start">
                            <span className="text-sm" style={{ color: COLORS.warmGray }}>{item.label}</span>
                            <span className="text-sm font-semibold text-right" style={{ color: COLORS.navy }}>{item.value}</span>
                          </div>
                        </div>
                      ))}
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
                  <motion.div key="step-4" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.4 }} className="text-center py-8">
                    <div className="w-20 h-20 mx-auto flex items-center justify-center mb-6" style={{ backgroundColor: COLORS.goldMuted }}>
                      <CheckCircle2 className="w-10 h-10" style={{ color: COLORS.gold }} />
                    </div>
                    <h3 className="text-2xl font-semibold mb-3" style={{ color: COLORS.navy, fontFamily: serifFont }} data-testid="text-success-title">Welcome to Travana</h3>
                    <p className="leading-relaxed max-w-sm mx-auto" style={{ color: COLORS.warmGray }} data-testid="text-success-message">Your application has been submitted successfully. We'll be in touch shortly to get you started on your journey.</p>
                  </motion.div>
                )}
              </AnimatePresence>

              {registerMutation.isError && step < 4 && (
                <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="mt-4 p-3" style={{ backgroundColor: "#FEF2F2", border: "1px solid #FECACA" }}>
                  <p className="text-red-600 text-sm" data-testid="text-error">
                    {registerMutation.error instanceof AxiosError && registerMutation.error.response?.data && typeof registerMutation.error.response.data === "object" && "message" in registerMutation.error.response.data
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
                    <button onClick={() => setStep(step - 1)} className="flex-1 py-3.5 font-semibold transition-colors" style={{ border: `1px solid ${COLORS.creamDark}`, color: COLORS.navy }} data-testid="button-back">Back</button>
                  )}
                  <button
                    onClick={handleNext}
                    disabled={!canProceed() || registerMutation.isPending}
                    className="flex-1 py-3.5 font-semibold text-white transition-colors flex items-center justify-center gap-2 disabled:opacity-40"
                    style={{ backgroundColor: canProceed() && !registerMutation.isPending ? COLORS.gold : COLORS.creamDark, color: canProceed() && !registerMutation.isPending ? "#fff" : COLORS.warmGray }}
                    data-testid="button-next"
                  >
                    {registerMutation.isPending ? <Loader2 className="w-5 h-5 animate-spin" /> : step === 3 ? "Submit Application" : <><span>Continue</span><ArrowRight className="w-4 h-4" /></>}
                  </button>
                </div>
              ) : (
                <button onClick={handleClose} className="w-full py-3.5 font-semibold text-white transition-colors" style={{ backgroundColor: COLORS.gold }} data-testid="button-done">Done</button>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export default function TravanaAdvisors() {
  return (
    <PageWrapper>
      <PageHero
        title="Become a Travel Advisor"
        subtitle="Join a community of passionate advisors building extraordinary careers in luxury travel."
        imageSrc="https://images.unsplash.com/photo-1436491865332-7a61a109db05?w=1920&q=80"
      />
      <HowItWorks />
      <BenefitsGrid />
      <IncomePotential />
      <JoinCTA />
    </PageWrapper>
  );
}

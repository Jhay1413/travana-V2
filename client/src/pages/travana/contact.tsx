import { useState } from "react";
import { motion } from "framer-motion";
import { MapPin, Phone, Mail, Clock, Send } from "lucide-react";
import { COLORS, fadeUp, stagger, useScrollInView, serifFont, PageWrapper, PageHero } from "./shared";

function ContactForm() {
  const { ref, isInView } = useScrollInView();
  const [formData, setFormData] = useState({ name: "", email: "", subject: "", message: "" });

  const updateField = (field: string, value: string) => setFormData((prev) => ({ ...prev, [field]: value }));

  const inputStyle = {
    border: `1px solid ${COLORS.creamDark}`,
    outline: "none",
    borderRadius: "2px",
    color: COLORS.navy,
    backgroundColor: "#fff",
  };

  return (
    <section ref={ref} className="py-20 md:py-28 bg-white" data-testid="section-contact-form">
      <div className="max-w-6xl mx-auto px-5 md:px-8">
        <div className="grid md:grid-cols-5 gap-12 md:gap-16">
          <motion.div
            initial={{ opacity: 0, x: -30 }}
            animate={isInView ? { opacity: 1, x: 0 } : {}}
            transition={{ duration: 0.7 }}
            className="md:col-span-3"
          >
            <p className="text-sm font-semibold uppercase tracking-[0.2em] mb-4" style={{ color: COLORS.gold }}>
              Send a Message
            </p>
            <h2 className="text-3xl md:text-4xl tracking-tight mb-8" style={{ fontFamily: serifFont, color: COLORS.navy, fontWeight: 400 }}>
              We'd Love to Hear From You
            </h2>

            <form
              onSubmit={(e) => e.preventDefault()}
              className="space-y-6"
              data-testid="form-contact"
            >
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                <div>
                  <label htmlFor="contact-name" className="block text-sm font-semibold mb-2" style={{ color: COLORS.navy }}>Full Name</label>
                  <input
                    id="contact-name"
                    type="text"
                    value={formData.name}
                    onChange={(e) => updateField("name", e.target.value)}
                    placeholder="Your name"
                    className="w-full px-4 py-3.5 transition-all"
                    style={inputStyle}
                    onFocus={(e) => (e.target.style.border = `1px solid ${COLORS.gold}`)}
                    onBlur={(e) => (e.target.style.border = `1px solid ${COLORS.creamDark}`)}
                    data-testid="input-contact-name"
                  />
                </div>
                <div>
                  <label htmlFor="contact-email" className="block text-sm font-semibold mb-2" style={{ color: COLORS.navy }}>Email Address</label>
                  <input
                    id="contact-email"
                    type="email"
                    value={formData.email}
                    onChange={(e) => updateField("email", e.target.value)}
                    placeholder="you@example.com"
                    className="w-full px-4 py-3.5 transition-all"
                    style={inputStyle}
                    onFocus={(e) => (e.target.style.border = `1px solid ${COLORS.gold}`)}
                    onBlur={(e) => (e.target.style.border = `1px solid ${COLORS.creamDark}`)}
                    data-testid="input-contact-email"
                  />
                </div>
              </div>

              <div>
                <label htmlFor="contact-subject" className="block text-sm font-semibold mb-2" style={{ color: COLORS.navy }}>Enquiry Type</label>
                <select
                  id="contact-subject"
                  value={formData.subject}
                  onChange={(e) => updateField("subject", e.target.value)}
                  className="w-full px-4 py-3.5 transition-all appearance-none"
                  style={{ ...inputStyle, color: formData.subject ? COLORS.navy : COLORS.warmGray }}
                  onFocus={(e) => (e.target.style.border = `1px solid ${COLORS.gold}`)}
                  onBlur={(e) => (e.target.style.border = `1px solid ${COLORS.creamDark}`)}
                  data-testid="select-contact-subject"
                >
                  <option value="" disabled>Select an enquiry type</option>
                  <option value="general">General Enquiry</option>
                  <option value="advisor">Becoming an Advisor</option>
                  <option value="partnership">Partnership Opportunities</option>
                  <option value="press">Press & Media</option>
                  <option value="support">Customer Support</option>
                </select>
              </div>

              <div>
                <label htmlFor="contact-message" className="block text-sm font-semibold mb-2" style={{ color: COLORS.navy }}>Message</label>
                <textarea
                  id="contact-message"
                  value={formData.message}
                  onChange={(e) => updateField("message", e.target.value)}
                  placeholder="How can we help you?"
                  rows={6}
                  className="w-full px-4 py-3.5 transition-all resize-none"
                  style={inputStyle}
                  onFocus={(e) => (e.target.style.border = `1px solid ${COLORS.gold}`)}
                  onBlur={(e) => (e.target.style.border = `1px solid ${COLORS.creamDark}`)}
                  data-testid="input-contact-message"
                />
              </div>

              <button
                type="submit"
                className="inline-flex items-center gap-2.5 px-8 py-3.5 font-semibold text-base tracking-wide transition-all duration-300 text-white"
                style={{ backgroundColor: COLORS.gold, borderRadius: "2px" }}
                onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = COLORS.goldLight)}
                onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = COLORS.gold)}
                data-testid="button-contact-submit"
              >
                Send Message
                <Send className="w-4 h-4" />
              </button>
            </form>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, x: 30 }}
            animate={isInView ? { opacity: 1, x: 0 } : {}}
            transition={{ duration: 0.7, delay: 0.2 }}
            className="md:col-span-2"
          >
            <p className="text-sm font-semibold uppercase tracking-[0.2em] mb-4" style={{ color: COLORS.gold }}>
              Contact Details
            </p>
            <h2 className="text-3xl tracking-tight mb-8" style={{ fontFamily: serifFont, color: COLORS.navy, fontWeight: 400 }}>
              Get in Touch
            </h2>

            <div className="space-y-6">
              {[
                { icon: MapPin, title: "Our Office", lines: ["71 Victoria Street", "London, SW1H 0XA", "United Kingdom"] },
                { icon: Phone, title: "Phone", lines: ["+44 20 7946 0958", "+44 20 7946 0959"] },
                { icon: Mail, title: "Email", lines: ["hello@travana.com", "support@travana.com"] },
                { icon: Clock, title: "Hours", lines: ["Monday — Friday: 9am — 6pm", "Saturday: 10am — 4pm", "Sunday: Closed"] },
              ].map((item, i) => (
                <div
                  key={i}
                  className="flex gap-4 p-5 transition-all duration-300"
                  style={{ backgroundColor: COLORS.cream, border: `1px solid ${COLORS.creamDark}` }}
                  data-testid={`contact-info-${i}`}
                >
                  <div className="w-10 h-10 flex-shrink-0 flex items-center justify-center" style={{ backgroundColor: COLORS.goldMuted }}>
                    <item.icon className="w-4 h-4" style={{ color: COLORS.gold }} />
                  </div>
                  <div>
                    <h4 className="text-sm font-semibold mb-1" style={{ color: COLORS.navy }}>{item.title}</h4>
                    {item.lines.map((line, j) => (
                      <p key={j} className="text-sm leading-relaxed" style={{ color: COLORS.warmGray }}>{line}</p>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
}

export default function TravanaContact() {
  return (
    <PageWrapper>
      <PageHero
        title="Contact Us"
        subtitle="Have a question or want to learn more? We're here to help."
        imageSrc="https://images.unsplash.com/photo-1423666639041-f56000c27a9a?w=1920&q=80"
      />
      <ContactForm />
    </PageWrapper>
  );
}

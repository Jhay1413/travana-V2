import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Plane, Users, FileText, TrendingUp, Shield, Zap } from "lucide-react";

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-black text-white">
      <nav className="fixed top-0 left-0 right-0 z-50 backdrop-blur-xl bg-black/70 border-b border-white/10">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center">
              <Plane className="w-5 h-5 text-white" />
            </div>
            <span className="text-xl font-semibold tracking-tight">TravelHub</span>
          </div>
          <Button
            asChild
            className="rounded-full bg-white text-black hover:bg-white/90 px-6"
            data-testid="button-login-nav"
          >
            <a href="/api/login">Sign In</a>
          </Button>
        </div>
      </nav>

      <main className="pt-32 pb-24">
        <div className="max-w-7xl mx-auto px-6">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="text-center max-w-4xl mx-auto mb-20"
          >
            <h1 className="text-5xl md:text-7xl font-bold tracking-tight mb-6 bg-gradient-to-r from-white via-white to-white/60 bg-clip-text text-transparent">
              Travel Agency
              <br />
              Command Center
            </h1>
            <p className="text-xl md:text-2xl text-white/60 mb-10 max-w-2xl mx-auto">
              The premium CRM for travel professionals. Manage clients, quotes, and commissions with elegance.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Button
                asChild
                size="lg"
                className="rounded-full bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-lg px-8 py-6"
                data-testid="button-get-started"
              >
                <a href="/api/login">Get Started</a>
              </Button>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.2 }}
            className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-24"
          >
            {[
              {
                icon: Users,
                title: "Client Management",
                description: "Track clients through every stage from enquiry to booking with detailed profiles and history.",
              },
              {
                icon: FileText,
                title: "Smart Quotes",
                description: "Create beautiful quotes with flights, accommodations, and real-time pricing calculations.",
              },
              {
                icon: TrendingUp,
                title: "Commission Tracking",
                description: "Automatic commission calculations with agent splits and agency net visibility.",
              },
              {
                icon: Shield,
                title: "Role-Based Access",
                description: "Five user roles with tailored dashboards for Admins, Managers, Agents, Homeworkers, and Referrers.",
              },
              {
                icon: Zap,
                title: "Real-Time Dashboard",
                description: "KPIs, pipeline views, and team performance metrics updated in real-time.",
              },
              {
                icon: Plane,
                title: "Itinerary Builder",
                description: "Build complete travel itineraries with flights, hotels, and detailed notes.",
              },
            ].map((feature, i) => (
              <motion.div
                key={feature.title}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: 0.3 + i * 0.1 }}
                className="group p-8 rounded-3xl bg-white/5 border border-white/10 hover:bg-white/10 hover:border-white/20 transition-all duration-300"
                data-testid={`card-feature-${i}`}
              >
                <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-blue-500/20 to-purple-600/20 flex items-center justify-center mb-6 group-hover:from-blue-500/30 group-hover:to-purple-600/30 transition-all">
                  <feature.icon className="w-6 h-6 text-blue-400" />
                </div>
                <h3 className="text-xl font-semibold mb-3">{feature.title}</h3>
                <p className="text-white/60">{feature.description}</p>
              </motion.div>
            ))}
          </motion.div>

          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 1, delay: 0.8 }}
            className="text-center"
          >
            <p className="text-white/40 text-sm">
              Designed for UK travel agencies. All prices in GBP. Dates in dd/mm/yyyy format.
            </p>
          </motion.div>
        </div>
      </main>

      <footer className="border-t border-white/10 py-8">
        <div className="max-w-7xl mx-auto px-6 text-center text-white/40 text-sm">
          <p>&copy; 2026 TravelHub. Premium travel agency software.</p>
        </div>
      </footer>
    </div>
  );
}

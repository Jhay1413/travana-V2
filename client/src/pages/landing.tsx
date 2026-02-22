import { useState } from "react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Plane, Users, FileText, TrendingUp, Shield, Zap, Loader2, Eye, EyeOff } from "lucide-react";
import { useLogin } from "@/hooks/mutations";

export default function LandingPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const loginMutation = useLogin();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    loginMutation.mutate({ email, password });
  };

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
        </div>
      </nav>

      <main className="pt-32 pb-24">
        <div className="max-w-7xl mx-auto px-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-start mb-24">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6 }}
            >
              <h1 className="text-5xl md:text-7xl font-bold tracking-tight mb-6 bg-gradient-to-r from-white via-white to-white/60 bg-clip-text text-transparent">
                Travel Agency
                <br />
                Command Center
              </h1>
              <p className="text-xl md:text-2xl text-white/60 mb-10 max-w-2xl">
                The premium CRM for travel professionals. Manage clients, quotes, and commissions with elegance.
              </p>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.2 }}
              className="w-full max-w-md mx-auto lg:mx-0"
            >
              <div className="rounded-3xl bg-white/5 border border-white/10 p-8 backdrop-blur-xl">
                <h2 className="text-2xl font-semibold mb-6">Sign In</h2>
                <form onSubmit={handleSubmit} className="space-y-5">
                  <div className="space-y-2">
                    <Label htmlFor="email" className="text-white/70">Email</Label>
                    <Input
                      id="email"
                      type="email"
                      placeholder="you@example.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                      className="bg-white/5 border-white/10 text-white placeholder:text-white/30 focus:border-blue-500/50 rounded-xl h-12"
                      data-testid="input-email"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="password" className="text-white/70">Password</Label>
                    <div className="relative">
                      <Input
                        id="password"
                        type={showPassword ? "text" : "password"}
                        placeholder="Enter your password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        required
                        className="bg-white/5 border-white/10 text-white placeholder:text-white/30 focus:border-blue-500/50 rounded-xl h-12 pr-12"
                        data-testid="input-password"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-white/40 hover:text-white/70 transition-colors"
                        data-testid="button-toggle-password"
                      >
                        {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                      </button>
                    </div>
                  </div>

                  {loginMutation.isError && (
                    <p className="text-red-400 text-sm" data-testid="text-login-error">
                      {loginMutation.error?.message || "Invalid email or password"}
                    </p>
                  )}

                  <Button
                    type="submit"
                    disabled={loginMutation.isPending}
                    className="w-full rounded-xl bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 h-12 text-base font-medium"
                    data-testid="button-login"
                  >
                    {loginMutation.isPending ? (
                      <Loader2 className="w-5 h-5 animate-spin" />
                    ) : (
                      "Sign In"
                    )}
                  </Button>
                </form>

                <div className="mt-6 pt-6 border-t border-white/10">
                  <p className="text-white/40 text-sm text-center mb-4">Or continue with</p>
                  <Button
                    asChild
                    variant="outline"
                    className="w-full rounded-xl border-white/10 bg-white/5 text-white hover:bg-white/10 h-12"
                    data-testid="button-login-replit"
                  >
                    <a href="/api/login">Sign in with Replit</a>
                  </Button>
                </div>
              </div>
            </motion.div>
          </div>

          <motion.div
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.4 }}
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
                transition={{ duration: 0.5, delay: 0.5 + i * 0.1 }}
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
            transition={{ duration: 1, delay: 1 }}
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

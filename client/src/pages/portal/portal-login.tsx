import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Mail, ArrowRight, CheckCircle, Loader2, Sparkles } from "lucide-react";
import { usePortalLogin, setPortalToken, getPortalToken } from "@/hooks/use-portal-api";
import { useLocation } from "wouter";

function GlassCard({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`backdrop-blur-xl bg-white/[0.08] border border-white/[0.12] rounded-3xl ${className}`}>
      {children}
    </div>
  );
}

export default function PortalLoginPage() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [, setLocation] = useLocation();
  const loginMutation = usePortalLogin();

  useEffect(() => {
    if (getPortalToken()) {
      setLocation("/portal");
      return;
    }

    const params = new URLSearchParams(window.location.search);
    const urlToken = params.get("token");
    if (urlToken) {
      setPortalToken(urlToken);
      setLocation("/portal");
    }
  }, [setLocation]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;
    try {
      const result = await loginMutation.mutateAsync(email);
      if (result?.token) {
        setLocation("/portal");
        return;
      }
    } catch {
    }
    setSent(true);
  };

  const handleDemoLogin = () => {
    setPortalToken("demo_token_" + Date.now());
    setLocation("/portal");
  };

  return (
    <div className="min-h-screen bg-[#0a0a0f] flex items-center justify-center px-4">
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-purple-500/10 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl" />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        className="relative z-10 w-full max-w-md"
      >
        <div className="text-center mb-8">
          <div className="w-16 h-16 rounded-3xl bg-gradient-to-br from-purple-500/30 to-blue-500/30 flex items-center justify-center mx-auto mb-4 border border-white/10">
            <Sparkles className="w-8 h-8 text-purple-400" />
          </div>
          <h1 className="text-3xl font-bold text-white mb-2" data-testid="text-portal-title">Client Portal</h1>
          <p className="text-white/50 text-sm">Access your quotes, bookings & deals</p>
        </div>

        <GlassCard className="p-6 md:p-8">
          {!sent ? (
            <form onSubmit={handleSubmit}>
              <label className="block text-sm font-medium text-white/70 mb-2" htmlFor="email">
                Email address
              </label>
              <div className="relative mb-4">
                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-white/30" />
                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  className="w-full pl-12 pr-4 py-3.5 rounded-2xl bg-white/[0.06] border border-white/[0.1] text-white placeholder:text-white/30 focus:outline-none focus:border-purple-500/50 focus:ring-1 focus:ring-purple-500/30 transition-all"
                  required
                  data-testid="input-email"
                />
              </div>
              <motion.button
                whileTap={{ scale: 0.98 }}
                type="submit"
                disabled={loginMutation.isPending || !email}
                className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-purple-600 to-blue-600 text-white font-semibold flex items-center justify-center gap-2 disabled:opacity-50 transition-opacity"
                data-testid="button-send-link"
              >
                {loginMutation.isPending ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <>
                    Send Magic Link
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </motion.button>
            </form>
          ) : (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="text-center py-4"
            >
              <CheckCircle className="w-12 h-12 text-green-400 mx-auto mb-4" />
              <h2 className="text-lg font-semibold text-white mb-2" data-testid="text-link-sent">Check your email</h2>
              <p className="text-white/50 text-sm mb-4">
                We've sent a magic link to <span className="text-white/80">{email}</span>
              </p>
              <button
                onClick={handleDemoLogin}
                className="text-sm text-purple-400 hover:text-purple-300 transition-colors underline underline-offset-4"
                data-testid="button-demo-login"
              >
                Demo: Skip to portal
              </button>
            </motion.div>
          )}
        </GlassCard>

        <p className="text-center text-white/30 text-xs mt-6">
          Your travel agent will send you a link to access your portal
        </p>
      </motion.div>
    </div>
  );
}

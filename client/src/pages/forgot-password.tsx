import { useState } from "react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Plane, Loader2, ArrowLeft, CheckCircle } from "lucide-react";
import axios from "@/api/client/axios-client";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      await axios.post("/api/auth/forgot-password", { email });
      setSubmitted(true);
    } catch (err: any) {
      setError(err?.response?.data?.message || "Something went wrong");
    } finally {
      setLoading(false);
    }
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
        <div className="max-w-md mx-auto px-6">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
          >
            <div className="rounded-3xl bg-white/5 border border-white/10 p-8 backdrop-blur-xl">
              {submitted ? (
                <div className="text-center space-y-4">
                  <CheckCircle className="w-12 h-12 text-green-400 mx-auto" />
                  <h2 className="text-2xl font-semibold" data-testid="text-forgot-success">Check Your Email</h2>
                  <p className="text-white/60">
                    If an account exists with that email address, you'll receive a password reset link shortly.
                  </p>
                  <p className="text-white/40 text-sm">
                    Please contact your administrator if you need further assistance.
                  </p>
                  <a
                    href="/"
                    className="inline-flex items-center gap-2 text-blue-400 hover:text-blue-300 transition-colors text-sm mt-4"
                    data-testid="link-back-login"
                  >
                    <ArrowLeft className="w-4 h-4" />
                    Back to Sign In
                  </a>
                </div>
              ) : (
                <>
                  <h2 className="text-2xl font-semibold mb-2">Forgot Password</h2>
                  <p className="text-white/60 text-sm mb-6">
                    Enter your email address and we'll send you a link to reset your password.
                  </p>
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
                        data-testid="input-forgot-email"
                      />
                    </div>

                    {error && (
                      <p className="text-red-400 text-sm" data-testid="text-forgot-error">{error}</p>
                    )}

                    <Button
                      type="submit"
                      disabled={loading}
                      className="w-full rounded-xl bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 h-12 text-base font-medium"
                      data-testid="button-forgot-submit"
                    >
                      {loading ? (
                        <Loader2 className="w-5 h-5 animate-spin" />
                      ) : (
                        "Send Reset Link"
                      )}
                    </Button>
                  </form>

                  <div className="mt-6 text-center">
                    <a
                      href="/"
                      className="inline-flex items-center gap-2 text-blue-400 hover:text-blue-300 transition-colors text-sm"
                      data-testid="link-back-login"
                    >
                      <ArrowLeft className="w-4 h-4" />
                      Back to Sign In
                    </a>
                  </div>
                </>
              )}
            </div>
          </motion.div>
        </div>
      </main>
    </div>
  );
}

import { useState } from "react";
import { useParams } from "wouter";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Plane, Loader2, ArrowLeft, CheckCircle, Eye, EyeOff } from "lucide-react";
import axios from "@/api/client/axios-client";

export default function ResetPasswordPage() {
  const { token } = useParams<{ token: string }>();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (password.length < 6) {
      setError("Password must be at least 6 characters");
      return;
    }

    if (password !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }

    setLoading(true);
    try {
      await axios.post("/api/auth/reset-password", { token, password });
      setSuccess(true);
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
              {success ? (
                <div className="text-center space-y-4">
                  <CheckCircle className="w-12 h-12 text-green-400 mx-auto" />
                  <h2 className="text-2xl font-semibold" data-testid="text-reset-success">Password Reset!</h2>
                  <p className="text-white/60">
                    Your password has been successfully reset. You can now sign in with your new password.
                  </p>
                  <a
                    href="/"
                    className="inline-flex items-center gap-2 text-blue-400 hover:text-blue-300 transition-colors text-sm mt-4"
                    data-testid="link-goto-login"
                  >
                    <ArrowLeft className="w-4 h-4" />
                    Go to Sign In
                  </a>
                </div>
              ) : (
                <>
                  <h2 className="text-2xl font-semibold mb-2">Reset Password</h2>
                  <p className="text-white/60 text-sm mb-6">
                    Enter your new password below.
                  </p>
                  <form onSubmit={handleSubmit} className="space-y-5">
                    <div className="space-y-2">
                      <Label htmlFor="password" className="text-white/70">New Password</Label>
                      <div className="relative">
                        <Input
                          id="password"
                          type={showPassword ? "text" : "password"}
                          placeholder="Enter new password"
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                          required
                          className="bg-white/5 border-white/10 text-white placeholder:text-white/30 focus:border-blue-500/50 rounded-xl h-12 pr-12"
                          data-testid="input-new-password"
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword(!showPassword)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-white/40 hover:text-white/70 transition-colors"
                        >
                          {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                        </button>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="confirmPassword" className="text-white/70">Confirm Password</Label>
                      <Input
                        id="confirmPassword"
                        type={showPassword ? "text" : "password"}
                        placeholder="Confirm new password"
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        required
                        className="bg-white/5 border-white/10 text-white placeholder:text-white/30 focus:border-blue-500/50 rounded-xl h-12"
                        data-testid="input-confirm-password"
                      />
                    </div>

                    {error && (
                      <p className="text-red-400 text-sm" data-testid="text-reset-error">{error}</p>
                    )}

                    <Button
                      type="submit"
                      disabled={loading}
                      className="w-full rounded-xl bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 h-12 text-base font-medium"
                      data-testid="button-reset-submit"
                    >
                      {loading ? (
                        <Loader2 className="w-5 h-5 animate-spin" />
                      ) : (
                        "Reset Password"
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

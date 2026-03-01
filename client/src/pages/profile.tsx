import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { CommandCenterShell, type Role } from "@/components/command-center-shell";
import { useCurrentUser } from "@/hooks/queries";
import axiosClient from "@/api/client/axios-client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { Mail, Phone, Lock, Eye, EyeOff, Save, User, Shield } from "lucide-react";

export default function ProfilePage() {
  const [role, setRole] = useState<Role>(() => {
    return (sessionStorage.getItem("command-center-role") as Role) || "Agent";
  });

  const handleRoleChange = (r: Role) => {
    setRole(r);
    sessionStorage.setItem("command-center-role", r);
  };

  return (
    <CommandCenterShell
      active="agent-settings"
      title="Account Settings"
      role={role}
      onRoleChange={handleRoleChange}
    >
      <AccountSettings />
    </CommandCenterShell>
  );
}

function AccountSettings() {
  const { data: currentUser } = useCurrentUser();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [email, setEmail] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [detailsLoaded, setDetailsLoaded] = useState(false);

  if (currentUser && !detailsLoaded) {
    setEmail(currentUser.email || "");
    setPhoneNumber(currentUser.phoneNumber || "");
    setDetailsLoaded(true);
  }

  const updateDetailsMutation = useMutation({
    mutationFn: async (data: { email?: string; phoneNumber?: string }) => {
      const { data: result } = await axiosClient.patch("/api/auth/profile", data);
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["auth", "currentUser"] });
      toast({ title: "Details updated", description: "Your contact details have been saved." });
    },
    onError: (err: Error) => {
      toast({ title: "Update failed", description: err.message, variant: "destructive" });
    },
  });

  const changePasswordMutation = useMutation({
    mutationFn: async (data: { currentPassword: string; newPassword: string }) => {
      const { data: result } = await axiosClient.post("/api/auth/change-password", data);
      return result;
    },
    onSuccess: () => {
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      toast({ title: "Password changed", description: "Your password has been updated." });
    },
    onError: (err: Error) => {
      toast({ title: "Password change failed", description: err.message, variant: "destructive" });
    },
  });

  const handleSaveDetails = () => {
    const updates: Record<string, string> = {};
    if (email !== (currentUser?.email || "")) updates.email = email;
    if (phoneNumber !== (currentUser?.phoneNumber || "")) updates.phoneNumber = phoneNumber;
    if (Object.keys(updates).length === 0) {
      toast({ title: "No changes", description: "No details were changed." });
      return;
    }
    updateDetailsMutation.mutate(updates);
  };

  const handleChangePassword = () => {
    if (!currentPassword) {
      toast({ title: "Current password required", description: "Please enter your current password.", variant: "destructive" });
      return;
    }
    if (!newPassword) {
      toast({ title: "New password required", description: "Please enter a new password.", variant: "destructive" });
      return;
    }
    if (newPassword.length < 6) {
      toast({ title: "Password too short", description: "New password must be at least 6 characters.", variant: "destructive" });
      return;
    }
    if (newPassword !== confirmPassword) {
      toast({ title: "Passwords don't match", description: "New password and confirmation must match.", variant: "destructive" });
      return;
    }
    changePasswordMutation.mutate({ currentPassword, newPassword });
  };

  return (
    <div className="mx-auto max-w-2xl space-y-8 p-6" data-testid="account-settings-page">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-500/10">
          <User className="h-5 w-5 text-blue-600" />
        </div>
        <div>
          <h2 className="text-lg font-semibold text-slate-900 dark:text-white" data-testid="text-settings-name">
            {currentUser?.name || "Account Settings"}
          </h2>
          <p className="text-sm text-slate-500 dark:text-slate-400" data-testid="text-settings-role">
            <Shield className="mr-1 inline h-3.5 w-3.5" />
            {currentUser?.role || "User"}
          </p>
        </div>
      </div>

      <Separator />

      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-700 dark:bg-slate-800/50" data-testid="section-contact-details">
        <h3 className="mb-4 text-sm font-semibold text-slate-900 dark:text-white">Contact Details</h3>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email" className="text-xs text-slate-600 dark:text-slate-400">
              <Mail className="mr-1.5 inline h-3.5 w-3.5" />
              Email Address
            </Label>
            <Input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="your@email.com"
              className="rounded-xl"
              data-testid="input-email"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="phone" className="text-xs text-slate-600 dark:text-slate-400">
              <Phone className="mr-1.5 inline h-3.5 w-3.5" />
              Phone Number
            </Label>
            <Input
              id="phone"
              type="tel"
              value={phoneNumber}
              onChange={(e) => setPhoneNumber(e.target.value)}
              placeholder="07xxx xxxxxx"
              className="rounded-xl"
              data-testid="input-phone"
            />
          </div>
          <Button
            onClick={handleSaveDetails}
            disabled={updateDetailsMutation.isPending}
            className="rounded-xl bg-blue-600 hover:bg-blue-700"
            data-testid="button-save-details"
          >
            <Save className="mr-2 h-4 w-4" />
            {updateDetailsMutation.isPending ? "Saving..." : "Save Details"}
          </Button>
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-700 dark:bg-slate-800/50" data-testid="section-change-password">
        <h3 className="mb-4 text-sm font-semibold text-slate-900 dark:text-white">
          <Lock className="mr-1.5 inline h-4 w-4" />
          Change Password
        </h3>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="current-password" className="text-xs text-slate-600 dark:text-slate-400">Current Password</Label>
            <div className="relative">
              <Input
                id="current-password"
                type={showCurrentPassword ? "text" : "password"}
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                placeholder="Enter current password"
                className="rounded-xl pr-10"
                data-testid="input-current-password"
              />
              <button
                type="button"
                onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                data-testid="button-toggle-current-password"
              >
                {showCurrentPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="new-password" className="text-xs text-slate-600 dark:text-slate-400">New Password</Label>
            <div className="relative">
              <Input
                id="new-password"
                type={showNewPassword ? "text" : "password"}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Enter new password"
                className="rounded-xl pr-10"
                data-testid="input-new-password"
              />
              <button
                type="button"
                onClick={() => setShowNewPassword(!showNewPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                data-testid="button-toggle-new-password"
              >
                {showNewPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="confirm-password" className="text-xs text-slate-600 dark:text-slate-400">Confirm New Password</Label>
            <div className="relative">
              <Input
                id="confirm-password"
                type={showConfirmPassword ? "text" : "password"}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Confirm new password"
                className="rounded-xl pr-10"
                data-testid="input-confirm-password"
              />
              <button
                type="button"
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                data-testid="button-toggle-confirm-password"
              >
                {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>
          <Button
            onClick={handleChangePassword}
            disabled={changePasswordMutation.isPending}
            className="rounded-xl bg-blue-600 hover:bg-blue-700"
            data-testid="button-change-password"
          >
            <Lock className="mr-2 h-4 w-4" />
            {changePasswordMutation.isPending ? "Changing..." : "Change Password"}
          </Button>
        </div>
      </div>
    </div>
  );
}

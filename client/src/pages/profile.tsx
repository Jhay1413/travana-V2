import { useState } from "react";
import { CommandCenterShell, type Role } from "@/components/command-center-shell";
import HubProfiles from "@/pages/hub/hub-profiles";

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
      title="My Profile"
      role={role}
      onRoleChange={handleRoleChange}
    >
      <HubProfiles />
    </CommandCenterShell>
  );
}

import { useRole } from "@/hooks/use-role";
import { CommandCenterShell } from "@/components/command-center-shell";
import SocialPostsBoard from "@/components/social-posts-board";

export default function SocialPostsPage() {
  const { role, setRole } = useRole();

  return (
    <CommandCenterShell
      active="social-posts"
      title="Social Posts"
      subtitle="Browse and schedule social media posts from your quotes"
      role={role}
      onRoleChange={setRole}
    >
      <SocialPostsBoard />
    </CommandCenterShell>
  );
}

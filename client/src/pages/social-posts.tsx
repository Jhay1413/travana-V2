import { useRole } from "@/hooks/use-role";
import SocialPostsBoard from "@/components/social-posts-board";

export default function SocialPostsPage() {
  const { role, setRole } = useRole();

  return (
    <SocialPostsBoard />
  );
}

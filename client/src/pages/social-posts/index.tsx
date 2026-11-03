import { useState } from "react";
import { SocialPageHeader, SocialPostsGrid } from "@/features/social";

export default function SocialPostsPage() {
  const [createOpen, setCreateOpen] = useState(false);
  const [countsLine, setCountsLine] = useState("");

  return (
    <div className="flex flex-col gap-3.5 text-[14px] leading-[1.5]">
      <SocialPageHeader view="grid" countsLine={countsLine} onCreate={() => setCreateOpen(true)} />
      <SocialPostsGrid createOpen={createOpen} onCreateOpenChange={setCreateOpen} onCountsChange={setCountsLine} />
    </div>
  );
}

import { useState } from "react";
import { useFreeQuoteStatusCounts } from "@/features/quote/api/use-quote-queries";
import {
  CreatePostMenu,
  SchedulePostDialog,
  SocialCalendar,
  SocialPageHeader,
  SocialPostEditorDialog,
  usePostEditorState,
  useScheduleDialogState,
} from "@/features/social";

export default function SocialPostsCalendarPage() {
  const [createOpen, setCreateOpen] = useState(false);
  const { data: counts } = useFreeQuoteStatusCounts("", []);
  const { editorProps, generate, openEditor } = usePostEditorState();
  const schedule = useScheduleDialogState();

  const countsLine = counts
    ? `Calendar view · ${counts.scheduled} scheduled · ${counts.draft} ${counts.draft === 1 ? "draft" : "drafts"}`
    : "";

  return (
    <div className="flex flex-col gap-3.5 text-[14px] leading-[1.5]">
      <SocialPageHeader view="calendar" countsLine={countsLine} onCreate={() => setCreateOpen(true)} />
      <SocialCalendar
        onOpenPost={(quote) => void openEditor(quote)}
        onScheduleDraft={schedule.onScheduleDraft}
        onChangeTime={schedule.onChangeTime}
      />
      <SocialPostEditorDialog {...editorProps} />
      <CreatePostMenu open={createOpen} onOpenChange={setCreateOpen} onGenerate={generate} />
      {schedule.target && (
        <SchedulePostDialog
          quote={schedule.target.quote}
          deal={schedule.target.deal}
          mode={schedule.target.mode}
          initialDate={schedule.target.initialDate}
          open={schedule.open}
          onOpenChange={schedule.onOpenChange}
        />
      )}
    </div>
  );
}

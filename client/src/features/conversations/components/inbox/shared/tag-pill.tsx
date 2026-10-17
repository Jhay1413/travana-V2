import type { ConversationTag } from "../../../types";

export interface TagPillProps {
  tag: ConversationTag;
}

/** Chip tinted with the tag's own hex colour. */
export function TagPill({ tag }: TagPillProps) {
  return (
    <span
      className="inline-flex shrink-0 items-center rounded-full px-2 py-0.5 text-[12px] font-semibold"
      style={{ backgroundColor: `${tag.color}22`, color: tag.color }}
      title={tag.name}
    >
      {tag.name}
    </span>
  );
}

import { Segmented, type SegmentedItem } from "@/components/ui/segmented";

export type PipelineSegmentItem<T extends string> = SegmentedItem<T>;

/** Pipeline flavour of the shared segmented control: black active segment. */
export function PipelineSegmented<T extends string>(props: {
  value: T;
  onChange: (value: T) => void;
  items: Array<PipelineSegmentItem<T>>;
  label: string;
  className?: string;
}) {
  return <Segmented {...props} variant="black" className={`shrink-0 ${props.className ?? ""}`.trim()} />;
}

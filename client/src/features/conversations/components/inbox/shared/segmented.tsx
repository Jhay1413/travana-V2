import { Segmented as UiSegmented, type SegmentedItem, type SegmentedProps as UiSegmentedProps } from "@/components/ui/segmented";

export type { SegmentedItem };
export type SegmentedProps<T extends string> = Omit<UiSegmentedProps<T>, "variant" | "itemClassName" | "label"> & { height?: 38 | 42 };

/** Inbox flavour of the shared segmented control (38px default, items stretch on mobile). */
export function Segmented<T extends string>({ height = 38, ...props }: SegmentedProps<T>) {
  return <UiSegmented {...props} height={height} itemClassName="flex-1 sm:flex-none" />;
}

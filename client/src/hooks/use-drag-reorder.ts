import { useRef, useState } from "react";

/**
 * Drag-to-reorder for a list rendered in ANY layout — including a wrapping grid.
 *
 * Uses native HTML5 drag events rather than framer-motion's `Reorder`. Reorder
 * measures element positions along a single axis, which breaks as soon as items
 * wrap onto a second line: it has no way to express "row 2, column 1". These
 * events instead report the source and target elements directly, so a wrapping
 * grid works exactly like a single row.
 *
 * Usage:
 *   const { itemProps, draggingIndex, overIndex } = useDragReorder(items, setItems);
 *   items.map((item, i) => <div key={item.key} {...itemProps(i)} />)
 */
export function useDragReorder<T>(items: T[], onReorder: (next: T[]) => void) {
  // Kept in a ref as well as state: dataTransfer is unreadable during dragover
  // in some browsers, and state may not have flushed by the time drop fires.
  const dragIndexRef = useRef<number | null>(null);
  const [draggingIndex, setDraggingIndex] = useState<number | null>(null);
  const [overIndex, setOverIndex] = useState<number | null>(null);

  const reset = () => {
    dragIndexRef.current = null;
    setDraggingIndex(null);
    setOverIndex(null);
  };

  const move = (from: number, to: number) => {
    if (from === to || from < 0 || to < 0 || from >= items.length || to >= items.length) return;
    const next = [...items];
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved);
    onReorder(next);
  };

  const itemProps = (index: number) => ({
    draggable: true,
    onDragStart: (e: React.DragEvent) => {
      dragIndexRef.current = index;
      setDraggingIndex(index);
      e.dataTransfer.effectAllowed = "move";
      // Firefox refuses to start a drag unless some data is set.
      e.dataTransfer.setData("text/plain", String(index));
    },
    onDragOver: (e: React.DragEvent) => {
      // Without preventDefault the element is not a valid drop target and the
      // browser shows the "no drop" cursor.
      e.preventDefault();
      e.dataTransfer.dropEffect = "move";
      if (overIndex !== index) setOverIndex(index);
    },
    onDragLeave: () => {
      if (overIndex === index) setOverIndex(null);
    },
    onDrop: (e: React.DragEvent) => {
      e.preventDefault();
      const parsed = Number(e.dataTransfer.getData("text/plain"));
      const from = dragIndexRef.current ?? (Number.isNaN(parsed) ? null : parsed);
      if (from !== null) move(from, index);
      reset();
    },
    onDragEnd: reset,
  });

  return { itemProps, draggingIndex, overIndex };
}

/**
 * Insert plain text into a contentEditable `root` at the caret.
 *
 * If `savedRange` is given (and still lives inside `root`) it is restored as the
 * selection first; otherwise the current selection is used when it is inside
 * `root`, falling back to appending at the end. `execCommand("insertText")` is
 * preferred because it keeps the native undo stack and turns newlines into the
 * editor's block/<br> markup; a manual Range insert covers browsers without it.
 */
export function insertTextAtCaret(root: HTMLElement, text: string, savedRange?: Range | null): void {
  if (!text) return;
  root.focus();
  const selection = window.getSelection();
  if (!selection) return;

  const isInside = (range: Range) => root.contains(range.commonAncestorContainer);
  const current = selection.rangeCount > 0 ? selection.getRangeAt(0) : null;

  if (savedRange && isInside(savedRange)) {
    selection.removeAllRanges();
    selection.addRange(savedRange);
  } else if (!current || !isInside(current)) {
    const end = document.createRange();
    end.selectNodeContents(root);
    end.collapse(false);
    selection.removeAllRanges();
    selection.addRange(end);
  }

  if (document.execCommand("insertText", false, text)) return;

  if (selection.rangeCount === 0) return;
  const range = selection.getRangeAt(0);
  range.deleteContents();
  const node = document.createTextNode(text);
  range.insertNode(node);
  range.setStartAfter(node);
  range.collapse(true);
  selection.removeAllRanges();
  selection.addRange(range);
}

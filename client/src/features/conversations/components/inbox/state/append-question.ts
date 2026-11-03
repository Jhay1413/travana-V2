/** Adds a drafted question below whatever the agent already typed in the reply box. */
export function appendQuestion(currentReply: string, text: string): string {
  return currentReply.trim() ? `${currentReply.trimEnd()}\n\n${text}` : text;
}

import { toOnlySocialsBody } from "@shared/social-post-body";

/** HTML to load into the contentEditable editor: exactly what will be published. */
export function postToEditorHtml(post: string): string {
  return toOnlySocialsBody(post);
}

/**
 * Converts the editor's innerHTML back to a post body. contentEditable turns
 * Enter into <div> blocks (an empty line is <div><br></div>); flatten those to
 * line breaks before normalising so blank lines survive the round-trip.
 */
export function editorHtmlToPost(html: string): string {
  const flattened = html
    .replace(/<(div|p)\b[^>]*>\s*<br\s*\/?>\s*<\/\1>/gi, "\n")
    .replace(/<(div|p)\b[^>]*>/gi, "\n")
    .replace(/<\/(div|p)>/gi, "")
    .replace(/&nbsp;/g, " ");
  return toOnlySocialsBody(flattened);
}

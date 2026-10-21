import { toOnlySocialsBody } from "@shared/social-post-body";

/**
 * HTML to load into the contentEditable editor: exactly what will be published.
 * Only <br> survives as markup; any other "<" / ">" in the post is escaped so
 * stored text can never inject elements into the editor. "&" is left alone so
 * entities the editor already produced round-trip unchanged.
 */
export function postToEditorHtml(post: string): string {
  return toOnlySocialsBody(post)
    .split(/(<br>)/)
    .map((part) => (part === "<br>" ? part : part.replace(/</g, "&lt;").replace(/>/g, "&gt;")))
    .join("");
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

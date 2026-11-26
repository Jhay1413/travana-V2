const FONTS_LINK_ID = "portal-fonts";
/** Exactly the reference design's families and weights (travana-customer-hub/index.html). */
export const FONTS_HREF =
  "https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,300;0,400;0,500;1,300;1,400&family=Jost:wght@300;400;500&display=swap";

/**
 * Loads Cormorant Garamond and Jost the first time the portal shell mounts. Nothing
 * is added to index.html, so the staff app never downloads these fonts.
 */
export function loadPortalFonts(doc: Document = document): void {
  if (doc.getElementById(FONTS_LINK_ID)) return;
  const link = doc.createElement("link");
  link.id = FONTS_LINK_ID;
  link.rel = "stylesheet";
  link.href = FONTS_HREF;
  doc.head.appendChild(link);
}

/** What the customer portal's "My documents" endpoints return (shared so the client and the server cannot drift). */

/** What the in-app viewer can show: a PDF (rendered page by page) or a picture. */
export type PortalDocumentViewKind = "pdf" | "image";

/** One file the agency keeps on the customer's profile. Nothing else about the file is ever sent. */
export interface PortalDocument {
  id: string;
  /** The agent-given title, or the original file name when there is none. */
  name: string;
  /** Plain label ("Passport", "Tickets"...), or null when the agent gave none. */
  category: string | null;
  /** Short type label: "PDF", "Image", "Word document"... */
  kind: string;
  sizeBytes: number;
  /** ISO timestamp. */
  uploadedAt: string;
  /** True when the in-app viewer can show this file (stored type AND file extension agree on a PDF or common image). */
  viewable: boolean;
  /** What the viewer would show, or null when `viewable` is false. */
  viewKind: PortalDocumentViewKind | null;
  /** The deal (enquiry, quote or booking) the agency linked the file to. Files not linked to a deal are never sent. */
  dealId: string;
  /** The deal's live booking, whichever of the three the file was linked to; null while the deal has no booking yet. */
  bookingId: string | null;
}

/**
 * Answer of `GET /api/v2/portal/documents/:id/download` for files held in cloud storage: a link that works for
 * `expiresInSeconds` and forces a download. (A legacy file held on the server's own disk is streamed back as the
 * file itself instead of this JSON; the client helper handles both.)
 */
export interface PortalDocumentDownloadLink {
  url: string;
  fileName: string;
  expiresInSeconds: number;
}

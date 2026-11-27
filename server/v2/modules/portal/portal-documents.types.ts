import type { Readable } from 'stream';
/** A customer's file that passed the visibility join, with the deal it is linked to. */
export interface PortalLinkedFileRow {
  id: string;
  clientId: string;
  /** Internal: the storage key or legacy disk name. Never leaves the server. */
  filename: string;
  title: string | null;
  originalName: string;
  mimeType: string;
  size: number;
  category: string | null;
  createdAt: Date;
  /** The transaction behind the enquiry, quote or booking the file is linked to. */
  dealId: string;
}

/** How the controller delivers a download: a short-lived storage link, or (legacy disk files) the file itself. */
export type PortalDownload =
  | { kind: 'link'; url: string; fileName: string; expiresInSeconds: number }
  | { kind: 'stream'; filePath: string; fileName: string; contentType: string; contentDisposition: string };

/** A document opened for in-app viewing: the bytes to relay, with the one safe type for them. */
export interface PortalViewStream {
  stream: Readable;
  /** Exact content type for the kind (never the stored value verbatim). */
  contentType: string;
  fileName: string;
  /** Exact byte length when known. */
  size: number | null;
}

export type { QuoteImage, InsertQuoteImage } from "@shared/schema";

export interface PresignQuoteImageInput {
  filename: string;
  contentType: string;
}

export interface PresignQuoteImageResult {
  uploadUrl: string;
  key: string;
  proxyUrl: string;
}

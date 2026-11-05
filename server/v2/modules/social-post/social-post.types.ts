export interface OnlySocialsMediaContent {
  id: number;
  uuid: string;
  name: string;
  mime_type: string;
  type: string;
  url: string;
  thumb_url: string;
  is_video: boolean;
  created_at: string;
}

export interface OnlySocialsPostContent {
  body: string;
  media: OnlySocialsMediaContent[];
  url: string;
}

export interface OnlySocialsPostVersion {
  account_id: number;
  is_original: boolean;
  content: OnlySocialsPostContent[];
  options: Record<string, unknown>;
}

export interface OnlySocialsPost {
  id: number;
  uuid: string;
  name: string;
  hexColor: string;
  status: string;
  date: string;
  time: string;
  versions: OnlySocialsPostVersion[];
  tags: string[];
  created_at: string;
  updated_at: string;
}

export interface OnlySocialsMediaUploadResponse {
  id: number;
  uuid: string;
  name: string;
  mime_type: string;
  type: string;
  url: string;
  thumb_url: string;
  is_video: boolean;
  created_at: string;
}

/** Org-scoped branding used to fill in the "To Book" contact block of a generated post. */
export interface OrgSocialContact {
  businessName: string | null;
  phone: string | null;
  website: string | null;
  instagramUrl: string | null;
}

/** Raw org row (name + generic settings blob) used to derive an OrgSocialContact. */
export interface OrganizationBranding {
  name: string;
  settings: Record<string, unknown>;
}

export type SocialPlatform = "facebook" | "instagram" | "other";

/** One connected account from OnlySocials' GET /{workspace}/accounts. */
export interface OnlySocialsAccount {
  id: number;
  uuid: string;
  name: string;
  username: string | null;
  image: string | null;
  /** Raw provider string from OnlySocials (e.g. "facebook_page"). */
  provider: string;
  platform: SocialPlatform;
  authorized: boolean;
}

/** An account a post is published to. */
export interface OnlySocialsPublishTarget {
  accountId: number;
  platform: SocialPlatform;
}

/** Whitelisted fields of PATCH /social-posts/:id. */
export interface UpdateSocialPostInput {
  post?: string;
  accountIds?: number[];
}

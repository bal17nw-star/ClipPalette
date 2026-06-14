export type ClipType = "text" | "url" | "image" | "code";

export interface ClipItem {
  id: number;
  content: string;
  content_hash: string;
  clip_type: ClipType;
  source_app: string | null;
  created_at: string;
  is_pinned: boolean;
  tags: string[];
  ogp_title: string | null;
  ogp_image: string | null;
  ogp_domain: string | null;
  image_data: string | null;
}

export interface Snippet {
  id: number;
  trigger: string;
  content: string;
  description: string | null;
  created_at: string;
}

export interface OgpData {
  title: string | null;
  image: string | null;
  domain: string | null;
  description: string | null;
}

export interface SearchOptions {
  query?: string;
  clip_type?: string;
  tag?: string;
  pinned_only: boolean;
  limit?: number;
  offset?: number;
}

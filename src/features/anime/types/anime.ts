export interface AnimeTitle {
  slug: string;
  title: string;
  path: string;
  url: string;
  thumbnail: string;
  currentEpisode?: number | null;
  totalEpisodes?: number | null;
  type?: string | null;
  quality?: string | null;
  hot?: boolean;
  views?: number | string | null;
  timeAgo?: string | null;
  score?: number | null;
  rank?: number | null;
}

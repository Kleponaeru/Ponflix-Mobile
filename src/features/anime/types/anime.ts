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

export interface AnimeDetails extends AnimeTitle {
  japaneseTitle?: string | null;
  synopsis?: string | null;
  status?: string | null;
  aired?: string | null;
  duration?: string | null;
  genres?: string[];
  updatedAt?: string | null;
}

export interface AnimeEpisode {
  title: string;
  slug: string;
  path: string;
  url: string;
  number: number;
}

export interface AnimeServer {
  name: string;
  value: string;
  quality?: string;
  provider?: string;
  url: string;
}

export interface AnimePlayback {
  title: string;
  iframe?: string | null;
  servers?: AnimeServer[];
  sourceStatus?: string | null;
  playbackAvailable?: boolean;
}

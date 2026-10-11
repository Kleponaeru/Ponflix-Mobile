export type ComicCategory = 'manga' | 'manhwa' | 'manhua';

export interface ComicChapter {
  title: string;
  slug: string;
  releasedAt?: string;
}

export interface ComicListItem {
  id: string;
  title: string;
  imageUrl: string;
  type: string;
  status: string;
  isColored: boolean;
  latestChapter?: ComicChapter;
}

export interface ComicDetails extends ComicListItem {
  rating: number | null;
  votes: string | null;
  author: string | null;
  illustrator: string | null;
  alternativeTitles: string[];
  genres: { name: string; slug: string }[];
  description: string;
  firstChapter?: ComicChapter;
  chapters: ComicChapter[];
}

export interface ComicReaderData {
  title: string;
  mangaTitle: string;
  images: string[];
  nextChapter?: string;
  previousChapter?: string;
  chapters: ComicChapter[];
}

export interface ComicPage {
  items: ComicListItem[];
  page: number;
  totalPages: number;
}

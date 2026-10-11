export type LibraryMediaType = 'anime' | 'comic';

export interface LibraryEntry {
  type: LibraryMediaType;
  id: string;
  title: string;
  imageUrl: string;
  route: string;
  subtitle?: string;
  updatedAt: number;
}

export type LibraryEntryInput = Pick<LibraryEntry, 'type' | 'id' | 'route'> &
  Partial<Pick<LibraryEntry, 'title' | 'imageUrl' | 'subtitle'>>;

export interface LibraryData {
  bookmarks: LibraryEntry[];
  recent: LibraryEntry[];
}

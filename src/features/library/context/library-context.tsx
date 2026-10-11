import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type PropsWithChildren } from 'react';

import { LocalStorage } from '@/features/library/storage';
import type { LibraryData, LibraryEntry, LibraryEntryInput, LibraryMediaType } from '@/features/library/types/library';

const STORAGE_KEY = 'ponflix-library-v1';
const MAX_RECENT_ITEMS = 50;
const EMPTY_LIBRARY: LibraryData = { bookmarks: [], recent: [] };

type LibraryContextValue = {
  bookmarks: LibraryEntry[];
  recent: LibraryEntry[];
  ready: boolean;
  isBookmarked: (type: LibraryMediaType, id: string) => boolean;
  toggleBookmark: (entry: LibraryEntryInput) => void;
  recordProgress: (entry: LibraryEntryInput) => void;
  removeBookmark: (type: LibraryMediaType, id: string) => void;
  removeRecent: (type: LibraryMediaType, id: string) => void;
  clearRecent: () => void;
};

const LibraryContext = createContext<LibraryContextValue | null>(null);

function entryKey(entry: Pick<LibraryEntry, 'type' | 'id'>) {
  return `${entry.type}:${entry.id}`;
}

function parseLibrary(rawValue: string | null): LibraryData {
  if (!rawValue) return EMPTY_LIBRARY;
  try {
    const value: unknown = JSON.parse(rawValue);
    if (value && typeof value === 'object') {
      const parsed = value as Partial<LibraryData>;
      return {
        bookmarks: Array.isArray(parsed.bookmarks) ? parsed.bookmarks : [],
        recent: Array.isArray(parsed.recent) ? parsed.recent : [],
      };
    }
  } catch {
    return EMPTY_LIBRARY;
  }
  return EMPTY_LIBRARY;
}

export function LibraryProvider({ children }: PropsWithChildren) {
  const [library, setLibrary] = useState<LibraryData>(EMPTY_LIBRARY);
  const [ready, setReady] = useState(false);
  const libraryRef = useRef(library);
  const writesRef = useRef(Promise.resolve());

  useEffect(() => {
    let alive = true;
    LocalStorage.getItem(STORAGE_KEY)
      .then((value) => {
        if (!alive) return;
        const next = parseLibrary(value);
        libraryRef.current = next;
        setLibrary(next);
      })
      .catch(() => {})
      .finally(() => {
        if (alive) setReady(true);
      });
    return () => { alive = false; };
  }, []);

  const commit = useCallback((update: (current: LibraryData) => LibraryData) => {
    const next = update(libraryRef.current);
    libraryRef.current = next;
    setLibrary(next);
    writesRef.current = writesRef.current
      .catch(() => {})
      .then(() => LocalStorage.setItem(STORAGE_KEY, JSON.stringify(next)))
      .catch(() => {});
  }, []);

  const isBookmarked = useCallback((type: LibraryMediaType, id: string) => {
    return library.bookmarks.some((entry) => entry.type === type && entry.id === id);
  }, [library.bookmarks]);

  const toggleBookmark = useCallback((input: LibraryEntryInput) => {
    if (!ready) return;
    commit((current) => {
      const exists = current.bookmarks.some((entry) => entry.type === input.type && entry.id === input.id);
      const bookmarks = exists
        ? current.bookmarks.filter((entry) => entry.type !== input.type || entry.id !== input.id)
        : [{
            type: input.type,
            id: input.id,
            title: input.title || input.id.replace(/-/g, ' '),
            imageUrl: input.imageUrl || '',
            route: input.route,
            subtitle: input.subtitle,
            updatedAt: Date.now(),
          }, ...current.bookmarks];
      return { ...current, bookmarks };
    });
  }, [commit, ready]);

  const recordProgress = useCallback((input: LibraryEntryInput) => {
    if (!ready) return;
    commit((current) => {
      const key = `${input.type}:${input.id}`;
      const existing = current.recent.find((entry) => entryKey(entry) === key);
      const entry: LibraryEntry = {
        type: input.type,
        id: input.id,
        title: input.title || existing?.title || input.id.replace(/-/g, ' '),
        imageUrl: input.imageUrl || existing?.imageUrl || '',
        route: input.route,
        subtitle: input.subtitle || existing?.subtitle,
        updatedAt: Date.now(),
      };
      const recent = [entry, ...current.recent.filter((item) => entryKey(item) !== key)].slice(0, MAX_RECENT_ITEMS);
      return { ...current, recent };
    });
  }, [commit, ready]);

  const removeBookmark = useCallback((type: LibraryMediaType, id: string) => {
    commit((current) => ({
      ...current,
      bookmarks: current.bookmarks.filter((entry) => entry.type !== type || entry.id !== id),
    }));
  }, [commit]);

  const removeRecent = useCallback((type: LibraryMediaType, id: string) => {
    commit((current) => ({
      ...current,
      recent: current.recent.filter((entry) => entry.type !== type || entry.id !== id),
    }));
  }, [commit]);

  const clearRecent = useCallback(() => commit((current) => ({ ...current, recent: [] })), [commit]);

  const value = useMemo(() => ({
    bookmarks: library.bookmarks,
    recent: library.recent,
    ready,
    isBookmarked,
    toggleBookmark,
    recordProgress,
    removeBookmark,
    removeRecent,
    clearRecent,
  }), [library.bookmarks, library.recent, ready, isBookmarked, toggleBookmark, recordProgress, removeBookmark, removeRecent, clearRecent]);

  return <LibraryContext.Provider value={value}>{children}</LibraryContext.Provider>;
}

export function useLibrary() {
  const context = useContext(LibraryContext);
  if (!context) throw new Error('useLibrary must be used within LibraryProvider.');
  return context;
}

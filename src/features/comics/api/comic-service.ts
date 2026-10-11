import type { ComicCategory, ComicChapter, ComicDetails, ComicListItem, ComicPage, ComicReaderData } from '@/features/comics/types/comic';
import { cleanComicTitle, extractComicSlug } from '@/features/comics/utils/comic-slug';

const API_URL = 'https://ponflix-comics-api.vercel.app/api.php';
const CHAPTER_COUNT_CONCURRENCY = 3;
const chapterCountCache = new Map<string, Promise<number>>();
let activeChapterCountRequests = 0;
const chapterCountQueue: (() => void)[] = [];

async function withChapterCountSlot<T>(request: () => Promise<T>): Promise<T> {
  if (activeChapterCountRequests >= CHAPTER_COUNT_CONCURRENCY) {
    await new Promise<void>((resolve) => chapterCountQueue.push(resolve));
  } else {
    activeChapterCountRequests += 1;
  }
  try {
    return await request();
  } finally {
    const next = chapterCountQueue.shift();
    if (next) next();
    else activeChapterCountRequests -= 1;
  }
}

async function fetchPayload<T>(url: string, signal?: AbortSignal): Promise<T> {
  const response = await fetch(url, { headers: { Accept: 'application/json' }, signal });
  if (!response.ok) throw new Error(`Comics request failed (${response.status}).`);
  const payload = await response.json();
  if (payload?.status === false || !payload?.data) {
    throw new Error(payload?.message || 'Comics data is unavailable right now.');
  }
  return payload.data as T;
}

function mapChapter(raw: Record<string, unknown>): ComicChapter {
  const slug = extractComicSlug(String(raw.link_chapter || raw.link || raw.slug || ''));
  return {
    title: cleanComicTitle(String(raw.judul_chapter || raw.judul || raw.title || ''), 'Chapter'),
    slug,
    releasedAt: String(raw.waktu_rilis || raw.tanggal || raw.tanggal_rilis || ''),
  };
}

function mapListItem(raw: Record<string, unknown>): ComicListItem {
  const latest = Array.isArray(raw.chapter) ? raw.chapter[0] : undefined;
  const type = String(raw.tipe || 'Manga');
  return {
    id: extractComicSlug(String(raw.link || raw.id || '')),
    title: cleanComicTitle(String(raw.judul || ''), extractComicSlug(String(raw.link || '')).replace(/-/g, ' ')),
    imageUrl: String(raw.gambar || ''),
    type,
    status: String(raw.status || 'Updating'),
    isColored: raw.warna === 'Warna',
    latestChapter: latest && typeof latest === 'object' ? mapChapter(latest as Record<string, unknown>) : undefined,
  };
}

export async function fetchComicPage(category: ComicCategory, page = 1, signal?: AbortSignal): Promise<ComicPage> {
  const params = new URLSearchParams({ type: category, page: String(page) });
  const data = await fetchPayload<{ total_halaman?: number; komik?: Record<string, unknown>[] }>(`${API_URL}?${params}`, signal);
  return {
    items: Array.isArray(data.komik) ? data.komik.map(mapListItem).filter((item) => item.id) : [],
    page,
    totalPages: Math.max(1, Number(data.total_halaman) || page),
  };
}

export async function searchComics(query: string, signal?: AbortSignal): Promise<ComicListItem[]> {
  const normalizedQuery = query.trim().toLocaleLowerCase();
  if (normalizedQuery) {
    const params = new URLSearchParams({ s: query.trim(), page: '1' });
    const data = await fetchPayload<{ komik?: Record<string, unknown>[] }>(`${API_URL}?${params}`, signal);
    return Array.isArray(data.komik) ? data.komik.map(mapListItem).filter((item) => item.id) : [];
  }

  const categories: ComicCategory[] = ['manga', 'manhwa', 'manhua'];
  const pages = await Promise.all(categories.map((category) => fetchComicPage(category, 1, signal)));
  const unique = new Map<string, ComicListItem>();
  for (const item of pages.flatMap((result) => result.items)) {
    if (!unique.has(item.id)) unique.set(item.id, item);
  }
  return [...unique.values()];
}

export async function fetchComicDetails(id: string, signal?: AbortSignal): Promise<ComicDetails> {
  const data = await fetchPayload<Record<string, any>>(`${API_URL}?komik=${encodeURIComponent(id)}`, signal);
  const info = data.detail || {};
  const chapters = Array.isArray(data.daftar_chapter) ? data.daftar_chapter.map(mapChapter).filter((chapter: ComicChapter) => chapter.slug) : [];
  const firstChapter = data.chapter_awal ? mapChapter(data.chapter_awal) : undefined;
  const latestChapter = data.chapter_terbaru ? mapChapter(data.chapter_terbaru) : chapters[0];
  return {
    id: String(data.id || id),
    title: cleanComicTitle(String(data.judul || ''), id.replace(/-/g, ' ')),
    imageUrl: String(data.gambar || ''),
    rating: Number(data.rating) > 0 ? Number(data.rating) : null,
    votes: data.votes ? String(data.votes) : null,
    type: String(info.jenis_komik || 'Comic'),
    status: String(info.status || 'Unknown'),
    isColored: String(data.detail?.warna || '') === 'Warna',
    author: info.pengarang ? String(info.pengarang) : null,
    illustrator: info.ilustrator ? String(info.ilustrator) : null,
    alternativeTitles: typeof info.judul_alternatif === 'string' ? info.judul_alternatif.split(',').map((title: string) => title.trim()).filter(Boolean) : [],
    genres: Array.isArray(data.genre) ? data.genre.map((genre: Record<string, unknown>) => ({ name: String(genre.nama || ''), slug: String(genre.link || '') })).filter((genre: { name: string }) => genre.name) : [],
    description: String(data.desk || ''),
    chapters,
    firstChapter,
    latestChapter,
  };
}

export function fetchComicChapterCount(id: string): Promise<number> {
  const cached = chapterCountCache.get(id);
  if (cached) return cached;

  const request = withChapterCountSlot(async () => {
    const data = await fetchPayload<Record<string, unknown>>(`${API_URL}?komik=${encodeURIComponent(id)}`);
    return Array.isArray(data.daftar_chapter) ? data.daftar_chapter.length : 0;
  });
  chapterCountCache.set(id, request);
  request.catch(() => chapterCountCache.delete(id));
  return request;
}

export async function fetchComicReader(chapterSlug: string, signal?: AbortSignal): Promise<ComicReaderData> {
  const data = await fetchPayload<Record<string, any>>(`${API_URL}?chapter=${encodeURIComponent(chapterSlug)}`, signal);
  const images = Array.isArray(data.gambar) ? data.gambar.map((image: string | { url?: string }) => typeof image === 'string' ? image : image.url || '').filter(Boolean) : [];
  const nav = data.navigasi || {};
  const chapters = Array.isArray(data.semua_chapter) ? data.semua_chapter.map(mapChapter).filter((chapter: ComicChapter) => chapter.slug) : [];
  return {
    title: cleanComicTitle(String(data.judul || ''), 'Chapter'),
    mangaTitle: cleanComicTitle(String(data.info_komik?.judul || ''), 'Comic'),
    images,
    nextChapter: extractComicSlug(nav.selanjutnya),
    previousChapter: extractComicSlug(nav.sebelumnya),
    chapters,
  };
}

import type { AnimeDetails, AnimeEpisode, AnimePlayback, AnimeTitle } from '@/features/anime/types/anime';

const API_BASE_URL = 'https://ponflix-api.vercel.app';
const CACHE_TTL: Record<string, number> = {
  '/api/latest': 60_000,
  '/api/spotlight': 120_000,
  '/api/trending': 300_000,
};

const cache = new Map<string, { data: AnimeTitle[]; expiresAt: number }>();

export function clearAnimeFeedCache() {
  cache.clear();
}

async function fetchFeed(path: string, signal?: AbortSignal): Promise<AnimeTitle[]> {
  const ttl = CACHE_TTL[path];
  const cached = ttl ? cache.get(path) : undefined;
  if (cached && cached.expiresAt > Date.now()) return cached.data;

  const response = await fetch(`${API_BASE_URL}${path}`, {
    headers: { Accept: 'application/json' },
    signal,
  });
  if (!response.ok) throw new Error(`Anime request failed (${response.status}).`);

  const payload: { success?: boolean; message?: string; data?: AnimeTitle[] } = await response.json();
  if (!payload.success) throw new Error(payload.message || 'Ponflix could not load anime right now.');

  const data = Array.isArray(payload.data) ? payload.data : [];
  if (ttl) cache.set(path, { data, expiresAt: Date.now() + ttl });
  return data;
}

export const fetchSpotlightAnime = (signal?: AbortSignal) => fetchFeed('/api/spotlight', signal);
export const fetchTrendingAnime = (signal?: AbortSignal) => fetchFeed('/api/trending', signal);
export const fetchLatestAnime = (signal?: AbortSignal) => fetchFeed('/api/latest', signal);

export async function searchAnime(query: string, signal?: AbortSignal): Promise<AnimeTitle[]> {
  const search = encodeURIComponent(query.trim());
  if (!search) return fetchTrendingAnime(signal);
  return fetchFeed(`/api/search?q=${search}`, signal);
}

async function fetchAnimeData<T>(path: string, signal?: AbortSignal): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    headers: { Accept: 'application/json' },
    signal,
  });
  if (!response.ok) throw new Error(`Anime request failed (${response.status}).`);

  const payload: { success?: boolean; message?: string; data?: T } = await response.json();
  if (!payload.success || payload.data == null) {
    throw new Error(payload.message || 'Anime data is unavailable right now.');
  }
  return payload.data;
}

export const fetchAnimeDetails = (slug: string, signal?: AbortSignal) =>
  fetchAnimeData<AnimeDetails>(`/api/anime/${encodeURIComponent(slug)}`, signal);

export const fetchAnimeEpisodes = (slug: string, signal?: AbortSignal) =>
  fetchAnimeData<AnimeEpisode[]>(`/api/anime/${encodeURIComponent(slug)}/episodes`, signal);

export const fetchEpisodePlayback = (episodeSlug: string, signal?: AbortSignal) =>
  fetchAnimeData<AnimePlayback>(`/api/episode/${encodeURIComponent(episodeSlug)}`, signal);

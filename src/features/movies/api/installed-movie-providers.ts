import { LocalStorage } from '@/features/library/storage';

const STORAGE_KEY = 'ponflix-movie-providers-v1';
export const IDLIX_PROVIDER_ID = 'idlix';

export async function getInstalledMovieProviders(): Promise<string[]> {
  const stored = await LocalStorage.getItem(STORAGE_KEY);
  if (!stored) return [];
  try {
    const parsed: unknown = JSON.parse(stored);
    return Array.isArray(parsed) ? parsed.filter((value): value is string => typeof value === 'string') : [];
  } catch {
    return [];
  }
}

export async function setMovieProviderInstalled(providerId: string, installed: boolean): Promise<string[]> {
  const current = await getInstalledMovieProviders();
  const next = installed
    ? [...new Set([...current, providerId])]
    : current.filter((value) => value !== providerId);
  await LocalStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  return next;
}

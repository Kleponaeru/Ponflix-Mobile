export function extractComicSlug(value?: string | null): string {
  if (!value) return '';
  const segments = value.split('/').filter(Boolean);
  const comicIndex = segments.lastIndexOf('komik');
  return segments[comicIndex + 1] || segments.at(-1) || '';
}

export function cleanComicTitle(value?: string | null, fallback = 'Untitled comic'): string {
  return (value || fallback).replace(/^Komik\s+/i, '').replace(/\s+/g, ' ').trim();
}

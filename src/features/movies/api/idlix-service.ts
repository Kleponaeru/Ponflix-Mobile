import { Platform } from 'react-native';

export const IDLIX_BASE_URL = 'https://z2.idlixku.com';
const TMDB_POSTER_BASE = 'https://image.tmdb.org/t/p/w500';

export type IdlixCategory = 'movie' | 'series';

export interface IdlixTitle {
  id: string;
  title: string;
  slug: string;
  type: string;
  posterUrl: string;
  overview: string;
  year?: string;
  status?: string;
  url: string;
}

export interface IdlixEpisode {
  id: string;
  title: string;
  number: number;
  season?: number;
}

export type IdlixPlaybackType = 'movie' | 'episode';

export interface IdlixSubtitleSource {
  uri: string;
  label: string;
  language?: string;
  referer?: string;
}

export type IdlixPlayback =
  | { kind: 'video'; uri: string; headers: Record<string, string>; contentType?: 'hls'; subtitleSources?: IdlixSubtitleSource[] }
  | { kind: 'embed'; uri: string; subtitleSources?: IdlixSubtitleSource[] };

export interface IdlixDetails extends IdlixTitle {
  genres: string[];
  episodes: IdlixEpisode[];
  seasons: number;
  runtime?: string;
  tagline?: string;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function firstString(value: Record<string, unknown>, ...keys: string[]): string {
  for (const key of keys) {
    const item = value[key];
    if (typeof item === 'string' && item.trim()) return item.trim();
    if (typeof item === 'number') return String(item);
  }
  return '';
}

function imageUrl(value: string): string {
  if (!value) return '';
  if (/^https?:\/\//i.test(value)) return value;
  return `${TMDB_POSTER_BASE}${value.startsWith('/') ? value : `/${value}`}`;
}

function unwrapItems(payload: unknown): unknown[] {
  if (Array.isArray(payload)) return payload;
  if (!isRecord(payload)) return [];
  const data = payload.data;
  if (Array.isArray(data)) return data;
  if (isRecord(data)) {
    for (const key of ['items', 'results', 'movies', 'series']) {
      if (Array.isArray(data[key])) return data[key] as unknown[];
    }
  }
  for (const key of ['items', 'results', 'movies', 'series']) {
    if (Array.isArray(payload[key])) return payload[key] as unknown[];
  }
  return [];
}

function unwrapObject(payload: unknown): Record<string, unknown> | null {
  if (!isRecord(payload)) return null;
  for (const key of ['data', 'detail', 'movie', 'series', 'result']) {
    if (isRecord(payload[key])) return payload[key] as Record<string, unknown>;
  }
  return payload;
}

function readNumber(value: Record<string, unknown>, ...keys: string[]): number | undefined {
  for (const key of keys) {
    const item = value[key];
    const number = typeof item === 'number' ? item : typeof item === 'string' ? Number(item) : NaN;
    if (Number.isFinite(number) && number > 0) return number;
  }
  return undefined;
}

function collectEpisodes(root: Record<string, unknown>, fallbackSlug: string): IdlixEpisode[] {
  const episodes: IdlixEpisode[] = [];
  const visited = new Set<object>();
  const episodeListKey = /^(episodes?|episodeList|episode_list|episodeItems|episode_items)$/i;
  const seasonKey = /^(seasons?|seasonList|season_list|seasonWrapper|season_wrapper)$/i;

  const addEpisode = (value: unknown, index: number, inheritedSeason?: number) => {
    if (!isRecord(value)) return;
    const nestedEpisode = isRecord(value.episode) ? value.episode : isRecord(value.Episode) ? value.Episode : value;
    const id = firstString(nestedEpisode, 'id', '_id', 'slug', 'url', 'episodeId', 'episode_id');
    const number = readNumber(nestedEpisode, 'episodeNumber', 'episode_number', 'episodeNo', 'episode_no', 'number', 'ep') ?? index + 1;
    const episodeTitle = firstString(nestedEpisode, 'title', 'name', 'episodeTitle', 'episode_title') || `Episode ${number}`;
    episodes.push({
      id: id || `${fallbackSlug}-${inheritedSeason ?? 0}-${number}`,
      title: episodeTitle,
      number,
      season: readNumber(nestedEpisode, 'seasonNumber', 'season_number', 'season') ?? inheritedSeason,
    });
  };

  const visit = (value: unknown, inheritedSeason?: number) => {
    if (!isRecord(value) || visited.has(value)) return;
    visited.add(value);
    for (const [key, child] of Object.entries(value)) {
      if (!child || typeof child !== 'object') continue;
      if (seasonKey.test(key)) {
        const seasons = Array.isArray(child) ? child : [child];
        for (const [seasonIndex, seasonValue] of seasons.entries()) {
          if (!isRecord(seasonValue)) continue;
          const seasonNumber = readNumber(seasonValue, 'seasonNumber', 'season_number', 'number', 'season') ?? seasonIndex + 1;
          visit(seasonValue, seasonNumber);
        }
      } else if (episodeListKey.test(key) && Array.isArray(child)) {
        child.forEach((episode, index) => addEpisode(episode, index, inheritedSeason));
        child.forEach((episode) => visit(episode, inheritedSeason));
      } else if (!Array.isArray(child)) {
        visit(child, inheritedSeason);
      }
    }
  };

  visit(root);
  const unique = new Map<string, IdlixEpisode>();
  for (const episode of episodes) {
    const key = `${episode.season ?? ''}:${episode.number}:${episode.id}`;
    if (!unique.has(key)) unique.set(key, episode);
  }
  return [...unique.values()].sort((a, b) => (a.season ?? 0) - (b.season ?? 0) || a.number - b.number);
}

function mapTitle(value: unknown, category: IdlixCategory): IdlixTitle | null {
  if (!isRecord(value)) return null;
  const slug = firstString(value, 'slug', 'id', 'url');
  const title = firstString(value, 'title', 'name', 'originalTitle', 'original_title');
  if (!slug || !title) return null;

  const safeSlug = slug.split('/').filter(Boolean).pop() || slug;
  const rawType = firstString(value, 'type', 'contentType', 'content_type').toLocaleLowerCase();
  const resolvedCategory: IdlixCategory = rawType.includes('series') || rawType.includes('tv') ? 'series' : category;
  const directUrl = firstString(value, 'url', 'link');
  const url = /^https?:\/\//i.test(directUrl)
    ? directUrl
    : `${IDLIX_BASE_URL}/${resolvedCategory === 'series' ? 'series' : 'movie'}/${safeSlug}`;
  const release = firstString(value, 'releaseDate', 'release_date', 'firstAirDate', 'first_air_date', 'airDate');
  return {
    id: firstString(value, 'id', 'slug') || safeSlug,
    title,
    slug: safeSlug,
    type: resolvedCategory === 'series' ? 'Series' : 'Movie',
    posterUrl: imageUrl(firstString(value, 'posterPath', 'poster_path', 'poster', 'image', 'thumbnail')),
    overview: firstString(value, 'overview', 'description', 'synopsis'),
    year: release.match(/\d{4}/)?.[0],
    status: firstString(value, 'status'),
    url,
  };
}

async function fetchTitles(path: string, category: IdlixCategory, signal?: AbortSignal): Promise<IdlixTitle[]> {
  if (Platform.OS !== 'android') {
    throw new Error('Idlix direct requests are available in the Android app. The web version needs a server proxy.');
  }
  const response = await fetch(`${IDLIX_BASE_URL}${path}`, {
    headers: {
      Accept: 'application/json',
      Referer: `${IDLIX_BASE_URL}/`,
      'User-Agent': 'Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 Chrome/131.0.0.0 Mobile Safari/537.36',
    },
    signal,
  });
  if (!response.ok) throw new Error(`Idlix returned HTTP ${response.status}.`);
  const payload: unknown = await response.json();
  return unwrapItems(payload).map((item) => mapTitle(item, category)).filter((item): item is IdlixTitle => item !== null);
}

function findStringDeep(payload: unknown, ...keys: string[]): string {
  const expected = new Set(keys.map((key) => key.toLowerCase()));
  const visited = new Set<object>();
  const visit = (value: unknown): string => {
    if (!value || typeof value !== 'object' || visited.has(value)) return '';
    visited.add(value);
    if (Array.isArray(value)) {
      for (const item of value) {
        const found = visit(item);
        if (found) return found;
      }
      return '';
    }
    for (const [key, child] of Object.entries(value)) {
      if (expected.has(key.toLowerCase()) && (typeof child === 'string' || typeof child === 'number')) {
        const result = String(child).trim();
        if (result) return result;
      }
    }
    for (const child of Object.values(value)) {
      const found = visit(child);
      if (found) return found;
    }
    return '';
  };
  return visit(payload);
}

function collectSubtitleSources(payloads: unknown[], baseUrl = IDLIX_BASE_URL): IdlixSubtitleSource[] {
  const sources = new Map<string, IdlixSubtitleSource>();
  const visited = new Set<object>();
  const subtitleArrayKey = /^(subtitles?|subtitleTracks?|subtitle_tracks|captions?|textTracks?|text_tracks)$/i;
  const subtitleExtension = /\.(?:vtt|srt|ass|ssa|ttml|dfxp|xml)(?:$|[?#])/i;

  const visit = (value: unknown, inSubtitleList = false) => {
    if (!value || typeof value !== 'object' || visited.has(value)) return;
    visited.add(value);
    if (Array.isArray(value)) {
      value.forEach((item) => {
        if (typeof item === 'string' && inSubtitleList && subtitleExtension.test(item)) {
          try {
            const absoluteUri = new URL(item, baseUrl).toString();
            const isIndonesian = /(?:^|[\\/_-])(?:id|ind|indo|indonesian)(?:[\\/_?.-]|$)/i.test(item);
            sources.set(absoluteUri, { uri: absoluteUri, label: isIndonesian ? 'Indonesian' : 'Subtitle', referer: baseUrl });
          } catch {
            // Skip invalid URLs in the subtitle list.
          }
        } else {
          visit(item, inSubtitleList);
        }
      });
      return;
    }

    const record = value as Record<string, unknown>;
    // CloudX's Idlix response models subtitle entries as { label, path }.
    // Only treat `path` as a URL while inside a subtitle collection so API
    // routes and image paths elsewhere in the payload are not misclassified.
    const uri = firstString(record, 'url', 'src', 'file', 'link', 'subtitleUrl', 'subtitle_url', 'source')
      || (inSubtitleList ? firstString(record, 'path') : '');
    const type = firstString(record, 'kind', 'type', 'format', 'mimeType', 'mime_type').toLowerCase();
    const explicitlyNonSubtitle = /video|audio/.test(type);
    const isSubtitle = !explicitlyNonSubtitle && (inSubtitleList || /subtitle|caption|text\/vtt|application\/x-subrip/.test(type) || subtitleExtension.test(uri));
    if (uri && isSubtitle) {
      let absoluteUri: string;
      try {
        absoluteUri = new URL(uri, baseUrl).toString();
      } catch {
        return;
      }
      const language = firstString(record, 'language', 'lang', 'srclang', 'locale') || undefined;
      const rawLabel = firstString(record, 'label', 'name', 'title');
      const isIndonesian = /^(id|ind|id-id|indonesian)$/i.test(language || '') || /indonesia|(?:^|[_-])(id|ind|indo)(?:[_-]|\.)/i.test(rawLabel || uri);
      const label = rawLabel || (isIndonesian ? 'Indonesian' : language || 'Subtitle');
      sources.set(absoluteUri, { uri: absoluteUri, label, language, referer: baseUrl });
    }

    for (const [key, child] of Object.entries(record)) {
      if (child && typeof child === 'object') visit(child, inSubtitleList || subtitleArrayKey.test(key));
    }
  };

  payloads.forEach((payload) => visit(payload));
  return [...sources.values()];
}

function unpackPackerScript(script: string): string | null {
  // Match CloudStream's JsUnpacker pattern used by its Jeniusplay extractor.
  const packed = /\}\s*\('(.*)',\s*(.*?),\s*(\d+),\s*'(.*?)'\.split\('\|'\)/s.exec(script);
  if (!packed) return null;
  const [, rawPayload, radixText, countText, rawWords] = packed;
  const payload = rawPayload.replace(/\\'/g, "'");
  const radix = Number.parseInt(radixText, 10);
  const count = Number(countText);
  const words = rawWords.split('|');
  if (radix < 2 || radix > 95 || count <= 0 || count > 100_000 || words.length !== count) return null;

  const alphabet62 = '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ';
  const alphabet95 = " !\"#$%&'()*+,-./0123456789:;<=>?@ABCDEFGHIJKLMNOPQRSTUVWXYZ[\\]^_`abcdefghijklmnopqrstuvwxyz{|}~";
  const alphabet = radix > 36 && radix < 62 ? alphabet62.slice(0, radix)
    : radix === 62 ? alphabet62
      : radix > 62 && radix < 95 ? alphabet95.slice(0, radix)
        : radix === 95 ? alphabet95
          : '';
  const unbase = (value: string): number => {
    if (!alphabet) return Number.parseInt(value, radix);
    let result = 0;
    for (let index = value.length - 1, power = 0; index >= 0; index -= 1, power += 1) {
      const digit = alphabet.indexOf(value[index]);
      if (digit < 0) return -1;
      result += radix ** power * digit;
    }
    return result;
  };

  return payload.replace(/\b[a-zA-Z0-9_]+\b/g, (token) => {
    const word = words[unbase(token)];
    return word || token;
  });
}

function findJsonArrayAfterKey(value: string, key: string): unknown[] {
  const keyMatch = new RegExp(`(?:["']${key}["']|\\b${key}\\b)\\s*:`).exec(value);
  if (!keyMatch) return [];
  const start = value.indexOf('[', keyMatch.index + keyMatch[0].length);
  if (start < 0) return [];

  let depth = 0;
  let quote = '';
  let escaped = false;
  for (let index = start; index < value.length; index += 1) {
    const character = value[index];
    if (quote) {
      if (escaped) escaped = false;
      else if (character === '\\') escaped = true;
      else if (character === quote) quote = '';
      continue;
    }
    if (character === '"' || character === "'") quote = character;
    else if (character === '[') depth += 1;
    else if (character === ']') {
      depth -= 1;
      if (depth === 0) {
        try {
          const parsed: unknown = JSON.parse(value.slice(start, index + 1));
          return Array.isArray(parsed) ? parsed : [];
        } catch {
          return [];
        }
      }
    }
  }
  return [];
}

function subtitleSourcesFromPlayerPage(html: string, pageUrl: string): IdlixSubtitleSource[] {
  const result = new Map<string, IdlixSubtitleSource>();
  const add = (source: IdlixSubtitleSource) => result.set(source.uri, source);

  for (const match of html.matchAll(/<track\b([^>]*)>/gi)) {
    const attributes = match[1];
    const readAttribute = (name: string) => {
      const attribute = new RegExp(`(?:^|\\s)${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s>]+))`, 'i').exec(attributes);
      return (attribute?.[1] ?? attribute?.[2] ?? attribute?.[3] ?? '').trim();
    };
    const uri = readAttribute('src');
    const kind = readAttribute('kind');
    if (!uri || (kind && !/subtitles|captions/i.test(kind))) continue;
    try {
      const absoluteUri = new URL(uri, pageUrl).toString();
      const language = readAttribute('srclang') || undefined;
      const label = readAttribute('label') || (language && /^(id|ind|id-id)$/i.test(language) ? 'Indonesian' : language || 'Subtitle');
      add({ uri: absoluteUri, label, language, referer: pageUrl });
    } catch {
      // Ignore malformed track URLs and keep scanning the page.
    }
  }

  const scripts = [...html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gi)].map((match) => match[1]);
  for (const rawScript of scripts) {
    const script = unpackPackerScript(rawScript) || rawScript;
    for (const key of ['tracks', 'captions', 'subtitles', 'subtitleTracks']) {
      const tracks = findJsonArrayAfterKey(script, key);
      for (const source of collectSubtitleSources([{ [key]: tracks }], pageUrl)) add(source);
    }
  }
  return [...result.values()];
}

async function resolveJeniusplay(
  playerUrl: string,
  sourcePageUrl: string,
  signal?: AbortSignal,
): Promise<{ videoUrl: string; subtitleSources: IdlixSubtitleSource[] } | null> {
  let parsed: URL;
  try {
    parsed = new URL(playerUrl);
  } catch {
    return null;
  }
  if (!/jeniusplay/i.test(parsed.hostname)) return null;

  const pageResponse = await fetch(playerUrl, {
    headers: requestHeaders(sourcePageUrl),
    signal,
  });
  if (!pageResponse.ok) throw new Error(`Player page returned HTTP ${pageResponse.status}.`);
  const html = await pageResponse.text();
  const subtitleSources = subtitleSourcesFromPlayerPage(html, playerUrl);
  const data = parsed.searchParams.get('data') || parsed.pathname.split('/').filter(Boolean).at(-1)?.split('data=').at(-1);
  if (!data) throw new Error('Player URL has no video data token.');

  const endpoint = new URL('/player/index.php', parsed.origin);
  endpoint.searchParams.set('data', data);
  endpoint.searchParams.set('do', 'getVideo');
  const body = `hash=${encodeURIComponent(data)}&r=${encodeURIComponent(sourcePageUrl)}`;
  const response = await fetch(endpoint.toString(), {
    method: 'POST',
    headers: { ...requestHeaders(playerUrl), 'Content-Type': 'application/x-www-form-urlencoded', 'X-Requested-With': 'XMLHttpRequest' },
    body,
    signal,
  });
  if (!response.ok) throw new Error(`Player stream request returned HTTP ${response.status}.`);
  const payload: unknown = await response.json();
  const source = findStringDeep(payload, 'videoSource', 'video_source', 'source', 'src');
  if (!source) throw new Error('Player response did not include a video source.');
  return {
    videoUrl: source.replace(/\.txt(?=($|[?#]))/i, '.m3u8'),
    subtitleSources,
  };
}

async function resolveMajorplay(
  playerUrl: string,
  sourcePageUrl: string,
  signal?: AbortSignal,
): Promise<{ videoUrl: string | null; subtitleSources: IdlixSubtitleSource[] } | null> {
  let parsed: URL;
  try {
    parsed = new URL(playerUrl);
  } catch {
    return null;
  }
  if (!/(?:^|\.)majorplay\.net$/i.test(parsed.hostname)) return null;

  const pageResponse = await fetch(playerUrl, {
    headers: {
      ...requestHeaders(sourcePageUrl),
      // CloudX requests Majorplay player pages with a desktop Chrome user agent.
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      // The shared API headers advertise JSON, which can make the player host
      // return an empty/non-page response instead of its subtitle config HTML.
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
    },
    signal,
  });
  if (!pageResponse.ok) throw new Error(`Majorplay page returned HTTP ${pageResponse.status}.`);
  const html = await pageResponse.text();

  const mediaTags = [...html.matchAll(/<(?:source|video)\b[^>]*>/gi)].map((match) => match[0]);
  const readMediaAttribute = (tag: string, name: string) => {
    const attribute = new RegExp(`(?:^|\\s)${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s>]+))`, 'i').exec(tag);
    return (attribute?.[1] ?? attribute?.[2] ?? attribute?.[3] ?? '').trim();
  };
  let rawVideoUrl = '';
  for (const tag of mediaTags) {
    rawVideoUrl = readMediaAttribute(tag, 'src') || readMediaAttribute(tag, 'data-src') || readMediaAttribute(tag, 'data-file');
    if (rawVideoUrl) break;
  }
  // Some player templates put the stream URL in a small JS config object
  // instead of a <source src="..."> element.
  if (!rawVideoUrl) {
    const configUrl = /["'](?:file|src|source)["']\s*:\s*["']([^"']+)["']/i.exec(html)?.[1]?.replace(/\\\//g, '/');
    if (configUrl && /\.(?:m3u8|mp4|txt)(?:$|[?#])/i.test(configUrl)) rawVideoUrl = configUrl;
  }
  let videoUrl: string | null = null;
  if (rawVideoUrl) {
    try {
      videoUrl = new URL(rawVideoUrl, playerUrl).toString();
    } catch {
      throw new Error('Majorplay returned an invalid video address.');
    }
  }

  // CloudX reads subtitle metadata from script elements whose data contains
  // `subtitles`, where each entry has a label and path.
  const subtitleSources = new Map<string, IdlixSubtitleSource>();
  const subtitleEntry = /"label"\s*:\s*"([^"\\]*(?:\\.[^"\\]*)*)"[^}]*?"path"\s*:\s*"([^"\\]*(?:\\.[^"\\]*)*)"/g;
  const scripts = [...html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gi)];
  for (const scriptMatch of scripts) {
    const script = scriptMatch[1];
    if (!/subtitles/i.test(script)) continue;
    for (const match of script.matchAll(subtitleEntry)) {
      const label = match[1].replace(/\\(["\\])/g, '$1').trim() || 'Subtitle';
      const path = match[2].replace(/\\(["\\])/g, '$1').trim();
      if (!path) continue;
      try {
        const uri = new URL(path, playerUrl).toString();
        const language = /indonesia|\b(?:id|ind)\b/i.test(label) ? 'id' : undefined;
        subtitleSources.set(uri, { uri, label, language, referer: playerUrl });
      } catch {
        // Ignore malformed subtitle paths and keep valid tracks.
      }
    }
  }
  return { videoUrl, subtitleSources: [...subtitleSources.values()] };
}

function ensureAndroidPlayback(): void {
  if (Platform.OS !== 'android') {
    throw new Error('Idlix playback is currently available in the Android app only.');
  }
}

function requestHeaders(referer = `${IDLIX_BASE_URL}/`): Record<string, string> {
  let origin = IDLIX_BASE_URL;
  try {
    origin = new URL(referer).origin;
  } catch {
    // Keep the Idlix origin for non-URL referrers.
  }
  return {
    Accept: 'application/json, text/plain, */*',
    Origin: origin,
    Referer: referer,
    'User-Agent': 'Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 Chrome/131.0.0.0 Mobile Safari/537.36',
  };
}

function responseCookie(response: Response): string {
  const setCookie = response.headers.get('set-cookie');
  if (!setCookie) return '';
  return setCookie.split(/,(?=[^;,]+=)/).map((cookie) => cookie.split(';', 1)[0].trim()).filter(Boolean).join('; ');
}

function isDirectVideoUrl(uri: string): boolean {
  return /\.(m3u8|mp4|mpd)(?:$|[?#])/i.test(uri);
}

async function waitForGate(milliseconds: number, signal?: AbortSignal, onGateWait?: (seconds: number) => void): Promise<void> {
  const endAt = Date.now() + milliseconds;
  while (Date.now() < endAt) {
    if (signal?.aborted) throw new Error('Playback was cancelled.');
    const remaining = endAt - Date.now();
    onGateWait?.(Math.ceil(remaining / 1000));
    await new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => {
        signal?.removeEventListener('abort', onAbort);
        resolve();
      }, Math.min(1000, remaining));
      const onAbort = () => {
        clearTimeout(timeout);
        reject(new Error('Playback was cancelled.'));
      };
      signal?.addEventListener('abort', onAbort, { once: true });
    });
  }
}

export async function fetchIdlixPlayback(
  id: string,
  type: IdlixPlaybackType,
  signal?: AbortSignal,
  onGateWait?: (seconds: number) => void,
): Promise<IdlixPlayback> {
  ensureAndroidPlayback();
  if (!id) throw new Error('This title has no playback ID.');

  const playInfoResponse = await fetch(`${IDLIX_BASE_URL}/api/watch/play-info/${type}/${encodeURIComponent(id)}`, {
    headers: requestHeaders(),
    credentials: 'include',
    signal,
  });
  if (!playInfoResponse.ok) throw new Error(`Idlix could not start playback (HTTP ${playInfoResponse.status}).`);
  const playInfo: unknown = await playInfoResponse.json();
  let cookie = responseCookie(playInfoResponse);
  const gateToken = findStringDeep(playInfo, 'gateToken', 'gate_token');
  if (!gateToken) throw new Error('Idlix did not return a playback token for this item.');

  const unlockAt = Number(findStringDeep(playInfo, 'unlockAt', 'unlock_at'));
  const serverNow = Number(findStringDeep(playInfo, 'serverNow', 'server_now'));
  const waitMilliseconds = Number.isFinite(unlockAt) && Number.isFinite(serverNow)
    ? Math.max(0, Math.min(180_000, unlockAt - serverNow))
    : 0;
  if (waitMilliseconds > 0) {
    await waitForGate(waitMilliseconds, signal, onGateWait);
  }

  const claimHeaders = requestHeaders();
  claimHeaders['Content-Type'] = 'application/json';
  if (cookie) claimHeaders.Cookie = cookie;
  const claimResponse = await fetch(`${IDLIX_BASE_URL}/api/watch/session/claim`, {
    method: 'POST',
    headers: claimHeaders,
    credentials: 'include',
    body: JSON.stringify({ gateToken }),
    signal,
  });
  if (!claimResponse.ok) throw new Error(`Idlix could not claim the playback session (HTTP ${claimResponse.status}).`);
  cookie = [cookie, responseCookie(claimResponse)].filter(Boolean).join('; ');
  const claimPayload: unknown = await claimResponse.json();
  const claim = findStringDeep(claimPayload, 'claim');
  const redeemUrl = findStringDeep(claimPayload, 'redeemUrl', 'redeem_url');
  if (!claim || !redeemUrl) throw new Error('Idlix returned an incomplete playback session.');

  let redeemEndpoint: string;
  try {
    redeemEndpoint = new URL(redeemUrl, IDLIX_BASE_URL).toString();
  } catch {
    throw new Error('Idlix returned an invalid playback address.');
  }
  const redeemHeaders = requestHeaders();
  redeemHeaders['Content-Type'] = 'application/json';
  if (cookie) redeemHeaders.Cookie = cookie;
  const redeemResponse = await fetch(redeemEndpoint, {
    method: 'POST',
    headers: redeemHeaders,
    credentials: 'include',
    body: JSON.stringify({ claim }),
    signal,
  });
  if (!redeemResponse.ok) throw new Error(`Idlix could not redeem the playback session (HTTP ${redeemResponse.status}).`);
  const redeemed: unknown = await redeemResponse.json();
  const apiSubtitleSources = collectSubtitleSources([playInfo, claimPayload, redeemed]);
  const iframeUrl = findStringDeep(redeemed, 'url', 'iframeUrl', 'iframe_url');
  if (!iframeUrl) throw new Error('Idlix did not return a video source.');
  const absoluteUrl = new URL(iframeUrl, IDLIX_BASE_URL).toString();
  const sourcePageUrl = `${IDLIX_BASE_URL}/`;

  if (isDirectVideoUrl(absoluteUrl)) {
    return {
      kind: 'video',
      uri: absoluteUrl,
      headers: requestHeaders(sourcePageUrl),
      subtitleSources: apiSubtitleSources,
    };
  }

  const playerHost = new URL(absoluteUrl).hostname;
  const playerResolver = /(?:^|\.)majorplay\.net$/i.test(playerHost) ? resolveMajorplay : resolveJeniusplay;
  const resolvedPlayer = await playerResolver(absoluteUrl, sourcePageUrl, signal).catch(() => null);
  if (resolvedPlayer) {
    const subtitleSources = [...apiSubtitleSources, ...resolvedPlayer.subtitleSources];
    if (resolvedPlayer.videoUrl) {
      return {
        kind: 'video',
        uri: resolvedPlayer.videoUrl,
        headers: requestHeaders(absoluteUrl),
        subtitleSources,
      };
    }
    return { kind: 'embed', uri: absoluteUrl, subtitleSources };
  }

  // Preserve the provider player for its in-player quality and subtitle controls.
  return {
    kind: 'embed',
    uri: absoluteUrl,
    subtitleSources: apiSubtitleSources,
  };
}

export function fetchIdlixTitles(category: IdlixCategory, page = 1, signal?: AbortSignal) {
  const endpoint = category === 'series' ? 'series' : 'movies';
  return fetchTitles(`/api/${endpoint}?page=${page}&limit=36&sort=createdAt`, category, signal);
}

export function searchIdlixTitles(query: string, category: IdlixCategory, signal?: AbortSignal) {
  return fetchTitles(`/api/search?q=${encodeURIComponent(query.trim())}`, category, signal);
}

export async function fetchIdlixDetails(slug: string, category: IdlixCategory, signal?: AbortSignal): Promise<IdlixDetails> {
  if (Platform.OS !== 'android') {
    throw new Error('Idlix direct requests are available in the Android app. The web version needs a server proxy.');
  }
  const endpoint = category === 'series' ? 'series' : 'movies';
  const response = await fetch(`${IDLIX_BASE_URL}/api/${endpoint}/${encodeURIComponent(slug)}`, {
    headers: {
      Accept: 'application/json',
      Referer: `${IDLIX_BASE_URL}/`,
      'User-Agent': 'Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 Chrome/131.0.0.0 Mobile Safari/537.36',
    },
    signal,
  });
  if (!response.ok) throw new Error(`Idlix returned HTTP ${response.status}.`);
  const payload: unknown = await response.json();
  const raw = unwrapObject(payload);
  if (!raw) throw new Error('Idlix returned an unsupported title response.');
  const title = mapTitle(raw, category) ?? {
    id: slug,
    title: firstString(raw, 'title', 'name') || slug.replace(/-/g, ' '),
    slug,
    type: category === 'series' ? 'Series' : 'Movie',
    posterUrl: imageUrl(firstString(raw, 'posterPath', 'poster_path', 'poster', 'image', 'thumbnail')),
    overview: firstString(raw, 'overview', 'description', 'synopsis'),
    url: `${IDLIX_BASE_URL}/${category === 'series' ? 'series' : 'movie'}/${slug}`,
  };
  const episodes = collectEpisodes(isRecord(payload) ? payload : raw, slug);
  const genres = Array.isArray(raw.genres) ? raw.genres.map((genre) => typeof genre === 'string' ? genre : isRecord(genre) ? firstString(genre, 'name', 'title') : '').filter(Boolean) : Array.isArray(raw.genre) ? raw.genre.filter((genre): genre is string => typeof genre === 'string') : [];
  const seasonList = Array.isArray(raw.seasons) ? raw.seasons : Array.isArray(raw.Season) ? raw.Season : [];
  const seasonsValue = seasonList.length || readNumber(raw, 'numberOfSeasons', 'number_of_seasons', 'seasonCount', 'season_count') || Math.max(0, ...episodes.map((episode) => episode.season ?? 0));
  return {
    ...title,
    overview: firstString(raw, 'overview', 'description', 'synopsis') || title.overview,
    status: firstString(raw, 'status') || title.status,
    genres,
    episodes,
    seasons: seasonsValue,
    runtime: firstString(raw, 'runtime', 'duration', 'durationSec'),
    tagline: firstString(raw, 'tagline'),
  };
}

export const DEFAULT_CLOUDSTREAM_REPOSITORY =
  'https://raw.githubusercontent.com/Asm0d3usX/CloudX-V2/refs/heads/builds/repo.json';

export interface CloudstreamRepository {
  name?: string;
  description?: string;
  iconUrl?: string;
  manifestVersion?: number;
  pluginLists?: string[];
}

export interface CloudstreamPlugin {
  name: string;
  internalName?: string;
  description?: string;
  iconUrl?: string;
  language?: string;
  authors?: string[];
  tvTypes?: string[];
  version?: number;
  fileSize?: number;
  url?: string;
  status?: number;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function httpsUrl(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  try {
    const url = new URL(value);
    return url.protocol === 'https:' ? url.toString() : undefined;
  } catch {
    return undefined;
  }
}

async function fetchJson(url: string, signal?: AbortSignal): Promise<unknown> {
  const response = await fetch(url, {
    headers: { Accept: 'application/json' },
    signal,
  });
  if (!response.ok) throw new Error(`Request failed (${response.status}) for ${new URL(url).hostname}.`);
  return response.json();
}

export async function fetchCloudstreamRepository(
  rawUrl: string,
  signal?: AbortSignal,
): Promise<{ repository: CloudstreamRepository; plugins: CloudstreamPlugin[] }> {
  const repoUrl = httpsUrl(rawUrl.trim());
  if (!repoUrl) throw new Error('Enter a valid HTTPS repository URL.');

  const rawRepository = await fetchJson(repoUrl, signal);
  if (!isRecord(rawRepository)) throw new Error('This URL did not return a repository JSON object.');

  const pluginListUrls = Array.isArray(rawRepository.pluginLists)
    ? rawRepository.pluginLists.map(httpsUrl).filter((url): url is string => Boolean(url))
    : [];
  if (!pluginListUrls.length) throw new Error('The repository has no valid HTTPS plugin list URLs.');

  const pluginLists = await Promise.all(pluginListUrls.map((url) => fetchJson(url, signal)));
  const plugins = pluginLists.flatMap((list) => {
    if (!Array.isArray(list)) return [];
    return list.flatMap((entry): CloudstreamPlugin[] => {
      if (!isRecord(entry) || typeof entry.name !== 'string') return [];
      return [{
        name: entry.name,
        internalName: typeof entry.internalName === 'string' ? entry.internalName : undefined,
        description: typeof entry.description === 'string' ? entry.description : undefined,
        iconUrl: httpsUrl(entry.iconUrl),
        language: typeof entry.language === 'string' ? entry.language : undefined,
        authors: Array.isArray(entry.authors) ? entry.authors.filter((author): author is string => typeof author === 'string') : undefined,
        tvTypes: Array.isArray(entry.tvTypes) ? entry.tvTypes.filter((type): type is string => typeof type === 'string') : undefined,
        version: typeof entry.version === 'number' ? entry.version : undefined,
        fileSize: typeof entry.fileSize === 'number' ? entry.fileSize : undefined,
        url: httpsUrl(entry.url),
        status: typeof entry.status === 'number' ? entry.status : undefined,
      }];
    });
  });

  return {
    repository: {
      name: typeof rawRepository.name === 'string' ? rawRepository.name : 'CloudStream repository',
      description: typeof rawRepository.description === 'string' ? rawRepository.description : undefined,
      iconUrl: httpsUrl(rawRepository.iconUrl),
      manifestVersion: typeof rawRepository.manifestVersion === 'number' ? rawRepository.manifestVersion : undefined,
      pluginLists: pluginListUrls,
    },
    plugins,
  };
}

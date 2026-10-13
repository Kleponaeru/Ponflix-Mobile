import { Image } from 'expo-image';
import { router, useLocalSearchParams } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, StatusBar, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { WebView } from 'react-native-webview';

import { AppRefreshScrollView } from '@/components/app-refresh-scroll-view';
import { KeepScreenAwake } from '@/components/keep-screen-awake';
import { PonflixTheme } from '@/constants/theme';
import { fetchIdlixDetails, fetchIdlixPlayback, IDLIX_BASE_URL, type IdlixDetails, type IdlixEpisode, type IdlixPlayback, type IdlixPlaybackType } from '@/features/movies/api/idlix-service';
import { IdlixVideoPlayer } from '@/features/movies/components/idlix-video-player';

const { colors, fonts } = PonflixTheme;

const MAJORPLAY_TRACK_PROBE = `(() => {
  const post = (value) => {
    try { window.ReactNativeWebView.postMessage(JSON.stringify(value)); } catch (_) {}
  };
  post({ type: 'ponflix-majorplay-probe-started', pageTitle: document.title || '', readyState: document.readyState });
  const state = window.__ponflixProbeState || { timer: false, last: '', config: '' };
  window.__ponflixProbeState = state;
  const inspectConfig = (configUrl) => {
    if (!/\\.json(?:$|[?#])/i.test(configUrl) || state.config === configUrl) return;
    state.config = configUrl;
    post({ type: 'ponflix-majorplay-config-started' });
    fetch(configUrl, { credentials: 'include' }).then(async (response) => {
      const text = await response.text();
      let data = null;
      let parseOk = false;
      try {
        data = JSON.parse(text);
        parseOk = true;
        if (typeof data === 'string') {
          try { data = JSON.parse(data); } catch (_) {}
        }
      } catch (_) {}
      const media = new Set();
      const subtitles = new Map();
      const contentType = response.headers.get('content-type') || '';
      const isHls = /mpegurl/i.test(contentType) || text.trimStart().startsWith('#EXTM3U');
      if (isHls) {
        const lines = text.split(String.fromCharCode(10)).map((line) => line.trim());
        lines.forEach((line) => {
          if (!line.startsWith('#EXT-X-MEDIA:')) return;
          const attributes = {};
          for (const match of line.slice('#EXT-X-MEDIA:'.length).matchAll(/([A-Z0-9-]+)=("[^"]*"|[^,]*)/g)) {
            const raw = match[2].trim();
            attributes[match[1]] = raw.startsWith('"') && raw.endsWith('"') ? raw.slice(1, -1) : raw;
          }
          if (attributes.TYPE !== 'SUBTITLES' || !attributes.URI) return;
          try {
            const uri = new URL(attributes.URI, configUrl).toString();
            const language = attributes.LANGUAGE || '';
            const label = attributes.NAME || language || 'Subtitle';
            subtitles.set(uri, { uri, label, language });
          } catch (_) {}
        });
        media.add(configUrl);
      }
      const walk = (value, key = '', label = 'Subtitle') => {
        if (typeof value === 'string') {
          try {
            const uri = new URL(value, configUrl).toString();
            if (/\\.(?:m3u8|mp4|mpd)(?:$|[?#])/i.test(uri)) media.add(uri);
            if (/\\.(?:vtt|srt|ass|ssa|ttml|dfxp|xml)(?:$|[?#])/i.test(uri)) subtitles.set(uri, { uri, label });
          } catch (_) {}
          return;
        }
        if (!value || typeof value !== 'object') return;
        if (Array.isArray(value)) { value.forEach((item) => walk(item, key, label)); return; }
        const itemLabel = value.label || value.name || value.language || value.lang || label;
        Object.keys(value).forEach((childKey) => walk(value[childKey], childKey, String(itemLabel)));
      };
      if (data) walk(data);
      const preview = text.slice(0, 260)
        .replace(/https?:[/][/][^\\s"'<>]+/g, (url) => url.split('?')[0] + '?[redacted]')
        .replace(/[A-Za-z0-9_-]{32,}/g, '[redacted]')
        .replace(/\\s+/g, ' ');
      post({ type: 'ponflix-majorplay-config', status: response.status,
        contentType, isHls, textLength: text.length,
        parseOk, jsonType: data === null ? 'unparsed' : Array.isArray(data) ? 'array' : typeof data,
        keys: data && typeof data === 'object' ? Object.keys(data).slice(0, 20) : [],
        containsMedia: /m3u8|\.mp4|\.mpd/i.test(text), containsSubtitles: /subtitle|caption|\.vtt|\.srt/i.test(text), preview,
        mediaUrls: Array.from(media).slice(0, 5), subtitles: Array.from(subtitles.values()).slice(0, 12) });
    }).catch((error) => post({ type: 'ponflix-majorplay-config-error', message: String(error) }));
  };
  const scan = () => {
    try {
      const video = document.querySelector('video');
      const source = video ? (video.currentSrc || video.src || video.querySelector('source')?.src || '') : '';
      if (source) inspectConfig(source);
      const elements = video ? Array.from(video.querySelectorAll('track')) : [];
      const subtitles = elements.map((element, index) => ({
        uri: element.src || '', kind: element.kind || '',
        label: element.label || element.srclang || 'Subtitle ' + (index + 1), language: element.srclang || ''
      })).filter((track) => track.uri && (!track.kind || track.kind === 'subtitles' || track.kind === 'captions'));
      const textTracks = video && video.textTracks ? Array.from(video.textTracks).map((track) => ({
        kind: track.kind || '', label: track.label || '', language: track.language || '', mode: track.mode || ''
      })) : [];
      const subtitleResources = Array.from(performance.getEntriesByType('resource')).flatMap((entry) => {
        const name = entry.name || '';
        const lower = name.toLowerCase();
        if (!['subtitle', 'caption', '.vtt', '.srt', '.ass', '.ttml', '.dfxp'].some((part) => lower.includes(part))) return [];
        try {
          const url = new URL(name);
          const extension = /\.([a-z0-9]+)$/i.exec(url.pathname)?.[1]?.toLowerCase() || '';
          return [{ host: url.hostname, extension, pathDepth: url.pathname.split('/').filter(Boolean).length }];
        } catch (_) { return []; }
      }).slice(0, 12);
      const frames = Array.from(document.querySelectorAll('iframe')).slice(0, 4).map((frame) => {
        try { const url = new URL(frame.src, document.location.href); return url.hostname + url.pathname; } catch (_) { return 'unreadable-frame-url'; }
      });
      const result = { type: 'ponflix-majorplay-tracks', source, subtitles, textTracks, subtitleResources, trackElementCount: elements.length, frames,
        hasVideo: Boolean(video), pageTitle: (document.title || '').slice(0, 100),
        scriptCount: document.scripts.length, readyState: document.readyState };
      const serialized = JSON.stringify(result);
      if (serialized !== state.last) { state.last = serialized; post(result); }
    } catch (error) { post({ type: 'ponflix-majorplay-probe-error', message: String(error) }); }
  };
  scan();
  if (!state.timer) { state.timer = true; window.setInterval(scan, 1500); }
  post({ type: 'ponflix-majorplay-probe-complete-v6' });
})(); true;`;

export default function IdlixWatchScreen() {
  const params = useLocalSearchParams<{ id?: string | string[]; title?: string | string[]; type?: string | string[]; detailSlug?: string | string[]; seriesSlug?: string | string[] }>();
  const routeId = Array.isArray(params.id) ? params.id[0] : params.id;
  const routeTitle = Array.isArray(params.title) ? params.title[0] : params.title || 'Idlix playback';
  const detailSlug = Array.isArray(params.detailSlug) ? params.detailSlug[0] : params.detailSlug;
  const seriesSlug = Array.isArray(params.seriesSlug) ? params.seriesSlug[0] : params.seriesSlug;
  const type: IdlixPlaybackType = params.type === 'movie' ? 'movie' : 'episode';
  const [currentId, setCurrentId] = useState(routeId);
  const [currentTitle, setCurrentTitle] = useState(routeTitle);
  const [playback, setPlayback] = useState<IdlixPlayback | null>(null);
  const [titleDetails, setTitleDetails] = useState<IdlixDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [detailsLoading, setDetailsLoading] = useState(Boolean(detailSlug));
  const [gateWait, setGateWait] = useState(0);
  const [error, setError] = useState('');
  const [reloadKey, setReloadKey] = useState(0);
  const majorplayWebViewRef = useRef<WebView>(null);
  const isLoading = Boolean(currentId) && loading;
  const visibleError = currentId ? error : 'This item has no playback ID.';
  const episodes = titleDetails?.episodes ?? [];
  const episodesLoading = detailsLoading;
  const currentEpisodeIndex = episodes.findIndex((episode) => episode.id === currentId);
  const currentEpisode = currentEpisodeIndex >= 0 ? episodes[currentEpisodeIndex] : undefined;
  const routeEpisodeNumber = /\b(?:episode|ep)\s*#?(\d+)\b/i.exec(currentTitle)?.[1];
  const episodeNumber = currentEpisode?.number ?? (currentEpisodeIndex >= 0 ? currentEpisodeIndex + 1 : undefined) ?? (routeEpisodeNumber ? Number(routeEpisodeNumber) : undefined);
  const fullscreenEpisodeLabel = type === 'episode'
    ? [currentEpisode?.season ? `Season ${currentEpisode.season}` : null, episodeNumber ? `Episode ${episodeNumber}` : currentEpisode?.title || currentTitle].filter(Boolean).join(' · ')
    : undefined;
  const nextEpisode = currentEpisodeIndex >= 0 ? episodes[currentEpisodeIndex + 1] : undefined;

  useEffect(() => {
    if (!detailSlug) return;
    const controller = new AbortController();
    fetchIdlixDetails(detailSlug, type === 'movie' ? 'movie' : 'series', controller.signal).then((details) => {
      if (!controller.signal.aborted) setTitleDetails(details);
    }).catch(() => {
      if (!controller.signal.aborted) setTitleDetails(null);
    }).finally(() => {
      if (!controller.signal.aborted) setDetailsLoading(false);
    });
    return () => controller.abort();
  }, [detailSlug, type]);

  useEffect(() => {
    if (!currentId) return;
    const controller = new AbortController();
    fetchIdlixPlayback(currentId, type, controller.signal, setGateWait).then((result) => {
      if (!controller.signal.aborted) setPlayback(result);
    }).catch((reason: unknown) => {
      if (!controller.signal.aborted) setError(reason instanceof Error ? reason.message : 'Idlix could not resolve this video.');
    }).finally(() => {
      if (!controller.signal.aborted) setLoading(false);
      if (!controller.signal.aborted) setRefreshing(false);
    });
    return () => controller.abort();
  }, [currentId, type, reloadKey]);

  const retry = () => {
    setGateWait(0);
    setError('');
    setPlayback(null);
    setLoading(true);
    setReloadKey((value) => value + 1);
  };

  const refresh = () => {
    setRefreshing(true);
    setGateWait(0);
    setError('');
    setPlayback(null);
    setLoading(true);
    setReloadKey((value) => value + 1);
  };

  const selectEpisode = (episode: IdlixEpisode) => {
    if (episode.id === currentId) return;
    setCurrentId(episode.id);
    setCurrentTitle(episode.title);
    setPlayback(null);
    setError('');
    setGateWait(0);
    setLoading(true);
  };

  return (
    <View style={styles.screen}>
      <StatusBar barStyle="light-content" backgroundColor="#000" />
      <SafeAreaView edges={['top']} style={styles.safeArea}>
        <View style={styles.topBar}>
          <Pressable accessibilityRole="button" accessibilityLabel="Back to title" onPress={() => router.back()} style={styles.backButton}>
            <SymbolView name={{ ios: 'chevron.left', android: 'arrow_back', web: 'arrow_back' }} size={19} tintColor="#FFF" />
          </Pressable>
          <View style={styles.heading}>
            <Text style={styles.kicker}>PONFLIX PLAYER</Text>
            <Text numberOfLines={1} style={styles.title}>{currentTitle}</Text>
          </View>
        </View>

        <AppRefreshScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          refreshing={refreshing}
          onRefresh={refresh}
        >
          {playback?.kind === 'embed' ? <KeepScreenAwake /> : null}
          {playback?.kind === 'video' ? <IdlixVideoPlayer key={currentId} uri={playback.uri} headers={playback.headers} title={titleDetails?.title || (type === 'movie' ? currentTitle : routeTitle)} episodeLabel={fullscreenEpisodeLabel} contentType={playback.contentType} subtitleSources={playback.subtitleSources} /> : playback?.kind === 'embed' ? (
            <>
              <View style={styles.playerFrame}>
                <WebView
                  key={currentId}
                  ref={majorplayWebViewRef}
                  source={{ uri: playback.uri, headers: { Referer: `${IDLIX_BASE_URL}/` } }}
                  style={styles.embed}
                  originWhitelist={['https://*']}
                  javaScriptEnabled
                  domStorageEnabled
                  injectedJavaScript={/majorplay\.net$/i.test(new URL(playback.uri).hostname) ? MAJORPLAY_TRACK_PROBE : undefined}
                  onLoadEnd={() => {
                    if (!/majorplay\.net$/i.test(new URL(playback.uri).hostname)) return;
                    setTimeout(() => {
                      majorplayWebViewRef.current?.injectJavaScript("window.ReactNativeWebView?.postMessage(JSON.stringify({ type: 'ponflix-majorplay-probe-ping-v6' })); true;");
                      majorplayWebViewRef.current?.injectJavaScript(MAJORPLAY_TRACK_PROBE);
                    }, 300);
                  }}
                  onMessage={(event) => {
                    try {
                      const rawMessage = event.nativeEvent.data;
                      const payload = JSON.parse(rawMessage) as {
                        type?: string;
                        source?: string;
                        isHls?: boolean;
                        mediaUrls?: string[];
                        subtitles?: Array<{ uri?: string; kind?: string; label?: string; language?: string }>;
                      };
                      if (payload.type === 'ponflix-majorplay-config') {
                        const stream = payload.mediaUrls?.[0];
                        const manifestSubtitleTracks = payload.subtitles ?? [];
                        const inheritedSubtitleSources = playback.kind === 'embed' ? playback.subtitleSources ?? [] : [];
                        const discoveredSubtitleSources = (payload.isHls ? [] : manifestSubtitleTracks)
                          .filter((track) => typeof track.uri === 'string' && /^https?:\/\//i.test(track.uri))
                          .map((track) => ({ uri: track.uri!, label: track.label || 'Subtitle', language: track.language, referer: playback.uri }));
                        const subtitleSources = [...new Map(
                          [...inheritedSubtitleSources, ...discoveredSubtitleSources].map((track) => [track.uri, track]),
                        ).values()];
                        if (!stream) {
                          return;
                        }
                        let origin = '';
                        try { origin = new URL(playback.uri).origin; } catch { return; }
                        setPlayback({
                          kind: 'video', uri: stream, contentType: payload.isHls ? 'hls' : undefined,
                          headers: {
                            Accept: 'application/json, text/plain, */*', Origin: origin, Referer: playback.uri,
                            'User-Agent': 'Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 Chrome/131.0.0.0 Mobile Safari/537.36',
                          },
                          subtitleSources,
                        });
                        return;
                      }
                      if (payload.type !== 'ponflix-majorplay-tracks') return;
                      if (!payload.source && !payload.subtitles?.length) {
                        return;
                      }
                      const subtitleSources = (payload.subtitles ?? [])
                        .filter((track) => typeof track.uri === 'string' && /^https?:\/\//i.test(track.uri))
                        .map((track) => ({ uri: track.uri!, label: track.label || 'Subtitle', language: track.language, referer: playback.uri }));
                      const source = payload.source ?? '';
                      if (!/^https?:\/\//i.test(source) || !/(?:\.m3u8|\.mp4|\.mpd|playlist|master)(?:$|[?#])/i.test(source)) {
                        return;
                      }
                      let origin = '';
                      try { origin = new URL(playback.uri).origin; } catch { return; }
                      setPlayback({
                        kind: 'video',
                        uri: source,
                        headers: {
                          Accept: 'application/json, text/plain, */*',
                          Origin: origin,
                          Referer: playback.uri,
                          'User-Agent': 'Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 Chrome/131.0.0.0 Mobile Safari/537.36',
                        },
                        subtitleSources,
                      });
                    } catch {
                      // Ignore page messages that are not the Majorplay track probe.
                    }
                  }}
                  allowsFullscreenVideo
                  allowsInlineMediaPlayback
                  mediaPlaybackRequiresUserAction={false}
                  onError={() => { setPlayback(null); setError('The source player could not be loaded.'); }}
                  onHttpError={() => { setPlayback(null); setError('The source player returned an HTTP error.'); }}
                  setSupportMultipleWindows={false}
                />
              </View>
            </>
          ) : isLoading ? (
            <View style={styles.state}>
              <ActivityIndicator color={colors.accent} size="large" />
              <Text style={styles.stateTitle}>{gateWait ? `Waiting for Idlix: ${gateWait}s` : 'Preparing video…'}</Text>
              <Text style={styles.stateBody}>Connecting to the video source.</Text>
            </View>
          ) : (
            <View style={styles.state}>
              <View style={styles.errorIcon}><SymbolView name={{ ios: 'exclamationmark.triangle.fill', android: 'warning', web: 'warning' }} size={22} tintColor={colors.accentSoft} /></View>
              <Text style={styles.stateTitle}>Couldn’t start playback</Text>
              <Text style={styles.stateBody}>{visibleError || 'Idlix did not return a playable source.'}</Text>
              <Pressable accessibilityRole="button" onPress={retry} style={styles.retryButton}><Text style={styles.retryText}>Try again</Text></Pressable>
            </View>
          )}

          <View style={styles.detailsSection}>
            <View style={styles.detailsTop}>
              {titleDetails?.posterUrl ? <Image source={{ uri: titleDetails.posterUrl }} contentFit="cover" cachePolicy="memory-disk" style={styles.detailsPoster} /> : null}
              <View style={styles.detailsHeading}>
                <Text style={styles.detailsKicker}>{type === 'movie' ? 'NOW PLAYING · MOVIE' : 'NOW PLAYING · SERIES'}</Text>
                <Text style={styles.detailsTitle}>{titleDetails?.title || (type === 'movie' ? currentTitle : 'Series details')}</Text>
                {type === 'episode' ? <Text numberOfLines={2} style={styles.currentEpisodeTitle}>{currentTitle}</Text> : null}
                <View style={styles.detailsMetaRow}>
                  {titleDetails?.year ? <MetaPill label={titleDetails.year} /> : null}
                  {titleDetails?.runtime ? <MetaPill label={titleDetails.runtime} /> : null}
                  {titleDetails?.status ? <MetaPill label={titleDetails.status} /> : null}
                  {type === 'episode' && titleDetails?.seasons ? <MetaPill label={`${titleDetails.seasons} seasons`} /> : null}
                </View>
              </View>
            </View>
            {titleDetails?.genres.length ? (
              <View style={styles.detailsGenres}>
                {titleDetails.genres.map((genre) => <Text key={genre} style={styles.detailsGenre}>{genre}</Text>)}
              </View>
            ) : null}
            {titleDetails?.overview ? <Text style={styles.detailsOverview}>{titleDetails.overview}</Text> : null}
          </View>

          {type === 'episode' && seriesSlug ? (
            <View style={styles.episodeSection}>
              <View style={styles.episodeHeader}>
                <View style={styles.episodeHeading}>
                  <Text style={styles.episodeSectionTitle}>Episodes</Text>
                  <Text style={styles.episodeCount}>{episodes.length}</Text>
                </View>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={nextEpisode ? `Play next episode: ${nextEpisode.title}` : 'No next episode'}
                  accessibilityState={{ disabled: !nextEpisode }}
                  disabled={!nextEpisode}
                  onPress={() => nextEpisode && selectEpisode(nextEpisode)}
                  style={({ pressed }) => [styles.nextButton, !nextEpisode && styles.nextButtonDisabled, pressed && nextEpisode && styles.pressed]}
                >
                  <Text style={[styles.nextButtonText, !nextEpisode && styles.nextButtonTextDisabled]}>Next Episode</Text>
                  <SymbolView name={{ ios: 'forward.end.fill', android: 'skip_next', web: 'skip_next' }} size={16} tintColor={nextEpisode ? '#FFF' : 'rgba(255,255,255,0.34)'} />
                </Pressable>
              </View>

              {episodesLoading ? (
                <View style={styles.episodesLoading}><ActivityIndicator color={colors.accent} size="small" /><Text style={styles.stateBody}>Loading episodes…</Text></View>
              ) : episodes.length ? episodes.map((episode, index) => {
                const active = episode.id === currentId;
                return (
                  <Pressable
                    key={`${episode.id}-${index}`}
                    accessibilityRole="button"
                    accessibilityState={{ selected: active }}
                    accessibilityLabel={`${active ? 'Now playing' : 'Play'} ${episode.title}`}
                    onPress={() => selectEpisode(episode)}
                    style={({ pressed }) => [styles.episodeRow, active && styles.activeEpisode, pressed && styles.pressed]}
                  >
                    <View style={[styles.episodeNumber, active && styles.activeEpisodeNumber]}>
                      {active ? <SymbolView name={{ ios: 'speaker.wave.2.fill', android: 'volume_up', web: 'volume_up' }} size={15} tintColor={colors.accentSoft} /> : <Text style={styles.episodeNumberText}>{String(episode.number || index + 1).padStart(2, '0')}</Text>}
                    </View>
                    <View style={styles.episodeCopy}>
                      <Text numberOfLines={1} style={[styles.episodeTitle, active && styles.activeEpisodeTitle]}>{episode.title}</Text>
                      {episode.season ? <Text style={styles.episodeMeta}>Season {episode.season} · Episode {episode.number}</Text> : <Text style={styles.episodeMeta}>Episode {episode.number || index + 1}</Text>}
                    </View>
                    {active ? <Text style={styles.nowPlaying}>NOW PLAYING</Text> : <SymbolView name={{ ios: 'play.fill', android: 'play_arrow', web: 'play_arrow' }} size={18} tintColor="rgba(255,255,255,0.5)" />}
                  </Pressable>
                );
              }) : <Text style={styles.emptyEpisodes}>No episodes were returned for this series.</Text>}
            </View>
          ) : null}
        </AppRefreshScrollView>
      </SafeAreaView>
    </View>
  );
}

function MetaPill({ label }: { label: string }) {
  return <View style={styles.metaPill}><Text style={styles.metaText}>{label}</Text></View>;
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#000' },
  safeArea: { flex: 1 },
  topBar: { minHeight: 58, flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16 },
  backButton: { width: 36, height: 36, borderRadius: 9, backgroundColor: 'rgba(255,255,255,0.09)', alignItems: 'center', justifyContent: 'center' },
  heading: { flex: 1, gap: 3 },
  kicker: { color: '#FF858E', fontFamily: fonts.bold, fontSize: 9, letterSpacing: 1.4 },
  title: { color: '#FFF', fontFamily: fonts.semibold, fontSize: 13 },
  scroll: { flex: 1 },
  scrollContent: { paddingBottom: 26 },
  playerFrame: { width: '100%', aspectRatio: 16 / 9, backgroundColor: '#000' },
  embed: { flex: 1, backgroundColor: '#000' },
  detailsSection: { paddingHorizontal: 18, paddingTop: 20, paddingBottom: 4, gap: 12 },
  detailsTop: { flexDirection: 'row', alignItems: 'flex-start', gap: 13 },
  detailsPoster: { width: 68, height: 100, borderRadius: 8, backgroundColor: '#171717' },
  detailsHeading: { flex: 1, gap: 6 },
  detailsKicker: { color: colors.accentSoft, fontFamily: fonts.bold, fontSize: 8, letterSpacing: 1.1 },
  detailsTitle: { color: '#FFF', fontFamily: fonts.extraBold, fontSize: 19, lineHeight: 24 },
  currentEpisodeTitle: { color: 'rgba(255,255,255,0.68)', fontFamily: fonts.medium, fontSize: 11, lineHeight: 16 },
  detailsMetaRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 1 },
  metaPill: { paddingHorizontal: 7, paddingVertical: 4, borderRadius: 5, backgroundColor: 'rgba(255,255,255,0.09)' },
  metaText: { color: 'rgba(255,255,255,0.72)', fontFamily: fonts.semibold, fontSize: 9 },
  detailsGenres: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  detailsGenre: { color: 'rgba(255,255,255,0.58)', fontFamily: fonts.medium, fontSize: 9, paddingHorizontal: 8, paddingVertical: 5, borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)', borderRadius: 12 },
  detailsOverview: { color: 'rgba(255,255,255,0.66)', fontFamily: fonts.regular, fontSize: 11, lineHeight: 18 },
  state: { width: '100%', aspectRatio: 16 / 9, alignItems: 'center', justifyContent: 'center', padding: 22, gap: 8, backgroundColor: '#080808' },
  stateTitle: { color: '#FFF', fontFamily: fonts.bold, fontSize: 15, textAlign: 'center' },
  stateBody: { color: 'rgba(255,255,255,0.55)', fontFamily: fonts.regular, fontSize: 11, lineHeight: 17, textAlign: 'center' },
  errorIcon: { width: 42, height: 42, alignItems: 'center', justifyContent: 'center', borderRadius: 21, backgroundColor: 'rgba(229,9,20,0.16)', marginBottom: 3 },
  retryButton: { minHeight: 36, marginTop: 3, paddingHorizontal: 18, borderRadius: 8, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.accent },
  retryText: { color: '#FFF', fontFamily: fonts.bold, fontSize: 12 },
  episodeSection: { paddingHorizontal: 16, paddingTop: 20 },
  episodeHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 9 },
  episodeHeading: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  episodeSectionTitle: { color: '#FFF', fontFamily: fonts.bold, fontSize: 17 },
  episodeCount: { color: 'rgba(255,255,255,0.48)', fontFamily: fonts.medium, fontSize: 11 },
  nextButton: { minHeight: 36, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5, paddingHorizontal: 11, borderRadius: 8, backgroundColor: colors.accent },
  nextButtonDisabled: { backgroundColor: 'rgba(255,255,255,0.08)' },
  nextButtonText: { color: '#FFF', fontFamily: fonts.semibold, fontSize: 10 },
  nextButtonTextDisabled: { color: 'rgba(255,255,255,0.34)' },
  episodesLoading: { minHeight: 82, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10 },
  episodeRow: { minHeight: 66, flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 9, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.07)', borderRadius: 8 },
  activeEpisode: { backgroundColor: 'rgba(229,9,20,0.1)' },
  pressed: { opacity: 0.68 },
  episodeNumber: { width: 38, height: 38, borderRadius: 8, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.08)' },
  activeEpisodeNumber: { backgroundColor: 'rgba(229,9,20,0.18)' },
  episodeNumberText: { color: 'rgba(255,255,255,0.65)', fontFamily: fonts.bold, fontSize: 11 },
  episodeCopy: { flex: 1, gap: 4 },
  episodeTitle: { color: '#FFF', fontFamily: fonts.semibold, fontSize: 12 },
  activeEpisodeTitle: { color: colors.accentSoft },
  episodeMeta: { color: 'rgba(255,255,255,0.43)', fontFamily: fonts.regular, fontSize: 10 },
  nowPlaying: { color: colors.accentSoft, fontFamily: fonts.bold, fontSize: 8, letterSpacing: 0.5 },
  emptyEpisodes: { color: 'rgba(255,255,255,0.54)', fontFamily: fonts.regular, fontSize: 11, paddingVertical: 20 },
});

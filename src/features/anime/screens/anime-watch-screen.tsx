import { SymbolView } from 'expo-symbols';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StatusBar, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { PonflixTheme } from '@/constants/theme';
import { AppRefreshFlatList } from '@/components/app-refresh-flat-list';
import { useLibrary } from '@/features/library/context/library-context';
import { AnimeStreamPlayer } from '@/features/anime/components/anime-stream-player';
import { fetchAnimeEpisodes, fetchEpisodePlayback } from '@/features/anime/api/anime-service';
import type { AnimeEpisode, AnimePlayback, AnimeServer } from '@/features/anime/types/anime';

const { colors, fonts } = PonflixTheme;
type AudioMode = 'sub' | 'dub';

function safeHttpsUrl(value?: string | null) {
  if (!value) return '';
  try {
    const url = new URL(value);
    return url.protocol === 'https:' ? url.toString() : '';
  } catch {
    return '';
  }
}

function serverMode(server: AnimeServer): AudioMode {
  const value = [server.name, server.value, server.quality].filter(Boolean).join(' ');
  return /(^|[\s,/_-])dub($|[\s,/_-])/i.test(value) ? 'dub' : 'sub';
}

export default function AnimeWatchScreen() {
  const params = useLocalSearchParams<{ slug?: string | string[]; episodeSlug?: string | string[] }>();
  const slug = Array.isArray(params.slug) ? params.slug[0] : params.slug;
  const episodeSlug = Array.isArray(params.episodeSlug) ? params.episodeSlug[0] : params.episodeSlug;
  return <AnimeWatchContent key={(slug || '') + ':' + (episodeSlug || '')} slug={slug} episodeSlug={episodeSlug} />;
}

function AnimeWatchContent({ slug, episodeSlug }: { slug?: string; episodeSlug?: string }) {
  const { recordProgress } = useLibrary();
  const [playback, setPlayback] = useState<AnimePlayback | null>(null);
  const [episodes, setEpisodes] = useState<AnimeEpisode[]>([]);
  const [selectedServer, setSelectedServer] = useState('');
  const [audioMode, setAudioMode] = useState<AudioMode>('sub');
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [episodesLoading, setEpisodesLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [episodesError, setEpisodesError] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    if (!episodeSlug) return;
    const controller = new AbortController();
    fetchEpisodePlayback(episodeSlug, controller.signal)
      .then((result) => {
        setPlayback(result);
        const initial = result.servers?.find((server) => serverMode(server) === 'sub')?.url || result.iframe || '';
        setSelectedServer(initial);
        if (slug && episodeSlug) {
          recordProgress({
            type: 'anime',
            id: slug,
            subtitle: result.title,
            route: `/anime/${slug}/episode/${episodeSlug}`,
          });
        }
      })
      .catch((cause: unknown) => {
        if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : 'The player could not be loaded.');
      })
      .finally(() => {
        if (!controller.signal.aborted) {
          setLoading(false);
          setRefreshing(false);
        }
      });
    return () => controller.abort();
  }, [episodeSlug, recordProgress, reloadKey, slug]);

  useEffect(() => {
    if (!slug) return;
    const controller = new AbortController();
    fetchAnimeEpisodes(slug, controller.signal)
      .then(setEpisodes)
      .catch(() => { if (!controller.signal.aborted) setEpisodesError(true); })
      .finally(() => {
        if (!controller.signal.aborted) setEpisodesLoading(false);
      });
    return () => controller.abort();
  }, [slug, reloadKey]);

  const playerUrl = useMemo(() => safeHttpsUrl(selectedServer || playback?.iframe), [playback?.iframe, selectedServer]);
  const availableServers = useMemo(() => (playback?.servers || []).map((server, index) => ({ server, index })).filter(({ server }) => serverMode(server) === audioMode), [audioMode, playback?.servers]);
  const filteredEpisodes = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase();
    return normalized ? episodes.filter((episode) => (episode.title + ' ' + episode.number).toLocaleLowerCase().includes(normalized)) : episodes;
  }, [episodes, query]);
  const currentIndex = episodes.findIndex((episode) => episode.slug === episodeSlug);
  const nextEpisode = currentIndex >= 0 ? episodes[currentIndex + 1] : undefined;

  const selectAudioMode = (mode: AudioMode) => {
    setAudioMode(mode);
    const next = playback?.servers?.find((server) => serverMode(server) === mode)?.url || '';
    if (next) {
      setSelectedServer(next);
    }
  };

  const play = (episode: AnimeEpisode) => {
    if (!slug) return;
    recordProgress({
      type: 'anime',
      id: slug,
      subtitle: episode.title,
      route: `/anime/${slug}/episode/${episode.slug}`,
    });
    router.replace({ pathname: '/anime/[slug]/episode/[episodeSlug]', params: { slug, episodeSlug: episode.slug } });
  };

  const refresh = () => {
    if (refreshing) return;
    setRefreshing(true);
    setLoading(true);
    setEpisodesLoading(true);
    setError('');
    setEpisodesError(false);
    setReloadKey((key) => key + 1);
  };

  const listHeader = (
    <View>
      <View style={styles.topBar}>
        <Pressable accessibilityRole="button" accessibilityLabel="Back to series details" onPress={() => router.back()} style={styles.iconButton}>
          <SymbolView name={{ ios: 'chevron.left', android: 'arrow_back', web: 'arrow_back' }} size={20} tintColor="#FFF" />
        </Pressable>
        <View style={styles.topTitle}>
          <Text style={styles.topEyebrow}>NOW PLAYING</Text>
          <Text numberOfLines={1} style={styles.topEpisode}>{playback?.title || episodeSlug?.replace(/-/g, ' ')}</Text>
        </View>
        <Pressable accessibilityRole="button" accessibilityLabel="Reload stream" onPress={refresh} style={styles.iconButton}>
          <SymbolView name={{ ios: 'arrow.clockwise', android: 'refresh', web: 'refresh' }} size={18} tintColor="#FFF" />
        </Pressable>
      </View>

      <View style={styles.playerFrame}>
        {loading ? (
          <View style={styles.playerMessage}><ActivityIndicator color={colors.accent} size="large" /><Text style={styles.playerMessageText}>Connecting to stream…</Text></View>
        ) : error || playback?.playbackAvailable === false || !playerUrl ? (
          <View style={styles.playerMessage}>
            <SymbolView name={{ ios: 'play.rectangle', android: 'live_tv', web: 'live_tv' }} size={35} tintColor="rgba(255,255,255,0.5)" />
            <Text style={styles.playerErrorTitle}>Stream unavailable</Text>
            <Text style={styles.playerMessageText}>{error || 'There is no playable source for this episode.'}</Text>
            <Pressable onPress={refresh} style={styles.retryButton}><Text style={styles.retryText}>Try again</Text></Pressable>
          </View>
        ) : (
          <AnimeStreamPlayer
            key={playerUrl}
            uri={playerUrl}
            onError={() => setError('This stream server did not respond.')}
          />
        )}
      </View>
      <Text style={styles.playerHint}>If playback doesn’t start, choose another server.</Text>

      <View style={styles.serverSection}>
        <View style={styles.serverHeading}>
          <View><Text style={styles.sectionEyebrow}>PLAYBACK OPTIONS</Text><Text style={styles.sectionTitle}>Stream settings</Text></View>
          {playback?.sourceStatus ? <Text style={styles.sourceStatus}>{playback.sourceStatus === 'ok' ? '● LIVE' : playback.sourceStatus.toUpperCase()}</Text> : null}
        </View>
        {playback?.servers?.length ? (
          <>
            <View style={styles.modeRow}>
              {(['sub', 'dub'] as const).map((mode) => {
                const selected = audioMode === mode;
                const available = playback.servers?.some((server) => serverMode(server) === mode);
                return (
                  <Pressable key={mode} disabled={!available} onPress={() => selectAudioMode(mode)} style={[styles.modeButton, selected && styles.modeSelected, !available && styles.disabled]}>
                    <Text style={[styles.modeText, selected && styles.modeTextSelected]}>{mode === 'sub' ? 'Sub' : 'Dub'}{!available ? ' · unavailable' : ''}</Text>
                  </Pressable>
                );
              })}
            </View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.serverRow}>
              {availableServers.map(({ server, index }) => {
                const selected = selectedServer === server.url;
                return (
                  <Pressable key={server.value + server.url + index} onPress={() => { setSelectedServer(server.url); setError(''); }} style={[styles.serverButton, selected && styles.serverSelected]}>
                    <Text numberOfLines={1} style={[styles.serverText, selected && styles.serverTextSelected]}>{server.name || server.quality || 'Server ' + (index + 1)}</Text>
                  </Pressable>
                );
              })}
            </ScrollView>
          </>
        ) : <Text style={styles.playerHint}>The source provides one stream server for this episode.</Text>}
      </View>

      {nextEpisode ? (
        <Pressable accessibilityRole="button" onPress={() => play(nextEpisode)} style={styles.nextCard}>
          <View style={styles.nextCopy}><Text style={styles.nextEyebrow}>UP NEXT</Text><Text numberOfLines={1} style={styles.nextTitle}>{nextEpisode.title}</Text></View>
          <View style={styles.nextButton}><Text style={styles.nextButtonText}>Play next</Text><SymbolView name={{ ios: 'chevron.right', android: 'chevron_right', web: 'chevron_right' }} size={16} tintColor="#111216" /></View>
        </Pressable>
      ) : null}

      <View style={styles.episodesHeader}>
        <View><Text style={styles.sectionEyebrow}>KEEP WATCHING</Text><Text style={styles.sectionTitle}>Episodes</Text></View>
        {episodes.length ? <Text style={styles.episodeCount}>{episodes.length} episodes</Text> : null}
      </View>
      <View style={styles.episodeSearch}>
        <SymbolView name={{ ios: 'magnifyingglass', android: 'search', web: 'search' }} size={17} tintColor="rgba(255,255,255,0.45)" />
        <TextInput accessibilityLabel="Search episodes" value={query} onChangeText={setQuery} placeholder="Search episodes" placeholderTextColor="rgba(255,255,255,0.35)" style={styles.searchInput} />
        {query ? <Pressable accessibilityRole="button" onPress={() => setQuery('')}><Text style={styles.clear}>×</Text></Pressable> : null}
      </View>
      {episodesError ? <Text style={styles.playerHint}>Episode list unavailable.</Text> : null}
    </View>
  );

  return (
    <View style={styles.screen}>
      <StatusBar barStyle="light-content" backgroundColor={colors.background} />
      <SafeAreaView edges={['top']} style={styles.safeArea}>
        <AppRefreshFlatList
          data={filteredEpisodes}
          keyExtractor={(episode) => episode.slug}
          renderItem={({ item, index }) => {
            const selected = item.slug === episodeSlug;
            return (
              <Pressable onPress={() => play(item)} style={[styles.episodeRow, selected && styles.currentEpisode]}>
                <View style={[styles.episodeNo, selected && styles.currentEpisodeNo]}><Text style={[styles.episodeNoText, selected && styles.currentEpisodeNoText]}>{String(item.number || index + 1).padStart(2, '0')}</Text></View>
                <View style={styles.episodeCopy}><Text numberOfLines={1} style={[styles.episodeTitle, selected && styles.currentEpisodeTitle]}>{item.title}</Text><Text style={styles.episodeMeta}>{selected ? 'Now playing' : 'Tap to play'}</Text></View>
                <SymbolView name={{ ios: selected ? 'waveform' : 'play.fill', android: selected ? 'graphic_eq' : 'play_arrow', web: selected ? 'graphic_eq' : 'play_arrow' }} size={18} tintColor={selected ? colors.accentSoft : 'rgba(255,255,255,0.5)'} />
              </Pressable>
            );
          }}
          ListHeaderComponent={listHeader}
          ListEmptyComponent={episodesLoading ? <View style={styles.empty}><ActivityIndicator color={colors.accent} /><Text style={styles.playerHint}>Loading episode list…</Text></View> : <View style={styles.empty}><Text style={styles.playerHint}>No episodes found.</Text></View>}
          contentContainerStyle={styles.listContent}
          ItemSeparatorComponent={() => <View style={styles.separator} />}
          refreshing={refreshing}
          onRefresh={refresh}
          showsVerticalScrollIndicator={false}
          initialNumToRender={10}
          maxToRenderPerBatch={8}
          windowSize={7}
        />
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  safeArea: { flex: 1 },
  listContent: { paddingBottom: 28 },
  topBar: { height: 64, flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16 },
  iconButton: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.07)' },
  topTitle: { flex: 1, gap: 3 },
  topEyebrow: { color: colors.accentSoft, fontFamily: fonts.bold, fontSize: 8, letterSpacing: 1.6 },
  topEpisode: { color: '#FFF', fontFamily: fonts.semibold, fontSize: 13 },
  playerFrame: { width: '100%', aspectRatio: 16 / 9, backgroundColor: '#000', overflow: 'hidden' },
  playerMessage: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 9, paddingHorizontal: 26, backgroundColor: '#050506' },
  playerMessageText: { color: 'rgba(255,255,255,0.55)', fontFamily: fonts.regular, fontSize: 11, lineHeight: 17, textAlign: 'center' },
  playerErrorTitle: { color: '#FFF', fontFamily: fonts.bold, fontSize: 15, marginTop: 2 },
  retryButton: { minHeight: 36, borderRadius: 8, backgroundColor: '#FFF', paddingHorizontal: 15, alignItems: 'center', justifyContent: 'center', marginTop: 4 },
  retryText: { color: '#111216', fontFamily: fonts.bold, fontSize: 11 },
  playerHint: { color: 'rgba(255,255,255,0.4)', fontFamily: fonts.regular, fontSize: 10, marginHorizontal: 20, marginTop: 8 },
  serverSection: { marginTop: 23 },
  serverHeading: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', paddingHorizontal: 20 },
  sectionEyebrow: { color: colors.accent, fontFamily: fonts.bold, fontSize: 9, letterSpacing: 1.6, marginBottom: 4 },
  sectionTitle: { color: '#FFF', fontFamily: fonts.bold, fontSize: 19 },
  sourceStatus: { color: '#86EFAC', fontFamily: fonts.bold, fontSize: 9, paddingBottom: 3 },
  modeRow: { flexDirection: 'row', gap: 8, paddingHorizontal: 20, marginTop: 14 },
  modeButton: { minHeight: 35, justifyContent: 'center', paddingHorizontal: 14, borderRadius: 18, backgroundColor: 'rgba(255,255,255,0.07)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.09)' },
  modeSelected: { backgroundColor: 'rgba(229,9,20,0.18)', borderColor: 'rgba(229,9,20,0.65)' },
  disabled: { opacity: 0.35 },
  modeText: { color: 'rgba(255,255,255,0.58)', fontFamily: fonts.semibold, fontSize: 11 },
  modeTextSelected: { color: '#FFF' },
  serverRow: { gap: 8, paddingHorizontal: 20, paddingVertical: 11 },
  serverButton: { minHeight: 34, maxWidth: 150, justifyContent: 'center', paddingHorizontal: 12, borderRadius: 7, backgroundColor: 'rgba(255,255,255,0.045)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' },
  serverSelected: { borderColor: colors.accent, backgroundColor: 'rgba(229,9,20,0.18)' },
  serverText: { color: 'rgba(255,255,255,0.55)', fontFamily: fonts.medium, fontSize: 10 },
  serverTextSelected: { color: '#FFF', fontFamily: fonts.semibold },
  nextCard: { minHeight: 72, marginHorizontal: 20, marginTop: 13, paddingHorizontal: 14, borderRadius: 12, borderWidth: 1, borderColor: 'rgba(255,255,255,0.09)', backgroundColor: 'rgba(255,255,255,0.04)', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  nextCopy: { flex: 1, gap: 5 },
  nextEyebrow: { color: colors.accentSoft, fontFamily: fonts.bold, fontSize: 8, letterSpacing: 1.6 },
  nextTitle: { color: '#FFF', fontFamily: fonts.semibold, fontSize: 12 },
  nextButton: { minHeight: 37, flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, borderRadius: 7, backgroundColor: '#FFF' },
  nextButtonText: { color: '#111216', fontFamily: fonts.bold, fontSize: 10 },
  episodesHeader: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', marginTop: 28, marginBottom: 13, paddingHorizontal: 20 },
  episodeCount: { color: 'rgba(255,255,255,0.4)', fontFamily: fonts.medium, fontSize: 10, paddingBottom: 3 },
  episodeSearch: { height: 43, flexDirection: 'row', alignItems: 'center', gap: 8, marginHorizontal: 20, marginBottom: 12, paddingHorizontal: 12, borderRadius: 9, backgroundColor: 'rgba(255,255,255,0.05)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)' },
  searchInput: { flex: 1, color: '#FFF', fontFamily: fonts.regular, fontSize: 12 },
  clear: { color: 'rgba(255,255,255,0.6)', fontSize: 21, lineHeight: 24 },
  episodeRow: { minHeight: 64, flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 20, backgroundColor: 'rgba(255,255,255,0.015)' },
  currentEpisode: { backgroundColor: 'rgba(229,9,20,0.095)' },
  episodeNo: { width: 40, height: 40, borderRadius: 9, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.06)' },
  currentEpisodeNo: { backgroundColor: colors.accent },
  episodeNoText: { color: 'rgba(255,255,255,0.6)', fontFamily: fonts.bold, fontSize: 11 },
  currentEpisodeNoText: { color: '#FFF' },
  episodeCopy: { flex: 1, gap: 4 },
  episodeTitle: { color: 'rgba(255,255,255,0.8)', fontFamily: fonts.medium, fontSize: 12 },
  currentEpisodeTitle: { color: '#FFF', fontFamily: fonts.semibold },
  episodeMeta: { color: 'rgba(255,255,255,0.38)', fontFamily: fonts.regular, fontSize: 9 },
  separator: { height: StyleSheet.hairlineWidth, backgroundColor: 'rgba(255,255,255,0.07)', marginLeft: 72 },
  empty: { minHeight: 100, alignItems: 'center', justifyContent: 'center', gap: 8 },
});

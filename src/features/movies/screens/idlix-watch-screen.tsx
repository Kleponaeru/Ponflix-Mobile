import { Image } from 'expo-image';
import { router, useLocalSearchParams } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StatusBar, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { WebView } from 'react-native-webview';

import { AppRefreshScrollView } from '@/components/app-refresh-scroll-view';
import { KeepScreenAwake } from '@/components/keep-screen-awake';
import { PonflixTheme } from '@/constants/theme';
import { fetchIdlixDetails, fetchIdlixPlayback, IDLIX_BASE_URL, type IdlixDetails, type IdlixEpisode, type IdlixPlayback, type IdlixPlaybackType } from '@/features/movies/api/idlix-service';
import { IdlixVideoPlayer } from '@/features/movies/components/idlix-video-player';

const { colors, fonts } = PonflixTheme;

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
  const isLoading = Boolean(currentId) && loading;
  const visibleError = currentId ? error : 'This item has no playback ID.';
  const episodes = titleDetails?.episodes ?? [];
  const episodesLoading = detailsLoading;
  const currentEpisodeIndex = episodes.findIndex((episode) => episode.id === currentId);
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
          {playback?.kind === 'video' ? <IdlixVideoPlayer key={currentId} uri={playback.uri} headers={playback.headers} title={currentTitle} subtitleSources={playback.subtitleSources} /> : playback?.kind === 'embed' ? (
            <>
              <View style={styles.playerFrame}>
                <WebView
                  key={currentId}
                  source={{ uri: playback.uri, headers: { Referer: `${IDLIX_BASE_URL}/` } }}
                  style={styles.embed}
                  originWhitelist={['https://*']}
                  javaScriptEnabled
                  domStorageEnabled
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

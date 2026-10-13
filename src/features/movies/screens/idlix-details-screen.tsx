import { Image } from 'expo-image';
import { router, useLocalSearchParams } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StatusBar, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppRefreshScrollView } from '@/components/app-refresh-scroll-view';
import { BrandHeader } from '@/components/brand-header';
import { PonflixTheme } from '@/constants/theme';
import { fetchIdlixDetails, type IdlixCategory, type IdlixDetails, type IdlixPlaybackType } from '@/features/movies/api/idlix-service';

const { colors, fonts } = PonflixTheme;

export default function IdlixDetailsScreen() {
  const params = useLocalSearchParams<{ slug?: string | string[]; type?: string | string[] }>();
  const slug = Array.isArray(params.slug) ? params.slug[0] : params.slug;
  const rawType = Array.isArray(params.type) ? params.type[0] : params.type;
  const category: IdlixCategory = rawType === 'series' ? 'series' : 'movie';
  const [details, setDetails] = useState<IdlixDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    if (!slug) return;
    const controller = new AbortController();
    fetchIdlixDetails(slug, category, controller.signal).then((value) => {
      if (!controller.signal.aborted) setDetails(value);
    }).catch((reason: unknown) => {
      if (!controller.signal.aborted) setError(reason instanceof Error ? reason.message : 'Idlix could not load this title.');
    }).finally(() => {
      if (!controller.signal.aborted) {
        setLoading(false);
        setRefreshing(false);
      }
    });
    return () => controller.abort();
  }, [slug, category, reloadKey]);

  const retry = () => {
    setError('');
    setLoading(true);
    setReloadKey((value) => value + 1);
  };

  const refresh = () => {
    setError('');
    setRefreshing(true);
    setLoading(true);
    setReloadKey((value) => value + 1);
  };

  const openPlayback = (id: string, playbackTitle: string, playbackType: IdlixPlaybackType) => {
    const titleParam = `&detailSlug=${encodeURIComponent(details?.slug || '')}`;
    const seriesParam = playbackType === 'episode' ? `&seriesSlug=${encodeURIComponent(details?.slug || '')}` : '';
    const href = `/(tabs)/movies/idlix/watch?id=${encodeURIComponent(id)}&title=${encodeURIComponent(playbackTitle)}&type=${playbackType}${titleParam}${seriesParam}` as const;
    router.push(href);
  };

  if (!slug) {
    return <SafeAreaView edges={['top']} style={styles.screen}><View style={styles.errorState}><Text style={styles.errorTitle}>Title address missing</Text><Pressable accessibilityRole="button" onPress={() => router.back()} style={styles.backTextButton}><Text style={styles.backText}>Back to Idlix</Text></Pressable></View></SafeAreaView>;
  }

  if (loading && !details) {
    return <View style={styles.center}><ActivityIndicator color={colors.accent} size="large" /><Text style={styles.messageText}>Loading title details…</Text></View>;
  }

  if (!details) {
    return (
      <SafeAreaView edges={['top']} style={styles.screen}>
        <StatusBar barStyle="light-content" backgroundColor={colors.background} />
        <View style={styles.errorState}>
          <Text style={styles.errorTitle}>Title details unavailable</Text>
          <Text style={styles.messageText}>{error || 'Idlix did not return details for this title.'}</Text>
          <Pressable accessibilityRole="button" onPress={retry} style={styles.retryButton}><Text style={styles.retryText}>Try again</Text></Pressable>
          <Pressable accessibilityRole="button" onPress={() => router.back()} style={styles.backTextButton}><Text style={styles.backText}>Back to Idlix</Text></Pressable>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <View style={styles.screen}>
      <StatusBar barStyle="light-content" backgroundColor={colors.background} />
      <SafeAreaView edges={['top']} style={styles.safeArea}>
        <BrandHeader rightAction={(
          <Pressable accessibilityRole="button" accessibilityLabel="Back to titles" onPress={() => router.back()} style={styles.backButton}>
            <SymbolView name={{ ios: 'chevron.left', android: 'arrow_back', web: 'arrow_back' }} size={19} tintColor="#FFF" />
          </Pressable>
        )} />
        <AppRefreshScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.content}
          refreshing={refreshing}
          onRefresh={refresh}
        >
          <View style={styles.hero}>
            {details.posterUrl ? <Image source={{ uri: details.posterUrl }} contentFit="cover" cachePolicy="memory-disk" transition={180} style={StyleSheet.absoluteFill} /> : null}
            <View style={styles.heroShade} />
            <View style={styles.heroCopy}>
              <Text style={styles.kicker}>{details.type.toUpperCase()}{details.year ? ` · ${details.year}` : ''}</Text>
              <Text style={styles.title}>{details.title}</Text>
              {details.tagline ? <Text style={styles.tagline}>{details.tagline}</Text> : null}
            </View>
          </View>

          <View style={styles.metaRow}>
            {details.status ? <MetaPill label={details.status} /> : null}
            {details.runtime ? <MetaPill label={details.runtime} /> : null}
            {details.seasons ? <MetaPill label={`${details.seasons} seasons`} /> : null}
            {details.episodes.length ? <MetaPill label={`${details.episodes.length} episodes`} /> : null}
          </View>

          {details.genres.length ? <View style={styles.genreRow}>{details.genres.map((genre) => <View key={genre} style={styles.genrePill}><Text style={styles.genreText}>{genre}</Text></View>)}</View> : null}

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Synopsis</Text>
            <Text style={styles.synopsis}>{details.overview || 'Synopsis not available.'}</Text>
          </View>

          {category === 'movie' ? (
            <Pressable accessibilityRole="button" onPress={() => openPlayback(details.id, details.title, 'movie')} style={styles.playButton}>
              <SymbolView name={{ ios: 'play.fill', android: 'play_arrow', web: 'play_arrow' }} size={18} tintColor="#FFF" />
              <Text style={styles.playButtonText}>Play movie</Text>
            </Pressable>
          ) : null}

          {category === 'series' ? (
            <View style={styles.section}>
              <View style={styles.sectionHeading}>
                <Text style={styles.sectionTitle}>Episodes</Text>
                <Text style={styles.count}>{details.episodes.length}</Text>
              </View>
              {details.episodes.length ? details.episodes.map((episode, index) => (
                <Pressable key={`${episode.id}-${index}`} accessibilityRole="button" accessibilityLabel={`Play ${episode.title}`} onPress={() => openPlayback(episode.id, episode.title, 'episode')} style={({ pressed }) => [styles.episodeRow, pressed && styles.episodePressed]}>
                  <View style={styles.episodeNumber}><Text style={styles.episodeNumberText}>{String(episode.number || index + 1).padStart(2, '0')}</Text></View>
                  <View style={styles.episodeCopy}>
                    <Text numberOfLines={1} style={styles.episodeTitle}>{episode.title}</Text>
                    {episode.season ? <Text style={styles.episodeMeta}>Season {episode.season}</Text> : null}
                  </View>
                  <SymbolView name={{ ios: 'play.fill', android: 'play_arrow', web: 'play_arrow' }} size={20} tintColor={colors.accentSoft} />
                </Pressable>
              )) : <Text style={styles.synopsis}>No episodes were returned by the source.</Text>}
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
  screen: { flex: 1, backgroundColor: colors.background },
  safeArea: { flex: 1 },
  content: { paddingBottom: 32 },
  backButton: { width: 34, height: 34, borderRadius: 8, backgroundColor: 'rgba(255,255,255,0.08)', alignItems: 'center', justifyContent: 'center' },
  hero: { minHeight: 300, marginHorizontal: 16, marginTop: 5, borderRadius: 14, overflow: 'hidden', justifyContent: 'flex-end', backgroundColor: colors.surface },
  heroShade: { ...StyleSheet.absoluteFill, backgroundColor: 'rgba(5,6,8,0.42)' },
  heroCopy: { padding: 18 },
  kicker: { color: '#FF8A92', fontFamily: fonts.bold, fontSize: 9, letterSpacing: 1.5, marginBottom: 7 },
  title: { color: '#FFF', fontFamily: fonts.extraBold, fontSize: 27, lineHeight: 33 },
  tagline: { color: 'rgba(255,255,255,0.75)', fontFamily: fonts.regular, fontSize: 12, marginTop: 8 },
  metaRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 7, paddingHorizontal: 20, paddingTop: 15 },
  metaPill: { paddingHorizontal: 9, paddingVertical: 6, borderRadius: 6, backgroundColor: 'rgba(255,255,255,0.08)' },
  metaText: { color: 'rgba(255,255,255,0.72)', fontFamily: fonts.semibold, fontSize: 10 },
  genreRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 7, paddingHorizontal: 20, paddingTop: 11 },
  genrePill: { paddingHorizontal: 9, paddingVertical: 6, borderRadius: 14, borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)' },
  genreText: { color: 'rgba(255,255,255,0.58)', fontFamily: fonts.medium, fontSize: 9 },
  section: { paddingHorizontal: 20, marginTop: 24 },
  sectionHeading: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 9 },
  sectionTitle: { color: '#FFF', fontFamily: fonts.bold, fontSize: 17 },
  synopsis: { color: 'rgba(255,255,255,0.63)', fontFamily: fonts.regular, fontSize: 12, lineHeight: 20, marginTop: 8 },
  count: { color: 'rgba(255,255,255,0.43)', fontFamily: fonts.medium, fontSize: 11 },
  playButton: { minHeight: 46, marginHorizontal: 20, marginTop: 18, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderRadius: 9, backgroundColor: colors.accent },
  playButtonText: { color: '#FFF', fontFamily: fonts.bold, fontSize: 12 },
  episodeRow: { minHeight: 64, flexDirection: 'row', alignItems: 'center', gap: 12, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.07)' },
  episodePressed: { opacity: 0.68 },
  episodeNumber: { width: 39, height: 39, borderRadius: 8, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(229,9,20,0.16)' },
  episodeNumberText: { color: colors.accentSoft, fontFamily: fonts.bold, fontSize: 12 },
  episodeCopy: { flex: 1, gap: 4 },
  episodeTitle: { color: '#FFF', fontFamily: fonts.semibold, fontSize: 12 },
  episodeMeta: { color: 'rgba(255,255,255,0.42)', fontFamily: fonts.regular, fontSize: 10 },
  center: { flex: 1, backgroundColor: colors.background, alignItems: 'center', justifyContent: 'center', gap: 10, padding: 24 },
  messageText: { color: 'rgba(255,255,255,0.53)', fontFamily: fonts.regular, textAlign: 'center', fontSize: 11, lineHeight: 17, marginTop: 6 },
  errorState: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 28 },
  errorTitle: { color: '#FFF', fontFamily: fonts.bold, fontSize: 16, textAlign: 'center' },
  retryButton: { minHeight: 38, marginTop: 14, paddingHorizontal: 16, borderRadius: 8, backgroundColor: '#FFF', justifyContent: 'center' },
  retryText: { color: '#111216', fontFamily: fonts.bold, fontSize: 12 },
  backTextButton: { minHeight: 38, marginTop: 6, paddingHorizontal: 14, justifyContent: 'center' },
  backText: { color: 'rgba(255,255,255,0.66)', fontFamily: fonts.semibold, fontSize: 11 },
});

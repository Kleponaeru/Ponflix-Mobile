import { Image } from 'expo-image';
import { router } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StatusBar, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AnimeRail } from '@/features/anime/components/anime-rail';
import { BrandHeader } from '@/components/brand-header';
import { AppRefreshScrollView } from '@/components/app-refresh-scroll-view';
import { clearAnimeFeedCache, fetchLatestAnime, fetchSpotlightAnime, fetchTrendingAnime } from '@/features/anime/api/anime-service';
import type { AnimeTitle } from '@/features/anime/types/anime';
import { PonflixTheme } from '@/constants/theme';

const { colors, fonts } = PonflixTheme;

export default function HomeScreen() {
  const [spotlight, setSpotlight] = useState<AnimeTitle[]>([]);
  const [trending, setTrending] = useState<AnimeTitle[]>([]);
  const [latest, setLatest] = useState<AnimeTitle[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [heroIndex, setHeroIndex] = useState(0);
  const [reloadKey, setReloadKey] = useState(0);
  const latestRef = useRef<ScrollView>(null);
  const featured = spotlight[heroIndex];

  useEffect(() => {
    const controller = new AbortController();

    Promise.allSettled([
      fetchSpotlightAnime(controller.signal),
      fetchTrendingAnime(controller.signal),
      fetchLatestAnime(controller.signal),
    ]).then(([spotlightResult, trendingResult, latestResult]) => {
      if (controller.signal.aborted) return;
      if (spotlightResult.status === 'fulfilled') {
        setSpotlight(spotlightResult.value);
        setHeroIndex(0);
      }
      if (trendingResult.status === 'fulfilled') setTrending(trendingResult.value);
      if (latestResult.status === 'fulfilled') setLatest(latestResult.value);

      if ([spotlightResult, trendingResult, latestResult].every((result) => result.status === 'rejected')) {
        setError('Ponflix could not load anime. Check your connection and try again.');
      }
    }).finally(() => {
      if (!controller.signal.aborted) {
        setLoading(false);
        setRefreshing(false);
      }
    });

    return () => controller.abort();
  }, [reloadKey]);

  const openAnime = (anime: AnimeTitle) => {
    router.push({ pathname: '/anime/[slug]', params: { slug: anime.slug } });
  };

  const refreshHome = () => {
    if (refreshing) return;
    setError('');
    setRefreshing(true);
    clearAnimeFeedCache();
    setReloadKey((key) => key + 1);
  };

  return (
    <View style={styles.screen}>
      <StatusBar barStyle="light-content" backgroundColor={colors.background} />
      <SafeAreaView edges={['top']} style={styles.safeArea}>
        <BrandHeader rightAction={(
          <Pressable accessibilityRole="button" accessibilityLabel="Search anime and comics" onPress={() => router.push('/search')} style={styles.searchButton}>
            <Text style={styles.searchGlyph}>⌕</Text>
          </Pressable>
        )} />
        <AppRefreshScrollView
          ref={latestRef}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.content}
          refreshing={refreshing}
          onRefresh={refreshHome}
        >
          <View style={styles.hero}>
            {featured?.thumbnail ? (
              <Image source={{ uri: featured.thumbnail }} contentFit="cover" cachePolicy="memory-disk" transition={260} style={StyleSheet.absoluteFill} />
            ) : null}
            <View style={styles.heroShade} />
            <View style={styles.heroCopy}>
              {loading && !featured ? <ActivityIndicator color={colors.accent} size="small" /> : null}
              <View style={styles.heroEyebrowRow}><View style={styles.redMark} /><Text style={styles.heroEyebrow}>ANIME SPOTLIGHT</Text></View>
              <Text numberOfLines={3} style={styles.heroTitle}>{featured?.title || (loading ? 'Discover your next series' : 'Your next series starts here.')}</Text>
              {featured ? (
                <View style={styles.heroMeta}>
                  {featured.currentEpisode ? <Text style={styles.newEpisode}>New episode · {featured.currentEpisode}</Text> : null}
                  {featured.type ? <Text style={styles.metaText}>{featured.type}</Text> : null}
                  {featured.quality ? <Text style={styles.metaText}>{featured.quality}</Text> : null}
                  {featured.totalEpisodes ? <Text style={styles.metaText}>{featured.totalEpisodes} episodes</Text> : null}
                </View>
              ) : (
                <Text style={styles.heroDescription}>Find your next series to get lost in. New episodes and fan favorites, all in one place.</Text>
              )}
              <View style={styles.heroActions}>
                <Pressable accessibilityRole="button" onPress={() => featured && openAnime(featured)} style={styles.primaryButton}>
                  <Text style={styles.playGlyph}>▶</Text>
                  <Text style={styles.primaryButtonText}>View details</Text>
                </Pressable>
                <Pressable accessibilityRole="button" onPress={() => latestRef.current?.scrollTo({ y: 640, animated: true })} style={styles.secondaryButton}>
                  <Text style={styles.secondaryButtonText}>Browse latest</Text>
                </Pressable>
              </View>
            </View>
            {spotlight.length > 1 ? (
              <View style={styles.heroControls}>
                <Text style={styles.heroCount}>{String(heroIndex + 1).padStart(2, '0')} / {String(spotlight.length).padStart(2, '0')}</Text>
                <Pressable accessibilityRole="button" accessibilityLabel="Previous featured anime" hitSlop={8} onPress={() => setHeroIndex((index) => (index - 1 + spotlight.length) % spotlight.length)} style={styles.arrowButton}>
                  <Text style={styles.arrowGlyph}>‹</Text>
                </Pressable>
                <Pressable accessibilityRole="button" accessibilityLabel="Next featured anime" hitSlop={8} onPress={() => setHeroIndex((index) => (index + 1) % spotlight.length)} style={styles.arrowButton}>
                  <Text style={styles.arrowGlyph}>›</Text>
                </Pressable>
              </View>
            ) : null}
          </View>

          {error ? (
            <View style={styles.errorCard}>
              <Text style={styles.errorText}>{error}</Text>
              <Pressable accessibilityRole="button" onPress={() => { setLoading(true); setError(''); setReloadKey((key) => key + 1); }} style={styles.retryButton}>
                <Text style={styles.retryText}>Try again</Text>
              </Pressable>
            </View>
          ) : null}

          {trending.length ? (
            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <View>
                  <Text style={styles.sectionEyebrow}>POPULAR RIGHT NOW</Text>
                  <Text style={styles.sectionTitle}>Top 10 anime today</Text>
                </View>
                <Text style={styles.sectionNote}>By popularity</Text>
              </View>
              <AnimeRail anime={trending.slice(0, 10)} ranked onAnimePress={openAnime} />
            </View>
          ) : null}

          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <View>
                <Text style={styles.sectionEyebrow}>FRESHLY UPDATED</Text>
                <Text style={styles.sectionTitle}>Latest completed anime</Text>
              </View>
              <Pressable accessibilityRole="button" onPress={() => router.push('/search')} hitSlop={8}>
                <Text style={styles.seeAll}>Discover ›</Text>
              </Pressable>
            </View>
            {latest.length ? (
              <AnimeRail anime={latest} onAnimePress={openAnime} />
            ) : loading ? (
              <View style={styles.loadingRow}><ActivityIndicator color={colors.accent} /><Text style={styles.loadingText}>Loading latest anime…</Text></View>
            ) : (
              <View style={styles.emptyCard}><Text style={styles.emptyText}>No latest titles are available right now.</Text></View>
            )}
          </View>
        </AppRefreshScrollView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  safeArea: { flex: 1 },
  searchButton: { width: 42, height: 42, alignItems: 'center', justifyContent: 'center', borderRadius: 21, backgroundColor: 'rgba(255,255,255,0.06)' },
  searchGlyph: { color: '#FFF', fontSize: 29, lineHeight: 34, marginTop: -5 },
  content: { paddingBottom: 28 },
  hero: { minHeight: 484, justifyContent: 'flex-end', overflow: 'hidden', backgroundColor: colors.surface },
  heroShade: { ...StyleSheet.absoluteFill, backgroundColor: 'rgba(8,9,11,0.54)' },
  heroCopy: { paddingHorizontal: 22, paddingTop: 82, paddingBottom: 62 },
  heroEyebrowRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 13 },
  heroEyebrow: { color: 'rgba(255,255,255,0.68)', fontFamily: fonts.bold, fontSize: 11, letterSpacing: 2 },
  redMark: { width: 4, height: 17, backgroundColor: colors.accent, marginRight: 8, borderRadius: 2 },
  heroTitle: { color: '#FFF', fontFamily: fonts.extraBold, fontSize: 37, lineHeight: 42, letterSpacing: -1.2, maxWidth: 355 },
  heroMeta: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', columnGap: 11, rowGap: 7, marginTop: 15 },
  newEpisode: { color: '#86EFAC', fontFamily: fonts.semibold, fontSize: 12 },
  metaText: { color: 'rgba(255,255,255,0.7)', fontFamily: fonts.regular, fontSize: 12 },
  heroDescription: { color: 'rgba(255,255,255,0.67)', fontFamily: fonts.regular, fontSize: 14, lineHeight: 21, marginTop: 14, maxWidth: 330 },
  heroActions: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 23 },
  primaryButton: { minHeight: 46, borderRadius: 9, backgroundColor: '#FFF', paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 9 },
  playGlyph: { color: '#111216', fontSize: 13 },
  primaryButtonText: { color: '#111216', fontFamily: fonts.bold, fontSize: 13 },
  secondaryButton: { minHeight: 46, borderRadius: 9, backgroundColor: 'rgba(255,255,255,0.14)', paddingHorizontal: 17, justifyContent: 'center' },
  secondaryButtonText: { color: '#FFF', fontFamily: fonts.semibold, fontSize: 13 },
  heroControls: { position: 'absolute', right: 20, bottom: 16, flexDirection: 'row', alignItems: 'center', gap: 8 },
  heroCount: { color: 'rgba(255,255,255,0.55)', fontFamily: fonts.medium, fontSize: 11, fontVariant: ['tabular-nums'], marginRight: 4 },
  arrowButton: { width: 34, height: 34, alignItems: 'center', justifyContent: 'center', borderRadius: 17, borderWidth: 1, borderColor: 'rgba(255,255,255,0.25)', backgroundColor: 'rgba(0,0,0,0.3)' },
  arrowGlyph: { color: '#FFF', fontSize: 25, lineHeight: 29, marginTop: -4 },
  section: { marginTop: 29 },
  sectionHeader: { minHeight: 52, paddingHorizontal: 20, marginBottom: 13, flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', gap: 8 },
  sectionEyebrow: { color: colors.accent, fontFamily: fonts.bold, fontSize: 9, letterSpacing: 1.7, marginBottom: 5 },
  sectionTitle: { color: '#F7F7F8', fontFamily: fonts.bold, fontSize: 19, letterSpacing: -0.4 },
  sectionNote: { color: 'rgba(255,255,255,0.42)', fontFamily: fonts.regular, fontSize: 10, paddingBottom: 2 },
  seeAll: { color: 'rgba(255,255,255,0.62)', fontFamily: fonts.medium, fontSize: 12, paddingBottom: 3 },
  errorCard: { marginHorizontal: 20, marginTop: 18, padding: 14, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)', borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.035)', gap: 12 },
  errorText: { color: 'rgba(255,255,255,0.7)', fontFamily: fonts.regular, fontSize: 13, lineHeight: 19 },
  retryButton: { alignSelf: 'flex-start', paddingHorizontal: 14, minHeight: 36, borderRadius: 8, alignItems: 'center', justifyContent: 'center', backgroundColor: '#FFF' },
  retryText: { color: '#111216', fontFamily: fonts.bold, fontSize: 12 },
  loadingRow: { marginHorizontal: 20, minHeight: 74, borderRadius: 11, backgroundColor: 'rgba(255,255,255,0.035)', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10 },
  loadingText: { color: 'rgba(255,255,255,0.5)', fontFamily: fonts.regular, fontSize: 12 },
  emptyCard: { marginHorizontal: 20, paddingVertical: 24, alignItems: 'center', borderRadius: 11, backgroundColor: 'rgba(255,255,255,0.035)' },
  emptyText: { color: 'rgba(255,255,255,0.5)', fontFamily: fonts.regular, fontSize: 12 },
});

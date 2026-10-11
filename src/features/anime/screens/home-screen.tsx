import { router } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, StatusBar, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { PonflixTheme } from '@/constants/theme';
import { BrandHeader } from '@/components/brand-header';
import { SpotlightBanner } from '@/components/spotlight-banner';
import { AnimeRail } from '@/features/anime/components/anime-rail';
import { clearAnimeFeedCache, fetchLatestAnime, fetchSpotlightAnime, fetchTrendingAnime } from '@/features/anime/api/anime-service';
import type { AnimeTitle } from '@/features/anime/types/anime';
import { ComicCard } from '@/features/comics/components/comic-card';
import { fetchComicPage } from '@/features/comics/api/comic-service';
import type { ComicCategory, ComicListItem } from '@/features/comics/types/comic';

const { colors, fonts } = PonflixTheme;
const comicCategories: ComicCategory[] = ['manga', 'manhwa', 'manhua'];

export default function HomeScreen() {
  const [spotlight, setSpotlight] = useState<AnimeTitle[]>([]);
  const [trending, setTrending] = useState<AnimeTitle[]>([]);
  const [latest, setLatest] = useState<AnimeTitle[]>([]);
  const [comics, setComics] = useState<ComicListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    Promise.allSettled([
      fetchSpotlightAnime(controller.signal),
      fetchTrendingAnime(controller.signal),
      fetchLatestAnime(controller.signal),
      ...comicCategories.map((category) => fetchComicPage(category, 1, controller.signal)),
    ]).then(([spotlightResult, trendingResult, latestResult, ...comicResults]) => {
      if (controller.signal.aborted) return;
      if (spotlightResult.status === 'fulfilled') setSpotlight(spotlightResult.value);
      if (trendingResult.status === 'fulfilled') setTrending(trendingResult.value);
      if (latestResult.status === 'fulfilled') setLatest(latestResult.value);
      const loadedComics = comicResults.flatMap((result) => result.status === 'fulfilled' ? result.value.items.slice(0, 6) : []);
      setComics([...new Map(loadedComics.map((comic) => [comic.id, comic])).values()]);
      if (spotlightResult.status === 'rejected' && trendingResult.status === 'rejected' && latestResult.status === 'rejected' && comicResults.every((result) => result.status === 'rejected')) {
        setError('Ponflix could not load recommendations. Check your connection and try again.');
      } else {
        setError('');
      }
    }).finally(() => {
      if (!controller.signal.aborted) {
        setLoading(false);
        setRefreshing(false);
      }
    });
    return () => controller.abort();
  }, [reloadKey]);

  const refreshHome = useCallback(() => {
    if (refreshing) return;
    clearAnimeFeedCache();
    setRefreshing(true);
    setReloadKey((key) => key + 1);
  }, [refreshing]);

  const openAnime = useCallback((anime: AnimeTitle) => {
    router.push({ pathname: '/anime/[slug]', params: { slug: anime.slug } });
  }, []);

  const openComic = useCallback((comic: ComicListItem) => {
    router.push({ pathname: '/comics/[id]', params: { id: comic.id } });
  }, []);

  return (
    <View style={styles.screen}>
      <StatusBar barStyle="light-content" backgroundColor={colors.background} />
      <SafeAreaView edges={['top']} style={styles.safeArea}>
        <BrandHeader rightAction={(
          <Pressable accessibilityRole="button" accessibilityLabel="Search anime and comics" onPress={() => router.push('/search')} style={styles.searchButton}>
            <Text style={styles.searchGlyph}>⌕</Text>
          </Pressable>
        )} />
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.content}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refreshHome} tintColor={colors.accent} colors={[colors.accent]} progressBackgroundColor={colors.surface} />}>
          <SpotlightBanner
            imageUrl={spotlight[0]?.thumbnail}
            eyebrow="ANIME SPOTLIGHT"
            title={spotlight[0]?.title || 'Stories worth staying up for.'}
            description={spotlight[0]
              ? [
                  spotlight[0].currentEpisode ? `New episode · ${spotlight[0].currentEpisode}` : undefined,
                  spotlight[0].type,
                  spotlight[0].quality,
                  spotlight[0].totalEpisodes ? `${spotlight[0].totalEpisodes} episodes` : undefined,
                ].filter(Boolean).join(' · ')
              : 'Discover a featured anime, then find your next comic to read.'}
            primaryLabel="View details"
            onPrimaryPress={() => spotlight[0] && router.push({ pathname: '/anime/[slug]', params: { slug: spotlight[0].slug } })}
            secondaryLabel="Read comics"
            onSecondaryPress={() => router.push('/comics')}
          />

          {error ? <View style={styles.errorCard}><Text style={styles.errorText}>{error}</Text></View> : null}

          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <View><Text style={styles.sectionEyebrow}>POPULAR RIGHT NOW</Text><Text style={styles.sectionTitle}>Anime to watch</Text></View>
              <Pressable accessibilityRole="button" onPress={() => router.push('/anime')}><Text style={styles.seeAll}>All anime ›</Text></Pressable>
            </View>
            {trending.length ? <AnimeRail anime={trending.slice(0, 10)} ranked onAnimePress={openAnime} /> : loading ? <View style={styles.loadingRow}><ActivityIndicator color={colors.accent} /><Text style={styles.loadingText}>Loading anime…</Text></View> : null}
          </View>

          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <View><Text style={styles.sectionEyebrow}>YOUR NEXT READ</Text><Text style={styles.sectionTitle}>Comics to read</Text></View>
              <Pressable accessibilityRole="button" onPress={() => router.push('/comics')}><Text style={styles.seeAll}>All comics ›</Text></Pressable>
            </View>
            {comics.length ? (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.comicRail}>
                {comics.map((comic) => <ComicCard key={comic.id} comic={comic} width={146} onPress={openComic} />)}
              </ScrollView>
            ) : loading ? <View style={styles.loadingRow}><ActivityIndicator color={colors.accent} /><Text style={styles.loadingText}>Loading comics…</Text></View> : null}
          </View>

          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <View><Text style={styles.sectionEyebrow}>FRESHLY UPDATED</Text><Text style={styles.sectionTitle}>Latest anime</Text></View>
              <Pressable accessibilityRole="button" onPress={() => router.push('/anime')}><Text style={styles.seeAll}>All anime ›</Text></Pressable>
            </View>
            {latest.length ? <AnimeRail anime={latest} onAnimePress={openAnime} /> : loading ? <View style={styles.loadingRow}><ActivityIndicator color={colors.accent} /><Text style={styles.loadingText}>Loading latest anime…</Text></View> : null}
          </View>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  safeArea: { flex: 1 },
  content: { paddingBottom: 30 },
  searchButton: { width: 42, height: 42, alignItems: 'center', justifyContent: 'center', borderRadius: 21, backgroundColor: 'rgba(255,255,255,0.06)' },
  searchGlyph: { color: '#FFF', fontSize: 29, lineHeight: 34, marginTop: -5 },
  section: { marginTop: 28 },
  sectionHeader: { minHeight: 50, paddingHorizontal: 20, marginBottom: 13, flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', gap: 8 },
  sectionEyebrow: { color: colors.accent, fontFamily: fonts.bold, fontSize: 9, letterSpacing: 1.7, marginBottom: 5 },
  sectionTitle: { color: '#F7F7F8', fontFamily: fonts.bold, fontSize: 19, letterSpacing: -0.4 },
  seeAll: { color: 'rgba(255,255,255,0.62)', fontFamily: fonts.medium, fontSize: 12, paddingBottom: 3 },
  comicRail: { paddingHorizontal: 20, gap: 12 },
  loadingRow: { marginHorizontal: 20, minHeight: 76, borderRadius: 11, backgroundColor: 'rgba(255,255,255,0.035)', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10 },
  loadingText: { color: 'rgba(255,255,255,0.5)', fontFamily: fonts.regular, fontSize: 12 },
  errorCard: { marginHorizontal: 20, marginTop: 14, padding: 14, borderRadius: 11, backgroundColor: 'rgba(255,255,255,0.04)' },
  errorText: { color: 'rgba(255,255,255,0.6)', fontFamily: fonts.regular, fontSize: 12, lineHeight: 18 },
});

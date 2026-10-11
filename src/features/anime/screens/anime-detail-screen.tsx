import { Image } from 'expo-image';
import { router, useLocalSearchParams } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { LinearGradient } from 'expo-linear-gradient';
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, RefreshControl, StatusBar, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { PonflixTheme } from '@/constants/theme';
import { fetchAnimeDetails, fetchAnimeEpisodes } from '@/features/anime/api/anime-service';
import type { AnimeDetails, AnimeEpisode } from '@/features/anime/types/anime';

const { colors, fonts } = PonflixTheme;

export default function AnimeDetailScreen() {
  const params = useLocalSearchParams<{ slug?: string | string[] }>();
  const slug = Array.isArray(params.slug) ? params.slug[0] : params.slug;
  return <AnimeDetailContent key={slug || 'missing'} slug={slug} />;
}

function AnimeDetailContent({ slug }: { slug?: string }) {
  const [anime, setAnime] = useState<AnimeDetails | null>(null);
  const [episodes, setEpisodes] = useState<AnimeEpisode[]>([]);
  const [query, setQuery] = useState('');
  const [showFullSynopsis, setShowFullSynopsis] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [episodesError, setEpisodesError] = useState(false);
  const [error, setError] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    if (!slug) return;
    const controller = new AbortController();
    Promise.allSettled([
      fetchAnimeDetails(slug, controller.signal),
      fetchAnimeEpisodes(slug, controller.signal),
    ]).then(([detailsResult, episodesResult]) => {
      if (controller.signal.aborted) return;
      if (detailsResult.status === 'fulfilled') setAnime(detailsResult.value);
      else setError(true);
      if (episodesResult.status === 'fulfilled') setEpisodes(episodesResult.value);
      else setEpisodesError(true);
    }).finally(() => {
      if (!controller.signal.aborted) {
        setLoading(false);
        setRefreshing(false);
      }
    });

    return () => controller.abort();
  }, [slug, reloadKey]);

  const filteredEpisodes = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase();
    return normalized ? episodes.filter((episode) => episode.title.toLocaleLowerCase().includes(normalized) || String(episode.number).includes(normalized)) : episodes;
  }, [episodes, query]);

  const refresh = () => {
    if (refreshing) return;
    setRefreshing(true);
    setReloadKey((key) => key + 1);
  };

  const play = (episode: AnimeEpisode) => {
    if (!slug) return;
    router.push({ pathname: '/anime/[slug]/episode/[episodeSlug]', params: { slug, episodeSlug: episode.slug } });
  };

  if (loading && !anime) {
    return <View style={styles.center}><ActivityIndicator size="large" color={colors.accent} /><Text style={styles.muted}>Loading series details…</Text></View>;
  }

  if (error || !anime) {
    return (
      <SafeAreaView style={styles.screen} edges={['top']}>
        <StatusBar barStyle="light-content" backgroundColor={colors.background} />
        <View style={styles.center}>
          <Text style={styles.errorTitle}>This series isn’t available right now.</Text>
          <Text style={styles.muted}>Check your connection, then try again.</Text>
          <Pressable onPress={refresh} style={styles.retryButton}><Text style={styles.retryText}>Try again</Text></Pressable>
        </View>
      </SafeAreaView>
    );
  }

  const firstEpisode = episodes[0];
  const latestEpisode = episodes[episodes.length - 1];
  const listHeader = (
    <View>
      <View style={styles.hero}>
        <Image source={{ uri: anime.thumbnail }} contentFit="cover" cachePolicy="memory-disk" style={StyleSheet.absoluteFill} />
        <LinearGradient colors={['rgba(8,9,11,0.18)', 'rgba(8,9,11,0.55)', colors.background]} locations={[0, 0.46, 1]} style={StyleSheet.absoluteFill} />
        <SafeAreaView edges={['top']} style={styles.heroContent}>
          <Pressable accessibilityRole="button" accessibilityLabel="Go back" onPress={() => router.back()} style={styles.backButton}>
            <SymbolView name={{ ios: 'chevron.left', android: 'arrow_back', web: 'arrow_back' }} size={20} tintColor="#FFF" />
          </Pressable>
          <View style={styles.posterWrap}>
            <Image source={{ uri: anime.thumbnail }} contentFit="cover" cachePolicy="memory-disk" transition={200} style={styles.poster} />
          </View>
          <Text style={styles.eyebrow}>PONFLIX ORIGINALS</Text>
          <Text style={styles.title}>{anime.title}</Text>
          <View style={styles.metaRow}>
            {anime.score ? <Text style={styles.score}>★ {Number(anime.score).toFixed(1)}</Text> : null}
            {anime.type ? <Text style={styles.meta}>{anime.type}</Text> : null}
            {anime.status ? <Text style={styles.meta}>{anime.status}</Text> : null}
            {anime.totalEpisodes ? <Text style={styles.meta}>{anime.totalEpisodes} eps</Text> : episodes.length ? <Text style={styles.meta}>{episodes.length} eps</Text> : null}
          </View>
          <Text numberOfLines={showFullSynopsis ? undefined : 5} style={styles.synopsis}>{anime.synopsis || 'Synopsis not available yet.'}</Text>
          {anime.synopsis && anime.synopsis.length > 220 ? (
            <Pressable accessibilityRole="button" accessibilityState={{ expanded: showFullSynopsis }} onPress={() => setShowFullSynopsis((expanded) => !expanded)}>
              <Text style={styles.readMoreHint}>{showFullSynopsis ? 'Show less' : 'Read more'}</Text>
            </Pressable>
          ) : null}
          <View style={styles.actionRow}>
            {firstEpisode ? (
              <Pressable accessibilityRole="button" onPress={() => play(firstEpisode)} style={styles.playButton}>
                <SymbolView name={{ ios: 'play.fill', android: 'play_arrow', web: 'play_arrow' }} size={19} tintColor="#111216" />
                <Text style={styles.playText}>Start watching</Text>
              </Pressable>
            ) : null}
            {latestEpisode && latestEpisode.slug !== firstEpisode?.slug ? (
              <Pressable accessibilityRole="button" onPress={() => play(latestEpisode)} style={styles.latestButton}>
                <Text style={styles.latestText}>Latest episode</Text>
              </Pressable>
            ) : null}
          </View>
        </SafeAreaView>
      </View>

      <View style={styles.sectionHeader}>
        <View>
          <Text style={styles.sectionEyebrow}>YOUR NEXT WATCH</Text>
          <Text style={styles.sectionTitle}>Episodes</Text>
        </View>
        {episodes.length ? <Text style={styles.episodeCount}>{episodes.length} episodes</Text> : null}
      </View>
      <View style={styles.searchBar}>
        <SymbolView name={{ ios: 'magnifyingglass', android: 'search', web: 'search' }} size={18} tintColor="rgba(255,255,255,0.48)" />
        <TextInput accessibilityLabel="Find an episode" value={query} onChangeText={setQuery} placeholder="Find an episode" placeholderTextColor="rgba(255,255,255,0.38)" returnKeyType="search" style={styles.searchInput} />
        {query ? <Pressable accessibilityRole="button" accessibilityLabel="Clear episode search" onPress={() => setQuery('')}><Text style={styles.clear}>×</Text></Pressable> : null}
      </View>
      {episodesError ? <Text style={styles.episodeError}>The episode list couldn’t load. Pull down to retry.</Text> : null}
    </View>
  );

  return (
    <View style={styles.screen}>
      <StatusBar barStyle="light-content" backgroundColor={colors.background} />
      <FlatList
        data={filteredEpisodes}
        keyExtractor={(episode) => episode.slug}
        renderItem={({ item, index }) => (
          <Pressable accessibilityRole="button" accessibilityLabel={'Play ' + item.title} onPress={() => play(item)} style={({ pressed }) => [styles.episodeRow, pressed && styles.pressed]}>
            <View style={styles.episodeNumber}><Text style={styles.episodeNumberText}>{String(item.number || index + 1).padStart(2, '0')}</Text></View>
            <View style={styles.episodeCopy}>
              <Text numberOfLines={1} style={styles.episodeTitle}>{item.title || 'Episode ' + (index + 1)}</Text>
              <Text style={styles.episodeSub}>Watch episode</Text>
            </View>
            <View style={styles.episodePlay}>
              <SymbolView name={{ ios: 'play.fill', android: 'play_arrow', web: 'play_arrow' }} size={16} tintColor="#FFF" />
            </View>
          </Pressable>
        )}
        ListHeaderComponent={listHeader}
        ListEmptyComponent={<View style={styles.empty}><Text style={styles.muted}>{loading ? 'Loading episodes…' : episodes.length ? 'No episodes match that search.' : 'No episodes are listed for this series yet.'}</Text></View>}
        contentContainerStyle={styles.listContent}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={colors.accent} colors={[colors.accent]} progressBackgroundColor={colors.surface} />}
        showsVerticalScrollIndicator={false}
        initialNumToRender={12}
        maxToRenderPerBatch={10}
        windowSize={9}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  center: { flex: 1, minHeight: 300, alignItems: 'center', justifyContent: 'center', gap: 12, padding: 24, backgroundColor: colors.background },
  muted: { color: 'rgba(255,255,255,0.53)', fontFamily: fonts.regular, fontSize: 13, textAlign: 'center' },
  errorTitle: { color: '#FFF', fontFamily: fonts.bold, fontSize: 18, textAlign: 'center' },
  retryButton: { minHeight: 42, borderRadius: 9, backgroundColor: '#FFF', paddingHorizontal: 18, alignItems: 'center', justifyContent: 'center', marginTop: 4 },
  retryText: { color: '#111216', fontFamily: fonts.bold, fontSize: 12 },
  listContent: { paddingBottom: 32 },
  hero: { minHeight: 560, backgroundColor: colors.surface, overflow: 'hidden' },
  heroContent: { flex: 1, minHeight: 560, paddingHorizontal: 22, paddingBottom: 25, alignItems: 'flex-start', justifyContent: 'flex-end' },
  backButton: { position: 'absolute', top: 8, left: 18, width: 42, height: 42, alignItems: 'center', justifyContent: 'center', borderRadius: 21, backgroundColor: 'rgba(0,0,0,0.45)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)' },
  posterWrap: { width: 84, height: 120, overflow: 'hidden', borderRadius: 9, borderWidth: 1, borderColor: 'rgba(255,255,255,0.18)', marginBottom: 17 },
  poster: { width: '100%', height: '100%' },
  eyebrow: { color: colors.accentSoft, fontFamily: fonts.bold, fontSize: 9, letterSpacing: 2.1, marginBottom: 7 },
  title: { color: '#FFF', fontFamily: fonts.extraBold, fontSize: 30, lineHeight: 35, letterSpacing: -0.8 },
  metaRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 9, marginTop: 11 },
  score: { color: '#A7F3D0', fontFamily: fonts.bold, fontSize: 11 },
  meta: { color: 'rgba(255,255,255,0.62)', fontFamily: fonts.medium, fontSize: 10 },
  synopsis: { color: 'rgba(255,255,255,0.7)', fontFamily: fonts.regular, fontSize: 12, lineHeight: 18, marginTop: 14, maxWidth: 600 },
  readMoreHint: { color: 'rgba(255,255,255,0.4)', fontFamily: fonts.regular, fontSize: 10, marginTop: 4 },
  actionRow: { flexDirection: 'row', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginTop: 18 },
  playButton: { minHeight: 46, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 9, borderRadius: 8, backgroundColor: '#FFF', paddingHorizontal: 17 },
  playText: { color: '#111216', fontFamily: fonts.bold, fontSize: 13 },
  latestButton: { minHeight: 46, borderRadius: 8, backgroundColor: 'rgba(255,255,255,0.13)', paddingHorizontal: 15, justifyContent: 'center' },
  latestText: { color: '#FFF', fontFamily: fonts.semibold, fontSize: 12 },
  sectionHeader: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', paddingHorizontal: 20, marginTop: 26, marginBottom: 13 },
  sectionEyebrow: { color: colors.accent, fontFamily: fonts.bold, fontSize: 9, letterSpacing: 1.7, marginBottom: 5 },
  sectionTitle: { color: '#FFF', fontFamily: fonts.bold, fontSize: 21, letterSpacing: -0.3 },
  episodeCount: { color: 'rgba(255,255,255,0.43)', fontFamily: fonts.medium, fontSize: 10, paddingBottom: 3 },
  searchBar: { height: 46, flexDirection: 'row', alignItems: 'center', gap: 9, borderRadius: 10, backgroundColor: 'rgba(255,255,255,0.055)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.09)', marginHorizontal: 20, marginBottom: 14, paddingHorizontal: 13 },
  searchInput: { flex: 1, color: '#FFF', fontFamily: fonts.regular, fontSize: 13, paddingVertical: 8 },
  clear: { color: 'rgba(255,255,255,0.6)', fontSize: 22, lineHeight: 25 },
  episodeError: { color: colors.accentSoft, fontFamily: fonts.regular, fontSize: 11, marginHorizontal: 20, marginBottom: 12 },
  episodeRow: { minHeight: 66, flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 20, paddingVertical: 10, backgroundColor: 'rgba(255,255,255,0.018)' },
  pressed: { backgroundColor: 'rgba(255,255,255,0.07)' },
  episodeNumber: { width: 43, height: 43, alignItems: 'center', justifyContent: 'center', borderRadius: 9, backgroundColor: 'rgba(255,255,255,0.065)' },
  episodeNumberText: { color: 'rgba(255,255,255,0.6)', fontFamily: fonts.bold, fontSize: 12, fontVariant: ['tabular-nums'] },
  episodeCopy: { flex: 1, gap: 4 },
  episodeTitle: { color: 'rgba(255,255,255,0.9)', fontFamily: fonts.semibold, fontSize: 13 },
  episodeSub: { color: 'rgba(255,255,255,0.42)', fontFamily: fonts.regular, fontSize: 10 },
  episodePlay: { width: 35, height: 35, alignItems: 'center', justifyContent: 'center', borderRadius: 18, backgroundColor: 'rgba(229,9,20,0.78)' },
  separator: { height: StyleSheet.hairlineWidth, backgroundColor: 'rgba(255,255,255,0.07)', marginLeft: 75 },
  empty: { minHeight: 120, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 20 },
});

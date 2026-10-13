import { router, useLocalSearchParams } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, StatusBar, StyleSheet, Text, TextInput, useWindowDimensions, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { PonflixTheme } from '@/constants/theme';
import { BrandHeader } from '@/components/brand-header';
import { AppRefreshScrollView } from '@/components/app-refresh-scroll-view';
import { AnimeCard } from '@/features/anime/components/anime-card';
import { clearAnimeFeedCache, searchAnime } from '@/features/anime/api/anime-service';
import type { AnimeTitle } from '@/features/anime/types/anime';
import { ComicCard } from '@/features/comics/components/comic-card';
import { searchComics } from '@/features/comics/api/comic-service';
import type { ComicListItem } from '@/features/comics/types/comic';

const { colors, fonts } = PonflixTheme;
type ResultFilter = 'all' | 'anime' | 'comics';
type SearchResult = { kind: 'anime'; item: AnimeTitle } | { kind: 'comic'; item: ComicListItem };
const filters: { id: ResultFilter; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'anime', label: 'Anime' },
  { id: 'comics', label: 'Comics' },
];

export default function DiscoverScreen() {
  const params = useLocalSearchParams<{ query?: string | string[]; filter?: string | string[] }>();
  const initialQuery = Array.isArray(params.query) ? params.query[0] : params.query;
  const requestedFilter = Array.isArray(params.filter) ? params.filter[0] : params.filter;
  const initialFilter: ResultFilter = requestedFilter === 'anime' || requestedFilter === 'comics' ? requestedFilter : 'all';
  return <DiscoverContent key={`${initialQuery ?? ''}-${initialFilter}`} initialQuery={initialQuery ?? ''} initialFilter={initialFilter} />;
}

function DiscoverContent({ initialQuery, initialFilter }: { initialQuery: string; initialFilter: ResultFilter }) {
  const { width: screenWidth } = useWindowDimensions();
  const contentWidth = Math.max(0, screenWidth - 40);
  const columns = Math.min(5, Math.max(2, Math.floor((contentWidth + 12) / 160)));
  const cardWidth = (contentWidth - (columns - 1) * 12) / columns;
  const [query, setQuery] = useState(initialQuery);
  const [submittedQuery, setSubmittedQuery] = useState(initialQuery.trim());
  const [anime, setAnime] = useState<AnimeTitle[]>([]);
  const [comics, setComics] = useState<ComicListItem[]>([]);
  const [filter, setFilter] = useState<ResultFilter>(initialFilter);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [animeError, setAnimeError] = useState('');
  const [comicError, setComicError] = useState('');
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    Promise.allSettled([
      searchAnime(submittedQuery, controller.signal),
      searchComics(submittedQuery, controller.signal),
    ]).then(([animeResult, comicResult]) => {
      if (controller.signal.aborted) return;
      if (animeResult.status === 'fulfilled') {
        setAnime(animeResult.value);
        setAnimeError('');
      } else {
        setAnime([]);
        setAnimeError(animeResult.reason instanceof Error ? animeResult.reason.message : 'Anime search is unavailable.');
      }
      if (comicResult.status === 'fulfilled') {
        setComics(comicResult.value);
        setComicError('');
      } else {
        setComics([]);
        setComicError(comicResult.reason instanceof Error ? comicResult.reason.message : 'Comic search is unavailable.');
      }
    }).finally(() => {
      if (!controller.signal.aborted) {
        setLoading(false);
        setRefreshing(false);
      }
    });
    return () => controller.abort();
  }, [submittedQuery, reloadKey]);

  const results = useMemo<SearchResult[]>(() => [
    ...(filter === 'all' || filter === 'anime' ? anime.map((item): SearchResult => ({ kind: 'anime', item })) : []),
    ...(filter === 'all' || filter === 'comics' ? comics.map((item): SearchResult => ({ kind: 'comic', item })) : []),
  ], [anime, comics, filter]);

  const submitSearch = useCallback((value: string) => {
    const nextQuery = value.trim();
    setLoading(true);
    if (nextQuery === submittedQuery) setReloadKey((key) => key + 1);
    else setSubmittedQuery(nextQuery);
  }, [submittedQuery]);

  const refreshResults = useCallback(() => {
    if (refreshing) return;
    clearAnimeFeedCache();
    setRefreshing(true);
    setReloadKey((key) => key + 1);
  }, [refreshing]);

  const openAnime = useCallback((item: AnimeTitle) => {
    router.push({ pathname: '/anime/[slug]', params: { slug: item.slug } });
  }, []);
  const openComic = useCallback((item: ComicListItem) => {
    router.push({ pathname: '/comics/[id]', params: { id: item.id } });
  }, []);

  return (
    <View style={styles.screen}>
      <StatusBar barStyle="light-content" backgroundColor={colors.background} />
      <SafeAreaView edges={['top']} style={styles.safeArea}>
        <BrandHeader />
        <AppRefreshScrollView
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.content}
          refreshing={refreshing}
          onRefresh={refreshResults}>
          <View style={styles.pageHeading}>
            <Text style={styles.kicker}>FIND YOUR NEXT FAVORITE</Text>
            <Text style={styles.title}>Search Ponflix</Text>
            <Text style={styles.subtitle}>Find anime to watch and comics to read.</Text>
          </View>

          <View style={styles.searchBar}>
            <TextInput
              accessibilityLabel="Search anime and comics"
              autoCapitalize="none"
              autoCorrect={false}
              onChangeText={setQuery}
              onSubmitEditing={() => submitSearch(query)}
              placeholder="Search anime or comics"
              placeholderTextColor="rgba(255,255,255,0.4)"
              returnKeyType="search"
              style={styles.input}
              value={query}
            />
            {query ? <Pressable accessibilityRole="button" accessibilityLabel="Clear search" hitSlop={10} onPress={() => { setQuery(''); submitSearch(''); }} style={styles.clearButton}><Text style={styles.clearText}>×</Text></Pressable> : null}
            <Pressable accessibilityRole="button" accessibilityLabel="Search" onPress={() => submitSearch(query)} style={styles.searchButton}>
              <SymbolView name={{ ios: 'magnifyingglass', android: 'search', web: 'search' }} size={21} tintColor="#FFF" />
            </Pressable>
          </View>

          <View style={styles.filterRow}>
            {filters.map((item) => (
              <Pressable key={item.id} accessibilityRole="tab" accessibilityState={{ selected: filter === item.id }} onPress={() => setFilter(item.id)} style={[styles.filterButton, filter === item.id && styles.filterSelected]}>
                <Text style={[styles.filterText, filter === item.id && styles.filterTextSelected]}>{item.label}</Text>
              </Pressable>
            ))}
          </View>

          <View style={styles.resultsHeader}>
            <Text style={styles.resultsTitle}>{submittedQuery ? `Results for “${submittedQuery}”` : 'Popular right now'}</Text>
            {!loading ? <Text style={styles.count}>{results.length} titles</Text> : null}
          </View>

          {loading ? (
            <View style={styles.loading}><ActivityIndicator color={colors.accent} /><Text style={styles.loadingText}>Searching anime and comics…</Text></View>
          ) : results.length ? (
            <View style={styles.grid}>
              {results.map((result) => result.kind === 'anime' ? (
                <AnimeCard key={`anime-${result.item.slug}`} anime={result.item} width={cardWidth} onPress={openAnime} />
              ) : (
                <ComicCard key={`comic-${result.item.id}`} comic={result.item} width={cardWidth} onPress={openComic} />
              ))}
            </View>
          ) : (
            <View style={styles.empty}>
              <Text style={styles.emptyTitle}>{animeError && comicError ? 'Search is unavailable' : 'No titles found'}</Text>
              <Text style={styles.emptyText}>{animeError && comicError ? 'Please check your connection and try again.' : 'Try a different title, or switch between Anime and Comics.'}</Text>
              {animeError && comicError ? <Pressable accessibilityRole="button" onPress={() => submitSearch(submittedQuery)} style={styles.retryButton}><Text style={styles.retryText}>Try again</Text></Pressable> : null}
            </View>
          )}
        </AppRefreshScrollView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  safeArea: { flex: 1 },
  content: { flexGrow: 1, paddingHorizontal: 20, paddingBottom: 28 },
  pageHeading: { paddingTop: 14, paddingBottom: 22 },
  kicker: { color: colors.accent, fontFamily: fonts.bold, fontSize: 10, letterSpacing: 2 },
  title: { color: '#FFF', fontFamily: fonts.extraBold, fontSize: 30, lineHeight: 36, letterSpacing: -0.8, marginTop: 9 },
  subtitle: { color: 'rgba(255,255,255,0.55)', fontFamily: fonts.regular, fontSize: 13, lineHeight: 19, marginTop: 6 },
  searchBar: { minHeight: 50, flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)', borderRadius: 10, backgroundColor: 'rgba(255,255,255,0.045)', paddingLeft: 14, paddingRight: 5 },
  input: { flex: 1, color: '#FFF', fontFamily: fonts.regular, fontSize: 14, paddingVertical: 10 },
  clearButton: { width: 32, height: 38, alignItems: 'center', justifyContent: 'center' },
  clearText: { color: 'rgba(255,255,255,0.55)', fontSize: 23, lineHeight: 26 },
  searchButton: { width: 42, height: 40, borderRadius: 7, backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center' },
  filterRow: { flexDirection: 'row', gap: 8, marginTop: 17 },
  filterButton: { minHeight: 35, paddingHorizontal: 15, justifyContent: 'center', borderRadius: 18, borderWidth: 1, borderColor: 'rgba(255,255,255,0.13)', backgroundColor: 'rgba(255,255,255,0.04)' },
  filterSelected: { borderColor: colors.accent, backgroundColor: colors.accent },
  filterText: { color: 'rgba(255,255,255,0.62)', fontFamily: fonts.semibold, fontSize: 12 },
  filterTextSelected: { color: '#FFF' },
  resultsHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 25, marginBottom: 14 },
  resultsTitle: { color: '#F7F7F8', fontFamily: fonts.bold, fontSize: 17, flex: 1 },
  count: { color: 'rgba(255,255,255,0.4)', fontFamily: fonts.regular, fontSize: 11, marginLeft: 8 },
  grid: { width: '100%', flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', rowGap: 19 },
  loading: { minHeight: 130, alignItems: 'center', justifyContent: 'center', gap: 11 },
  loadingText: { color: 'rgba(255,255,255,0.48)', fontFamily: fonts.regular, fontSize: 12 },
  empty: { minHeight: 150, alignItems: 'center', justifyContent: 'center', padding: 20, borderRadius: 11, backgroundColor: 'rgba(255,255,255,0.035)' },
  emptyTitle: { color: '#FFF', fontFamily: fonts.bold, fontSize: 15, marginBottom: 5 },
  emptyText: { color: 'rgba(255,255,255,0.52)', fontFamily: fonts.regular, textAlign: 'center', fontSize: 12, lineHeight: 18 },
  retryButton: { marginTop: 11, minHeight: 36, borderRadius: 8, backgroundColor: '#FFF', paddingHorizontal: 14, alignItems: 'center', justifyContent: 'center' },
  retryText: { color: '#111216', fontFamily: fonts.bold, fontSize: 12 },
});

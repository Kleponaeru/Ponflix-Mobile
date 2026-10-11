import { Image } from 'expo-image';
import { useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StatusBar, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AnimeCard } from '@/features/anime/components/anime-card';
import { searchAnime } from '@/features/anime/api/anime-service';
import type { AnimeTitle } from '@/features/anime/types/anime';
import { PonflixTheme } from '@/constants/theme';

const { colors, fonts } = PonflixTheme;

export default function DiscoverScreen() {
  const params = useLocalSearchParams<{ query?: string | string[] }>();
  const initialQuery = Array.isArray(params.query) ? params.query[0] : params.query;
  return <DiscoverContent key={initialQuery ?? 'popular'} initialQuery={initialQuery ?? ''} />;
}

function DiscoverContent({ initialQuery }: { initialQuery: string }) {
  const [query, setQuery] = useState(initialQuery);
  const [submittedQuery, setSubmittedQuery] = useState(initialQuery.trim());
  const [anime, setAnime] = useState<AnimeTitle[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    searchAnime(submittedQuery, controller.signal)
      .then(setAnime)
      .catch((cause: unknown) => {
        if (!controller.signal.aborted) {
          setAnime([]);
          setError(cause instanceof Error ? cause.message : 'Anime could not be loaded.');
        }
      })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [submittedQuery, reloadKey]);

  const submitSearch = (value: string) => {
    const nextQuery = value.trim();
    setLoading(true);
    setError('');
    if (nextQuery === submittedQuery) setReloadKey((key) => key + 1);
    else setSubmittedQuery(nextQuery);
  };

  const openAnime = (item: AnimeTitle) => {
    setQuery(item.title);
    submitSearch(item.title);
  };

  return (
    <View style={styles.screen}>
      <StatusBar barStyle="light-content" backgroundColor={colors.background} />
      <SafeAreaView edges={['top']} style={styles.safeArea}>
        <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
          <View style={styles.header}>
            <Image source={require('../../../../assets/branding/ponflix-logo.png')} contentFit="contain" style={styles.logo} />
            <Text style={styles.kicker}>ANIME COLLECTION</Text>
            <Text style={styles.title}>{submittedQuery ? 'Search results' : 'Find your next series.'}</Text>
            <Text style={styles.subtitle}>Search anime and explore what’s popular on Ponflix.</Text>
          </View>

          <View style={styles.searchBar}>
            <TextInput
              accessibilityLabel="Search anime titles"
              autoCapitalize="none"
              autoCorrect={false}
              onChangeText={setQuery}
              onSubmitEditing={() => submitSearch(query)}
              placeholder="Search anime"
              placeholderTextColor="rgba(255,255,255,0.4)"
              returnKeyType="search"
              style={styles.input}
              value={query}
            />
            {query ? (
              <Pressable accessibilityRole="button" accessibilityLabel="Clear search" hitSlop={10} onPress={() => { setQuery(''); submitSearch(''); }} style={styles.clearButton}>
                <Text style={styles.clearText}>×</Text>
              </Pressable>
            ) : null}
            <Pressable accessibilityRole="button" onPress={() => submitSearch(query)} style={styles.searchButton}>
              <Text style={styles.searchButtonText}>Search</Text>
            </Pressable>
          </View>

          <View style={styles.resultsHeader}>
            <Text style={styles.resultsTitle}>{submittedQuery ? `Results for “${submittedQuery}”` : 'Popular right now'}</Text>
            {!loading && anime.length ? <Text style={styles.count}>{anime.length} titles</Text> : null}
          </View>

          {loading ? (
            <View style={styles.loading}><ActivityIndicator color="#E50914" /><Text style={styles.loadingText}>Finding anime…</Text></View>
          ) : error ? (
            <View style={styles.empty}><Text style={styles.emptyText}>{error}</Text><Pressable accessibilityRole="button" onPress={() => submitSearch(submittedQuery)} style={styles.retryButton}><Text style={styles.retryText}>Try again</Text></Pressable></View>
          ) : anime.length ? (
            <View style={styles.grid}>
              {anime.map((item) => <AnimeCard key={item.slug} anime={item} onPress={openAnime} />)}
            </View>
          ) : (
            <View style={styles.empty}><Text style={styles.emptyTitle}>No anime found</Text><Text style={styles.emptyText}>Try another title or browse what’s popular.</Text></View>
          )}
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  safeArea: { flex: 1 },
  content: { paddingHorizontal: 20, paddingBottom: 28 },
  header: { paddingTop: 14, paddingBottom: 22 },
  logo: { width: 122, height: 41, marginBottom: 24 },
  kicker: { color: colors.accent, fontFamily: fonts.bold, fontSize: 10, letterSpacing: 2 },
  title: { color: '#FFF', fontFamily: fonts.extraBold, fontSize: 30, lineHeight: 36, letterSpacing: -0.8, marginTop: 9 },
  subtitle: { color: 'rgba(255,255,255,0.55)', fontFamily: fonts.regular, fontSize: 13, lineHeight: 19, marginTop: 6 },
  searchBar: { minHeight: 50, flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)', borderRadius: 10, backgroundColor: 'rgba(255,255,255,0.045)', paddingLeft: 14, paddingRight: 5 },
  input: { flex: 1, color: '#FFF', fontFamily: fonts.regular, fontSize: 14, paddingVertical: 10 },
  clearButton: { width: 32, height: 38, alignItems: 'center', justifyContent: 'center' },
  clearText: { color: 'rgba(255,255,255,0.55)', fontSize: 23, lineHeight: 26 },
  searchButton: { minHeight: 40, borderRadius: 7, backgroundColor: '#E50914', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 14 },
  searchButtonText: { color: '#FFF', fontFamily: fonts.bold, fontSize: 12 },
  retryButton: { marginTop: 11, minHeight: 36, borderRadius: 8, backgroundColor: '#FFF', paddingHorizontal: 14, alignItems: 'center', justifyContent: 'center' },
  retryText: { color: '#111216', fontFamily: fonts.bold, fontSize: 12 },
  resultsHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 27, marginBottom: 14 },
  resultsTitle: { color: '#F7F7F8', fontFamily: fonts.bold, fontSize: 17, flex: 1 },
  count: { color: 'rgba(255,255,255,0.4)', fontFamily: fonts.regular, fontSize: 11, marginLeft: 8 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', rowGap: 19 },
  loading: { minHeight: 130, alignItems: 'center', justifyContent: 'center', gap: 11 },
  loadingText: { color: 'rgba(255,255,255,0.48)', fontFamily: fonts.regular, fontSize: 12 },
  empty: { minHeight: 130, alignItems: 'center', justifyContent: 'center', padding: 20, borderRadius: 11, backgroundColor: 'rgba(255,255,255,0.035)' },
  emptyTitle: { color: '#FFF', fontFamily: fonts.bold, fontSize: 15, marginBottom: 5 },
  emptyText: { color: 'rgba(255,255,255,0.52)', fontFamily: fonts.regular, textAlign: 'center', fontSize: 12, lineHeight: 18 },
});

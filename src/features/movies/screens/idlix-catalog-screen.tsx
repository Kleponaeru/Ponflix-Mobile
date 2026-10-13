import { Image } from 'expo-image';
import { router, type Href } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StatusBar, StyleSheet, Text, TextInput, useWindowDimensions, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppRefreshScrollView } from '@/components/app-refresh-scroll-view';
import { BrandHeader } from '@/components/brand-header';
import { PonflixTheme } from '@/constants/theme';
import { fetchIdlixTitles, searchIdlixTitles, type IdlixCategory, type IdlixTitle } from '@/features/movies/api/idlix-service';

const { colors, fonts } = PonflixTheme;
const categories: { id: IdlixCategory; label: string }[] = [
  { id: 'movie', label: 'Movies' },
  { id: 'series', label: 'Series' },
];

export default function IdlixCatalogScreen() {
  const { width } = useWindowDimensions();
  const [category, setCategory] = useState<IdlixCategory>('movie');
  const [query, setQuery] = useState('');
  const [submittedQuery, setSubmittedQuery] = useState('');
  const [titles, setTitles] = useState<IdlixTitle[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [reloadKey, setReloadKey] = useState(0);
  const contentWidth = Math.max(0, width - 40);
  const columns = Math.min(5, Math.max(2, Math.floor((contentWidth + 12) / 160)));
  const cardWidth = (contentWidth - (columns - 1) * 12) / columns;

  useEffect(() => {
    const controller = new AbortController();
    const request = submittedQuery.trim()
      ? searchIdlixTitles(submittedQuery, category, controller.signal)
      : fetchIdlixTitles(category, 1, controller.signal);
    request.then((items) => {
      if (controller.signal.aborted) return;
      setTitles(items);
    }).catch((reason: unknown) => {
      if (controller.signal.aborted) return;
      setTitles([]);
      setError(reason instanceof Error ? reason.message : 'Idlix could not load titles.');
    }).finally(() => {
      if (!controller.signal.aborted) {
        setLoading(false);
        setRefreshing(false);
      }
    });
    return () => controller.abort();
  }, [category, submittedQuery, reloadKey]);

  const submitSearch = useCallback(() => {
    const nextQuery = query.trim();
    setLoading(true);
    setError('');
    if (nextQuery === submittedQuery) setReloadKey((value) => value + 1);
    else setSubmittedQuery(nextQuery);
  }, [query, submittedQuery]);
  const refresh = useCallback(() => {
    if (refreshing) return;
    setLoading(true);
    setError('');
    setRefreshing(true);
    setReloadKey((value) => value + 1);
  }, [refreshing]);

  const openTitle = useCallback((title: IdlixTitle) => {
    const href = `/(tabs)/movies/idlix/${encodeURIComponent(title.slug)}?type=${encodeURIComponent(title.type === 'Series' ? 'series' : 'movie')}` as Href;
    router.push(href);
  }, []);

  return (
    <View style={styles.screen}>
      <StatusBar barStyle="light-content" backgroundColor={colors.background} />
      <SafeAreaView edges={['top']} style={styles.safeArea}>
        <BrandHeader rightAction={(
          <Pressable accessibilityRole="button" accessibilityLabel="Back to movie providers" onPress={() => router.back()} style={styles.backButton}>
            <Text style={styles.backText}>Providers</Text>
          </Pressable>
        )} />
        <AppRefreshScrollView
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.content}
          refreshing={refreshing}
          onRefresh={refresh}>
          <View style={styles.heading}>
            <Text style={styles.kicker}>PONFLIX PROVIDER</Text>
            <Text style={styles.title}>Idlix</Text>
            <Text style={styles.subtitle}>Browse Idlix movies and series on this Android device.</Text>
          </View>

          <View style={styles.categoryRow}>
            {categories.map((item) => (
              <Pressable key={item.id} accessibilityRole="tab" accessibilityState={{ selected: category === item.id }} onPress={() => { setLoading(true); setError(''); setCategory(item.id); }} style={[styles.categoryButton, category === item.id && styles.categorySelected]}>
                <Text style={[styles.categoryText, category === item.id && styles.categoryTextSelected]}>{item.label}</Text>
              </Pressable>
            ))}
          </View>

          <View style={styles.searchBar}>
            <TextInput
              accessibilityLabel="Search Idlix"
              autoCapitalize="none"
              autoCorrect={false}
              onChangeText={setQuery}
              onSubmitEditing={submitSearch}
              placeholder="Search Idlix titles"
              placeholderTextColor="rgba(255,255,255,0.38)"
              returnKeyType="search"
              style={styles.searchInput}
              value={query}
            />
            <Pressable accessibilityRole="button" accessibilityLabel="Search Idlix" onPress={submitSearch} style={styles.searchButton}><Text style={styles.searchGlyph}>⌕</Text></Pressable>
          </View>

          <View style={styles.listHeading}>
            <Text style={styles.sectionTitle}>{submittedQuery ? `Results for “${submittedQuery}”` : `Latest ${category === 'series' ? 'series' : 'movies'}`}</Text>
            {!loading ? <Text style={styles.count}>{titles.length}</Text> : null}
          </View>

          {loading ? <View style={styles.state}><ActivityIndicator color={colors.accent} /><Text style={styles.stateText}>Loading from Idlix…</Text></View> : error ? (
            <View style={styles.stateCard}>
              <Text style={styles.stateTitle}>Idlix couldn’t load</Text>
              <Text style={styles.stateText}>{error}</Text>
              <Pressable accessibilityRole="button" onPress={refresh} style={styles.retryButton}><Text style={styles.retryText}>Try again</Text></Pressable>
            </View>
          ) : titles.length ? (
            <View style={styles.grid}>
              {titles.map((title) => <TitleCard key={`${title.id}-${title.type}`} title={title} width={cardWidth} onPress={openTitle} />)}
            </View>
          ) : <View style={styles.stateCard}><Text style={styles.stateTitle}>No titles found</Text><Text style={styles.stateText}>Try another search, or pull down to refresh.</Text></View>}
        </AppRefreshScrollView>
      </SafeAreaView>
    </View>
  );
}

function TitleCard({ title, width, onPress }: { title: IdlixTitle; width: number; onPress: (title: IdlixTitle) => void }) {
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={`Open ${title.title} on Idlix`} onPress={() => onPress(title)} style={({ pressed }) => [styles.titleCard, { width }, pressed && styles.pressed]}>
      <View style={styles.poster}>
        {title.posterUrl ? <Image source={{ uri: title.posterUrl }} contentFit="cover" cachePolicy="memory-disk" transition={180} style={StyleSheet.absoluteFill} /> : <View style={styles.posterFallback}><Text style={styles.posterFallbackText}>PONFLIX</Text></View>}
        <View style={styles.posterShade} />
        <View style={styles.typeBadge}><Text style={styles.typeBadgeText}>{title.year || title.type.toUpperCase()}</Text></View>
        <Text numberOfLines={2} style={styles.posterTitle}>{title.title}</Text>
      </View>
      {title.status ? <Text numberOfLines={1} style={styles.statusText}>{title.status}</Text> : <View style={styles.statusSpacer} />}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  safeArea: { flex: 1 },
  content: { flexGrow: 1, paddingHorizontal: 20, paddingBottom: 32 },
  heading: { paddingTop: 12, paddingBottom: 18 },
  kicker: { color: colors.accent, fontFamily: fonts.bold, fontSize: 10, letterSpacing: 2 },
  title: { color: '#FFF', fontFamily: fonts.extraBold, fontSize: 29, lineHeight: 35, marginTop: 8 },
  subtitle: { color: 'rgba(255,255,255,0.55)', fontFamily: fonts.regular, fontSize: 12, lineHeight: 18, marginTop: 5 },
  backButton: { minHeight: 34, paddingHorizontal: 11, borderRadius: 8, backgroundColor: 'rgba(255,255,255,0.075)', justifyContent: 'center' },
  backText: { color: '#FFF', fontFamily: fonts.semibold, fontSize: 11 },
  categoryRow: { flexDirection: 'row', gap: 8, marginBottom: 12 },
  categoryButton: { minHeight: 34, paddingHorizontal: 15, justifyContent: 'center', borderRadius: 18, borderWidth: 1, borderColor: 'rgba(255,255,255,0.14)', backgroundColor: 'rgba(255,255,255,0.035)' },
  categorySelected: { backgroundColor: colors.accent, borderColor: colors.accent },
  categoryText: { color: 'rgba(255,255,255,0.6)', fontFamily: fonts.semibold, fontSize: 11 },
  categoryTextSelected: { color: '#FFF' },
  searchBar: { minHeight: 46, flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)', borderRadius: 9, backgroundColor: 'rgba(255,255,255,0.04)', paddingLeft: 13, paddingRight: 4 },
  searchInput: { flex: 1, color: '#FFF', fontFamily: fonts.regular, fontSize: 12, paddingVertical: 9 },
  searchButton: { width: 38, height: 38, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.accent, borderRadius: 7 },
  searchGlyph: { color: '#FFF', fontSize: 21, lineHeight: 24 },
  listHeading: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 23, marginBottom: 13 },
  sectionTitle: { color: '#F7F7F8', fontFamily: fonts.bold, fontSize: 16 },
  count: { color: 'rgba(255,255,255,0.42)', fontFamily: fonts.medium, fontSize: 11 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', rowGap: 17 },
  titleCard: {},
  pressed: { opacity: 0.8 },
  poster: { aspectRatio: 2 / 3, borderRadius: 11, overflow: 'hidden', backgroundColor: colors.surface, borderWidth: 1, borderColor: 'rgba(255,255,255,0.07)', justifyContent: 'flex-end', padding: 9 },
  posterFallback: { ...StyleSheet.absoluteFill, alignItems: 'center', justifyContent: 'center' },
  posterFallbackText: { color: 'rgba(255,255,255,0.25)', fontFamily: fonts.extraBold, fontSize: 12, letterSpacing: 2 },
  posterShade: { ...StyleSheet.absoluteFill, backgroundColor: 'rgba(5,6,8,0.32)' },
  typeBadge: { position: 'absolute', top: 7, right: 7, maxWidth: 74, paddingHorizontal: 6, paddingVertical: 4, borderRadius: 4, backgroundColor: 'rgba(0,0,0,0.72)' },
  typeBadgeText: { color: '#FFF', fontFamily: fonts.bold, fontSize: 8 },
  posterTitle: { color: '#FFF', fontFamily: fonts.bold, fontSize: 12, lineHeight: 16 },
  statusText: { color: 'rgba(255,255,255,0.45)', fontFamily: fonts.regular, fontSize: 9, paddingTop: 6 },
  statusSpacer: { height: 14 },
  state: { minHeight: 135, justifyContent: 'center', alignItems: 'center', gap: 10 },
  stateCard: { minHeight: 138, padding: 20, borderRadius: 10, backgroundColor: 'rgba(255,255,255,0.035)', alignItems: 'center', justifyContent: 'center' },
  stateTitle: { color: '#FFF', fontFamily: fonts.bold, fontSize: 14, textAlign: 'center' },
  stateText: { color: 'rgba(255,255,255,0.52)', fontFamily: fonts.regular, fontSize: 11, lineHeight: 17, textAlign: 'center', marginTop: 5 },
  retryButton: { minHeight: 34, marginTop: 11, paddingHorizontal: 14, borderRadius: 7, justifyContent: 'center', backgroundColor: '#FFF' },
  retryText: { color: '#111216', fontFamily: fonts.bold, fontSize: 11 },
});

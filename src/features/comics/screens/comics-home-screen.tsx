import { router } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, StatusBar, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { PonflixTheme } from '@/constants/theme';
import { AppRefreshFlatList } from '@/components/app-refresh-flat-list';
import { BrandHeader } from '@/components/brand-header';
import { SpotlightBanner } from '@/components/spotlight-banner';
import { ComicCard } from '@/features/comics/components/comic-card';
import { fetchComicPage } from '@/features/comics/api/comic-service';
import type { ComicCategory, ComicListItem } from '@/features/comics/types/comic';

const { colors, fonts } = PonflixTheme;
const categories: { id: ComicCategory; label: string }[] = [
  { id: 'manga', label: 'Manga' },
  { id: 'manhwa', label: 'Manhwa' },
  { id: 'manhua', label: 'Manhua' },
];
const horizontalGap = 12;

export default function ComicsHomeScreen() {
  const [category, setCategory] = useState<ComicCategory>('manhwa');
  return <ComicsCategoryScreen key={category} category={category} onSelectCategory={setCategory} />;
}

function ComicsCategoryScreen({ category, onSelectCategory }: { category: ComicCategory; onSelectCategory: (category: ComicCategory) => void }) {
  const { width: screenWidth } = useWindowDimensions();
  const columns = Math.min(5, Math.max(2, Math.floor((screenWidth - 40 + horizontalGap) / (148 + horizontalGap))));
  const cardWidth = (screenWidth - 40 - (columns - 1) * horizontalGap) / columns;
  const listRef = useRef<FlatList<ComicListItem>>(null);
  const loadingMoreRef = useRef(false);
  const pageRequestRef = useRef<AbortController | null>(null);
  const [comics, setComics] = useState<ComicListItem[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const controller = new AbortController();
    pageRequestRef.current?.abort();
    pageRequestRef.current = null;
    loadingMoreRef.current = false;
    fetchComicPage(category, 1, controller.signal)
      .then((result) => {
        if (controller.signal.aborted) return;
        setComics(result.items);
        setPage(result.page);
        setTotalPages(result.totalPages);
      })
      .catch((cause: unknown) => {
        if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : 'Comics could not be loaded.');
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });

    return () => {
      controller.abort();
      pageRequestRef.current?.abort();
    };
  }, [category]);

  const refresh = useCallback(() => {
    if (refreshing) return;
    pageRequestRef.current?.abort();
    const controller = new AbortController();
    pageRequestRef.current = controller;
    setRefreshing(true);
    setError('');
    fetchComicPage(category, 1, controller.signal)
      .then((result) => {
        if (controller.signal.aborted) return;
        setComics(result.items);
        setPage(result.page);
        setTotalPages(result.totalPages);
      })
      .catch((cause: unknown) => {
        if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : 'Comics could not be refreshed.');
      })
      .finally(() => {
        if (!controller.signal.aborted) setRefreshing(false);
        if (pageRequestRef.current === controller) pageRequestRef.current = null;
      });
  }, [category, refreshing]);

  const loadNextPage = useCallback(() => {
    if (loadingMoreRef.current || loading || refreshing || page >= totalPages || error) return;
    loadingMoreRef.current = true;
    setLoadingMore(true);
    const controller = new AbortController();
    pageRequestRef.current = controller;
    fetchComicPage(category, page + 1, controller.signal)
      .then((result) => {
        if (controller.signal.aborted) return;
        setComics((current) => {
          const ids = new Set(current.map((item) => item.id));
          return [...current, ...result.items.filter((item) => !ids.has(item.id))];
        });
        setPage(result.page);
        setTotalPages(result.totalPages);
      })
      .catch(() => {})
      .finally(() => {
        if (!controller.signal.aborted) {
          loadingMoreRef.current = false;
          setLoadingMore(false);
        }
        if (pageRequestRef.current === controller) pageRequestRef.current = null;
      });
  }, [category, error, loading, refreshing, page, totalPages]);

  const openComic = useCallback((comic: ComicListItem) => {
    router.push({ pathname: '/comics/[id]', params: { id: comic.id } });
  }, []);

  const listHeader = (
    <View>
      <View style={styles.bannerBleed}>
        <SpotlightBanner
          imageUrl={comics[0]?.imageUrl}
          eyebrow="THE NEXT CHAPTER STARTS HERE"
          title="Stories worth staying up for."
          description="Explore manga, manhwa and manhua picked for your next reading session."
          primaryLabel="Search comics"
          onPrimaryPress={() => router.push({ pathname: '/search', params: { filter: 'comics' } })}
          secondaryLabel="Browse titles"
          onSecondaryPress={() => listRef.current?.scrollToOffset({ offset: 540, animated: true })}
        />
      </View>
      <View style={styles.categoryRow}>
        {categories.map((item) => {
          const selected = category === item.id;
          return (
            <Pressable
              accessibilityRole="tab"
              accessibilityState={{ selected }}
              key={item.id}
              onPress={() => onSelectCategory(item.id)}
              style={[styles.categoryButton, selected && styles.categorySelected]}>
              <Text style={[styles.categoryText, selected && styles.categoryTextSelected]}>{item.label}</Text>
            </Pressable>
          );
        })}
      </View>
      <View style={styles.resultsHeader}>
        <View>
          <Text style={styles.sectionEyebrow}>CURATED FOR YOU</Text>
          <Text style={styles.sectionTitle}>{categories.find((item) => item.id === category)?.label} to read</Text>
        </View>
        {!loading && !error ? <Text style={styles.resultCount}>{comics.length} titles</Text> : null}
      </View>
    </View>
  );

  return (
    <View style={styles.screen}>
      <StatusBar barStyle="light-content" backgroundColor={colors.background} />
      <SafeAreaView edges={['top']} style={styles.safeArea}>
        <BrandHeader />
        <AppRefreshFlatList
          ref={listRef}
          key={category + '-' + columns}
          data={comics}
          numColumns={columns}
          keyExtractor={(item) => item.id}
          renderItem={({ item, index }) => (
            <View style={{ marginRight: (index + 1) % columns === 0 ? 0 : horizontalGap }}>
              <ComicCard comic={item} width={cardWidth} onPress={openComic} />
            </View>
          )}
          ListHeaderComponent={listHeader}
          ListEmptyComponent={loading ? (
            <View style={styles.stateBox}><ActivityIndicator color={colors.accent} /><Text style={styles.stateText}>Finding your next read…</Text></View>
          ) : error ? (
            <View style={styles.stateBox}><Text style={styles.stateTitle}>Couldn’t load comics</Text><Text style={styles.stateText}>{error}</Text><Pressable onPress={refresh} style={styles.retryButton}><Text style={styles.retryText}>Try again</Text></Pressable></View>
          ) : (
            <View style={styles.stateBox}><Text style={styles.stateText}>No titles found in this collection.</Text></View>
          )}
          ListFooterComponent={loadingMore ? <ActivityIndicator color={colors.accent} style={styles.footerLoader} /> : null}
          contentContainerStyle={styles.listContent}
          columnWrapperStyle={columns > 1 ? styles.column : undefined}
          showsVerticalScrollIndicator={false}
          refreshing={refreshing}
          onRefresh={refresh}
          onEndReached={loadNextPage}
          onEndReachedThreshold={0.55}
          initialNumToRender={columns * 5}
          maxToRenderPerBatch={columns * 4}
          windowSize={7}
          removeClippedSubviews
        />
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  safeArea: { flex: 1 },
  listContent: { paddingHorizontal: 20, paddingBottom: 28 },
  bannerBleed: { marginHorizontal: -20, marginBottom: 22 },
  categoryRow: { flexDirection: 'row', gap: 9, marginTop: 22, marginBottom: 27 },
  categoryButton: { minHeight: 39, paddingHorizontal: 15, borderRadius: 20, borderWidth: 1, borderColor: 'rgba(255,255,255,0.14)', alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.035)' },
  categorySelected: { borderColor: colors.accent, backgroundColor: colors.accent },
  categoryText: { color: 'rgba(255,255,255,0.62)', fontFamily: fonts.semibold, fontSize: 12 },
  categoryTextSelected: { color: '#FFF' },
  resultsHeader: { minHeight: 45, flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', marginBottom: 15 },
  sectionEyebrow: { color: colors.accent, fontFamily: fonts.bold, fontSize: 9, letterSpacing: 1.7, marginBottom: 4 },
  sectionTitle: { color: '#F7F7F8', fontFamily: fonts.bold, fontSize: 18, letterSpacing: -0.35 },
  resultCount: { color: 'rgba(255,255,255,0.4)', fontFamily: fonts.regular, fontSize: 10, paddingBottom: 3 },
  column: { justifyContent: 'flex-start' },
  stateBox: { minHeight: 180, alignItems: 'center', justifyContent: 'center', gap: 9, paddingHorizontal: 16 },
  stateTitle: { color: '#FFF', fontFamily: fonts.bold, fontSize: 16 },
  stateText: { color: 'rgba(255,255,255,0.52)', fontFamily: fonts.regular, fontSize: 12, lineHeight: 18, textAlign: 'center' },
  retryButton: { minHeight: 38, borderRadius: 8, backgroundColor: '#FFF', paddingHorizontal: 15, alignItems: 'center', justifyContent: 'center', marginTop: 3 },
  retryText: { color: '#111216', fontFamily: fonts.bold, fontSize: 12 },
  footerLoader: { padding: 20 },
});

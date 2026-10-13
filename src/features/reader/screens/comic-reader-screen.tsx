import { Image } from 'expo-image';
import { router, useLocalSearchParams } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, RefreshControl, StatusBar, StyleSheet, Text, View, type ViewToken } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { PonflixTheme } from '@/constants/theme';
import { useLibrary } from '@/features/library/context/library-context';
import { fetchComicReader } from '@/features/comics/api/comic-service';
import type { ComicReaderData } from '@/features/comics/types/comic';

const { colors, fonts } = PonflixTheme;

function ReaderPage({ uri, pageNumber }: { uri: string; pageNumber: number }) {
  const [aspectRatio, setAspectRatio] = useState(0.68);
  return (
    <View style={styles.readerPage}>
      <Image
        source={{ uri }}
        contentFit="contain"
        cachePolicy="memory-disk"
        priority={pageNumber <= 2 ? 'high' : 'normal'}
        transition={120}
        recyclingKey={uri}
        style={[styles.pageImage, { aspectRatio }]}
        onLoad={(event) => {
          const { width, height } = event.source;
          if (width > 0 && height > 0) setAspectRatio(width / height);
        }}
      />
    </View>
  );
}

export default function ComicReaderScreen() {
  const params = useLocalSearchParams<{ id?: string | string[]; chapterId?: string | string[] }>();
  const id = Array.isArray(params.id) ? params.id[0] : params.id;
  const chapterId = Array.isArray(params.chapterId) ? params.chapterId[0] : params.chapterId;
  return <ComicReaderContent key={chapterId || 'missing'} id={id} chapterId={chapterId} />;
}

function ComicReaderContent({ id, chapterId }: { id?: string; chapterId?: string }) {
  const { recordProgress } = useLibrary();
  const [chapter, setChapter] = useState<ComicReaderData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(false);
  const [currentPage, setCurrentPage] = useState(0);
  const [reloadKey, setReloadKey] = useState(0);
  const pageListRef = useRef<FlatList<string>>(null);
  const viewabilityConfig = useMemo(() => ({ viewAreaCoveragePercentThreshold: 60 }), []);
  const onViewableItemsChanged = useCallback(({ viewableItems }: { viewableItems: ViewToken[] }) => {
    const visible = viewableItems.find((item) => item.isViewable && item.index != null);
    if (visible?.index != null) setCurrentPage(visible.index);
  }, []);

  useEffect(() => {
    if (!chapterId) return;
    const controller = new AbortController();
    fetchComicReader(chapterId, controller.signal)
      .then((result) => {
        setChapter(result);
        if (id) {
          recordProgress({
            type: 'comic',
            id,
            title: result.mangaTitle,
            subtitle: result.title,
            route: `/comics/${id}/chapter/${chapterId}`,
          });
        }
      })
      .catch(() => { if (!controller.signal.aborted) setError(true); })
      .finally(() => {
        if (!controller.signal.aborted) {
          setLoading(false);
          setRefreshing(false);
        }
      });
    return () => controller.abort();
  }, [chapterId, id, recordProgress, reloadKey]);

  const navigateChapter = useCallback((nextChapter?: string) => {
    if (!id || !nextChapter) return;
    router.replace({ pathname: '/comics/[id]/chapter/[chapterId]', params: { id, chapterId: nextChapter } });
  }, [id]);

  const refresh = () => {
    if (refreshing) return;
    setRefreshing(true);
    setLoading(true);
    setError(false);
    setReloadKey((key) => key + 1);
  };

  if (loading && !chapter) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.accent} size="large" />
        <Text style={styles.centerText}>Opening chapter…</Text>
      </View>
    );
  }

  if (error || !chapter) {
    return (
      <SafeAreaView style={styles.screen} edges={['top']}>
        <StatusBar barStyle="light-content" backgroundColor={colors.background} />
        <View style={styles.center}>
          <SymbolView name={{ ios: 'book.closed', android: 'menu_book', web: 'menu_book' }} size={34} tintColor={colors.accentSoft} />
          <Text style={styles.errorTitle}>Chapter unavailable</Text>
          <Text style={styles.centerText}>This chapter couldn’t be opened. Try again or choose another chapter.</Text>
          <Pressable onPress={refresh} style={styles.retryButton}><Text style={styles.retryText}>Try again</Text></Pressable>
          {id ? <Pressable onPress={() => router.replace({ pathname: '/comics/[id]', params: { id } })} style={styles.backToTitle}><Text style={styles.backText}>Back to title</Text></Pressable> : null}
        </View>
      </SafeAreaView>
    );
  }

  const totalPages = chapter.images.length;
  const progress = totalPages ? (currentPage + 1) / totalPages : 0;

  return (
    <View style={styles.screen}>
      <StatusBar barStyle="light-content" backgroundColor={colors.background} />
      <SafeAreaView edges={['top']} style={styles.safeArea}>
        <View style={styles.topBar}>
          <Pressable accessibilityRole="button" accessibilityLabel="Back to comic details" disabled={!id} onPress={() => { if (id) router.replace({ pathname: '/comics/[id]', params: { id } }); }} style={styles.topButton}>
            <SymbolView name={{ ios: 'chevron.left', android: 'arrow_back', web: 'arrow_back' }} size={19} tintColor="#FFF" />
          </Pressable>
          <View style={styles.topCopy}>
            <Text numberOfLines={1} style={styles.topTitle}>{chapter.title}</Text>
            <Text numberOfLines={1} style={styles.topSubtitle}>{chapter.mangaTitle}</Text>
          </View>
          <Pressable accessibilityRole="button" accessibilityLabel="Reload chapter" onPress={refresh} style={styles.topButton}>
            <SymbolView name={{ ios: 'arrow.clockwise', android: 'refresh', web: 'refresh' }} size={18} tintColor="#FFF" />
          </Pressable>
        </View>

        {totalPages ? (
          <FlatList
            ref={pageListRef}
            data={chapter.images}
            keyExtractor={(uri, index) => chapterId + '-' + index + '-' + uri}
            renderItem={({ item, index }) => <ReaderPage uri={item} pageNumber={index + 1} />}
            ListFooterComponent={(
              <View style={styles.endCard}>
                <Text style={styles.endEyebrow}>YOU’RE ALL CAUGHT UP</Text>
                <Text style={styles.endTitle}>End of chapter</Text>
                {chapter.nextChapter ? (
                  <Pressable onPress={() => navigateChapter(chapter.nextChapter)} style={styles.continueButton}>
                    <Text style={styles.continueText}>Continue reading</Text>
                    <SymbolView name={{ ios: 'chevron.right', android: 'chevron_right', web: 'chevron_right' }} size={16} tintColor="#111216" />
                  </Pressable>
                ) : <Text style={styles.centerText}>You’ve reached the latest chapter.</Text>}
              </View>
            )}
            contentContainerStyle={styles.readerContent}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={colors.accent} colors={[colors.accent]} progressBackgroundColor={colors.surface} />}
            viewabilityConfig={viewabilityConfig}
            onViewableItemsChanged={onViewableItemsChanged}
            initialNumToRender={2}
            maxToRenderPerBatch={2}
            windowSize={5}
            removeClippedSubviews
            showsVerticalScrollIndicator={false}
          />
        ) : (
          <View style={styles.center}><Text style={styles.errorTitle}>No pages available</Text><Text style={styles.centerText}>There are no readable pages for this chapter yet.</Text></View>
        )}

        {totalPages ? (
          <View style={styles.bottomBar}>
            <View style={styles.progressLabels}><Text style={styles.progressText}>PAGE {currentPage + 1}</Text><Text style={styles.progressText}>{totalPages} PAGES</Text></View>
            <View style={styles.progressTrack}><View style={[styles.progressFill, { width: ((progress * 100) + '%') as import('react-native').DimensionValue }]} /></View>
            <View style={styles.chapterControls}>
              <Pressable accessibilityRole="button" accessibilityLabel="Previous chapter" disabled={!chapter.previousChapter} onPress={() => navigateChapter(chapter.previousChapter)} style={[styles.chapterButton, !chapter.previousChapter && styles.disabled]}>
                <SymbolView name={{ ios: 'chevron.left', android: 'chevron_left', web: 'chevron_left' }} size={17} tintColor="#FFF" />
                <Text style={styles.chapterButtonText}>Previous</Text>
              </Pressable>
              <Text numberOfLines={1} style={styles.chapterName}>{chapter.mangaTitle}</Text>
              <Pressable accessibilityRole="button" accessibilityLabel="Next chapter" disabled={!chapter.nextChapter} onPress={() => navigateChapter(chapter.nextChapter)} style={[styles.nextButton, !chapter.nextChapter && styles.disabled]}>
                <Text style={styles.nextButtonText}>Next</Text>
                <SymbolView name={{ ios: 'chevron.right', android: 'chevron_right', web: 'chevron_right' }} size={17} tintColor="#111216" />
              </Pressable>
            </View>
          </View>
        ) : null}
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  safeArea: { flex: 1 },
  center: { flex: 1, minHeight: 280, alignItems: 'center', justifyContent: 'center', gap: 11, padding: 24, backgroundColor: colors.background },
  errorTitle: { color: '#FFF', fontFamily: fonts.bold, fontSize: 18, textAlign: 'center' },
  centerText: { color: 'rgba(255,255,255,0.52)', fontFamily: fonts.regular, fontSize: 11, lineHeight: 17, textAlign: 'center' },
  retryButton: { minHeight: 40, borderRadius: 8, paddingHorizontal: 16, alignItems: 'center', justifyContent: 'center', backgroundColor: '#FFF', marginTop: 3 },
  retryText: { color: '#111216', fontFamily: fonts.bold, fontSize: 11 },
  backToTitle: { paddingHorizontal: 12, paddingVertical: 9 },
  backText: { color: 'rgba(255,255,255,0.65)', fontFamily: fonts.medium, fontSize: 11 },
  topBar: { minHeight: 58, flexDirection: 'row', alignItems: 'center', gap: 11, paddingHorizontal: 14, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.06)', backgroundColor: colors.background },
  topButton: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.07)' },
  topCopy: { flex: 1, gap: 3 },
  topTitle: { color: '#FFF', fontFamily: fonts.semibold, fontSize: 12 },
  topSubtitle: { color: 'rgba(255,255,255,0.45)', fontFamily: fonts.regular, fontSize: 10 },
  readerContent: { paddingBottom: 25, alignItems: 'center' },
  readerPage: { width: '100%', maxWidth: 850, backgroundColor: '#000', marginBottom: 2 },
  pageImage: { width: '100%', backgroundColor: '#08090B' },
  endCard: { width: '100%', alignItems: 'center', justifyContent: 'center', gap: 9, paddingVertical: 48, paddingHorizontal: 24, backgroundColor: '#101115' },
  endEyebrow: { color: colors.accentSoft, fontFamily: fonts.bold, fontSize: 9, letterSpacing: 1.7 },
  endTitle: { color: '#FFF', fontFamily: fonts.bold, fontSize: 22, marginBottom: 7 },
  continueButton: { minHeight: 44, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7, borderRadius: 8, paddingHorizontal: 16, backgroundColor: '#FFF' },
  continueText: { color: '#111216', fontFamily: fonts.bold, fontSize: 12 },
  bottomBar: { paddingHorizontal: 16, paddingTop: 10, paddingBottom: 8, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.08)', backgroundColor: 'rgba(12,13,16,0.98)' },
  progressLabels: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
  progressText: { color: 'rgba(255,255,255,0.48)', fontFamily: fonts.bold, fontSize: 8, letterSpacing: 0.8 },
  progressTrack: { height: 3, overflow: 'hidden', borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.12)' },
  progressFill: { height: '100%', borderRadius: 2, backgroundColor: colors.accent },
  chapterControls: { minHeight: 47, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginTop: 8 },
  chapterButton: { minHeight: 38, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4, paddingHorizontal: 7 },
  chapterButtonText: { color: 'rgba(255,255,255,0.75)', fontFamily: fonts.medium, fontSize: 10 },
  chapterName: { flex: 1, color: 'rgba(255,255,255,0.38)', textAlign: 'center', fontFamily: fonts.regular, fontSize: 9 },
  nextButton: { minHeight: 38, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5, borderRadius: 7, paddingHorizontal: 12, backgroundColor: '#FFF' },
  nextButtonText: { color: '#111216', fontFamily: fonts.bold, fontSize: 10 },
  disabled: { opacity: 0.34 },
});

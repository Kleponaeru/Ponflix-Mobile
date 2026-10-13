import { Image } from 'expo-image';
import { router, useLocalSearchParams } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { LinearGradient } from 'expo-linear-gradient';
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, StatusBar, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { PonflixTheme } from '@/constants/theme';
import { AppRefreshFlatList } from '@/components/app-refresh-flat-list';
import { useLibrary } from '@/features/library/context/library-context';
import { fetchComicDetails } from '@/features/comics/api/comic-service';
import type { ComicChapter, ComicDetails } from '@/features/comics/types/comic';

const { colors, fonts } = PonflixTheme;

function readableDescription(value: string) {
  return value.replace(/<[^>]+>/g, ' ').replace(/&nbsp;/gi, ' ').replace(/&amp;/gi, '&').replace(/&#039;|&apos;/gi, "'").replace(/&quot;/gi, '"').replace(/\s+/g, ' ').trim();
}

export default function ComicDetailScreen() {
  const params = useLocalSearchParams<{ id?: string | string[] }>();
  const id = Array.isArray(params.id) ? params.id[0] : params.id;
  return <ComicDetailContent key={id || 'missing'} id={id} />;
}

function ComicDetailContent({ id }: { id?: string }) {
  const library = useLibrary();
  const insets = useSafeAreaInsets();
  const [comic, setComic] = useState<ComicDetails | null>(null);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    if (!id) return;
    const controller = new AbortController();
    fetchComicDetails(id, controller.signal)
      .then((result) => setComic(result))
      .catch(() => { if (!controller.signal.aborted) setError(true); })
      .finally(() => {
        if (!controller.signal.aborted) {
          setLoading(false);
          setRefreshing(false);
        }
      });
    return () => controller.abort();
  }, [id, reloadKey]);

  const chapters = useMemo(() => comic?.chapters || [], [comic?.chapters]);
  const filteredChapters = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase();
    return normalized ? chapters.filter((chapter) => chapter.title.toLocaleLowerCase().includes(normalized)) : chapters;
  }, [chapters, query]);

  const openChapter = (chapter: ComicChapter) => {
    if (!id) return;
    if (comic) {
      library.recordProgress({
        type: 'comic',
        id,
        title: comic.title,
        imageUrl: comic.imageUrl,
        subtitle: chapter.title,
        route: `/comics/${id}/chapter/${chapter.slug}`,
      });
    }
    router.push({ pathname: '/comics/[id]/chapter/[chapterId]', params: { id, chapterId: chapter.slug } });
  };

  const refresh = () => {
    if (refreshing) return;
    setRefreshing(true);
    setReloadKey((key) => key + 1);
  };

  if (loading && !comic) {
    return <View style={styles.center}><ActivityIndicator size="large" color={colors.accent} /><Text style={styles.centerText}>Loading title…</Text></View>;
  }

  if (error || !comic) {
    return (
      <SafeAreaView style={styles.screen} edges={['top']}>
        <StatusBar barStyle="light-content" backgroundColor={colors.background} />
        <View style={styles.center}>
          <Text style={styles.errorTitle}>This title isn’t available right now.</Text>
          <Text style={styles.centerText}>Try again in a moment.</Text>
          <Pressable onPress={refresh} style={styles.primaryButton}><Text style={styles.primaryText}>Try again</Text></Pressable>
        </View>
      </SafeAreaView>
    );
  }

  const description = readableDescription(comic.description);
  const firstChapter = comic.firstChapter;
  const latestChapter = comic.latestChapter;
  const isSaved = library.isBookmarked('comic', comic.id);
  const header = (
    <View>
      <View style={styles.hero}>
        {comic.imageUrl ? <Image source={{ uri: comic.imageUrl }} contentFit="cover" cachePolicy="memory-disk" style={StyleSheet.absoluteFill} /> : null}
        <LinearGradient colors={['rgba(8,9,11,0.2)', 'rgba(8,9,11,0.58)', colors.background]} locations={[0, 0.45, 1]} style={StyleSheet.absoluteFill} />
        <SafeAreaView edges={['top']} style={styles.heroContent}>
          <Pressable accessibilityRole="button" accessibilityLabel="Go back" onPress={() => router.back()} style={[styles.backButton, { top: insets.top + 8 }]}>
            <SymbolView name={{ ios: 'chevron.left', android: 'arrow_back', web: 'arrow_back' }} size={20} tintColor="#FFF" />
          </Pressable>
          <View style={styles.cover}>
            {comic.imageUrl ? <Image source={{ uri: comic.imageUrl }} contentFit="cover" cachePolicy="memory-disk" transition={180} style={styles.coverImage} /> : null}
          </View>
          <Text style={styles.eyebrow}>PONFLIX COMICS</Text>
          <Text style={styles.title}>{comic.title}</Text>
          <View style={styles.metaRow}>
            {comic.type ? <Text style={styles.metaPill}>{comic.type}</Text> : null}
            {comic.status ? <Text style={styles.meta}>{comic.status}</Text> : null}
            {comic.rating ? <Text style={styles.rating}>★ {comic.rating.toFixed(1)}</Text> : null}
            {comic.isColored ? <Text style={styles.meta}>FULL COLOR</Text> : null}
          </View>
          {comic.author ? <Text style={styles.byline}>By {comic.author}{comic.illustrator ? ' · Art by ' + comic.illustrator : ''}</Text> : null}
          {description ? (
            <Text numberOfLines={expanded ? undefined : 5} style={styles.description}>{description}</Text>
          ) : <Text style={styles.description}>Description not available yet.</Text>}
          {description.length > 220 ? <Pressable onPress={() => setExpanded((current) => !current)}><Text style={styles.readMore}>{expanded ? 'Show less' : 'Read more'}</Text></Pressable> : null}
          {comic.genres.length ? (
            <View style={styles.genreRow}>{comic.genres.slice(0, 5).map((genre) => <View key={genre.slug} style={styles.genrePill}><Text style={styles.genreText}>{genre.name}</Text></View>)}</View>
          ) : null}
          <View style={styles.actionRow}>
            {firstChapter ? <Pressable accessibilityRole="button" onPress={() => openChapter(firstChapter)} style={styles.primaryButton}><SymbolView name={{ ios: 'book.fill', android: 'menu_book', web: 'menu_book' }} size={17} tintColor="#111216" /><Text style={styles.primaryText}>Start reading</Text></Pressable> : null}
            {latestChapter && latestChapter.slug !== firstChapter?.slug ? <Pressable accessibilityRole="button" onPress={() => openChapter(latestChapter)} style={styles.secondaryButton}><Text style={styles.secondaryText}>Latest chapter</Text></Pressable> : null}
            <Pressable
              accessibilityRole="button"
              accessibilityState={{ selected: isSaved, disabled: !library.ready }}
              accessibilityLabel={isSaved ? 'Remove comic from My List' : 'Save comic to My List'}
              disabled={!library.ready}
              onPress={() => library.toggleBookmark({ type: 'comic', id: comic.id, title: comic.title, imageUrl: comic.imageUrl, route: `/comics/${comic.id}` })}
              style={styles.bookmarkButton}>
              <SymbolView name={{ ios: isSaved ? 'bookmark.fill' : 'bookmark', android: isSaved ? 'bookmark' : 'bookmark_border', web: isSaved ? 'bookmark' : 'bookmark_border' }} size={16} tintColor="#FFF" />
              <Text style={styles.secondaryText}>{isSaved ? 'Saved' : 'My List'}</Text>
            </Pressable>
          </View>
        </SafeAreaView>
      </View>
      <View style={styles.chapterHeader}>
        <View><Text style={styles.sectionEyebrow}>PICK UP WHERE YOU LEFT OFF</Text><Text style={styles.sectionTitle}>Chapters</Text></View>
        {chapters.length ? <Text style={styles.chapterCount}>{chapters.length} chapters</Text> : null}
      </View>
      <View style={styles.searchBar}>
        <SymbolView name={{ ios: 'magnifyingglass', android: 'search', web: 'search' }} size={18} tintColor="rgba(255,255,255,0.48)" />
        <TextInput accessibilityLabel="Search chapters" value={query} onChangeText={setQuery} placeholder="Find a chapter" placeholderTextColor="rgba(255,255,255,0.37)" style={styles.searchInput} returnKeyType="search" />
        {query ? <Pressable accessibilityRole="button" accessibilityLabel="Clear chapter search" onPress={() => setQuery('')}><Text style={styles.clear}>×</Text></Pressable> : null}
      </View>
    </View>
  );

  return (
    <View style={styles.screen}>
      <StatusBar barStyle="light-content" backgroundColor={colors.background} />
      <AppRefreshFlatList
        data={filteredChapters}
        keyExtractor={(chapter) => chapter.slug}
        renderItem={({ item, index }) => (
          <Pressable accessibilityRole="button" accessibilityLabel={'Read ' + item.title} onPress={() => openChapter(item)} style={({ pressed }) => [styles.chapterRow, pressed && styles.chapterPressed]}>
            <View style={styles.chapterNumber}><Text style={styles.chapterNumberText}>{String(filteredChapters.length - index).padStart(2, '0')}</Text></View>
            <View style={styles.chapterCopy}><Text numberOfLines={1} style={styles.chapterTitle}>{item.title}</Text><Text style={styles.chapterDate}>{item.releasedAt || 'Read chapter'}</Text></View>
            <SymbolView name={{ ios: 'chevron.right', android: 'chevron_right', web: 'chevron_right' }} size={17} tintColor="rgba(255,255,255,0.38)" />
          </Pressable>
        )}
        ListHeaderComponent={header}
        ListEmptyComponent={<View style={styles.empty}><Text style={styles.emptyText}>{chapters.length ? 'No chapters match that search.' : 'No chapters are available yet.'}</Text></View>}
        contentContainerStyle={styles.listContent}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
        refreshing={refreshing}
        onRefresh={refresh}
        showsVerticalScrollIndicator={false}
        initialNumToRender={14}
        maxToRenderPerBatch={10}
        windowSize={9}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  center: { flex: 1, minHeight: 320, alignItems: 'center', justifyContent: 'center', gap: 11, padding: 24, backgroundColor: colors.background },
  centerText: { color: 'rgba(255,255,255,0.52)', fontFamily: fonts.regular, fontSize: 12, textAlign: 'center' },
  errorTitle: { color: '#FFF', fontFamily: fonts.bold, fontSize: 17, textAlign: 'center' },
  primaryButton: { minHeight: 45, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 9, borderRadius: 8, backgroundColor: '#FFF', paddingHorizontal: 16, marginTop: 5 },
  primaryText: { color: '#111216', fontFamily: fonts.bold, fontSize: 12 },
  listContent: { paddingBottom: 32 },
  hero: { minHeight: 610, backgroundColor: colors.surface, overflow: 'hidden' },
  heroContent: { flex: 1, minHeight: 610, alignItems: 'flex-start', justifyContent: 'flex-end', paddingHorizontal: 22, paddingBottom: 25 },
  backButton: { position: 'absolute', top: 8, left: 18, width: 42, height: 42, alignItems: 'center', justifyContent: 'center', borderRadius: 21, backgroundColor: 'rgba(0,0,0,0.45)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)' },
  cover: { width: 86, height: 126, overflow: 'hidden', borderRadius: 9, borderWidth: 1, borderColor: 'rgba(255,255,255,0.18)', marginBottom: 16, backgroundColor: colors.surface },
  coverImage: { width: '100%', height: '100%' },
  eyebrow: { color: colors.accentSoft, fontFamily: fonts.bold, fontSize: 9, letterSpacing: 2, marginBottom: 7 },
  title: { color: '#FFF', fontFamily: fonts.extraBold, fontSize: 29, lineHeight: 35, letterSpacing: -0.8 },
  metaRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8, marginTop: 10 },
  metaPill: { color: '#FFF', fontFamily: fonts.bold, fontSize: 9, backgroundColor: colors.accent, paddingHorizontal: 9, paddingVertical: 5, borderRadius: 5 },
  meta: { color: 'rgba(255,255,255,0.6)', fontFamily: fonts.medium, fontSize: 10 },
  rating: { color: '#A7F3D0', fontFamily: fonts.bold, fontSize: 10 },
  byline: { color: 'rgba(255,255,255,0.5)', fontFamily: fonts.medium, fontSize: 10, marginTop: 11 },
  description: { alignSelf: 'stretch', flexShrink: 1, color: 'rgba(255,255,255,0.68)', fontFamily: fonts.regular, fontSize: 12, lineHeight: 18, marginTop: 13, maxWidth: 610 },
  readMore: { color: '#FFF', fontFamily: fonts.semibold, fontSize: 11, marginTop: 5 },
  genreRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 7, marginTop: 13 },
  genrePill: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 13, borderWidth: 1, borderColor: 'rgba(255,255,255,0.15)', backgroundColor: 'rgba(0,0,0,0.17)' },
  genreText: { color: 'rgba(255,255,255,0.72)', fontFamily: fonts.medium, fontSize: 9 },
  actionRow: { flexDirection: 'row', alignItems: 'center', gap: 9, flexWrap: 'wrap', marginTop: 17 },
  secondaryButton: { minHeight: 45, justifyContent: 'center', borderRadius: 8, paddingHorizontal: 15, backgroundColor: 'rgba(255,255,255,0.14)' },
  bookmarkButton: { minHeight: 45, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7, borderRadius: 8, paddingHorizontal: 14, backgroundColor: 'rgba(255,255,255,0.14)' },
  secondaryText: { color: '#FFF', fontFamily: fonts.semibold, fontSize: 11 },
  chapterHeader: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', marginTop: 26, marginBottom: 13, paddingHorizontal: 20 },
  sectionEyebrow: { color: colors.accent, fontFamily: fonts.bold, fontSize: 9, letterSpacing: 1.6, marginBottom: 4 },
  sectionTitle: { color: '#FFF', fontFamily: fonts.bold, fontSize: 21 },
  chapterCount: { color: 'rgba(255,255,255,0.4)', fontFamily: fonts.medium, fontSize: 10, paddingBottom: 3 },
  searchBar: { height: 45, flexDirection: 'row', alignItems: 'center', gap: 9, marginHorizontal: 20, marginBottom: 13, paddingHorizontal: 12, borderRadius: 9, backgroundColor: 'rgba(255,255,255,0.05)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.09)' },
  searchInput: { flex: 1, color: '#FFF', fontFamily: fonts.regular, fontSize: 12 },
  clear: { color: 'rgba(255,255,255,0.6)', fontSize: 22, lineHeight: 25 },
  chapterRow: { minHeight: 66, flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 20, paddingVertical: 9, backgroundColor: 'rgba(255,255,255,0.018)' },
  chapterPressed: { backgroundColor: 'rgba(255,255,255,0.07)' },
  chapterNumber: { width: 41, height: 41, borderRadius: 9, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.07)' },
  chapterNumberText: { color: 'rgba(255,255,255,0.55)', fontFamily: fonts.bold, fontSize: 11 },
  chapterCopy: { flex: 1, gap: 4 },
  chapterTitle: { color: 'rgba(255,255,255,0.9)', fontFamily: fonts.semibold, fontSize: 12 },
  chapterDate: { color: 'rgba(255,255,255,0.4)', fontFamily: fonts.regular, fontSize: 10 },
  separator: { height: StyleSheet.hairlineWidth, marginLeft: 73, backgroundColor: 'rgba(255,255,255,0.07)' },
  empty: { minHeight: 130, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 20 },
  emptyText: { color: 'rgba(255,255,255,0.5)', fontFamily: fonts.regular, fontSize: 12, textAlign: 'center' },
});

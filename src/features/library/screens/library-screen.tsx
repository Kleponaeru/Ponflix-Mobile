import { Image } from 'expo-image';
import { Href, router } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { Alert, Platform, Pressable, ScrollView, StatusBar, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BrandHeader } from '@/components/brand-header';
import { PonflixTheme } from '@/constants/theme';
import { useLibrary } from '@/features/library/context/library-context';
import type { LibraryEntry, LibraryMediaType } from '@/features/library/types/library';

const { colors, fonts } = PonflixTheme;

function confirmRemoval(title: string, message: string, onConfirm: () => void) {
  if (Platform.OS === 'web') {
    if (typeof globalThis.confirm === 'function' && globalThis.confirm(message)) onConfirm();
    return;
  }

  Alert.alert(title, message, [
    { text: 'Cancel', style: 'cancel' },
    { text: 'Remove', style: 'destructive', onPress: onConfirm },
  ]);
}

export default function LibraryScreen() {
  const { bookmarks, recent, ready, removeBookmark, removeRecent, clearRecent } = useLibrary();
  const watching = recent.filter((entry) => entry.type === 'anime');
  const reading = recent.filter((entry) => entry.type === 'comic');

  const openEntry = (entry: LibraryEntry) => router.push(entry.route as Href);

  return (
    <View style={styles.screen}>
      <StatusBar barStyle="light-content" backgroundColor={colors.background} />
      <SafeAreaView edges={['top']} style={styles.safeArea}>
        <BrandHeader />
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
          <View style={styles.pageHeading}>
            <Text style={styles.eyebrow}>YOUR PONFLIX</Text>
            <Text style={styles.title}>My Library</Text>
            <Text style={styles.subtitle}>Saved titles and your latest watch and read progress, stored on this device.</Text>
          </View>

          {!ready ? (
            <View style={styles.emptyCard}><Text style={styles.emptyText}>Loading your library…</Text></View>
          ) : (
            <>
              <LibrarySection
                title="Continue watching"
                subtitle="Pick up your latest anime"
                actionText="RESUME"
                entries={watching}
                emptyText="Anime you start watching will show up here."
                onOpen={openEntry}
                onRemove={(entry) => confirmRemoval('Remove from history?', `Remove ${entry.title} from your recent history?`, () => removeRecent(entry.type, entry.id))}
              />
              <LibrarySection
                title="Continue reading"
                subtitle="Return to your latest chapter"
                actionText="CONTINUE"
                entries={reading}
                emptyText="Chapters you read will show up here."
                onOpen={openEntry}
                onRemove={(entry) => confirmRemoval('Remove from history?', `Remove ${entry.title} from your recent history?`, () => removeRecent(entry.type, entry.id))}
              />
              <LibrarySection
                title="My List"
                subtitle="Anime and comics you bookmarked"
                actionText="OPEN"
                entries={bookmarks}
                emptyText="Save an anime or comic from its details page to keep it here."
                onOpen={openEntry}
                onRemove={(entry) => confirmRemoval('Remove from My List?', `Remove ${entry.title} from your saved list?`, () => removeBookmark(entry.type, entry.id))}
              />
              {recent.length ? <Pressable accessibilityRole="button" onPress={() => confirmRemoval('Clear watch and read history?', 'This will remove all saved watch and read progress from this device.', clearRecent)} style={styles.clearHistory}><Text style={styles.clearHistoryText}>Clear watch and read history</Text></Pressable> : null}
            </>
          )}
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

function LibrarySection({
  title,
  subtitle,
  actionText,
  entries,
  emptyText,
  onOpen,
  onRemove,
}: {
  title: string;
  subtitle: string;
  actionText: string;
  entries: LibraryEntry[];
  emptyText: string;
  onOpen: (entry: LibraryEntry) => void;
  onRemove: (entry: LibraryEntry) => void;
}) {
  return (
    <View style={styles.section}>
      <View style={styles.sectionHeading}>
        <View><Text style={styles.sectionTitle}>{title}</Text><Text style={styles.sectionSubtitle}>{subtitle}</Text></View>
        {entries.length ? <Text style={styles.count}>{entries.length}</Text> : null}
      </View>
      {entries.length ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.shelf}>
          {entries.map((entry) => <LibraryCard key={`${entry.type}:${entry.id}`} entry={entry} actionText={actionText} onOpen={onOpen} onRemove={onRemove} />)}
        </ScrollView>
      ) : (
        <View style={styles.emptyCard}><Text style={styles.emptyText}>{emptyText}</Text></View>
      )}
    </View>
  );
}

function LibraryCard({ entry, actionText, onOpen, onRemove }: {
  entry: LibraryEntry;
  actionText: string;
  onOpen: (entry: LibraryEntry) => void;
  onRemove: (entry: LibraryEntry) => void;
}) {
  const mediaType: LibraryMediaType = entry.type;
  return (
    <View style={styles.card}>
      <Pressable accessibilityRole="button" accessibilityLabel={`Open ${entry.title}`} onPress={() => onOpen(entry)} style={({ pressed }) => [styles.poster, pressed && styles.pressed]}>
        {entry.imageUrl ? <Image source={{ uri: entry.imageUrl }} contentFit="cover" cachePolicy="memory-disk" style={StyleSheet.absoluteFill} /> : null}
        {!entry.imageUrl ? <View style={styles.posterFallback}><SymbolView name={{ ios: mediaType === 'anime' ? 'play.rectangle' : 'book.closed', android: mediaType === 'anime' ? 'play_arrow' : 'menu_book', web: mediaType === 'anime' ? 'play_arrow' : 'menu_book' }} size={27} tintColor="rgba(255,255,255,0.42)" /></View> : null}
        <View style={styles.posterShade} />
        <View style={styles.typeBadge}><Text style={styles.typeText}>{mediaType === 'anime' ? 'ANIME' : 'COMIC'}</Text></View>
        <View style={styles.posterFooter}><SymbolView name={{ ios: mediaType === 'anime' ? 'play.fill' : 'book.fill', android: mediaType === 'anime' ? 'play_arrow' : 'menu_book', web: mediaType === 'anime' ? 'play_arrow' : 'menu_book' }} size={14} tintColor="#FFF" /><Text style={styles.posterFooterText}>{actionText}</Text></View>
      </Pressable>
      <Pressable accessibilityRole="button" onPress={() => onOpen(entry)} style={styles.cardCopy}>
        <Text numberOfLines={2} style={styles.cardTitle}>{entry.title}</Text>
        {entry.subtitle ? <Text numberOfLines={1} style={styles.cardSubtitle}>{entry.subtitle}</Text> : null}
      </Pressable>
      <Pressable accessibilityRole="button" accessibilityLabel={`Remove ${entry.title} from this list`} hitSlop={9} onPress={() => onRemove(entry)} style={styles.removeButton}>
        <SymbolView name={{ ios: 'xmark', android: 'close', web: 'close' }} size={12} tintColor="rgba(255,255,255,0.8)" />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  safeArea: { flex: 1 },
  content: { paddingBottom: 32 },
  pageHeading: { paddingHorizontal: 20, paddingTop: 13, paddingBottom: 3 },
  eyebrow: { color: colors.accent, fontFamily: fonts.bold, fontSize: 10, letterSpacing: 2 },
  title: { color: '#FFF', fontFamily: fonts.extraBold, fontSize: 31, letterSpacing: -0.8, marginTop: 8 },
  subtitle: { maxWidth: 460, color: 'rgba(255,255,255,0.56)', fontFamily: fonts.regular, fontSize: 13, lineHeight: 20, marginTop: 7 },
  section: { marginTop: 27 },
  sectionHeading: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, marginBottom: 13 },
  sectionTitle: { color: '#FFF', fontFamily: fonts.bold, fontSize: 19, letterSpacing: -0.3 },
  sectionSubtitle: { color: 'rgba(255,255,255,0.4)', fontFamily: fonts.regular, fontSize: 11, marginTop: 4 },
  count: { minWidth: 25, height: 25, overflow: 'hidden', textAlign: 'center', textAlignVertical: 'center', borderRadius: 13, color: 'rgba(255,255,255,0.7)', fontFamily: fonts.bold, fontSize: 11, backgroundColor: 'rgba(255,255,255,0.08)' },
  shelf: { paddingHorizontal: 20, gap: 12 },
  card: { width: 138, marginBottom: 4 },
  poster: { aspectRatio: 0.7, overflow: 'hidden', borderRadius: 11, backgroundColor: '#18191E', borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)' },
  posterFallback: { ...StyleSheet.absoluteFill, alignItems: 'center', justifyContent: 'center' },
  posterShade: { ...StyleSheet.absoluteFill, backgroundColor: 'rgba(0,0,0,0.13)' },
  typeBadge: { position: 'absolute', top: 8, left: 8, paddingHorizontal: 7, paddingVertical: 5, borderRadius: 5, backgroundColor: 'rgba(8,9,11,0.74)' },
  typeText: { color: '#FFF', fontFamily: fonts.bold, fontSize: 8, letterSpacing: 0.7 },
  posterFooter: { position: 'absolute', left: 8, right: 8, bottom: 9, minHeight: 29, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, borderRadius: 6, backgroundColor: 'rgba(229,9,20,0.88)' },
  posterFooterText: { color: '#FFF', fontFamily: fonts.extraBold, fontSize: 8, letterSpacing: 0.8 },
  cardCopy: { minHeight: 51, paddingTop: 7 },
  cardTitle: { color: colors.text, fontFamily: fonts.semibold, fontSize: 12, lineHeight: 16 },
  cardSubtitle: { color: colors.muted, fontFamily: fonts.regular, fontSize: 10, marginTop: 4 },
  removeButton: { position: 'absolute', top: 7, right: 7, width: 25, height: 25, alignItems: 'center', justifyContent: 'center', borderRadius: 13, backgroundColor: 'rgba(8,9,11,0.72)' },
  pressed: { opacity: 0.82 },
  emptyCard: { minHeight: 76, justifyContent: 'center', marginHorizontal: 20, paddingHorizontal: 15, borderRadius: 10, backgroundColor: 'rgba(255,255,255,0.035)' },
  emptyText: { color: 'rgba(255,255,255,0.46)', fontFamily: fonts.regular, fontSize: 12, lineHeight: 18 },
  clearHistory: { alignSelf: 'flex-start', marginHorizontal: 20, marginTop: 22, minHeight: 38, justifyContent: 'center', paddingHorizontal: 12, borderRadius: 8, borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)' },
  clearHistoryText: { color: 'rgba(255,255,255,0.6)', fontFamily: fonts.medium, fontSize: 11 },
});

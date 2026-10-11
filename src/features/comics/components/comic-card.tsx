import { Image } from 'expo-image';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import type { ComicListItem } from '@/features/comics/types/comic';
import { PonflixTheme } from '@/constants/theme';

type ComicCardProps = {
  comic: ComicListItem;
  width: number;
  onPress: (comic: ComicListItem) => void;
};

export function ComicCard({ comic, width, onPress }: ComicCardProps) {
  const chapterNumber = comic.latestChapter?.title.match(/(?:chapter|chap\.?|ch\.?|ep\.?)[\s#-]*([\d]+(?:\.[\d]+)?)/i)?.[1];
  const chapterBadge = comic.latestChapter ? (chapterNumber ? `CH. ${chapterNumber}` : 'LATEST') : undefined;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={'View ' + comic.title + ', ' + comic.type}
      onPress={() => onPress(comic)}
      style={({ pressed }) => [styles.card, { width }, pressed && styles.pressed]}>
      <View style={styles.poster}>
        {comic.imageUrl ? (
          <Image
            source={{ uri: comic.imageUrl }}
            contentFit="cover"
            cachePolicy="memory-disk"
            recyclingKey={comic.id}
            transition={180}
            style={StyleSheet.absoluteFill}
          />
        ) : null}
        <View style={styles.shade} />
        <View style={styles.typeBadge}><Text numberOfLines={1} style={styles.typeText}>{comic.type.toUpperCase()}</Text></View>
        {chapterBadge ? <View style={styles.chapterBadge}><Text numberOfLines={1} style={styles.chapterBadgeText}>{chapterBadge}</Text></View> : null}
        {comic.isColored ? <View style={[styles.colorBadge, chapterBadge && styles.colorBadgeBelowChapter]}><Text style={styles.colorText}>COLOR</Text></View> : null}
      </View>
      <Text numberOfLines={2} style={styles.title}>{comic.title}</Text>
      {comic.latestChapter ? <Text numberOfLines={1} style={styles.chapter}>{comic.latestChapter.title}</Text> : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: { marginBottom: 20 },
  pressed: { opacity: 0.8 },
  poster: { aspectRatio: 0.7, borderRadius: 12, overflow: 'hidden', backgroundColor: '#17181C', borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)' },
  shade: { ...StyleSheet.absoluteFill, backgroundColor: 'rgba(0,0,0,0.08)' },
  typeBadge: { position: 'absolute', top: 8, left: 8, maxWidth: '76%', paddingHorizontal: 7, paddingVertical: 5, borderRadius: 5, backgroundColor: 'rgba(8,9,11,0.78)' },
  typeText: { color: '#FFF', fontFamily: PonflixTheme.fonts.bold, fontSize: 8, letterSpacing: 0.6 },
  chapterBadge: { position: 'absolute', top: 8, right: 8, maxWidth: '68%', paddingHorizontal: 7, paddingVertical: 5, borderRadius: 5, backgroundColor: PonflixTheme.colors.accent },
  chapterBadgeText: { color: '#FFF', fontFamily: PonflixTheme.fonts.extraBold, fontSize: 8, letterSpacing: 0.5 },
  colorBadge: { position: 'absolute', top: 8, right: 8, paddingHorizontal: 6, paddingVertical: 5, borderRadius: 5, backgroundColor: 'rgba(8,9,11,0.78)' },
  colorBadgeBelowChapter: { top: 33 },
  colorText: { color: '#FFF', fontFamily: PonflixTheme.fonts.bold, fontSize: 7, letterSpacing: 0.5 },
  title: { color: PonflixTheme.colors.text, fontFamily: PonflixTheme.fonts.semibold, fontSize: 12, lineHeight: 16, marginTop: 8 },
  chapter: { color: PonflixTheme.colors.muted, fontFamily: PonflixTheme.fonts.regular, fontSize: 10, marginTop: 4 },
});

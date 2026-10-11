import { Image } from 'expo-image';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import type { AnimeTitle } from '@/features/anime/types/anime';
import { PonflixTheme } from '@/constants/theme';

type AnimeCardProps = {
  anime: AnimeTitle;
  rank?: number;
  onPress: (anime: AnimeTitle) => void;
};

export function AnimeCard({ anime, rank, onPress }: AnimeCardProps) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Search Ponflix for ${anime.title}`}
      onPress={() => onPress(anime)}
      style={({ pressed }) => [styles.card, pressed && styles.pressed]}>
      <View style={styles.poster}>
        {anime.thumbnail ? (
          <Image
            source={{ uri: anime.thumbnail }}
            contentFit="cover"
            cachePolicy="memory-disk"
            recyclingKey={anime.slug}
            transition={220}
            style={StyleSheet.absoluteFill}
          />
        ) : null}
        <View style={styles.imageShade} />
        {typeof rank === 'number' ? (
          <View style={styles.rank}><Text style={styles.rankText}>TOP {String(rank).padStart(2, '0')}</Text></View>
        ) : null}
        <View style={styles.quality}><Text numberOfLines={1} style={styles.qualityText}>{anime.quality || anime.type || 'ANIME'}</Text></View>
        <View style={styles.caption}>
          <Text style={styles.type}>{anime.type || 'ANIME'}</Text>
          <Text numberOfLines={2} style={styles.title}>{anime.title}</Text>
        </View>
      </View>
      <View style={styles.metadata}>
        {anime.currentEpisode || anime.timeAgo ? (
          <Text numberOfLines={1} style={styles.episode}>
            {anime.currentEpisode ? `Episode ${anime.currentEpisode}` : anime.timeAgo}
          </Text>
        ) : <View style={styles.metadataSpacer} />}
        {anime.totalEpisodes ? <Text style={styles.episodeCount}>{anime.totalEpisodes} eps</Text> : null}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: { width: 148 },
  pressed: { opacity: 0.82 },
  poster: { aspectRatio: 2 / 3, borderRadius: 12, overflow: 'hidden', backgroundColor: '#17181C', borderWidth: 1, borderColor: 'rgba(255,255,255,0.07)' },
  imageShade: { ...StyleSheet.absoluteFill, backgroundColor: 'rgba(5,6,8,0.18)' },
  rank: { position: 'absolute', top: 8, left: 8, paddingHorizontal: 7, paddingVertical: 5, borderRadius: 5, backgroundColor: '#E50914' },
  rankText: { color: '#FFF', fontFamily: PonflixTheme.fonts.extraBold, fontSize: 9, letterSpacing: 0.7 },
  quality: { position: 'absolute', top: 8, right: 8, maxWidth: 78, paddingHorizontal: 7, paddingVertical: 5, borderRadius: 5, backgroundColor: 'rgba(0,0,0,0.66)' },
  qualityText: { color: 'rgba(255,255,255,0.88)', fontFamily: PonflixTheme.fonts.bold, fontSize: 8, letterSpacing: 0.6 },
  caption: { position: 'absolute', left: 9, right: 8, bottom: 10 },
  type: { color: 'rgba(255,255,255,0.65)', fontFamily: PonflixTheme.fonts.semibold, fontSize: 9, letterSpacing: 1, marginBottom: 3 },
  title: { color: '#FFF', fontFamily: PonflixTheme.fonts.bold, fontSize: 13, lineHeight: 17 },
  metadata: { flexDirection: 'row', justifyContent: 'space-between', gap: 5, paddingHorizontal: 1, paddingTop: 7 },
  episode: { flex: 1, color: 'rgba(255,255,255,0.52)', fontSize: 10 },
  metadataSpacer: { flex: 1 },
  episodeCount: { color: 'rgba(255,255,255,0.42)', fontFamily: PonflixTheme.fonts.medium, fontSize: 10 },
});

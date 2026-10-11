import { ScrollView, StyleSheet, View } from 'react-native';

import { AnimeCard } from '@/features/anime/components/anime-card';
import type { AnimeTitle } from '@/features/anime/types/anime';

type AnimeRailProps = {
  anime: AnimeTitle[];
  onAnimePress: (anime: AnimeTitle) => void;
  ranked?: boolean;
};

export function AnimeRail({ anime, onAnimePress, ranked = false }: AnimeRailProps) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.row}>
      {anime.map((item, index) => (
        <View key={item.slug} style={styles.item}>
          <AnimeCard anime={item} rank={ranked ? item.rank ?? index + 1 : undefined} onPress={onAnimePress} />
        </View>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  row: { paddingHorizontal: 20, gap: 12 },
  item: { width: 148 },
});

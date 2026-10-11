import { Text, View } from 'react-native';

import type { AnimeStreamPlayerProps } from '@/features/anime/components/anime-stream-player.types';

export function AnimeStreamPlayer(_props: AnimeStreamPlayerProps) {
  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#000', padding: 24 }}>
      <Text style={{ color: '#FFF', textAlign: 'center' }}>Streaming is not available on this platform.</Text>
    </View>
  );
}

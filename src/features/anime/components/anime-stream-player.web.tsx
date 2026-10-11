import { useState, type ComponentType } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { PonflixTheme } from '@/constants/theme';
import type { AnimeStreamPlayerProps } from '@/features/anime/components/anime-stream-player.types';

type IframeProps = {
  src: string;
  title: string;
  allow: string;
  allowFullScreen: boolean;
  onLoad: () => void;
  onError: () => void;
  style: { width: string; height: string; border: string };
};

const Iframe = 'iframe' as unknown as ComponentType<IframeProps>;

export function AnimeStreamPlayer({ uri, onError }: AnimeStreamPlayerProps) {
  const [loading, setLoading] = useState(true);
  return (
    <View style={styles.container}>
      <Iframe
        src={uri}
        title="Ponflix anime stream"
        allow="autoplay; fullscreen; picture-in-picture; encrypted-media"
        allowFullScreen
        onLoad={() => setLoading(false)}
        onError={() => { setLoading(false); onError(); }}
        style={{ width: '100%', height: '100%', border: '0' }}
      />
      {loading ? <View pointerEvents="none" style={styles.loading}><ActivityIndicator color={PonflixTheme.colors.accent} /></View> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  loading: { ...StyleSheet.absoluteFill, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.24)' },
});

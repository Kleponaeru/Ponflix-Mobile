import { useVideoPlayer, VideoView } from 'expo-video';
import { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

import { PonflixTheme } from '@/constants/theme';

export function IdlixVideoPlayer({ uri, headers, title }: { uri: string; headers: Record<string, string>; title: string }) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const player = useVideoPlayer({
    uri,
    contentType: /\.m3u8(?:$|[?#])/i.test(uri) ? 'hls' : 'auto',
    headers,
    metadata: { title },
  }, (videoPlayer) => {
    videoPlayer.play();
  });

  useEffect(() => {
    const subscription = player.addListener('statusChange', (event) => {
      if (event.status === 'readyToPlay') setLoading(false);
      if (event.status === 'error') {
        setLoading(false);
        setError(event.error?.message || 'The video source failed to play.');
      }
    });
    return () => subscription.remove();
  }, [player]);

  return (
    <View style={styles.container}>
      <VideoView
        player={player}
        style={styles.video}
        nativeControls
        contentFit="contain"
        fullscreenOptions={{ enable: true, orientation: 'landscape' }}
      />
      {loading ? <View pointerEvents="none" style={styles.loading}><ActivityIndicator color={PonflixTheme.colors.accent} size="large" /></View> : null}
      {error ? <View style={styles.error}><Text style={styles.errorText}>{error}</Text></View> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { width: '100%', aspectRatio: 16 / 9, backgroundColor: '#000' },
  video: { flex: 1, backgroundColor: '#000' },
  loading: { ...StyleSheet.absoluteFill, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.3)' },
  error: { ...StyleSheet.absoluteFill, alignItems: 'center', justifyContent: 'center', padding: 18, backgroundColor: 'rgba(0,0,0,0.84)' },
  errorText: { color: '#FFF', textAlign: 'center', fontFamily: PonflixTheme.fonts.regular, fontSize: 12 },
});

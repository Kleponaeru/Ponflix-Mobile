import { useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { WebView } from 'react-native-webview';

import { PonflixTheme } from '@/constants/theme';
import type { AnimeStreamPlayerProps } from '@/features/anime/components/anime-stream-player.types';

export function AnimeStreamPlayer({ uri, onError }: AnimeStreamPlayerProps) {
  const [loading, setLoading] = useState(true);

  return (
    <View style={styles.container}>
      <WebView
        source={{ uri }}
        style={styles.webView}
        containerStyle={styles.container}
        originWhitelist={['https://*']}
        javaScriptEnabled
        domStorageEnabled
        allowsFullscreenVideo
        allowsInlineMediaPlayback
        mediaPlaybackRequiresUserAction
        setSupportMultipleWindows={false}
        onShouldStartLoadWithRequest={(request) => request.url.startsWith('https://') || request.url === 'about:blank'}
        onLoadStart={() => setLoading(true)}
        onLoadEnd={() => setLoading(false)}
        onError={() => { setLoading(false); onError(); }}
        startInLoadingState
      />
      {loading ? <View pointerEvents="none" style={styles.loading}><ActivityIndicator color={PonflixTheme.colors.accent} /></View> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  webView: { flex: 1, backgroundColor: '#000' },
  loading: { ...StyleSheet.absoluteFill, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.24)' },
});

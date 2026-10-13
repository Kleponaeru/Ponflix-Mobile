import { router, useLocalSearchParams } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StatusBar, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { WebView } from 'react-native-webview';

import { PonflixTheme } from '@/constants/theme';
import { fetchIdlixPlayback, IDLIX_BASE_URL, type IdlixPlayback, type IdlixPlaybackType } from '@/features/movies/api/idlix-service';
import { IdlixVideoPlayer } from '@/features/movies/components/idlix-video-player';

const { colors, fonts } = PonflixTheme;

export default function IdlixWatchScreen() {
  const params = useLocalSearchParams<{ id?: string | string[]; title?: string | string[]; type?: string | string[] }>();
  const id = Array.isArray(params.id) ? params.id[0] : params.id;
  const title = Array.isArray(params.title) ? params.title[0] : params.title || 'Idlix playback';
  const type: IdlixPlaybackType = params.type === 'movie' ? 'movie' : 'episode';
  const [playback, setPlayback] = useState<IdlixPlayback | null>(null);
  const [loading, setLoading] = useState(true);
  const [gateWait, setGateWait] = useState(0);
  const [error, setError] = useState('');
  const [reloadKey, setReloadKey] = useState(0);
  const isLoading = Boolean(id) && loading;
  const visibleError = id ? error : 'This item has no playback ID.';

  useEffect(() => {
    if (!id) return;
    const controller = new AbortController();
    fetchIdlixPlayback(id, type, controller.signal, setGateWait).then((result) => {
      if (!controller.signal.aborted) setPlayback(result);
    }).catch((reason: unknown) => {
      if (!controller.signal.aborted) setError(reason instanceof Error ? reason.message : 'Idlix could not resolve this video.');
    }).finally(() => {
      if (!controller.signal.aborted) setLoading(false);
    });
    return () => controller.abort();
  }, [id, type, reloadKey]);

  const retry = () => {
    setGateWait(0);
    setError('');
    setPlayback(null);
    setLoading(true);
    setReloadKey((value) => value + 1);
  };

  return (
    <View style={styles.screen}>
      <StatusBar barStyle="light-content" backgroundColor="#000" />
      <SafeAreaView edges={['top']} style={styles.safeArea}>
        <View style={styles.topBar}>
          <Pressable accessibilityRole="button" accessibilityLabel="Back to title" onPress={() => router.back()} style={styles.backButton}>
            <SymbolView name={{ ios: 'chevron.left', android: 'arrow_back', web: 'arrow_back' }} size={19} tintColor="#FFF" />
          </Pressable>
          <View style={styles.heading}>
            <Text style={styles.kicker}>PONFLIX PLAYER</Text>
            <Text numberOfLines={1} style={styles.title}>{title}</Text>
          </View>
        </View>

        {playback?.kind === 'video' ? <IdlixVideoPlayer uri={playback.uri} headers={playback.headers} title={title} /> : playback?.kind === 'embed' ? (
          <WebView
            source={{ uri: playback.uri, headers: { Referer: `${IDLIX_BASE_URL}/` } }}
            style={styles.embed}
            originWhitelist={['https://*']}
            javaScriptEnabled
            domStorageEnabled
            allowsFullscreenVideo
            allowsInlineMediaPlayback
            mediaPlaybackRequiresUserAction={false}
            onError={() => { setPlayback(null); setError('The source player could not be loaded.'); }}
            onHttpError={() => { setPlayback(null); setError('The source player returned an HTTP error.'); }}
            setSupportMultipleWindows={false}
          />
        ) : isLoading ? (
          <View style={styles.state}>
            <ActivityIndicator color={colors.accent} size="large" />
            <Text style={styles.stateTitle}>{gateWait ? `Waiting for Idlix: ${gateWait}s` : 'Preparing video…'}</Text>
            <Text style={styles.stateBody}>Connecting to the video source.</Text>
          </View>
        ) : (
          <View style={styles.state}>
            <View style={styles.errorIcon}><SymbolView name={{ ios: 'exclamationmark.triangle.fill', android: 'warning', web: 'warning' }} size={22} tintColor={colors.accentSoft} /></View>
            <Text style={styles.stateTitle}>Couldn’t start playback</Text>
            <Text style={styles.stateBody}>{visibleError || 'Idlix did not return a playable source.'}</Text>
            <Pressable accessibilityRole="button" onPress={retry} style={styles.retryButton}><Text style={styles.retryText}>Try again</Text></Pressable>
          </View>
        )}
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#000' },
  safeArea: { flex: 1 },
  topBar: { minHeight: 58, flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16 },
  backButton: { width: 36, height: 36, borderRadius: 9, backgroundColor: 'rgba(255,255,255,0.09)', alignItems: 'center', justifyContent: 'center' },
  heading: { flex: 1, gap: 3 },
  kicker: { color: '#FF858E', fontFamily: fonts.bold, fontSize: 9, letterSpacing: 1.4 },
  title: { color: '#FFF', fontFamily: fonts.semibold, fontSize: 13 },
  embed: { flex: 1, backgroundColor: '#000' },
  state: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 28, gap: 11 },
  stateTitle: { color: '#FFF', fontFamily: fonts.bold, fontSize: 15, textAlign: 'center' },
  stateBody: { color: 'rgba(255,255,255,0.55)', fontFamily: fonts.regular, fontSize: 11, lineHeight: 17, textAlign: 'center' },
  errorIcon: { width: 50, height: 50, alignItems: 'center', justifyContent: 'center', borderRadius: 25, backgroundColor: 'rgba(229,9,20,0.16)', marginBottom: 5 },
  retryButton: { minHeight: 38, marginTop: 6, paddingHorizontal: 18, borderRadius: 8, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.accent },
  retryText: { color: '#FFF', fontFamily: fonts.bold, fontSize: 12 },
});

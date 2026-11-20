import { useCallback, useEffect, useRef, useState } from 'react';
import { Animated, StyleSheet } from 'react-native';
import { WebView } from 'react-native-webview';

import { ponflixLoaderHtml } from '../assets/ponflix-loader-html';

const LOADER_CYCLE_MS = 4200;
const FADE_OUT_MS = 260;

export function LaunchScreen() {
  const [visible, setVisible] = useState(true);
  const [opacity] = useState(() => new Animated.Value(1));
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const finishing = useRef(false);

  const finishAfterCycle = useCallback(() => {
    if (finishing.current) return;
    finishing.current = true;

    timer.current = setTimeout(() => {
      Animated.timing(opacity, {
        toValue: 0,
        duration: FADE_OUT_MS,
        useNativeDriver: true,
      }).start(() => setVisible(false));
    }, LOADER_CYCLE_MS);
  }, [opacity]);

  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);

  if (!visible) return null;

  return (
    <Animated.View pointerEvents="auto" style={[StyleSheet.absoluteFill, styles.overlay, { opacity }]}>
      <WebView
        accessibilityLabel="Ponflix loading"
        bounces={false}
        javaScriptEnabled={false}
        originWhitelist={['*']}
        overScrollMode="never"
        scrollEnabled={false}
        source={{ html: ponflixLoaderHtml }}
        style={styles.webView}
        onError={finishAfterCycle}
        onLoadEnd={finishAfterCycle}
      />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    backgroundColor: '#08090B',
    elevation: 100,
    zIndex: 100,
  },
  webView: {
    backgroundColor: '#08090B',
    flex: 1,
  },
});

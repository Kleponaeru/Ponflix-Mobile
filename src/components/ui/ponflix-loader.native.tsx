import { StyleSheet, View } from 'react-native';
import { WebView } from 'react-native-webview';

import { getPonflixLoaderHtml } from '@/features/launch/assets/ponflix-loader-html';

type PonflixLoaderProps = {
  size?: 'small' | 'large';
  label?: string;
};

export function PonflixLoader({ size = 'small', label = 'Loading Ponflix' }: PonflixLoaderProps) {
  const isLarge = size === 'large';

  return (
    <View
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel={label}
      style={[styles.frame, isLarge ? styles.large : styles.small]}
    >
      <WebView
        accessibilityLabel={label}
        bounces={false}
        javaScriptEnabled={false}
        originWhitelist={['*']}
        overScrollMode="never"
        scrollEnabled={false}
        source={{ html: getPonflixLoaderHtml(!isLarge) }}
        style={styles.webView}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  frame: {
    overflow: 'hidden',
    backgroundColor: 'transparent',
  },
  small: {
    width: 112,
    height: 62,
  },
  large: {
    width: 280,
    height: 150,
  },
  webView: {
    flex: 1,
    backgroundColor: 'transparent',
  },
});

import { useEffect, useState } from 'react';
import { Animated, StyleSheet, View } from 'react-native';

type PonflixLoaderProps = {
  size?: 'small' | 'large';
  label?: string;
};

const logo = require('../../../assets/branding/ponflix-logo.png');

export function PonflixLoader({ size = 'small', label }: PonflixLoaderProps) {
  const [pulse] = useState(() => new Animated.Value(0));
  const isLarge = size === 'large';
  const width = isLarge ? 210 : 92;

  useEffect(() => {
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 900, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0, duration: 900, useNativeDriver: true }),
      ]),
    );
    animation.start();
    return () => animation.stop();
  }, [pulse]);

  return (
    <View
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel={label || 'Loading Ponflix'}
      style={[styles.loader, { width }]}
    >
      <Animated.Image
        accessible={false}
        accessibilityIgnoresInvertColors
        source={logo}
        resizeMode="contain"
        style={{
          width,
          height: width / 3.36,
          opacity: pulse.interpolate({ inputRange: [0, 1], outputRange: [0.72, 1] }),
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  loader: {
    alignItems: 'center',
  },
});

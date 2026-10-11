import { Image } from 'expo-image';
import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

type BrandHeaderProps = {
  rightAction?: ReactNode;
};

export function BrandHeader({ rightAction }: BrandHeaderProps) {
  return (
    <View style={styles.header}>
      <Image source={require('../../assets/branding/ponflix-logo.png')} contentFit="contain" style={styles.logo} />
      {rightAction}
    </View>
  );
}

const styles = StyleSheet.create({
  header: { height: 58, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20 },
  logo: { width: 108, height: 36 },
});

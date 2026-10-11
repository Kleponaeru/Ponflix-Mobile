import { LinearGradient } from 'expo-linear-gradient';
import { Image } from 'expo-image';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { PonflixTheme } from '@/constants/theme';

const { colors, fonts } = PonflixTheme;

type SpotlightBannerProps = {
  imageUrl?: string;
  eyebrow: string;
  title: string;
  description: string;
  primaryLabel: string;
  onPrimaryPress: () => void;
  secondaryLabel?: string;
  onSecondaryPress?: () => void;
};

export function SpotlightBanner({
  imageUrl,
  eyebrow,
  title,
  description,
  primaryLabel,
  onPrimaryPress,
  secondaryLabel,
  onSecondaryPress,
}: SpotlightBannerProps) {
  return (
    <View style={styles.banner}>
      {imageUrl ? <Image source={{ uri: imageUrl }} contentFit="cover" cachePolicy="memory-disk" transition={240} style={StyleSheet.absoluteFill} /> : null}
      <LinearGradient
        colors={['rgba(8,9,11,0.08)', 'rgba(8,9,11,0.27)', 'rgba(8,9,11,0.96)']}
        locations={[0, 0.48, 1]}
        style={StyleSheet.absoluteFill}
      />
      <View style={styles.copy}>
        <View style={styles.eyebrowRow}><View style={styles.redMark} /><Text style={styles.eyebrow}>{eyebrow}</Text></View>
        <Text numberOfLines={3} style={styles.title}>{title}</Text>
        <Text numberOfLines={3} style={styles.description}>{description}</Text>
        <View style={styles.actions}>
          <Pressable accessibilityRole="button" onPress={onPrimaryPress} style={styles.primaryButton}>
            <Text style={styles.playGlyph}>▶</Text>
            <Text style={styles.primaryButtonText}>{primaryLabel}</Text>
          </Pressable>
          {secondaryLabel && onSecondaryPress ? (
            <Pressable accessibilityRole="button" onPress={onSecondaryPress} style={styles.secondaryButton}>
              <Text style={styles.secondaryButtonText}>{secondaryLabel}</Text>
            </Pressable>
          ) : null}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: { minHeight: 484, justifyContent: 'flex-end', overflow: 'hidden', backgroundColor: colors.surface },
  copy: { paddingHorizontal: 22, paddingTop: 82, paddingBottom: 62 },
  eyebrowRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 13 },
  redMark: { width: 4, height: 17, backgroundColor: colors.accent, marginRight: 8, borderRadius: 2 },
  eyebrow: { color: 'rgba(255,255,255,0.7)', fontFamily: fonts.bold, fontSize: 11, letterSpacing: 2 },
  title: { color: '#FFF', fontFamily: fonts.extraBold, fontSize: 37, lineHeight: 42, letterSpacing: -1.2, maxWidth: 355 },
  description: { color: 'rgba(255,255,255,0.68)', fontFamily: fonts.regular, fontSize: 14, lineHeight: 21, marginTop: 14, maxWidth: 340 },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 23 },
  primaryButton: { minHeight: 46, borderRadius: 9, backgroundColor: '#FFF', paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 9 },
  playGlyph: { color: '#111216', fontSize: 13 },
  primaryButtonText: { color: '#111216', fontFamily: fonts.bold, fontSize: 13 },
  secondaryButton: { minHeight: 46, borderRadius: 9, backgroundColor: 'rgba(255,255,255,0.14)', paddingHorizontal: 17, justifyContent: 'center' },
  secondaryButtonText: { color: '#FFF', fontFamily: fonts.semibold, fontSize: 13 },
});

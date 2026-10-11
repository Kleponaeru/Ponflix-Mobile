import { NativeTabs } from 'expo-router/unstable-native-tabs';

import { PonflixTheme } from '@/constants/theme';

const { colors } = PonflixTheme;

export default function AppTabs() {
  return (
    <NativeTabs
      backgroundColor={colors.background}
      indicatorColor="#261014"
      iconColor={{ default: colors.muted, selected: colors.accent }}
      labelStyle={{
        default: { color: colors.muted, fontFamily: PonflixTheme.fonts.medium },
        selected: { color: colors.text, fontFamily: PonflixTheme.fonts.semibold },
      }}>
      <NativeTabs.Trigger name="index">
        <NativeTabs.Trigger.Label>Home</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="explore">
        <NativeTabs.Trigger.Label>Search</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}

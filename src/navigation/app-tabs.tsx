import { NativeTabs } from 'expo-router/unstable-native-tabs';

import { PonflixTheme } from '@/constants/theme';

const { colors } = PonflixTheme;

export default function AppTabs() {
  return (
    <NativeTabs
      backgroundColor={colors.background}
      indicatorColor="rgba(229,9,20,0.18)"
      rippleColor="rgba(229,9,20,0.28)"
      iconColor={{ default: colors.muted, selected: colors.accent }}
      labelStyle={{
        default: { color: colors.muted, fontFamily: PonflixTheme.fonts.medium },
        selected: { color: colors.text, fontFamily: PonflixTheme.fonts.semibold },
      }}>
      <NativeTabs.Trigger name="index">
        <NativeTabs.Trigger.Icon md={{ default: 'home', selected: 'home_filled' }} sf={{ default: 'house', selected: 'house.fill' }} />
        <NativeTabs.Trigger.Label>Home</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="search">
        <NativeTabs.Trigger.Icon md={{ default: 'search', selected: 'search' }} sf="magnifyingglass" />
        <NativeTabs.Trigger.Label>Search</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="anime">
        <NativeTabs.Trigger.Icon md={{ default: 'movie', selected: 'movie' }} sf={{ default: 'play.rectangle', selected: 'play.rectangle.fill' }} />
        <NativeTabs.Trigger.Label>Anime</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="comics">
        <NativeTabs.Trigger.Icon md={{ default: 'menu_book', selected: 'menu_book' }} sf={{ default: 'books.vertical', selected: 'books.vertical.fill' }} />
        <NativeTabs.Trigger.Label>Comics</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="library">
        <NativeTabs.Trigger.Icon md={{ default: 'bookmark_border', selected: 'bookmark' }} sf={{ default: 'bookmark', selected: 'bookmark.fill' }} />
        <NativeTabs.Trigger.Label>Library</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}

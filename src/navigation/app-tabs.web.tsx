import { Image } from 'expo-image';
import { Tabs, TabList, TabTrigger, TabSlot, type TabListProps, type TabTriggerSlotProps } from 'expo-router/ui';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { PonflixTheme } from '@/constants/theme';

const { fonts } = PonflixTheme;

export default function AppTabs() {
  return (
    <Tabs>
      <TabSlot style={{ height: '100%' }} />
      <TabList asChild>
        <CustomTabList>
          <TabTrigger name="index" href="/" asChild><TabButton>Home</TabButton></TabTrigger>
          <TabTrigger name="explore" href="/explore" asChild><TabButton>Search</TabButton></TabTrigger>
        </CustomTabList>
      </TabList>
    </Tabs>
  );
}

function TabButton({ children, isFocused, ...props }: TabTriggerSlotProps) {
  return (
    <Pressable {...props} style={({ pressed }) => [styles.tabButton, isFocused && styles.tabButtonSelected, pressed && styles.pressed]}>
      <Text style={[styles.tabLabel, isFocused && styles.tabLabelSelected]}>{children}</Text>
    </Pressable>
  );
}

function CustomTabList(props: TabListProps) {
  return (
    <View {...props} style={[styles.tabListContainer, props.style]}>
      <View style={styles.innerContainer}>
        <Image source={require('../../assets/branding/ponflix-logo.png')} contentFit="contain" style={styles.logo} />
        <View style={styles.actions}>{props.children}</View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  tabListContainer: { position: 'absolute', zIndex: 10, top: 0, left: 0, right: 0, paddingHorizontal: 24, paddingVertical: 9, alignItems: 'center', backgroundColor: 'rgba(8,9,11,0.96)', borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.08)' },
  innerContainer: { width: '100%', maxWidth: 1240, minHeight: 43, flexDirection: 'row', alignItems: 'center' },
  logo: { width: 116, height: 39, marginRight: 'auto' },
  actions: { flexDirection: 'row', gap: 7 },
  tabButton: { paddingVertical: 10, paddingHorizontal: 15, borderRadius: 7 },
  tabButtonSelected: { backgroundColor: 'rgba(229,9,20,0.14)' },
  tabLabel: { color: 'rgba(255,255,255,0.55)', fontFamily: fonts.semibold, fontSize: 13 },
  tabLabelSelected: { color: '#FFF' },
  pressed: { opacity: 0.72 },
});

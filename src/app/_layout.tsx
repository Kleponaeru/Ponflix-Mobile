import { Inter_400Regular } from '@expo-google-fonts/inter/400Regular';
import { Inter_500Medium } from '@expo-google-fonts/inter/500Medium';
import { Inter_600SemiBold } from '@expo-google-fonts/inter/600SemiBold';
import { Inter_700Bold } from '@expo-google-fonts/inter/700Bold';
import { Inter_800ExtraBold } from '@expo-google-fonts/inter/800ExtraBold';
import { useFonts } from '@expo-google-fonts/inter/useFonts';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect } from 'react';

import { PonflixTheme } from '@/constants/theme';
import { LibraryProvider } from '@/features/library/context/library-context';

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
    Inter_800ExtraBold,
  });

  useEffect(() => {
    if (fontsLoaded || fontError) SplashScreen.hideAsync();
  }, [fontsLoaded, fontError]);

  if (!fontsLoaded && !fontError) return null;
  return (
    <LibraryProvider>
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: PonflixTheme.colors.background } }}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="anime/[slug]" />
        <Stack.Screen name="anime/[slug]/episode/[episodeSlug]" />
        <Stack.Screen name="comics/[id]" />
        <Stack.Screen name="comics/[id]/chapter/[chapterId]" />
        <Stack.Screen name="movies/idlix" />
        <Stack.Screen name="movies/idlix/[slug]" />
        <Stack.Screen name="movies/idlix/watch" />
      </Stack>
    </LibraryProvider>
  );
}

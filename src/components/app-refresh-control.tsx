import { RefreshControl, type RefreshControlProps } from 'react-native';

import { PonflixTheme } from '@/constants/theme';

type AppRefreshControlProps = Omit<RefreshControlProps, 'tintColor' | 'colors' | 'progressBackgroundColor'>;

/** Shared pull-to-refresh appearance for app screens. Each screen supplies the data reload action. */
export function AppRefreshControl(props: AppRefreshControlProps) {
  const { colors } = PonflixTheme;
  return (
    <RefreshControl
      {...props}
      tintColor={colors.accent}
      colors={[colors.accent]}
      progressBackgroundColor={colors.surface}
    />
  );
}

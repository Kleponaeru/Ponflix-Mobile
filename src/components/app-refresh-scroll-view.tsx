import { forwardRef, useState, type ForwardedRef, type ReactElement, type RefAttributes } from 'react';
import { ScrollView, type ScrollViewProps } from 'react-native';

import { AppRefreshControl } from '@/components/app-refresh-control';

type AppRefreshScrollViewProps = Omit<ScrollViewProps, 'refreshControl'> & {
  onRefresh: () => void | Promise<void>;
  refreshing?: boolean;
};

/** Standard vertical scroll view with Ponflix pull-to-refresh behavior. */
function AppRefreshScrollViewInner(
  { onRefresh, refreshing, ...props }: AppRefreshScrollViewProps,
  ref: ForwardedRef<ScrollView>,
) {
  const [internalRefreshing, setInternalRefreshing] = useState(false);
  const isRefreshing = refreshing ?? internalRefreshing;

  const handleRefresh = async () => {
    if (isRefreshing) return;
    if (refreshing === undefined) setInternalRefreshing(true);
    try {
      await onRefresh();
    } catch {
      // The screen owns its error state; keep refresh failures from escaping the gesture handler.
    } finally {
      if (refreshing === undefined) setInternalRefreshing(false);
    }
  };

  return (
    <ScrollView
      {...props}
      ref={ref}
      refreshControl={<AppRefreshControl refreshing={isRefreshing} onRefresh={handleRefresh} />}
    />
  );
}

const ForwardedAppRefreshScrollView = forwardRef(AppRefreshScrollViewInner);

export const AppRefreshScrollView = ForwardedAppRefreshScrollView as (
  props: AppRefreshScrollViewProps & RefAttributes<ScrollView>,
) => ReactElement;

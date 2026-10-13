import { forwardRef, useState, type ForwardedRef, type ReactElement, type RefAttributes } from 'react';
import { FlatList, type FlatListProps } from 'react-native';

import { AppRefreshControl } from '@/components/app-refresh-control';

type AppRefreshFlatListProps<ItemT> = Omit<FlatListProps<ItemT>, 'refreshControl' | 'onRefresh' | 'refreshing'> & {
  onRefresh: () => void | Promise<void>;
  refreshing?: boolean;
};

function AppRefreshFlatListInner<ItemT>(
  { onRefresh, refreshing, ...props }: AppRefreshFlatListProps<ItemT>,
  ref: ForwardedRef<FlatList<ItemT>>,
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
    <FlatList
      {...props}
      ref={ref}
      refreshControl={<AppRefreshControl refreshing={isRefreshing} onRefresh={handleRefresh} />}
    />
  );
}

const ForwardedAppRefreshFlatList = forwardRef(AppRefreshFlatListInner);

/** Standard virtualized list with Ponflix pull-to-refresh behavior. */
export const AppRefreshFlatList = ForwardedAppRefreshFlatList as <ItemT>(
  props: AppRefreshFlatListProps<ItemT> & RefAttributes<FlatList<ItemT>>,
) => ReactElement;

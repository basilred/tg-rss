import { useInfiniteQuery } from '@tanstack/react-query';
import { api } from '../api/client';
import { useUiStore } from '../stores/ui';

export const useFeed = () => {
  const sortOrder = useUiStore((s) => s.sortOrder);
  const activeFolder = useUiStore((s) => s.activeFolder);

  return useInfiniteQuery({
    queryKey: ['feed', sortOrder, activeFolder],
    queryFn: ({ pageParam }) =>
      api.feed.get({
        sort: sortOrder,
        folder: activeFolder ?? undefined,
        cursor: pageParam ?? undefined,
        limit: 30,
      }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
  });
};

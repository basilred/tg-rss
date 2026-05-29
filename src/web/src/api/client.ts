const BASE = '/api';

let token: string | null = null;

export const setToken = (t: string | null): void => {
  token = t;
};

const request = async <T>(
  path: string,
  options: RequestInit = {},
): Promise<T> => {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const res = await fetch(`${BASE}${path}`, { ...options, headers });

  if (!res.ok) {
    throw new Error(`API error: ${res.status}`);
  }

  return res.json();
};

export const api = {
  auth: {
    verify: (initData: string) =>
      request<{
        token: string;
        telegramSyncConnected: boolean;
        user: {
          id: number;
          firstName?: string;
          lastName?: string;
          username?: string;
        };
      }>('/auth/verify', {
        method: 'POST',
        body: JSON.stringify({ initData }),
      }),
    status: () =>
      request<{ telegramSyncConnected: boolean }>('/auth/status'),
  },
  channels: {
    search: (q: string) =>
      request<Array<{ id: number; username: string; title: string; photo_url: string }>>(
        `/channels/search?q=${encodeURIComponent(q)}`,
      ),
  },
  subscriptions: {
    list: () =>
      request<Array<{ id: number; username: string; title: string; photo_url: string; added_at: string; folder_ids: string | null }>>('/subscriptions'),
    add: (channelId: number) =>
      request('/subscriptions', {
        method: 'POST',
        body: JSON.stringify({ channelId }),
      }),
    remove: (channelId: number) =>
      request(`/subscriptions/${channelId}`, { method: 'DELETE' }),
    import: () =>
      request<{ imported: number }>('/subscriptions/import', { method: 'POST' }),
  },
  folders: {
    list: () =>
      request<Array<{ id: number; name: string; channel_ids: string | null }>>('/folders'),
    create: (name: string) =>
      request<{ id: number; name: string }>('/folders', {
        method: 'POST',
        body: JSON.stringify({ name }),
      }),
    update: (id: number, name: string) =>
      request(`/folders/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({ name }),
      }),
    delete: (id: number) =>
      request(`/folders/${id}`, { method: 'DELETE' }),
    addChannel: (folderId: number, channelId: number) =>
      request(`/folders/${folderId}/channels`, {
        method: 'POST',
        body: JSON.stringify({ channelId }),
      }),
    removeChannel: (folderId: number, channelId: number) =>
      request(`/folders/${folderId}/channels/${channelId}`, { method: 'DELETE' }),
  },
  feed: {
    get: (params: {
      sort?: string;
      folder?: number;
      cursor?: string;
      limit?: number;
    }) => {
      const searchParams = new URLSearchParams();
      if (params.sort) searchParams.set('sort', params.sort);
      if (params.folder) searchParams.set('folder', String(params.folder));
      if (params.cursor) searchParams.set('cursor', params.cursor);
      if (params.limit) searchParams.set('limit', String(params.limit));
      return request<{
        items: Array<{
          message: {
            id: number;
            channelId: number;
            text: string | null;
            mediaUrl: string | null;
            mediaType: string | null;
            postedAt: string;
          };
          channel: {
            id: number;
            username: string | null;
            title: string;
            photoUrl: string | null;
          };
          isRead: boolean;
        }>;
        nextCursor: string | null;
      }>(`/feed?${searchParams.toString()}`);
    },
  },
  read: {
    markBatch: (messageIds: number[]) =>
      request('/messages/read', {
        method: 'POST',
        body: JSON.stringify({ messageIds }),
      }),
  },
};

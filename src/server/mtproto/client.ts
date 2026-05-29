import MTProto from '@mtproto/core';
import { getDb } from '../db';
import { decryptSession, encryptSession } from './session';

const API_ID = Number(process.env.API_ID) || 0;
const API_HASH = process.env.API_HASH || '';

type MTProtoClient = InstanceType<typeof MTProto>;
type ClientMap = Map<number, MTProtoClient>;

const clients: ClientMap = new Map();

export const getClient = (userId: number): MTProtoClient => {
  let client = clients.get(userId);
  if (!client) {
    const db = getDb();
    const row = db
      .query('SELECT encrypted_session_data FROM user_sessions WHERE user_id = ? AND is_active = 1')
      .get(userId) as { encrypted_session_data: string } | undefined;

    const dataDir = process.env.DATA_DIR || '/data';

    client = new MTProto({
      api_id: API_ID,
      api_hash: API_HASH,
      storageOptions: { path: `${dataDir}/mtproto-${userId}` },
    });

    if (row) {
      try {
        const sessionRaw = decryptSession(row.encrypted_session_data);
        const sessionData = JSON.parse(sessionRaw);
        client.storage.set('dc', sessionData.dc);
        client.storage.set('auth_key', sessionData.auth_key);
        client.storage.set('server_salt', sessionData.server_salt);
      } catch {
        console.warn(`User ${userId}: failed to restore session`);
      }
    }

    clients.set(userId, client);
  }
  return client;
};

export const clearClient = (userId: number): void => {
  clients.delete(userId);
};

// ---- QR Code Login ----

interface ExportLoginTokenResult {
  token: Uint8Array;
  expires: number;
  tgLoginUrl: string;
}

export const exportLoginToken = async (): Promise<ExportLoginTokenResult> => {
  const dataDir = process.env.DATA_DIR || '/data';
  const client = new MTProto({
    api_id: API_ID,
    api_hash: API_HASH,
    storageOptions: { path: `${dataDir}/mtproto-qr-${Date.now()}` },
  });

  const result = await client.call('auth.exportLoginToken', {
    api_id: API_ID,
    api_hash: API_HASH,
    except_ids: [],
  }) as {
    token: Uint8Array;
    expires: number;
  };

  const tokenBase64 = Buffer.from(result.token).toString('base64url');
  const tgLoginUrl = `tg://login?token=${tokenBase64}`;

  return { token: result.token, expires: result.expires, tgLoginUrl };
};

interface ImportLoginTokenResult {
  user: { id: number; first_name?: string; last_name?: string };
}

export const importLoginToken = async (
  token: Uint8Array,
): Promise<ImportLoginTokenResult> => {
  const dataDir = process.env.DATA_DIR || '/data';
  const client = new MTProto({
    api_id: API_ID,
    api_hash: API_HASH,
    storageOptions: { path: `${dataDir}/mtproto-qr-${Date.now()}-import` },
  });

  const result = await client.call('auth.importLoginToken', {
    token,
  }) as {
    user: { id: number; first_name?: string; last_name?: string };
  };

  // Save the session
  const dc = client.storage.get('dc');
  const authKey = client.storage.get('auth_key');
  const serverSalt = client.storage.get('server_salt');

  const sessionData = JSON.stringify({ dc, auth_key: authKey, server_salt: serverSalt });
  const encrypted = encryptSession(sessionData);

  const db = getDb();
  db.run(
    'INSERT OR REPLACE INTO user_sessions (user_id, encrypted_session_data, is_active) VALUES (?, ?, 1)',
    [result.user.id, encrypted],
  );

  return result;
};

// ---- Dialogs ----

interface ChannelInfo {
  id: number;
  username: string;
  title: string;
  photoUrl: string | null;
}

export const getDialogs = async (
  client: MTProtoClient,
): Promise<ChannelInfo[]> => {
  const result = await client.call('messages.getDialogs', {
    offset_date: 0,
    offset_id: 0,
    offset_peer: { _: 'inputPeerEmpty' },
    limit: 200,
    hash: 0,
  }) as {
    chats: Array<{
      _: string;
      id: number;
      username?: string;
      title: string;
      photo?: { dc_id: number; id: number; access_hash: number };
    }>;
  };

  const channels: ChannelInfo[] = [];

  for (const chat of result.chats) {
    if (chat._ === 'channel') {
      channels.push({
        id: -Math.abs(chat.id),
        username: chat.username || '',
        title: chat.title,
        photoUrl: chat.photo
          ? `https://cdn.telesco.pe/file/photo_${chat.photo.dc_id}_${chat.photo.id}.jpg`
          : null,
      });
    }
  }

  return channels;
};

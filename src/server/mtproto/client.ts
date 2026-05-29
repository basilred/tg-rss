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

// ---- Phone Login (with SMS to avoid anti-fraud) ----

const createTempClient = (): MTProtoClient => {
  const dataDir = process.env.DATA_DIR || '/data';
  return new MTProto({
    api_id: API_ID,
    api_hash: API_HASH,
    storageOptions: { path: `${dataDir}/mtproto-login-${Date.now()}` },
  });
};

export const sendCode = async (
  client: MTProtoClient,
  phone: string,
): Promise<{ phoneCodeHash: string; timeout: number }> => {
  const result = await client.call('auth.sendCode', {
    phone_number: phone,
    settings: { _: 'codeSettings', allow_sms: true, current_number: true },
  }) as { phone_code_hash: string; timeout: number };
  return { phoneCodeHash: result.phone_code_hash, timeout: result.timeout || 60 };
};

export const signIn = async (
  client: MTProtoClient,
  phone: string,
  code: string,
  phoneCodeHash: string,
): Promise<{ userId: number }> => {
  const result = await client.call('auth.signIn', {
    phone_number: phone,
    phone_code: code,
    phone_code_hash: phoneCodeHash,
  }) as { user: { id: number } };

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

  return { userId: result.user.id };
};

// ---- Dialogs ----

interface ChannelInfo {
  id: number;
  accessHash: string;
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
      access_hash?: string | number;
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
        accessHash: chat.access_hash ? String(chat.access_hash) : '',
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

export { createTempClient };

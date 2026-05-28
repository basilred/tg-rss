import MTProto from '@mtproto/core';
import { getDb } from '../db';
import { decryptSession } from './session';

const API_ID = Number(process.env.API_ID) || 0;
const API_HASH = process.env.API_HASH || '';

if (!API_ID || !API_HASH) {
  console.warn('API_ID and API_HASH not set — MTProto will not work');
}

type ClientMap = Map<number, typeof MTProto>;

const clients: ClientMap = new Map();

export const getClient = (userId: number): typeof MTProto => {
  let client = clients.get(userId);
  if (!client) {
    const db = getDb();
    const row = db
      .query('SELECT encrypted_session_data FROM user_sessions WHERE user_id = ? AND is_active = 1')
      .get(userId) as { encrypted_session_data: string } | undefined;

    client = new MTProto({
      api_id: API_ID,
      api_hash: API_HASH,
    });

    if (row) {
      decryptSession(row.encrypted_session_data);
    }

    clients.set(userId, client);
  }
  return client;
};

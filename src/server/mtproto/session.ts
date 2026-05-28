import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';

type EncryptedSession = {
  iv: string;
  data: string;
};

const encrypt = (text: string, key: Buffer): EncryptedSession => {
  const iv = randomBytes(16);
  const cipher = createCipheriv('aes-256-cbc', key, iv);
  const encrypted = Buffer.concat([cipher.update(text, 'utf8'), cipher.final()]);
  return {
    iv: iv.toString('hex'),
    data: encrypted.toString('hex'),
  };
};

const decrypt = (encrypted: EncryptedSession, key: Buffer): string => {
  const decipher = createDecipheriv(
    'aes-256-cbc',
    key,
    Buffer.from(encrypted.iv, 'hex'),
  );
  const decrypted = Buffer.concat([
    decipher.update(Buffer.from(encrypted.data, 'hex')),
    decipher.final(),
  ]);
  return decrypted.toString('utf8');
};

const getSecret = (): Buffer => {
  const secret = process.env.SERVER_SECRET;
  if (!secret) throw new Error('SERVER_SECRET is required');
  return Buffer.from(secret.padEnd(32).slice(0, 32), 'utf8');
};

export const encryptSession = (sessionData: string): string => {
  const { iv, data } = encrypt(sessionData, getSecret());
  return JSON.stringify({ iv, data });
};

export const decryptSession = (encryptedStr: string): string => {
  const parsed: EncryptedSession = JSON.parse(encryptedStr);
  return decrypt(parsed, getSecret());
};

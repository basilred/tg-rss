import { createHmac } from 'node:crypto';

const DEFAULT_MAX_AGE_SECONDS = 15 * 60;

interface InitDataUser {
  id: number;
  first_name?: string;
  last_name?: string;
  username?: string;
}

export const verifyInitData = (
  initData: string,
  botToken: string,
  maxAgeSeconds = DEFAULT_MAX_AGE_SECONDS,
): InitDataUser | null => {
  const params = new URLSearchParams(initData);
  const data: Record<string, string> = {};

  for (const [key, value] of params) {
    data[key] = value;
  }

  const hash = data.hash;
  if (!hash) return null;

  delete data.hash;

  // Build check string from raw string values (no JSON parsing)
  const checkString = Object.keys(data)
    .sort()
    .map((key) => `${key}=${data[key]}`)
    .join('\n');

  const secretKey = createHmac('sha256', 'WebAppData').update(botToken).digest();
  const computedHash = createHmac('sha256', secretKey).update(checkString).digest('hex');

  if (computedHash !== hash) return null;

  const authDate = Number(data.auth_date);
  const nowSeconds = Math.floor(Date.now() / 1000);
  if (!Number.isFinite(authDate) || nowSeconds - authDate > maxAgeSeconds) {
    return null;
  }

  // Parse user field (it's a JSON string in URL-encoded initData)
  const userRaw = data.user;
  if (!userRaw) return null;

  try {
    const user = JSON.parse(userRaw) as InitDataUser;
    return user;
  } catch {
    return null;
  }
};

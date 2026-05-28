import { createHmac } from 'node:crypto';

interface InitDataUser {
  id: number;
  first_name?: string;
  last_name?: string;
  username?: string;
}

interface ParsedInitData {
  user?: InitDataUser;
  hash: string;
  [key: string]: string | number | InitDataUser | undefined;
}

const parseInitData = (initData: string): ParsedInitData => {
  const params = new URLSearchParams(initData);
  const result: Record<string, string> = {};
  for (const [key, value] of params) {
    result[key] = value;
  }
  return result as unknown as ParsedInitData;
};

export const verifyInitData = (initData: string, botToken: string): InitDataUser | null => {
  const data = parseInitData(initData);
  if (!data.user || !data.hash) return null;

  const checkString = Object.keys(data)
    .filter((key) => key !== 'hash')
    .sort()
    .map((key) => `${key}=${data[key]}`)
    .join('\n');

  const secretKey = createHmac('sha256', 'WebAppData').update(botToken).digest();
  const hash = createHmac('sha256', secretKey).update(checkString).digest('hex');

  if (hash !== data.hash) return null;

  return data.user;
};

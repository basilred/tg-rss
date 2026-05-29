import { Bot } from 'grammy';
import { getDb } from '../db';
import {
  createNewClient,
  sendCode,
  signIn,
  saveSession,
  getDialogs,
} from '../mtproto/client';

const BOT_TOKEN = process.env.BOT_TOKEN;

if (!BOT_TOKEN) {
  throw new Error('BOT_TOKEN environment variable is required');
}

export const bot = new Bot(BOT_TOKEN);

type LoginState = {
  step: 'phone' | 'code';
  phone: string;
  phoneCodeHash: string;
};

const loginStates = new Map<number, LoginState>();

bot.command('start', async (ctx) => {
  await ctx.reply(
    'Привет! Я помогу тебе читать каналы как RSS-ленту.\n\n' +
    'Отправь /login, чтобы подключить синхронизацию.\n' +
    'Затем нажми кнопку «Открыть ленту».',
  );
});

bot.command('status', async (ctx) => {
  const userId = ctx.from?.id;
  if (!userId) return;

  const db = getDb();
  const session = db
    .query('SELECT is_active FROM user_sessions WHERE user_id = ?')
    .get(userId) as { is_active: number } | undefined;

  const subCount = db
    .query('SELECT COUNT(*) as count FROM subscriptions WHERE user_id = ? AND is_active = 1')
    .get(userId) as { count: number };

  const msgCount = db
    .query('SELECT COUNT(*) as count FROM messages')
    .get() as { count: number };

  if (session?.is_active) {
    await ctx.reply(
      `Синхронизация активна.\n` +
      `Подписок на каналы: ${subCount.count}\n` +
      `Сообщений в ленте: ${msgCount.count}`,
    );
  } else {
    await ctx.reply('Синхронизация не настроена. Отправь /login.');
  }
});

bot.command('login', async (ctx) => {
  const userId = ctx.from?.id;
  if (!userId) return;

  // Check if already has session
  const db = getDb();
  const existing = db
    .query('SELECT is_active FROM user_sessions WHERE user_id = ?')
    .get(userId) as { is_active: number } | undefined;

  if (existing?.is_active) {
    await ctx.reply(
      'Синхронизация уже настроена. Отправь /sync чтобы обновить список каналов из подписок Telegram.',
    );
    return;
  }

  loginStates.set(userId, { step: 'phone', phone: '', phoneCodeHash: '' });
  await ctx.reply('Введи номер телефона в международном формате (например, +79161234567):');
});

bot.command('sync', async (ctx) => {
  const userId = ctx.from?.id;
  if (!userId) return;

  const db = getDb();
  const session = db
    .query('SELECT is_active FROM user_sessions WHERE user_id = ?')
    .get(userId) as { is_active: number } | undefined;

  if (!session?.is_active) {
    await ctx.reply('Сначала нужно подключить синхронизацию. Отправь /login.');
    return;
  }

  await ctx.reply('Обновляю список каналов из твоих подписок...');
  try {
    const { getClient } = await import('../mtproto/client');
    const client = getClient(userId);
    const channels = await getDialogs(client);
    await saveChannels(userId, channels);
    await ctx.reply(
      `Готово! Импортировано ${channels.length} каналов. Открой ленту.`,
    );
  } catch (err) {
    console.error(`User ${userId}: sync error`, err);
    await ctx.reply('Ошибка при синхронизации. Попробуй позже.');
  }
});

bot.on('message:text', async (ctx) => {
  const userId = ctx.from?.id;
  if (!userId) return;

  const state = loginStates.get(userId);
  if (!state) return;

  const text = ctx.message.text.trim();

  if (state.step === 'phone') {
    const phone = text.replace(/\s/g, '');
    state.phone = phone;

    try {
      const mtproto = createNewClient(`${userId}`);
      console.log(`User ${userId}: sending code to ${phone}`);
      const { phone_code_hash } = await sendCode(mtproto, phone);
      console.log(`User ${userId}: code sent, hash received`);
      state.phoneCodeHash = phone_code_hash;
      state.step = 'code';

      loginStates.set(userId, { ...state, mtprotoRef: mtproto } as LoginState & { mtprotoRef: unknown });
      // Store client reference separately
      pendingClients.set(userId, mtproto);

      await ctx.reply('Код отправлен в Telegram. Введи его:');
    } catch (err) {
      console.error(`User ${userId}: sendCode error`, JSON.stringify(err, null, 2));
      loginStates.delete(userId);
      await ctx.reply('Ошибка при отправке кода. Попробуй /login ещё раз.');
    }
  } else if (state.step === 'code') {
    const mtproto = pendingClients.get(userId);
    if (!mtproto) {
      await ctx.reply('Сессия истекла. Отправь /login заново.');
      loginStates.delete(userId);
      return;
    }

    try {
      await signIn(mtproto, state.phone, text, state.phoneCodeHash);
      const user = await mtproto.call('users.getUsers', { id: [{ _: 'inputUserSelf' }] });
      const actualUserId = (user as Array<{ id: number }>)[0]?.id || userId;

      await saveSession(mtproto, actualUserId);

      const db = getDb();
      db.run('INSERT OR IGNORE INTO users (id) VALUES (?)', [actualUserId]);

      await ctx.reply('Вход выполнен! Ищу твои каналы...');

      const channels = await getDialogs(mtproto);
      await saveChannels(actualUserId, channels);

      const subCount = db
        .query('SELECT COUNT(*) as count FROM subscriptions WHERE user_id = ? AND is_active = 1')
        .get(actualUserId) as { count: number };

      await ctx.reply(
        `Готово! Найдено ${channels.length} каналов (${subCount.count} в ленте).\n` +
        'Нажми кнопку «Открыть ленту», чтобы читать.',
      );

      pendingClients.delete(userId);
      loginStates.delete(userId);
    } catch (err) {
      console.error(`User ${userId}: signIn error`, JSON.stringify(err, null, 2));
      loginStates.delete(userId);
      pendingClients.delete(userId);
      await ctx.reply('Неверный код или ошибка входа. Отправь /login чтобы попробовать снова.');
    }
  }
});

const pendingClients = new Map<number, ReturnType<typeof createNewClient>>();

async function saveChannels(
  userId: number,
  channels: Array<{ id: number; username: string; title: string; photoUrl: string | null }>,
): Promise<void> {
  const db = getDb();

  const insertChannel = db.prepare(
    'INSERT OR REPLACE INTO channels (id, username, title, photo_url) VALUES (?, ?, ?, ?)',
  );
  const insertSub = db.prepare(
    'INSERT OR IGNORE INTO subscriptions (user_id, channel_id) VALUES (?, ?)',
  );

  const tx = db.transaction(() => {
    for (const ch of channels) {
      insertChannel.run(ch.id, ch.username, ch.title, ch.photoUrl);
      insertSub.run(userId, ch.id);
    }
  });

  tx();
}

export const setupBot = async (baseUrl: string): Promise<void> => {
  await bot.init();
  await bot.api.setWebhook(`${baseUrl}/bot/webhook`);
  console.log(`Bot webhook set to ${baseUrl}/bot/webhook`);
};

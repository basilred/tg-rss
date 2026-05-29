import { Bot } from 'grammy';
import { getDb } from '../db';
import { createTempClient, sendCode, signIn, getDialogs } from '../mtproto/client';

const BOT_TOKEN = process.env.BOT_TOKEN;

if (!BOT_TOKEN) {
  throw new Error('BOT_TOKEN environment variable is required');
}

export const bot = new Bot(BOT_TOKEN);

type LoginState = {
  step: 'phone' | 'code';
  phone: string;
  phoneCodeHash: string;
  client: ReturnType<typeof createTempClient>;
};

const loginStates = new Map<number, LoginState>();

bot.command('start', async (ctx) => {
  await ctx.reply(
    'Привет! Я показываю твои Telegram-каналы как RSS-ленту.\n\n' +
    'Отправь /login для первоначальной настройки.\n' +
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

  if (session?.is_active) {
    await ctx.reply(
      `Подключено. Каналов: ${subCount.count}.\n` +
      'Если каналы не обновились — нажми «Импортировать каналы» в настройках ленты.',
    );
  } else {
    await ctx.reply('Не подключено. Отправь /login для настройки.');
  }
});

bot.command('login', async (ctx) => {
  const userId = ctx.from?.id;
  if (!userId) return;

  const db = getDb();
  const existing = db
    .query('SELECT is_active FROM user_sessions WHERE user_id = ?')
    .get(userId) as { is_active: number } | undefined;

  if (existing?.is_active) {
    await ctx.reply('Уже подключено! Нажми кнопку «Открыть ленту».');
    return;
  }

  await ctx.reply(
    'Введи номер телефона в международном формате:\n' +
    'Например: +79161234567\n\n' +
    'Код подтверждения придёт по SMS.',
  );
  loginStates.set(userId, {
    step: 'phone',
    phone: '',
    phoneCodeHash: '',
    client: createTempClient(),
  });
});

bot.on('message:text', async (ctx) => {
  const userId = ctx.from?.id;
  if (!userId) return;

  const state = loginStates.get(userId);
  if (!state) return;

  const text = ctx.message.text.trim();

  if (state.step === 'phone') {
    const phone = text.replace(/\s/g, '');
    if (!phone.startsWith('+')) {
      await ctx.reply('Номер должен начинаться с +. Например: +79161234567');
      return;
    }

    state.phone = phone;
    try {
      const { phoneCodeHash, timeout } = await sendCode(state.client, phone);
      state.phoneCodeHash = phoneCodeHash;
      state.step = 'code';
      await ctx.reply(`Код отправлен по SMS. Введи его (действителен ${timeout} сек):`);
    } catch (err) {
      console.error(`User ${userId}: sendCode error`, err);
      loginStates.delete(userId);
      await ctx.reply('Ошибка при отправке кода. Попробуй /login ещё раз.');
    }
  } else if (state.step === 'code') {
    try {
      const result = await signIn(state.client, state.phone, text, state.phoneCodeHash);
      console.log(`User ${userId}: signed in as ${result.userId}`);

      const db = getDb();
      db.run('INSERT OR IGNORE INTO users (id) VALUES (?)', [result.userId]);

      await ctx.reply('Вход выполнен! Импортирую твои каналы...');

      const channels = await getDialogs(state.client);
      await saveChannels(result.userId, channels);

      const subCount = db
        .query('SELECT COUNT(*) as count FROM subscriptions WHERE user_id = ? AND is_active = 1')
        .get(result.userId) as { count: number };

      await ctx.reply(
        `Готово! Импортировано ${channels.length} каналов (${subCount.count} активных).\n` +
        'Нажми кнопку «Открыть ленту».',
      );

      loginStates.delete(userId);
    } catch (err) {
      const mtError = err as { error_message?: string };
      console.error(`User ${userId}: signIn error`, mtError);

      if (mtError.error_message === 'PHONE_CODE_EXPIRED') {
        await ctx.reply('Код истёк. Отправь /login чтобы получить новый.');
      } else if (mtError.error_message === 'PHONE_CODE_INVALID') {
        await ctx.reply('Неверный код. Попробуй ещё раз:');
      } else {
        await ctx.reply('Ошибка входа. Отправь /login чтобы попробовать снова.');
      }

      if (mtError.error_message !== 'PHONE_CODE_INVALID') {
        loginStates.delete(userId);
      }
    }
  }
});

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

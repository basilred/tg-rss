import { Bot } from 'grammy';

const BOT_TOKEN = process.env.BOT_TOKEN;

if (!BOT_TOKEN) {
  throw new Error('BOT_TOKEN environment variable is required');
}

export const bot = new Bot(BOT_TOKEN);

bot.command('start', async (ctx) => {
  await ctx.reply(
    'Привет! Я показываю твои Telegram-каналы как RSS-ленту.\n\n' +
    'Нажми кнопку «Открыть ленту», чтобы начать.',
  );
});

bot.command('status', async (ctx) => {
  const userId = ctx.from?.id;
  if (!userId) return;

  const { getDb } = await import('../db');
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
    await ctx.reply('Не подключено. Открой ленту и нажми «Подключить».');
  }
});

export const setupBot = async (baseUrl: string): Promise<void> => {
  await bot.init();
  await bot.api.setWebhook(`${baseUrl}/bot/webhook`);
  console.log(`Bot webhook set to ${baseUrl}/bot/webhook`);
};

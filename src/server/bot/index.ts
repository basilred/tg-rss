import { Bot } from 'grammy';

const BOT_TOKEN = process.env.BOT_TOKEN;

if (!BOT_TOKEN) {
  throw new Error('BOT_TOKEN environment variable is required');
}

export const bot = new Bot(BOT_TOKEN);

bot.command('start', async (ctx) => {
  await ctx.reply(
    'Привет! Я помогу тебе настроить RSS-ленту из твоих Telegram-подписок.\n\n' +
    'Отправь /login, чтобы подключить синхронизацию.\n' +
    'Затем нажми кнопку "Открыть ленту", чтобы читать каналы.',
  );
});

bot.command('status', async (ctx) => {
  const userId = ctx.from?.id;
  if (!userId) {
    await ctx.reply('Не удалось определить пользователя.');
    return;
  }

  const { getDb } = await import('../db');
  const db = getDb();
  const session = db
    .query('SELECT is_active FROM user_sessions WHERE user_id = ?')
    .get(userId) as { is_active: number } | undefined;

  if (session?.is_active) {
    await ctx.reply('Синхронизация активна. Лента работает.');
  } else {
    await ctx.reply(
      'Синхронизация не настроена. Отправь /login для подключения.',
    );
  }
});

bot.command('login', async (ctx) => {
  await ctx.reply('Введи свой номер телефона в международном формате (например, +79161234567):');
});

export const setupBot = (baseUrl: string): void => {
  bot.api.setWebhook(`${baseUrl}/bot/webhook`);
  console.log(`Bot webhook set to ${baseUrl}/bot/webhook`);
};

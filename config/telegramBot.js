const TelegramBot = require('node-telegram-bot-api');
const { forceLogoutIfLogin } = require('../services/commonService');
const { getRedisKey } = require('../services/redis/commonfunction');
const { __mf } = require('i18n');
const { authenticatorType } = require('./contants');
const { addAuthenticator } = require('../services/authService');
const { updateUser } = require('../services/userService');

// Initialize the bot with webhook = true
const bot = new TelegramBot(process.env.TELEGRAM_BOT, {
    polling: false // Disable polling
});

// Webhook path
const WEBHOOK_PATH = 'telegram-webhook/' + process.env.TELEGRAM_BOT;
const WEBHOOK_URL = process.env.SERVER_URL + WEBHOOK_PATH;

// Setup webhook
async function setupWebhook() {
    try {
        if (bot) {
            // First delete any existing webhook
            await bot.deleteWebHook();
            // Then set the new webhook
            const result = await bot.setWebHook(WEBHOOK_URL);
           
        }
    } catch (error) {
        console.error('Error setting up webhook:', error);
    }
}

// Command handlers
bot.onText(/\/start/, (msg) => {
    bot.sendMessage(msg.chat.id, __mf("telegramBot.start"));
});

bot.onText(/\/connect/, async (msg) => {
    try {
        let authToken = msg.text.split(" ")?.[1];
        if (authToken) {
            const userId = await getRedisKey(authToken?.trim());
            if (!userId) {
                bot.sendMessage(msg.chat.id, __mf("auth.authenticatorCodeNotMatch"));
                return;
            }

            await addAuthenticator({ userId: userId, deviceId: msg.chat.id, type: authenticatorType.telegram });
            await updateUser(userId, { isAuthenticatorEnable: true });
            await forceLogoutIfLogin(userId);
            bot.sendMessage(msg.chat.id, __mf("auth.authConnected"));
        }
        else {
            bot.sendMessage(msg.chat.id, __mf("telegramBot.codeInvalid"));
        }
    }
    catch (e) {
        bot.sendMessage(msg.chat.id, __mf(e?.message?.msg || "internalServerError", e?.message?.keys));
    }
});


// Initialize webhook when the module is loaded
if (process.env.TELEGRAM_BOT && process.env.SERVER_URL) {
    setupWebhook().catch(console.error);
} else {
    console.warn('TELEGRAM_BOT or SERVER_URL environment variables are not set. Webhook setup skipped.');
}

module.exports = bot;


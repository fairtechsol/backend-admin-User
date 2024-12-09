
const TelegramBot = require('node-telegram-bot-api');
const { forceLogoutIfLogin } = require('../services/commonService');
const { getRedisKey } = require('../services/redis/commonfunction');
const { __mf } = require('i18n');
const { authenticatorType } = require('./contants');
const { addAuthenticator } = require('../services/authService');
const { updateUser } = require('../services/userService');

const bot = new TelegramBot(process.env.TELEGRAM_BOT);

bot.onText("/start", (msg) => {
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
    }
    catch (e) {
        bot.sendMessage(msg.chat.id, __mf(e?.message?.msg || "internalServerError", e?.message?.keys));
    }
});


bot.on("polling_error", (msg) => console.log(msg));
bot.startPolling().catch((error)=>{
    console.log(error);
});

module.exports = bot;
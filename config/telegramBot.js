
const TelegramBot = require('node-telegram-bot-api');
const { connectAppWithToken } = require('../services/commonService');
const { getRedisKey } = require('../services/redis/commonfunction');
const { __mf } = require('i18n');

const bot = new TelegramBot("7987516913:AAFZw23Ys56_zmacUdCCU_4uWKuEK4Ehp1k");

bot.onText("/start", (msg) => {
    bot.sendMessage(msg.chat.id, __mf("telegramBot.start"));
});

bot.onText(/\/connect/, async (msg) => {
    try {
        let authToken = msg.text.split(" ")?.[1];
        const userId = await getRedisKey(authToken?.trim());
        if (!userId) {
            bot.sendMessage(msg.chat.id, __mf("auth.authenticatorCodeNotMatch"));
        }
        
        await connectAppWithToken(authToken, msg.chat.id, { id: userId });
        bot.sendMessage(msg.chat.id, __mf("auth.authConnected"));
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
const { cardGameType } = require("../../config/contants");
const { parseRedisData } = require("../commonService");

class CardProfitLoss {
    constructor(type, oldProfitLoss, data, oldExposure) {
        this.type = type;
        this.oldProfitLoss = oldProfitLoss;
        this.data = data;
        this.oldExposure = oldExposure;
    }

    getCardGameProfitLoss() {
        switch (this.type) {
            case cardGameType.abj:
                return this.andarBahar();
            case cardGameType.dt20:
                return this.dragonTiger();
            case cardGameType.teen20:
                return this.teen20();
            case cardGameType.lucky7:
                return this.lucky7();
            case cardGameType.card32:
                return this.card32();
            default:
                throw {
                    statusCode: 400,
                    message: {
                        msg: "bet.wrongCardBetType"
                    }
                };
        }
    }

    dragonTiger() {
        const { lossAmount } = data;
        return { profitLoss: parseFloat((parseFloat(lossAmount || 0) - parseFloat(this.oldProfitLoss || 0)).toFixed(2)), exposure: parseFloat(this.oldExposure || 0) + parseFloat(lossAmount || 0) };
    }

    lucky7() {
        const { lossAmount } = data;
        return { profitLoss: parseFloat((parseFloat(lossAmount || 0) - parseFloat(this.oldProfitLoss || 0)).toFixed(2)), exposure: parseFloat(this.oldExposure || 0) + parseFloat(lossAmount || 0) };
    }

    card32() {
        const { bettingType, winAmount, lossAmount, playerName, partnership } = this.data;
        let newProfitLoss = { ...(JSON.parse(this.oldProfitLoss || "{}")) };
        if (!newProfitLoss) {
            newProfitLoss = {
                player8: 0,
                player9: 0,
                player10: 0,
                player11: 0
            }
        }

        else {
            newProfitLoss = JSON.parse(newProfitLoss);
        }

        Object.keys(newProfitLoss)?.forEach((item) => {

            if ((item == playerName && bettingType == betType.BACK) || (item != playerName && bettingType == betType.LAY)) {
                newProfitLoss[item] += ((winAmount * partnership) / 100);
            }
            else if ((item != playerName && bettingType == betType.BACK) || (item == playerName && bettingType == betType.LAY)) {
                newProfitLoss[item] -= ((lossAmount * partnership) / 100);
            }

            newProfitLoss[item] = parseRedisData(item, newProfitLoss);
        });

        return { profitLoss: JSON.stringify(newProfitLoss), exposure: parseFloat(this.oldExposure || 0) - Math.min(...Object.values(this.oldProfitLoss), 0) + Math.min(...Object.values(newProfitLoss), 0) };
    }

    andarBahar() {
        const { lossAmount } = data;
        return { profitLoss: parseFloat((parseFloat(lossAmount || 0) - parseFloat(this.oldProfitLoss || 0)).toFixed(2)), exposure: parseFloat(this.oldExposure || 0) + parseFloat(lossAmount || 0) };
    }

    teen20() {
        const { winAmount, lossAmount } = data;
        return { profitLoss: parseFloat((parseFloat(winAmount || 0) + parseFloat(this.oldProfitLoss || 0)).toFixed(2)), exposure: parseFloat(this.oldExposure || 0) + parseFloat(lossAmount || 0) };
    }

}

exports.CardProfitLoss = CardProfitLoss;
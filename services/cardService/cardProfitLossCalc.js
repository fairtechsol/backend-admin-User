const { cardGameType, betType } = require("../../config/contants");

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
            case cardGameType.ab20:
                return this.andarBahar();
            case cardGameType.dt20:
            case cardGameType.dt202:
                return this.dragonTiger();
            case cardGameType.teen20:
            case cardGameType.teen8:
                return this.teen20();
            case cardGameType.lucky7:
            case cardGameType.lucky7eu:
                return this.lucky7();
            case cardGameType.card32:
                return this.card32();
            case cardGameType.dt6:
                return this.dragonTiger1Day();
            case cardGameType.dtl20:
                return this.dragonTigerLion();
            case cardGameType.teen:
                return this.teenOneDay();
            case cardGameType.poker:
                return this.poker1Day();
            case cardGameType.poker6:
            case cardGameType.poker20:
                return this.poker6Player();
            case cardGameType.race20:
                return this.race20();
            case cardGameType.war:
                return this.war();
            case cardGameType["3cardj"]:
                return this.threeCardJ();
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
        const { lossAmount } = this.data;
        return { profitLoss: -Math.abs(parseFloat((parseFloat(lossAmount || 0) - parseFloat(this.oldProfitLoss || 0)).toFixed(2))), exposure: parseFloat(this.oldExposure || 0) + parseFloat(lossAmount || 0) };
    }

    lucky7() {
        const { lossAmount } = this.data;
        return { profitLoss: -Math.abs(parseFloat((parseFloat(lossAmount || 0) - parseFloat(this.oldProfitLoss || 0)).toFixed(2))), exposure: parseFloat(this.oldExposure || 0) + parseFloat(lossAmount || 0) };
    }

    card32() {
        const { bettingType, winAmount, lossAmount, playerName, partnership } = this.data;
        let oldProfitLossData = JSON.parse(this.oldProfitLoss || "{}");
        let newProfitLoss = this.oldProfitLoss;
        if (!newProfitLoss) {
            newProfitLoss = {
                player8: 0,
                player9: 0,
                player10: 0,
                player11: 0
            }
        }
        else {
            newProfitLoss = {...JSON.parse(newProfitLoss)};
        }

        Object.keys(newProfitLoss)?.forEach((item) => {

            if ((item == this.removeSpacesAndToLowerCase(playerName) && bettingType == betType.BACK) || (item != this.removeSpacesAndToLowerCase(playerName) && bettingType == betType.LAY)) {
                newProfitLoss[item] += ((winAmount * partnership) / 100);
            }
            else if ((item != this.removeSpacesAndToLowerCase(playerName) && bettingType == betType.BACK) || (item == this.removeSpacesAndToLowerCase(playerName) && bettingType == betType.LAY)) {
                newProfitLoss[item] -= ((lossAmount * partnership) / 100);
            }

            newProfitLoss[item] = parseFloat((Number(newProfitLoss[item]) || 0.0).toFixed(2));
        });

        return { profitLoss: JSON.stringify(newProfitLoss), exposure: Math.abs(parseFloat(this.oldExposure || 0) - Math.abs(Math.min(...Object.values(oldProfitLossData || {}), 0)) + Math.abs(Math.min(...Object.values(newProfitLoss), 0))) };
    }

    andarBahar() {
        const { lossAmount } = this.data;
        return { profitLoss: -Math.abs(parseFloat((parseFloat(lossAmount || 0) - parseFloat(this.oldProfitLoss || 0)).toFixed(2))), exposure: parseFloat(this.oldExposure || 0) + parseFloat(lossAmount || 0) };
    }

    teen20() {
        const { winAmount, lossAmount } = this.data;
        return { profitLoss: parseFloat((parseFloat(winAmount || 0) + parseFloat(this.oldProfitLoss || 0)).toFixed(2)), exposure: parseFloat(this.oldExposure || 0) + parseFloat(lossAmount || 0) };
    }

    dragonTiger1Day() {
        const { bettingType, winAmount, lossAmount, playerName, partnership, sid } = this.data;

        if (sid == 1) {
            let oldProfitLossData = JSON.parse(this.oldProfitLoss || "{}");
            let newProfitLoss = this.oldProfitLoss;
            if (!newProfitLoss) {
                newProfitLoss = {
                    dragon: 0,
                    tiger: 0
                }
            }
            else {
                newProfitLoss = { ...JSON.parse(newProfitLoss) };
            }

            Object.keys(newProfitLoss)?.forEach((item) => {

                if ((item == this.removeSpacesAndToLowerCase(playerName) && bettingType == betType.BACK) || (item != this.removeSpacesAndToLowerCase(playerName) && bettingType == betType.LAY)) {
                    newProfitLoss[item] += ((winAmount * partnership) / 100);
                }
                else if ((item != this.removeSpacesAndToLowerCase(playerName) && bettingType == betType.BACK) || (item == this.removeSpacesAndToLowerCase(playerName) && bettingType == betType.LAY)) {
                    newProfitLoss[item] -= ((lossAmount * partnership) / 100);
                }

                newProfitLoss[item] = parseFloat((Number(newProfitLoss[item]) || 0.0).toFixed(2));
            });

            return { profitLoss: JSON.stringify(newProfitLoss), exposure: Math.abs(parseFloat(this.oldExposure || 0) - Math.abs(Math.min(...Object.values(oldProfitLossData || {}), 0)) + Math.abs(Math.min(...Object.values(newProfitLoss), 0))) };
        }
        return { profitLoss: -Math.abs(parseFloat((parseFloat(lossAmount || 0) - parseFloat(this.oldProfitLoss || 0)).toFixed(2))), exposure: parseFloat(this.oldExposure || 0) + parseFloat(lossAmount || 0) };

    }

    poker1Day() {
        const { bettingType, winAmount, lossAmount, playerName, partnership, sid } = this.data;

        if (sid == 1) {
            let oldProfitLossData = JSON.parse(this.oldProfitLoss || "{}");
            let newProfitLoss = this.oldProfitLoss;
            if (!newProfitLoss) {
                newProfitLoss = {
                    playera: 0,
                    playerb: 0
                }
            }
            else {
                newProfitLoss = { ...JSON.parse(newProfitLoss) };
            }

            Object.keys(newProfitLoss)?.forEach((item) => {

                if ((item == this.removeSpacesAndToLowerCase(playerName) && bettingType == betType.BACK) || (item != this.removeSpacesAndToLowerCase(playerName) && bettingType == betType.LAY)) {
                    newProfitLoss[item] += ((winAmount * partnership) / 100);
                }
                else if ((item != this.removeSpacesAndToLowerCase(playerName) && bettingType == betType.BACK) || (item == this.removeSpacesAndToLowerCase(playerName) && bettingType == betType.LAY)) {
                    newProfitLoss[item] -= ((lossAmount * partnership) / 100);
                }

                newProfitLoss[item] = parseFloat((Number(newProfitLoss[item]) || 0.0).toFixed(2));
            });

            return { profitLoss: JSON.stringify(newProfitLoss), exposure: Math.abs(parseFloat(this.oldExposure || 0) - Math.abs(Math.min(...Object.values(oldProfitLossData || {}), 0)) + Math.abs(Math.min(...Object.values(newProfitLoss), 0))) };
        }
        return { profitLoss: -Math.abs(parseFloat((parseFloat(lossAmount || 0) - parseFloat(this.oldProfitLoss || 0)).toFixed(2))), exposure: parseFloat(this.oldExposure || 0) + parseFloat(lossAmount || 0) };
    }

    dragonTigerLion() {
        const { lossAmount } = this.data;
        return { profitLoss: -Math.abs(parseFloat((parseFloat(lossAmount || 0) - parseFloat(this.oldProfitLoss || 0)).toFixed(2))), exposure: parseFloat(this.oldExposure || 0) + parseFloat(lossAmount || 0) };
    }

    teenOneDay() {
        const { bettingType, winAmount, lossAmount, playerName, partnership } = this.data;
        let oldProfitLossData = JSON.parse(this.oldProfitLoss || "{}");
        let newProfitLoss = this.oldProfitLoss;
        if (!newProfitLoss) {
            newProfitLoss = {
                playera: 0,
                playerb: 0
            }
        }
        else {
            newProfitLoss = {...JSON.parse(newProfitLoss)};
        }

        Object.keys(newProfitLoss)?.forEach((item) => {

            if ((item == this.removeSpacesAndToLowerCase(playerName) && bettingType == betType.BACK) || (item != this.removeSpacesAndToLowerCase(playerName) && bettingType == betType.LAY)) {
                newProfitLoss[item] += ((winAmount * partnership) / 100);
            }
            else if ((item != this.removeSpacesAndToLowerCase(playerName) && bettingType == betType.BACK) || (item == this.removeSpacesAndToLowerCase(playerName) && bettingType == betType.LAY)) {
                newProfitLoss[item] -= ((lossAmount * partnership) / 100);
            }

            newProfitLoss[item] = parseFloat((Number(newProfitLoss[item]) || 0.0).toFixed(2));
        });

        return { profitLoss: JSON.stringify(newProfitLoss), exposure: Math.abs(parseFloat(this.oldExposure || 0) - Math.abs(Math.min(...Object.values(oldProfitLossData || {}), 0)) + Math.abs(Math.min(...Object.values(newProfitLoss), 0))) };
    }

    poker6Player() {
        const { lossAmount } = this.data;
        return { profitLoss: -Math.abs(parseFloat((parseFloat(lossAmount || 0) - parseFloat(this.oldProfitLoss || 0)).toFixed(2))), exposure: parseFloat(this.oldExposure || 0) + parseFloat(lossAmount || 0) };
    }

    race20() {
        const { bettingType, winAmount, lossAmount, playerName, partnership, sid } = this.data;

        if (sid == 1) {
            let oldProfitLossData = JSON.parse(this.oldProfitLoss || "{}");
            let newProfitLoss = this.oldProfitLoss;
            if (!newProfitLoss) {
                newProfitLoss = {
                    kofspade: 0,
                    kofclub: 0,
                    kofdiamond: 0,
                    kofheart: 0
                }
            }
            else {
                newProfitLoss = { ...JSON.parse(newProfitLoss) };
            }

            Object.keys(newProfitLoss)?.forEach((item) => {

                if ((item == this.removeSpacesAndToLowerCase(playerName) && bettingType == betType.BACK) || (item != this.removeSpacesAndToLowerCase(playerName) && bettingType == betType.LAY)) {
                    newProfitLoss[item] += ((winAmount * partnership) / 100);
                }
                else if ((item != this.removeSpacesAndToLowerCase(playerName) && bettingType == betType.BACK) || (item == this.removeSpacesAndToLowerCase(playerName) && bettingType == betType.LAY)) {
                    newProfitLoss[item] -= ((lossAmount * partnership) / 100);
                }

                newProfitLoss[item] = parseFloat((Number(newProfitLoss[item]) || 0.0).toFixed(2));
            });

            return { profitLoss: JSON.stringify(newProfitLoss), exposure: Math.abs(parseFloat(this.oldExposure || 0) - Math.abs(Math.min(...Object.values(oldProfitLossData || {}), 0)) + Math.abs(Math.min(...Object.values(newProfitLoss), 0))) };
        }
        return { profitLoss: -Math.abs(parseFloat((parseFloat(lossAmount || 0) - parseFloat(this.oldProfitLoss || 0)).toFixed(2))), exposure: parseFloat(this.oldExposure || 0) + parseFloat(lossAmount || 0) };
    }

    war() {
        const { lossAmount } = this.data;
        return { profitLoss: -Math.abs(parseFloat((parseFloat(lossAmount || 0) - parseFloat(this.oldProfitLoss || 0)).toFixed(2))), exposure: parseFloat(this.oldExposure || 0) + parseFloat(lossAmount || 0) };
    }
    threeCardJ() {
        const { lossAmount } = this.data;
        return { profitLoss: -Math.abs(parseFloat((parseFloat(lossAmount || 0) - parseFloat(this.oldProfitLoss || 0)).toFixed(2))), exposure: parseFloat(this.oldExposure || 0) + parseFloat(lossAmount || 0) };
    }
    removeSpacesAndToLowerCase(str) {
        return str.replace(/\s+/g, '')?.toLowerCase();
    }

}

exports.CardProfitLoss = CardProfitLoss;
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
            case cardGameType.teen9:
                return this.teenTest();
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
            case cardGameType.queen:
                return this.queen();
            case cardGameType.war:
                return this.war();
            case cardGameType["3cardj"]:
                return this.threeCardJ();
            case cardGameType.card32eu:
                return this.card32B();
            case cardGameType.superover:
                return this.superOver();
            case cardGameType.cricketv3:
                return this.fivefivecricket();
            case cardGameType.cmatch20:
                return this.cricket20();
            case cardGameType.aaa:
                return this.amarAkbarAnthony();
            case cardGameType.btable:
                return this.bollywoodTable();
            case cardGameType.worli2:
                return this.instantWorli();
            case cardGameType.baccarat:
            case cardGameType.baccarat2:
                return this.baccarat();
            case cardGameType.cmeter:
                return this.cMeter();
            case cardGameType.ballbyball:
                return this.ballbyball();
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
        const { lossAmount, partnership } = this.data;
        return { profitLoss: -Math.abs(parseFloat((parseFloat(((lossAmount * partnership) / 100) || 0) - parseFloat(this.oldProfitLoss || 0)).toFixed(2))), exposure: parseFloat(this.oldExposure || 0) + parseFloat(lossAmount || 0) };
    }

    lucky7() {
        const { lossAmount, partnership } = this.data;
        return { profitLoss: -Math.abs(parseFloat((parseFloat((lossAmount * partnership) / 100 || 0) - parseFloat(this.oldProfitLoss || 0)).toFixed(2))), exposure: parseFloat(this.oldExposure || 0) + parseFloat(lossAmount || 0) };
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

    andarBahar() {
        const { lossAmount, partnership } = this.data;
        return { profitLoss: -Math.abs(parseFloat((parseFloat(((lossAmount * partnership) / 100) || 0) - parseFloat(this.oldProfitLoss || 0)).toFixed(2))), exposure: parseFloat(this.oldExposure || 0) + parseFloat(lossAmount || 0) };
    }

    teen20() {
        const { lossAmount, partnership } = this.data;
        return { profitLoss: -Math.abs(parseFloat((parseFloat(((lossAmount * partnership) / 100) || 0) - parseFloat(this.oldProfitLoss || 0)).toFixed(2))), exposure: parseFloat(this.oldExposure || 0) + parseFloat(lossAmount || 0) };
    }

    teenTest() {
        const { lossAmount, partnership, winAmount } = this.data;
        return { profitLoss: Math.abs(parseFloat((parseFloat(((winAmount * partnership) / 100) || 0) + parseFloat(this.oldProfitLoss || 0)).toFixed(2))), exposure: parseFloat(this.oldExposure || 0) + parseFloat(lossAmount || 0) };
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
        return { profitLoss: -Math.abs(parseFloat((parseFloat(((lossAmount * partnership) / 100) || 0) - parseFloat(this.oldProfitLoss || 0)).toFixed(2))), exposure: parseFloat(this.oldExposure || 0) + parseFloat(lossAmount || 0) };

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
        return { profitLoss: -Math.abs(parseFloat((parseFloat(((lossAmount * partnership) / 100) || 0) - parseFloat(this.oldProfitLoss || 0)).toFixed(2))), exposure: parseFloat(this.oldExposure || 0) + parseFloat(lossAmount || 0) };
    }

    dragonTigerLion() {
        const { lossAmount, partnership } = this.data;
        return { profitLoss: -Math.abs(parseFloat((parseFloat(((lossAmount || 0) * partnership) / 100) - parseFloat(this.oldProfitLoss || 0)).toFixed(2))), exposure: parseFloat(this.oldExposure || 0) + parseFloat(lossAmount || 0) };
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

    poker6Player() {
        const { lossAmount, partnership } = this.data;
        return { profitLoss: -Math.abs(parseFloat((parseFloat(((lossAmount || 0) * partnership) / 100) - parseFloat(this.oldProfitLoss || 0)).toFixed(2))), exposure: parseFloat(this.oldExposure || 0) + parseFloat(lossAmount || 0) };
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
        return { profitLoss: -Math.abs(parseFloat((parseFloat(((lossAmount || 0) * partnership) / 100) - parseFloat(this.oldProfitLoss || 0)).toFixed(2))), exposure: parseFloat(this.oldExposure || 0) + parseFloat(lossAmount || 0) };
    }

    war() {
        const { lossAmount, partnership } = this.data;
        return { profitLoss: -Math.abs(parseFloat((parseFloat(((lossAmount || 0) * partnership) / 100) - parseFloat(this.oldProfitLoss || 0)).toFixed(2))), exposure: parseFloat(this.oldExposure || 0) + parseFloat(lossAmount || 0) };
    }
    threeCardJ() {
        const { lossAmount, partnership } = this.data;
        return { profitLoss: -Math.abs(parseFloat((parseFloat(((lossAmount || 0) * partnership) / 100) - parseFloat(this.oldProfitLoss || 0)).toFixed(2))), exposure: parseFloat(this.oldExposure || 0) + parseFloat(lossAmount || 0) };
    }

    card32B() {
        const { bettingType, winAmount, lossAmount, playerName, partnership, sid } = this.data;

        if (sid == 1) {
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
        else if (parseInt(sid) == 13 || parseInt(sid) == 14 || parseInt(sid) == 27) {
            let oldProfitLossData = JSON.parse(this.oldProfitLoss || "{}");
            let newProfitLoss = this.oldProfitLoss;
            if (!newProfitLoss) {
                newProfitLoss = {
                    p1: 0,
                    p2: 0
                }
            }
            else {
                newProfitLoss = { ...JSON.parse(newProfitLoss) };
            }

            Object.keys(newProfitLoss)?.forEach((item) => {

                if ((bettingType == betType.BACK)) {
                    newProfitLoss.p1 += ((winAmount * partnership) / 100);
                    newProfitLoss.p2 -= ((lossAmount * partnership) / 100);
                }
                else if ((bettingType == betType.LAY)) {
                    newProfitLoss.p1 -= ((lossAmount * partnership) / 100);
                    newProfitLoss.p2 += ((winAmount * partnership) / 100);
                }

                newProfitLoss[item] = parseFloat((Number(newProfitLoss[item]) || 0.0).toFixed(2));
            });

            return { profitLoss: JSON.stringify(newProfitLoss), exposure: Math.abs(parseFloat(this.oldExposure || 0) - Math.abs(Math.min(...Object.values(oldProfitLossData || {}), 0)) + Math.abs(Math.min(...Object.values(newProfitLoss), 0))) };
        }
        return { profitLoss: -Math.abs(parseFloat((parseFloat(((lossAmount || 0) * partnership / 100).toFixed(2)) - parseFloat(this.oldProfitLoss || 0)).toFixed(2))), exposure: parseFloat(this.oldExposure || 0) + parseFloat(lossAmount || 0) };
    }

    superOver() {
        const { bettingType, winAmount, lossAmount, playerName, partnership } = this.data;
        let oldProfitLossData = JSON.parse(this.oldProfitLoss || "{}");
        let newProfitLoss = this.oldProfitLoss;
        if (!newProfitLoss) {
            newProfitLoss = {
                "eng": 0,
                "rsa": 0
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

    fivefivecricket() {
        const { bettingType, winAmount, lossAmount, playerName, partnership } = this.data;
        let oldProfitLossData = JSON.parse(this.oldProfitLoss || "{}");
        let newProfitLoss = this.oldProfitLoss;
        if (!newProfitLoss) {
            newProfitLoss = {
                "aus": 0,
                "ind": 0
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

    cricket20() {
        const { bettingType, winAmount, lossAmount, partnership, playerName } = this.data;
        const sid = playerName?.split(" ")[1];
        let oldProfitLossData = JSON.parse(this.oldProfitLoss || "{}");
        let newProfitLoss = this.oldProfitLoss;
        if (!newProfitLoss) {
            newProfitLoss = Array.from({ length: 10 }, (_, i) => i + 1).reduce((prev, curr) => {
                return {
                    ...prev,
                    [curr]: {
                        pl: 0,
                        run: 0
                    }
                }
            }, {})
        }
        else {
            newProfitLoss = { ...JSON.parse(newProfitLoss) };
        }

        Object.keys(newProfitLoss)?.forEach((item) => {

            if ((parseInt(item) + parseInt(sid) >= 12 && bettingType == betType.BACK) || (parseInt(item) + parseInt(sid) < 12 && bettingType == betType.LAY)) {
                newProfitLoss[item].pl += ((winAmount * partnership) / 100);
            }
            else if ((parseInt(item) + parseInt(sid) < 12 && bettingType == betType.BACK) || (parseInt(item) + parseInt(sid) >= 12 && bettingType == betType.LAY)) {
                newProfitLoss[item].pl -= ((lossAmount * partnership) / 100);
            }

            newProfitLoss[item].pl = parseFloat((Number(newProfitLoss[item].pl) || 0.0).toFixed(2));

            if (parseInt(item) == parseInt(sid)) {
                newProfitLoss[item].run = item;
            }
        });

        return { profitLoss: JSON.stringify(newProfitLoss), exposure: Math.abs(parseFloat(this.oldExposure || 0) - Math.abs(Math.min(...Object.values(oldProfitLossData || {})?.map((item) => item?.pl), 0)) + Math.abs(Math.min(...Object.values(newProfitLoss)?.map((item) => item?.pl), 0))) };
    }

    amarAkbarAnthony() {
        const { bettingType, winAmount, lossAmount, playerName, partnership, sid } = this.data;

        if (sid == 1) {
            let oldProfitLossData = JSON.parse(this.oldProfitLoss || "{}");
            let newProfitLoss = this.oldProfitLoss;
            if (!newProfitLoss) {
                newProfitLoss = {
                    amar: 0,
                    akbar: 0,
                    anthony: 0
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
        return { profitLoss: -Math.abs(parseFloat((parseFloat(((lossAmount || 0) * partnership) / 100) - parseFloat(this.oldProfitLoss || 0)).toFixed(2))), exposure: parseFloat(this.oldExposure || 0) + parseFloat(lossAmount || 0) };
    }

    bollywoodTable() {
        const { bettingType, winAmount, lossAmount, playerName, partnership, sid } = this.data;

        if (sid == 1) {
            let oldProfitLossData = JSON.parse(this.oldProfitLoss || "{}");
            let newProfitLoss = this.oldProfitLoss;
            if (!newProfitLoss) {
                newProfitLoss = {
                    don: 0,
                    amarakbaranthony: 0,
                    sahibbibiaurghulam: 0,
                    dharamveer: 0,
                    kiskiskopyaarkaroon: 0,
                    ghulam: 0,
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
        else if (sid == 7) {
            let oldProfitLossData = JSON.parse(this.oldProfitLoss || "{}");
            let newProfitLoss = this.oldProfitLoss;
            if (!newProfitLoss) {
                newProfitLoss = {
                    odd: 0,
                    even: 0
                }
            }
            else {
                newProfitLoss = { ...JSON.parse(newProfitLoss) };
            }
            if ((bettingType == betType.BACK)) {
                newProfitLoss.odd += ((winAmount * partnership) / 100);
                newProfitLoss.even -= ((lossAmount * partnership) / 100);
            }
            else if (bettingType == betType.LAY) {
                newProfitLoss.odd -= ((lossAmount * partnership) / 100);
                newProfitLoss.even += ((winAmount * partnership) / 100);
            }
            newProfitLoss.odd = parseFloat((Number(newProfitLoss.odd) || 0.0).toFixed(2));
            newProfitLoss.even = parseFloat((Number(newProfitLoss.even) || 0.0).toFixed(2));

            return { profitLoss: JSON.stringify(newProfitLoss), exposure: Math.abs(parseFloat(this.oldExposure || 0) - Math.abs(Math.min(...Object.values(oldProfitLossData || {}), 0)) + Math.abs(Math.min(...Object.values(newProfitLoss), 0))) };
        }
        return { profitLoss: -Math.abs(parseFloat((parseFloat(((lossAmount || 0) * partnership) / 100) - parseFloat(this.oldProfitLoss || 0)).toFixed(2))), exposure: parseFloat(this.oldExposure || 0) + parseFloat(lossAmount || 0) };
    }

    instantWorli() {
        const { lossAmount } = this.data;
        return { profitLoss: 0, exposure: parseFloat(this.oldExposure || 0) + parseFloat(lossAmount || 0) };
    }

    baccarat() {
        const { lossAmount, partnership } = this.data;
        return { profitLoss: -Math.abs(parseFloat((parseFloat((lossAmount * partnership) / 100 || 0) - parseFloat(this.oldProfitLoss || 0)).toFixed(2))), exposure: parseFloat(this.oldExposure || 0) + parseFloat(lossAmount || 0) };
    }

    queen() {
        const { bettingType, winAmount, lossAmount, playerName, partnership } = this.data;

        let oldProfitLossData = JSON.parse(this.oldProfitLoss || "{}");
        let newProfitLoss = this.oldProfitLoss;
        if (!newProfitLoss) {
            newProfitLoss = {
                total0: 0,
                total1: 0,
                total2: 0,
                total3: 0
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
    cMeter() {
        const { lossAmount, partnership } = this.data;
        return { profitLoss: -Math.abs(parseFloat((parseFloat(((lossAmount * partnership) / 2) || 0) - parseFloat(this.oldProfitLoss || 0)).toFixed(2))), exposure: parseFloat(this.oldExposure || 0) + parseFloat(lossAmount * 50 || 0) };
    }

    ballbyball() {
        const { lossAmount, partnership } = this.data;
        return { profitLoss: -Math.abs(parseFloat((parseFloat((lossAmount * partnership) / 100 || 0) - parseFloat(this.oldProfitLoss || 0)).toFixed(2))), exposure: parseFloat(this.oldExposure || 0) + parseFloat(lossAmount || 0) };
    }

    removeSpacesAndToLowerCase(str) {
        return str.replace(/\s+/g, '')?.toLowerCase();
    }

}

exports.CardProfitLoss = CardProfitLoss;
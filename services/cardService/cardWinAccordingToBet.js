const { cardGameType, betResultStatus, cardGameShapeCode, betType, cardGameShapeColor, cardsNo } = require("../../config/contants");

class CardWinOrLose {
    constructor(type, betOnTeam, result, betType, betPlaceData) {
        this.type = type;
        this.betOnTeam = betOnTeam;
        this.result = result;
        this.betType = betType;
        this.betPlaceData = betPlaceData;
    }

    removeSpacesAndToLowerCase(str) {
        return str.replace(/\s+/g, '')?.toLowerCase();
    }

    getCardGameProfitLoss() {
        switch (this.type) {
            case cardGameType.abj:
                return this.andarBahar();
            case cardGameType.dt20:
            case cardGameType.dt202:
                return this.dragonTiger();
            case cardGameType.teen20:
                return this.teen20();
            case cardGameType.lucky7:
            case cardGameType.lucky7eu:
                return this.lucky7();
            case cardGameType.card32:
                return this.card32();
            case cardGameType.dtl20:
                return this.dragonTigerLion();
            case cardGameType.teen:
                return this.teenOneDay();
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
        const { desc } = this.result;
        const betOnTeamData = this.betOnTeam.split(" ");
        const resultData = desc?.split("*");
        const currBetTeam = betOnTeamData?.[0];

        if (betOnTeamData?.length == 1) {
            if (currBetTeam?.toLowerCase() == resultData?.[0]?.split("|")?.[0]?.toLowerCase() || (currBetTeam?.toLowerCase() == "pair" && resultData?.[0]?.split("|")?.[1] == "Is Pair")) {
                return { result: betResultStatus.WIN, winAmount: this.betPlaceData.winAmount, lossAmount: this.betPlaceData.lossAmount };
            }
        }
        else {
            if (currBetTeam?.toLowerCase() == "dragon") {
                const cardBetType = (betOnTeamData.shift(), betOnTeamData.join(''));
                const currTeamResult = resultData?.[1]?.split("|")?.map((item) => this.removeSpacesAndToLowerCase(item));
                if (currTeamResult?.includes(this.removeSpacesAndToLowerCase(cardBetType))) {
                    return { result: betResultStatus.WIN, winAmount: this.betPlaceData.winAmount, lossAmount: this.betPlaceData.lossAmount };
                }
            }
            else if (currBetTeam?.toLowerCase() == "tiger") {
                const cardBetType = (betOnTeamData.shift(), betOnTeamData.join(''));
                const currTeamResult = resultData?.[2]?.split("|")?.map((item) => this.removeSpacesAndToLowerCase(item));
                if (currTeamResult?.includes(this.removeSpacesAndToLowerCase(cardBetType))) {
                    return { result: betResultStatus.WIN, winAmount: this.betPlaceData.winAmount, lossAmount: this.betPlaceData.lossAmount };
                }
            }
        }
        return { result: betResultStatus.LOSS, winAmount: this.betPlaceData.winAmount, lossAmount: this.betPlaceData.lossAmount };
    }

    dragonTiger1Day() {
        const { desc } = this.result;
        const betOnTeamData = this.betOnTeam.split(" ");
        const resultData = desc?.split("*");
        const currBetTeam = betOnTeamData?.[0];

        if (betOnTeamData?.length == 1) {
            if ((currBetTeam?.toLowerCase() == resultData?.[0]?.split("|")?.[0]?.toLowerCase() && this.betType == betType.BACK) || (currBetTeam?.toLowerCase() != resultData?.[0]?.split("|")?.[0]?.toLowerCase() && this.betType == betType.LAY) || (currBetTeam?.toLowerCase() == "pair" && resultData?.[0]?.split("|")?.[1] == "Is Pair")) {
                return { result: betResultStatus.WIN, winAmount: this.betPlaceData.winAmount, lossAmount: this.betPlaceData.lossAmount };
            }
        }
        else {
            if (currBetTeam?.toLowerCase() == "dragon") {
                const cardBetType = (betOnTeamData.shift(), betOnTeamData.join(''));
                const currTeamResult = resultData?.[1]?.split("|")?.map((item) => this.removeSpacesAndToLowerCase(item));
                if (currTeamResult?.includes(this.removeSpacesAndToLowerCase(cardBetType))) {
                    return { result: betResultStatus.WIN, winAmount: this.betPlaceData.winAmount, lossAmount: this.betPlaceData.lossAmount };
                }
            }
            else if (currBetTeam?.toLowerCase() == "tiger") {
                const cardBetType = (betOnTeamData.shift(), betOnTeamData.join(''));
                const currTeamResult = resultData?.[2]?.split("|")?.map((item) => this.removeSpacesAndToLowerCase(item));
                if (currTeamResult?.includes(this.removeSpacesAndToLowerCase(cardBetType))) {
                    return { result: betResultStatus.WIN, winAmount: this.betPlaceData.winAmount, lossAmount: this.betPlaceData.lossAmount };
                }
            }
        }
        return { result: betResultStatus.LOSS, winAmount: this.betPlaceData.winAmount, lossAmount: this.betPlaceData.lossAmount };
    }

    dragonTigerLion() {
        const { desc, cards } = this.result;
        const betOnTeamData = this.betOnTeam;
        const resultData = cards?.split(",");

        const dragonTigerLionIndexes = {
            D: 0,
            T: 1,
            L: 2
        }

        if (this.removeSpacesAndToLowerCase(betOnTeamData)?.includes("winner")) {
            if (betOnTeamData[betOnTeamData?.length - 1]?.toLowerCase() == desc[0]?.toLowerCase()) {
                return { result: betResultStatus.WIN, winAmount: this.betPlaceData.winAmount, lossAmount: this.betPlaceData.lossAmount };
            }
        }
        else if (this.removeSpacesAndToLowerCase(betOnTeamData)?.includes("red") || this.removeSpacesAndToLowerCase(betOnTeamData)?.includes("black")) {
            if (cardGameShapeColor[(resultData[dragonTigerLionIndexes[betOnTeamData?.[betOnTeamData?.length - 1]]]?.slice(-2))] == this.removeSpacesAndToLowerCase(betOnTeamData)?.slice(0, -1)) {
                return { result: betResultStatus.WIN, winAmount: this.betPlaceData.winAmount, lossAmount: this.betPlaceData.lossAmount };
            }
        }
        else if (this.removeSpacesAndToLowerCase(betOnTeamData)?.includes("odd") || this.removeSpacesAndToLowerCase(betOnTeamData)?.includes("even")) {
            if (parseInt(cardsNo[resultData[dragonTigerLionIndexes[betOnTeamData?.[betOnTeamData?.length - 1]]]?.slice(0, -2)] || resultData[dragonTigerLionIndexes[betOnTeamData?.[betOnTeamData?.length - 1]]]?.slice(0, -2)) % 2 == 0 && this.removeSpacesAndToLowerCase(betOnTeamData)?.includes("even")) {
                return { result: betResultStatus.WIN, winAmount: this.betPlaceData.winAmount, lossAmount: this.betPlaceData.lossAmount };
            }
            else if (parseInt(cardsNo[resultData[dragonTigerLionIndexes[betOnTeamData?.[betOnTeamData?.length - 1]]]?.slice(0, -2)] || resultData[dragonTigerLionIndexes[betOnTeamData?.[betOnTeamData?.length - 1]]]?.slice(0, -2)) % 2 != 0 && this.removeSpacesAndToLowerCase(betOnTeamData)?.includes("odd")) {
                return { result: betResultStatus.WIN, winAmount: this.betPlaceData.winAmount, lossAmount: this.betPlaceData.lossAmount };

            }
        }
        else {
            if (resultData[dragonTigerLionIndexes[betOnTeamData?.[0]]]?.slice(0, -2) == betOnTeamData?.split(" ")[1]) {
                return { result: betResultStatus.WIN, winAmount: this.betPlaceData.winAmount, lossAmount: this.betPlaceData.lossAmount };
            }
        }

        return { result: betResultStatus.LOSS, winAmount: this.betPlaceData.winAmount, lossAmount: this.betPlaceData.lossAmount };
    }

    lucky7() {
        const { desc } = this.result;
        const resultData = desc?.split("||")?.map((item) => this.removeSpacesAndToLowerCase(item));

        if (this.removeSpacesAndToLowerCase(resultData?.[0]) == "tie" && (this.removeSpacesAndToLowerCase(this.betOnTeam) == "highcard" || this.removeSpacesAndToLowerCase(this.betOnTeam) == "lowcard")) {
            return { result: betResultStatus.LOSS, winAmount: this.betPlaceData.winAmount, lossAmount: parseFloat((parseFloat(this.betPlaceData.lossAmount) / 2).toFixed(2)) };
        }
        else if (resultData?.includes(this.removeSpacesAndToLowerCase(this.betOnTeam))) {
            return { result: betResultStatus.WIN, winAmount: this.betPlaceData.winAmount, lossAmount: this.betPlaceData.lossAmount };
        }
        return { result: betResultStatus.LOSS, winAmount: this.betPlaceData.winAmount, lossAmount: this.betPlaceData.lossAmount };
    }

    card32() {
        const { win } = this.result;
        const playerWinCond = {
            player8: "1",
            player9: "2",
            player10: "3",
            player11: "4",
        }
        return ((this.betType === betType.BACK && playerWinCond[this.removeSpacesAndToLowerCase(this.betOnTeam)] == win) || (this.betType === betType.LAY && playerWinCond[this.removeSpacesAndToLowerCase(this.betOnTeam)] != win)) ? { result: betResultStatus.WIN, winAmount: this.betPlaceData.winAmount, lossAmount: this.betPlaceData.lossAmount } : { result: betResultStatus.LOSS, winAmount: this.betPlaceData.winAmount, lossAmount: this.betPlaceData.lossAmount };
    }

    andarBahar() {

        const { win, cards } = this.result;
        const currentCards = cards?.split(",")?.filter((item) => item != "1");

        const betOnTeamNormalized = this.removeSpacesAndToLowerCase(this.betOnTeam);
        const firstCard = this.removeSpacesAndToLowerCase(currentCards[0]);

        // Conditions for winning
        const conditions = [
            currentCards?.length <= 3 && (
                (betOnTeamNormalized == "sb" && win == "2") ||
                (betOnTeamNormalized == "sa" && win == "1")
            ),
            (betOnTeamNormalized == "2ndbeta" || betOnTeamNormalized == "1stbeta") && win == "1",
            (betOnTeamNormalized == "2ndbetb" || betOnTeamNormalized == "1stbetb") && win == "2",
            betOnTeamNormalized.slice(5) == cardGameShapeCode[firstCard?.slice(-2)],
            betOnTeamNormalized.slice(5) == firstCard?.slice(0, -2),
            betOnTeamNormalized.slice(5) == "odd" && parseInt(cardsNo[firstCard?.slice(0, -2)] || firstCard?.slice(0, -2)) % 2 == 1,
            betOnTeamNormalized.slice(5) == "even" && parseInt(cardsNo[firstCard?.slice(0, -2)] || firstCard?.slice(0, -2)) % 2 == 0
        ];

        // Check if any condition is met
        const isWin = conditions.some(condition => condition);

        // Return result
        if (isWin) {
            return { result: betResultStatus.WIN, winAmount: this.betPlaceData.winAmount, lossAmount: this.betPlaceData.lossAmount };
        }


        return { result: betResultStatus.LOSS, winAmount: this.betPlaceData.winAmount, lossAmount: this.betPlaceData.lossAmount };
    }

    teen20() {
        const { win, sid } = this.result;
        const teenPattiWinRatio = {
            "2": 1,
            "3": 4,
            "4": 6,
            "5": 35,
            "6": 45
        }

        if ((this.removeSpacesAndToLowerCase(this.betOnTeam) == "playera" && win == "1") || (this.removeSpacesAndToLowerCase(this.betOnTeam) == "playerb" && win == "2")) {
            return { result: betResultStatus.WIN, winAmount: this.betPlaceData.winAmount, lossAmount: this.betPlaceData.lossAmount };
        }
        else if ((this.removeSpacesAndToLowerCase(this.betOnTeam) == "pairplusa" && sid?.split(",")?.some(item => ["12", "13", "14", "15", "16"].includes(item))) || (this.removeSpacesAndToLowerCase(this.betOnTeam) == "pairplusb" && sid?.split(",")?.some(item => ["22", "23", "24", "25", "26"].includes(item)))) {
            let winAmount = this.betPlaceData.winAmount;
            if (this.removeSpacesAndToLowerCase(this.betOnTeam) == "pairplusa") {
                let winningItem = teenPattiWinRatio[sid?.split(",")?.find(item => ["12", "13", "14", "15", "16"].includes(item))?.split("")?.[1]];
                if (winningItem) {
                    winAmount = parseFloat((parseFloat(winAmount) * winningItem).toFixed(2));
                }
            }
            else if (this.removeSpacesAndToLowerCase(this.betOnTeam) == "pairplusb") {
                let winningItem = teenPattiWinRatio[sid?.split(",")?.find(item => ["22", "23", "24", "25", "26"].includes(item))?.split("")?.[1]];
                if (winningItem) {
                    winAmount = parseFloat((parseFloat(winAmount) * winningItem).toFixed(2));
                }
            }
            return { result: betResultStatus.WIN, winAmount: winAmount, lossAmount: this.betPlaceData.lossAmount };
        }
        else if (win == "0") {
            return { result: betResultStatus.TIE, winAmount: this.betPlaceData.winAmount, lossAmount: this.betPlaceData.lossAmount };
        }
        return { result: betResultStatus.LOSS, winAmount: this.betPlaceData.winAmount, lossAmount: this.betPlaceData.lossAmount };
    }

    teenOneDay() {
        const { win } = this.result;
        const playerWinCond = {
            playera: "1",
            playerb: "2"
        }
        return ((this.betType === betType.BACK && playerWinCond[this.removeSpacesAndToLowerCase(this.betOnTeam)] == win) || (this.betType === betType.LAY && playerWinCond[this.removeSpacesAndToLowerCase(this.betOnTeam)] != win)) ? { result: betResultStatus.WIN, winAmount: this.betPlaceData.winAmount, lossAmount: this.betPlaceData.lossAmount } : { result: betResultStatus.LOSS, winAmount: this.betPlaceData.winAmount, lossAmount: this.betPlaceData.lossAmount };
    }

}

exports.CardWinOrLose = CardWinOrLose;
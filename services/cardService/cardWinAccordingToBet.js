const { cardGameType, betResultStatus, cardGameShapeCode, betType, cardGameShapeColor, cardsNo, teenPattiWinRatio } = require("../../config/contants");

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
                return this.andarBahar2();
            case cardGameType.dt20:
            case cardGameType.dt202:
                return this.dragonTiger();
            case cardGameType.dt6:
                return this.dragonTiger1Day();
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
            case cardGameType.teen8:
                return this.teenOpen();
            case cardGameType.poker20:
            case cardGameType.poker6:
                return this.poker2020();
            case cardGameType.poker:
                return this.poker();
            case cardGameType.ab20:
                return this.andarBahar();
            case cardGameType.war:
                return this.casinoWar();
            case cardGameType.race20:
                return this.race20();
            case cardGameType.superover:
            case cardGameType.cricketv3:
                return this.superOver();
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
        const currBetTeam = this.removeSpacesAndToLowerCase(betOnTeamData?.[0]);

        const gameResult = this.removeSpacesAndToLowerCase(resultData?.[0]?.split("|")?.[0]);
        const isPairResult = resultData?.[0]?.split("|")?.[1] == "Is Pair";
        const betTypeIsBack = this.betType == betType.BACK;
        const betTypeIsLay = this.betType == betType.LAY;

        if (betOnTeamData?.length == 1) {
            if ((currBetTeam == gameResult && betTypeIsBack) || (currBetTeam != gameResult && betTypeIsLay) || (currBetTeam == "pair" && isPairResult)) {
                return { result: betResultStatus.WIN, winAmount: this.betPlaceData.winAmount, lossAmount: this.betPlaceData.lossAmount };
            }
        }
        else {
            const cardBetType = (this.removeSpacesAndToLowerCase(betOnTeamData.slice(1).join('')));
            const teamResultData = currBetTeam == "dragon" ? resultData?.[1] : resultData?.[2];
            const teamResult = teamResultData?.split("|")?.map(item => this.removeSpacesAndToLowerCase(item));

            if (teamResult?.includes(cardBetType)) {
                return { result: betResultStatus.WIN, winAmount: this.betPlaceData.winAmount, lossAmount: this.betPlaceData.lossAmount };
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

        const lastChar = betOnTeamData?.[betOnTeamData?.length - 1];
        const cardIndex = dragonTigerLionIndexes[lastChar];
        const card = resultData[cardIndex];
        const cardValue = card?.slice(0, -2);
        const cardColor = cardGameShapeColor[card?.slice(-2)];

        if (this.removeSpacesAndToLowerCase(betOnTeamData)?.includes("winner")) {
            if (lastChar?.toLowerCase() == desc[0]?.toLowerCase()) {
                return { result: betResultStatus.WIN, winAmount: this.betPlaceData.winAmount, lossAmount: this.betPlaceData.lossAmount };
            }
        }
        else if (this.removeSpacesAndToLowerCase(betOnTeamData)?.includes("red") || this.removeSpacesAndToLowerCase(betOnTeamData)?.includes("black")) {
            if (cardColor == this.removeSpacesAndToLowerCase(betOnTeamData)?.slice(0, -1)) {
                return { result: betResultStatus.WIN, winAmount: this.betPlaceData.winAmount, lossAmount: this.betPlaceData.lossAmount };
            }
        }
        else if (this.removeSpacesAndToLowerCase(betOnTeamData)?.includes("odd") || this.removeSpacesAndToLowerCase(betOnTeamData)?.includes("even")) {
            const cardNumber = parseInt(cardsNo[cardValue] || cardValue);
            const isEven = cardNumber % 2 == 0;
            if ((isEven && betOnTeamData?.includes("even")) || (!isEven && betOnTeamData?.includes("odd"))) {
                return { result: betResultStatus.WIN, winAmount: this.betPlaceData.winAmount, lossAmount: this.betPlaceData.lossAmount };
            }
        }
        else {
            if (cardValue == betOnTeamData?.split(" ")[1]) {
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
        if ((this.betType == betType.BACK && playerWinCond[this.removeSpacesAndToLowerCase(this.betOnTeam)] == win) || (this.betType == betType.LAY && playerWinCond[this.removeSpacesAndToLowerCase(this.betOnTeam)] != win)) {
            return { result: betResultStatus.WIN, winAmount: this.betPlaceData.winAmount, lossAmount: this.betPlaceData.lossAmount };
        }
        return { result: betResultStatus.LOSS, winAmount: this.betPlaceData.winAmount, lossAmount: this.betPlaceData.lossAmount };
    }

    andarBahar2() {

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

        const betOnTeamKey = this.removeSpacesAndToLowerCase(this.betOnTeam);
        const betOnTeamWinCondition = playerWinCond[betOnTeamKey];
        const isBackBet = this.betType == betType.BACK;
        const isLayBet = this.betType == betType.LAY;
        const isWinningCondition = betOnTeamWinCondition == win;

        return ((isBackBet && isWinningCondition) || (isLayBet && !isWinningCondition)) ? { result: betResultStatus.WIN, winAmount: this.betPlaceData.winAmount, lossAmount: this.betPlaceData.lossAmount } : { result: betResultStatus.LOSS, winAmount: this.betPlaceData.winAmount, lossAmount: this.betPlaceData.lossAmount };
    }

    teenOpen() {
        const { sid, cards } = this.result;
        const winningTeams = sid?.split("|")?.[0]?.split(",");
        const betOnTeamKey = this.removeSpacesAndToLowerCase(this.betOnTeam);
        if (betOnTeamKey?.includes("player") && winningTeams?.includes(betOnTeamKey?.[betOnTeamKey?.length - 1])) {
            return { result: betResultStatus.WIN, winAmount: this.betPlaceData.winAmount, lossAmount: this.betPlaceData.lossAmount };
        }
        else if (betOnTeamKey?.includes("pairplus")) {
            const currCards = cards?.split(",")?.filter((_, index) => index % 9 == parseInt(betOnTeamKey?.[betOnTeamKey?.length - 1]) - 1);
            const currCardData = currCards?.map((item) => ({
                numb: item?.slice(0, -2) == "A" ? 14 : cardsNo[item?.slice(0, -2)] || item?.slice(0, -2),
                shape: item?.slice(-2)
            }));

            if (currCardData?.sort((a, b) => b.numb - a.numb)?.every((item, index, arr) => item?.shape == currCardData?.[0]?.shape && parseInt(item?.numb) == parseInt(arr[index - 1]?.numb) + 1)) {
                return { result: betResultStatus.WIN, winAmount: parseFloat((parseFloat(this.betPlaceData.winAmount) * 40).toFixed(2)), lossAmount: this.betPlaceData.lossAmount };
            }
            else if (currCardData?.every((item, index, arr) => parseInt(item?.numb) == parseInt(arr[index - 1]))) {
                return { result: betResultStatus.WIN, winAmount: parseFloat((parseFloat(this.betPlaceData.winAmount) * 30).toFixed(2)), lossAmount: this.betPlaceData.lossAmount };
            }
            else if (currCardData?.sort((a, b) => b.numb - a.numb)?.every((item, index, arr) => parseInt(item?.numb) == parseInt(arr[index - 1]?.numb) + 1)) {
                return { result: betResultStatus.WIN, winAmount: parseFloat((parseFloat(this.betPlaceData.winAmount) * 6).toFixed(2)), lossAmount: this.betPlaceData.lossAmount };
            }
            else if (currCardData?.every((item) => item?.shape == currCardData?.[0]?.shape)) {
                return { result: betResultStatus.WIN, winAmount: parseFloat((parseFloat(this.betPlaceData.winAmount) * 4).toFixed(2)), lossAmount: this.betPlaceData.lossAmount };
            }
            else if (new Set(currCardData?.map((item) => item?.numb)).size() != 3) {
                return { result: betResultStatus.WIN, winAmount: parseFloat((parseFloat(this.betPlaceData.winAmount) * 1).toFixed(2)), lossAmount: this.betPlaceData.lossAmount };
            }
        }
        return { result: betResultStatus.LOSS, winAmount: this.betPlaceData.winAmount, lossAmount: this.betPlaceData.lossAmount };

    }
    poker2020() {
        const { sid } = this.result;
        const selectionId = this.betPlaceData?.browserDetail?.split("|")[betPlaceData?.browserDetail?.split("|")?.length - 1];

        if (sid?.split(",")?.includes(selectionId)) {
            return { result: betResultStatus.WIN, winAmount: this.betPlaceData.winAmount, lossAmount: this.betPlaceData.lossAmount };
        }
        return { result: betResultStatus.LOSS, winAmount: this.betPlaceData.winAmount, lossAmount: this.betPlaceData.lossAmount };
    }

    poker() {
        const { sid, cards, win } = this.result;
        const betOnTeamKey = this.removeSpacesAndToLowerCase(this.betOnTeam);
        const cardsArray = cards?.split(",");
        const winSid = sid?.split(",");

        const currCardData = cardsArray?.filter((_, index) => index < 2)?.map((item) => ({
            numb: item?.slice(0, -2) == "A" ? 14 : parseInt(cardsNo[item?.slice(0, -2)] || item?.slice(0, -2)),
            shape: item?.slice(-2)
        }));
        const calculateWinAmount = (multiplier) => ({
            result: betResultStatus.WIN,
            winAmount: parseFloat((parseFloat(this.betPlaceData.winAmount) * multiplier).toFixed(2)),
            lossAmount: this.betPlaceData.lossAmount
        });
        const bonus2CardCondition = (initialIndex) => {
            return [
                { check: currCardData?.[initialIndex]?.numb == 14 && currCardData?.[initialIndex + 1]?.numb == 14, multiplier: 30 },
                { check: currCardData?.[initialIndex]?.numb == 14 && currCardData?.[initialIndex + 1]?.numb == 13 && currCardData?.[initialIndex]?.shape == currCardData?.[initialIndex + 1]?.shape, multiplier: 25 },
                { check: ((currCardData?.[initialIndex]?.numb == 14 && currCardData?.[initialIndex + 1]?.numb == 12) || (currCardData?.[initialIndex]?.numb == 14 && currCardData?.[initialIndex + 1]?.numb == 11)) && currCardData?.[initialIndex]?.shape == currCardData?.[initialIndex + 1]?.shape, multiplier: 20 },
                { check: currCardData?.[initialIndex]?.numb == 14 && currCardData?.[initialIndex + 1]?.numb == 13, multiplier: 15 },
                { check: currCardData?.[initialIndex]?.numb == currCardData?.[initialIndex + 1]?.numb && [11, 12, 13].includes(currCardData?.[initialIndex + 1]?.numb), multiplier: 10 },
                { check: currCardData?.[initialIndex]?.numb == 14 && [11, 12].includes(currCardData?.[initialIndex + 1]?.numb), multiplier: 5 },
                { check: currCardData?.[initialIndex]?.numb == currCardData?.[initialIndex + 1]?.numb && currCardData?.[initialIndex + 1]?.numb <= 10, multiplier: 3 }
            ]
        }
        const bonus7CardCondition = (playerType) => {
            return [
                { check: winSid?.includes(`${playerType}4`), multiplier: 3 },
                { check: winSid?.includes(`${playerType}5`), multiplier: 4 },
                { check: winSid?.includes(`${playerType}6`), multiplier: 6 },
                { check: winSid?.includes(`${playerType}7`), multiplier: 8 },
                { check: winSid?.includes(`${playerType}8`), multiplier: 30 },
                { check: winSid?.includes(`${playerType}9`), multiplier: 50 },
                { check: winSid?.includes(`${playerType + 1}0`), multiplier: 100 },
            ]
        }

        if (((betOnTeamKey == "playera" && this.betType == betType.BACK) || (betOnTeamKey == "playerb" && this.betType == betType.LAY)) && win == "11") {
            return { result: betResultStatus.WIN, winAmount: this.betPlaceData.winAmount, lossAmount: this.betPlaceData.lossAmount };
        }
        else if (((betOnTeamKey == "playerb" && this.betType == betType.BACK) || (betOnTeamKey == "playera" && this.betType == betType.LAY)) && win == "21") {
            return { result: betResultStatus.WIN, winAmount: this.betPlaceData.winAmount, lossAmount: this.betPlaceData.lossAmount };
        }
        else if (betOnTeamKey == "playera2cardbonus") {
            const conditions = bonus2CardCondition(0);
            const result = conditions.find(({ check }) => check);
            return result ? calculateWinAmount(result.multiplier) : null;
        }
        else if (betOnTeamKey == "playerb2cardbonus") {
            const conditions = bonus2CardCondition(2);
            const result = conditions.find(({ check }) => check);
            return result ? calculateWinAmount(result.multiplier) : null;
        }
        else if (betOnTeamKey == "playera7cardbonus") {
            const conditions = bonus7CardCondition(1);
            const result = conditions.find(({ check }) => check);
            return result ? calculateWinAmount(result.multiplier) : null;
        }
        else if (betOnTeamKey == "playerb7cardbonus") {
            const conditions = bonus2CardCondition(2);
            const result = conditions.find(({ check }) => check);
            return result ? calculateWinAmount(result.multiplier) : null;
        }
        return { result: betResultStatus.LOSS, winAmount: this.betPlaceData.winAmount, lossAmount: this.betPlaceData.lossAmount };
    }
    andarBahar() {
        const { cards } = this.result;
        const [andar, bahar] = cards?.split("*")?.map((card) => card.split(","));
        const betOnTeamKey = this.removeSpacesAndToLowerCase(this.betOnTeam);

        const andarSet = new Set();
        const baharSet = new Set();
        let i, j;
        while (i < andar?.length || j < bahar?.length) {
            if (j < bahar?.length) {
                const baharCurrNumber = bahar[j]?.slice(0, -2);
                if (!andarSet.has(baharCurrNumber)) {
                    baharSet.add(baharCurrNumber);
                }
                j++;
            }
            if (i < andar?.length) {
                const andarCurrNumber = andar[i]?.slice(0, -2);
                if (!baharSet.has(andarCurrNumber)) {
                    andarSet.add(andarCurrNumber);
                }
                i++;
            }
        }

        if (betOnTeamKey?.contains("andar") && andarSet.has(this.betOnTeam?.split(` `)?.[1])) {
            return { result: betResultStatus.WIN, winAmount: this.betPlaceData.winAmount, lossAmount: this.betPlaceData.lossAmount };
        }
        else if (betOnTeamKey?.contains("bahar") && andarSet.has(this.betOnTeam?.split(` `)?.[1])) {
            if (j == 1) {
                return { result: betResultStatus.WIN, winAmount: parseFloat(((parseFloat(this.betPlaceData.winAmount) * 25) / 100).toFixed(2)), lossAmount: this.betPlaceData.lossAmount };
            }
            return { result: betResultStatus.WIN, winAmount: this.betPlaceData.winAmount, lossAmount: this.betPlaceData.lossAmount };
        }

        return { result: betResultStatus.LOSS, winAmount: this.betPlaceData.winAmount, lossAmount: this.betPlaceData.lossAmount };
    }
    casinoWar() {
        const { sid, cards } = this.result;
        const betOnTeamKey = this.removeSpacesAndToLowerCase(this.betOnTeam);
        const cardsData = cards?.split(",");

        if (betOnTeamKey?.includes("winner") && sid?.includes(betOnTeamKey?.[betOnTeamKey?.length - 1])) {
            return { result: betResultStatus.WIN, winAmount: this.betPlaceData.winAmount, lossAmount: this.betPlaceData.lossAmount };
        }
        else if ((betOnTeamKey?.includes("black") && cardGameShapeColor[cardsData[parseInt(betOnTeamKey?.[betOnTeamKey?.length - 1]) - 1]?.slice(-2)] == "black") || (betOnTeamKey?.includes("red") && cardGameShapeColor[cardsData[parseInt(betOnTeamKey?.[betOnTeamKey?.length - 1]) - 1]?.slice(-2)] == "red")) {
            return { result: betResultStatus.WIN, winAmount: this.betPlaceData.winAmount, lossAmount: this.betPlaceData.lossAmount };
        }
        else if ((betOnTeamKey?.includes("odd") && parseInt(cardsData[parseInt(betOnTeamKey?.[betOnTeamKey?.length - 1]) - 1]?.slice(0, -2)) % 2 == 1) || (betOnTeamKey?.includes("even") && parseInt(cardsData[parseInt(betOnTeamKey?.[betOnTeamKey?.length - 1]) - 1]?.slice(0, -2)) % 2 == 0)) {
            return { result: betResultStatus.WIN, winAmount: this.betPlaceData.winAmount, lossAmount: this.betPlaceData.lossAmount };
        }
        else if ((cardGameShapeCode[cardsData[parseInt(betOnTeamKey?.[betOnTeamKey?.length - 1]) - 1]?.slice(-2)] == betOnTeamKey?.slice(0, -1))) {
            return { result: betResultStatus.WIN, winAmount: this.betPlaceData.winAmount, lossAmount: this.betPlaceData.lossAmount };
        }
        return { result: betResultStatus.LOSS, winAmount: this.betPlaceData.winAmount, lossAmount: this.betPlaceData.lossAmount };
    }
    race20() {
        const { win, desc } = this.result;
        const betOnTeamKey = this.removeSpacesAndToLowerCase(this.betOnTeam);
        const seperatedCardsData = desc.split("|");
        const point = parseInt((seperatedCardsData?.[1]?.match(/\d+/g) || []).map(Number));
        const cardsNo = parseInt((seperatedCardsData?.[2]?.match(/\d+/g) || []).map(Number));

        const winningData = {
            1: "spade",
            2: "heart",
            3: "club",
            4: "diamond"
        }
        const betOnTeamShape = this.betOnTeam?.split(" ");

        if (betOnTeamKey?.includes("kof") && ((winningData[win] == betOnTeamShape?.[betOnTeamShape?.length - 1] && this.betType == betType.BACK) || (winningData[win] != betOnTeamShape?.[betOnTeamShape?.length - 1] && this.betType == betType.LAY))) {
            return { result: betResultStatus.WIN, winAmount: this.betPlaceData.winAmount, lossAmount: this.betPlaceData.lossAmount };
        }
        else if (betOnTeamKey == "totalpoint" && (this.betType == betType.BACK && point >= this.betPlaceData?.rate) || (this.betType == betType.LAY && point <= this.betPlaceData?.rate)) {
            return { result: betResultStatus.WIN, winAmount: this.betPlaceData.winAmount, lossAmount: this.betPlaceData.lossAmount };
        }
        else if (betOnTeamKey == "totalcard" && (this.betType == betType.BACK && cardsNo >= this.betPlaceData?.rate) || (this.betType == betType.LAY && cardsNo <= this.betPlaceData?.rate)) {
            return { result: betResultStatus.WIN, winAmount: this.betPlaceData.winAmount, lossAmount: this.betPlaceData.lossAmount };
        }
        if (betOnTeamKey?.includes("winwith") && parseInt((this.betOnTeam?.match(/\d+/g) || []).map(Number)) == parseInt(cardsNo)) {
            return { result: betResultStatus.WIN, winAmount: this.betPlaceData.winAmount, lossAmount: this.betPlaceData.lossAmount };
        }
        return { result: betResultStatus.LOSS, winAmount: this.betPlaceData.winAmount, lossAmount: this.betPlaceData.lossAmount };
    }

    superOver() {
        const { win } = this.result;

        if (parseInt(win) == 0) {
            return { result: betResultStatus.TIE, winAmount: this.betPlaceData.winAmount, lossAmount: this.betPlaceData.lossAmount };
        }

        const sid = this.betPlaceData?.browserDetail?.split("|")?.[1];

        const isBackBet = this.betType == betType.BACK;
        const isLayBet = this.betType == betType.LAY;
        const isWinningCondition = parseInt(sid) == parseInt(win);

        return ((isBackBet && isWinningCondition) || (isLayBet && !isWinningCondition)) ? { result: betResultStatus.WIN, winAmount: this.betPlaceData.winAmount, lossAmount: this.betPlaceData.lossAmount } : { result: betResultStatus.LOSS, winAmount: this.betPlaceData.winAmount, lossAmount: this.betPlaceData.lossAmount };
    }
}

exports.CardWinOrLose = CardWinOrLose;
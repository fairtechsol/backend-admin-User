const { cardGameType } = require("../../config/contants");

class CardResultTypeWin {
    constructor(type, cardResult) {
        this.type = type;
        this.cardResult = cardResult;
    }

    getCardGameProfitLoss() {
        switch (this.type) {
            case cardGameType.abj:
                return this.andarBahar();
            case cardGameType.dt20:
            case cardGameType.dt202:
            case cardGameType.dt6:
                return this.dragonTiger();
            case cardGameType.teen20:
            case cardGameType.teen:
                return this.teen20();
            case cardGameType.lucky7:
            case cardGameType.lucky7eu:
                return this.lucky7();
            case cardGameType.card32:
                return this.card32();
            case cardGameType.dtl20:
                return this.dragonTigerLion();
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
        switch (this.cardResult.win) {
            case '1':
                return 'Dragon';
            case '2':
                return 'Tiger';
            case '3':
                return 'Tie';
            default:
                return null;
        }
    }

    dragonTigerLion() {
        switch (this.cardResult.win) {
            case '1':
                return 'Dragon';
            case '21':
                return 'Tiger';
            case '41':
                return 'Lion';
            default:
                return null;
        }
    }

    lucky7() {
        return this.cardResult.desc;
    }

    card32() {
        switch (this.cardResult.win) {
            case '1':
                return 'Player 8';
            case '2':
                return 'Player 9';
            case '3':
                return 'Player 10';
            case '4':
                return 'Player 11';
            default:
                return null;
        }
    }

    andarBahar() {
        switch (this.cardResult.win) {
            case '1':
                return 'Andar';
            case '2':
                return 'Bahar';
            default:
                return null;
        }
    }

    teen20() {
        switch (this.cardResult.win) {
            case '1':
                return 'Player A';
            case '2':
                return 'Player B';
            case '3':
                return 'Tie';
            default:
                return null;
        }
    }
}

exports.CardResultTypeWin = CardResultTypeWin;

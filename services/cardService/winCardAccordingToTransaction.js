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
            case '2':
                return 'Andar';
            case '1':
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

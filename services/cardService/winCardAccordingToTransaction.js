const { cardGameType } = require("../../config/contants");

class CardResultTypeWin {
    constructor(type, cardResult) {
        this.type = type;
        this.cardResult = cardResult;
    }

    getCardGameProfitLoss() {
        switch (this.type) {
            case cardGameType.abj:
                return this.andarBahar2();
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
            case cardGameType.teen8:
                return this.teenOpen();
            case cardGameType.poker20:
            case cardGameType.poker:
                return this.poker2020();
            case cardGameType.poker6:
                return this.poker6Player();
            case cardGameType.ab20:
                return this.andarBahar();
            case cardGameType.war:
                return this.casinoWar();
            case cardGameType.race20:
                return this.race20();
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

    andarBahar2() {
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
            case '3':
                return 'Player B';
            case '0':
                return 'Tie';
            default:
                return null;
        }
    }

    teenOpen() {
        const sid = this.cardResult.result.sid;
        const firstElement = sid.split('|')[0];
        return `Player ${firstElement}`;
    }

    poker2020() {
        switch (this.cardResult.result.win) {
            case '11':
                return 'Player A';
            case '21':
                return 'Player B';
            case '0':
                return 'Player Abandoned';
            default:
                return 'Unknown';
        }
    }

    poker6Player() {
        switch (this.cardResult.result.win) {
            case '11':
                return 'Player 1';
            case '12':
                return 'Player 2';
            case '13':
                return 'Player 3';
            case '14':
                return 'Player 4';
            case '15':
                return 'Player 5';
            case '16':
                return 'Player 6';
            case '17':
                return 'Player 7';
            case '0':
                return 'Player Abandoned';
            default:
                return 'Unknown';
        }
    }

    andarBahar() {
        return 'Player ab20';
    }

    casinoWar() {
        return 'Player abandoned';
    }
    race20() {
        switch (this.cardResult.result.win) {
            case '1':
                return 'K Spade';
            case '2':
                return 'K Heart';
            case '3':
                return 'K Club';
            case '4':
                return 'K Diamond';
            default:
                return 'Unknown';
        }
    }
}

exports.CardResultTypeWin = CardResultTypeWin;

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
                return this.teen20();
            case cardGameType.teen:
                return this.teenOneDay();
            case cardGameType.teen9:
                return this.teenTest();
            case cardGameType.lucky7:
            case cardGameType.lucky7eu:
                return this.lucky7();
            case cardGameType.card32:
            case cardGameType.card32eu:
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
            case cardGameType.superover:
                return this.superOver();
            case cardGameType.cricketv3:
                return this.cricket55();
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

    teenOneDay() {
        switch (this.cardResult.win) {
            case '1':
                return 'Player A';
            case '2':
                return 'Player B';
            case '0':
                return 'Tie';
            default:
                return null;
        }
    }
    teenOpen() {
        const sid = this?.cardResult?.sid;
        const firstElement = sid.split('|')[0];
        return firstElement == "0" ? "No Win" : `Player ${firstElement}`;
    }

    poker2020() {
        switch (this.cardResult.win) {
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
        switch (this.cardResult.win) {
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
        return `Player ${this.cardResult.sid}`;
    }
    race20() {
        switch (this.cardResult.win) {
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
    superOver() {
        switch (this.cardResult.win) {
            case '1':
                return 'Player E';
            case '2':
                return 'Player R';
            case '0':
                return 'Player Abandoned';
            default:
                return 'Unknown';
        }
    }
    cricket55() {
        switch (this.cardResult.win) {
            case '1':
                return 'Player A';
            case '2':
                return 'Player I';
            case '0':
                return 'Player Abandoned';
            default:
                return 'Unknown';
        }
    }

    teenTest() {
        switch (this.cardResult.win) {
            case '11':
                return 'Dragon';
            case '21':
                return 'Tiger';
            case '31':
                return 'Lion';
            default:
                return 'Unknown';
        }
    }

    amarAkbarAnthony() {
        switch (this.cardResult.win) {
            case '1':
                return 'Amar';
            case '2':
                return 'Akbar';
            case '3':
                return 'Anthony';
            default:
                return 'Unknown';
        }
    }
    bollywoodTable() {
        switch (this.cardResult.win) {
            case '1':
                return 'Don';
            case '2':
                return 'Amar Akbar Anthony ';
            case '3':
                return 'Sahib Bibi Aur Ghulam';
            case '4':
                return 'Dharam Veer';
            case '5':
                return 'Kis Kis Ko Pyaar Karoon';
            case '6':
                return 'Ghulam';
            default:
                return 'Unknown';
        }
    }

    cricket20() {
        return this.cardResult.win;
    }

    instantWorli() {
        return `Player ${this.cardResult.win} Single`;
    }

    baccarat() {
        switch (this.cardResult.win) {
            case '1':
                return 'Player';
            case '2':
                return 'Banker';
            case '3':
                return 'Tie';
            default:
                return 'Unknown';
        }
    }
}

exports.CardResultTypeWin = CardResultTypeWin;

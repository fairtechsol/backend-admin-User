const { Server } = require("./grpcServer");
const { getPlacedBets, verifyBet, getResultBetProfitLoss, getSessionBetProfitLossExpert } = require("./handlers/betsHandler");
const { declareTournamentMatchResult, unDeclareTournamentMatchResult, unDeclareFinalMatchResult, declareFinalMatchResult } = require("./handlers/declareMatchHandler");
const { declareSessionResult, declareSessionNoResult, unDeclareSessionResult } = require("./handlers/declareSessionHandler");
const { addMatch, raceAdd } = require("./handlers/matchHandler");

const { GRPC_PORT = 50000 } = process.env;

const protoOptionsArray = [
    {
        path: `${__dirname}/proto/declareSession.proto`, //path to proto file
        package: "declareSessionProvider",//package in proto name
        service: "DeclareSessionProvider",//service name in proto file
    },
    {
        path: `${__dirname}/proto/declareMatch.proto`, //path to proto file
        package: "declareMatchProvider",//package in proto name
        service: "DeclareMatchProvider",//service name in proto file
    },
    {
        path: `${__dirname}/proto/bets.proto`, //path to proto file
        package: "betsProvider",//package in proto name
        service: "BetsProvider",//service name in proto file
    },
    {
        path: `${__dirname}/proto/match.proto`, //path to proto file
        package: "matchProvider",//package in proto name
        service: "MatchProvider",//service name in proto file
    }
];

const server = new Server(`${GRPC_PORT}`, protoOptionsArray);

// gRPC methods implementation
server
    .addService("DeclareSessionProvider", "DeclareSession", declareSessionResult)
    .addService("DeclareSessionProvider", "DeclareSessionNoResult", declareSessionNoResult)
    .addService("DeclareSessionProvider", "UnDeclareSession", unDeclareSessionResult)

    .addService("DeclareMatchProvider", "DeclareTournament", declareTournamentMatchResult)
    .addService("DeclareMatchProvider", "UnDeclareTournament", unDeclareTournamentMatchResult)

    .addService("DeclareMatchProvider", "DeclareFinalMatch", declareFinalMatchResult)
    .addService("DeclareMatchProvider", "UnDeclareFinalMatch", unDeclareFinalMatchResult)

    .addService("BetsProvider", "GetBets", getPlacedBets)
    .addService("BetsProvider", "VerifyBet", verifyBet)
    .addService("BetsProvider", "GetSessionProfitLossUserWise", getSessionBetProfitLossExpert)
    .addService("BetsProvider", "GetSessionProfitLossBet", getResultBetProfitLoss)

    .addService("MatchProvider", "AddMatch", addMatch)
    .addService("MatchProvider", "AddRaceMatch", raceAdd)

module.exports = server;
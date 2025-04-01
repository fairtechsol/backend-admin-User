const { Server } = require("./grpcServer");
const { declareTournamentMatchResult, unDeclareTournamentMatchResult } = require("./handlers/declareMatchHandler");
const { declareSessionResult, declareSessionNoResult, unDeclareSessionResult } = require("./handlers/declareSessionHandler");

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
    


module.exports = server;
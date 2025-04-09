const { expertDomain, walletDomain } = require("../../config/contants");
const GrpcClient = require("./grpcClient");

const expertProtoOptionsArray = [
    {
        path: `${__dirname}/proto/match.proto`, //path to proto file
        package: "matchProvider",//package in proto name
        service: "MatchProvider",//service name in proto file
    },
    {
        path: `${__dirname}/proto/user.proto`, //path to proto file
        package: "userProvider",//package in proto name
        service: "UserService",//service name in proto file
    },
];


const expertServerAddress = expertDomain;
const walletServerAddress = walletDomain;

const grpcReq = {
    expert: new GrpcClient(expertProtoOptionsArray, expertServerAddress),
    wallet: new GrpcClient(expertProtoOptionsArray, walletServerAddress),
};

module.exports = grpcReq;
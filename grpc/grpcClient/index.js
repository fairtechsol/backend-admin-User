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


const expertServerAddress = "127.0.0.1:60600";
const walletServerAddress = "127.0.0.1:50500";

const grpcReq = {
    expert: new GrpcClient(expertProtoOptionsArray, expertServerAddress),
    wallet: new GrpcClient(expertProtoOptionsArray, walletServerAddress),
};

module.exports = grpcReq;
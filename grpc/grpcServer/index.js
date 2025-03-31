const { Server } = require("./grpcServer");
const { declareSessionResult } = require("./handlers/declareHandler");

const { GRPC_PORT = 50000 } = process.env;

const protoOptionsArray = [
    {
        path: `${__dirname}/proto/declare.proto`, //path to proto file
        package: "declareProvider",//package in proto name
        service: "DeclareProvider",//service name in proto file
    }
];

const server = new Server(`${GRPC_PORT}`, protoOptionsArray);

// gRPC methods implementation
server
    .addService("DeclareProvider", "DeclareSession", declareSessionResult)


module.exports = server;
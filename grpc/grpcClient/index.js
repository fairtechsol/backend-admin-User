const GrpcClient = require("./grpcClient");

const testProtoOptionsArray = [
    {
        path: `${__dirname}/proto/`, //path to proto file
        package: "",//package in proto name
        service: "",//service name in proto file
    }
];


const testServerAddress = "localhost:60600";

const grpcReq = {
  
};

module.exports = grpcReq;
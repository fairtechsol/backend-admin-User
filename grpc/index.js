const grpcServer = require("./grpcServer/index");

grpcServer.start();

module.exports = { grpcServer };
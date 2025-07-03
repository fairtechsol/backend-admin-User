const grpc = require("@grpc/grpc-js");
const protoLoader = require("@grpc/proto-loader");
const lodash = require("lodash");

/**
 * GrpcClient: Singleton-based client manager that avoids recreating channels.
 */
class GrpcClient {
  static serviceConstructors = {};
  static clientsRegistry = {};

  static initialize(protoOptionsArray) {
    if (Object.keys(GrpcClient.serviceConstructors).length) return;
    protoOptionsArray.forEach(opts => {
      const pkgDef = protoLoader.loadSync(opts.path, {
        keepCase: true,
        longs: String,
        enums: String,
        defaults: true,
        oneofs: true,
        ...(opts.options || {}),
      });
      const grpcObj = grpc.loadPackageDefinition(pkgDef);
      const ctor = lodash.get(grpcObj, `${opts.package}.${opts.service}`);
      if (!ctor) throw new Error(`Cannot find ${opts.service} in ${opts.package}`);
      GrpcClient.serviceConstructors[opts.service] = ctor;
    });
  }

  constructor(protoOptionsArray, serverAddress) {
    GrpcClient.initialize(protoOptionsArray);
    this.serverAddress = serverAddress;
  }

  getClient(serviceName) {
    const key = `${serviceName}@${this.serverAddress}`;
    if (!GrpcClient.clientsRegistry[key]) {
      const Ctor = GrpcClient.serviceConstructors[serviceName];
      if (!Ctor) throw new Error(`Service constructor for ${serviceName} not loaded`);
      const creds = ["production", "dev"].includes(process.env.NODE_ENV)
        ? grpc.credentials.createSsl()
        : grpc.credentials.createInsecure();
      GrpcClient.clientsRegistry[key] = new Ctor(
        this.serverAddress,
        creds,
        {
          "grpc.max_receive_message_length": -1,
          "grpc.max_send_message_length": -1,
        }
      );
    }
    return GrpcClient.clientsRegistry[key];
  }

  callMethod(serviceName, methodName, requestData, metadata = {}) {
    return new Promise((resolve, reject) => {
      const client = this.getClient(serviceName);
      const meta = new grpc.Metadata();
      Object.entries(metadata).forEach(([k, v]) => meta.add(k, v));
      client[methodName](requestData, meta, (err, resp) => {
        if (err) return reject(err);
        resolve(resp);
      });
    });
  }

  static shutdownAll() {
    Object.values(GrpcClient.clientsRegistry).forEach(c => {
      try { c.close(); } catch (_) {}
    });
  }
}

module.exports = GrpcClient;
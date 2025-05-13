const grpc = require("@grpc/grpc-js");
const protoLoader = require("@grpc/proto-loader");
const lodash = require("lodash");

/**
 * GrpcClient class for managing gRPC clients and making RPC calls.
 */
class GrpcClient {
  /**
   * Constructor to initialize the gRPC client.
   * @param {Array} protoOptionsArray - Array of proto options, each containing the path, package name, and service name.
   * @param {string} serverAddress - Address of the gRPC server.
   */
  constructor(protoOptionsArray, serverAddress) {
    this.serverAddress = serverAddress;
    this.clients = this.loadProtoServices(protoOptionsArray);
  }

  /**
   * Load the proto services and create clients for each service.
   * @param {Array} protoOptionsArray - Array of proto options.
   * @returns {Object} - Object containing gRPC clients for each service.
   */
  loadProtoServices(protoOptionsArray) {
    const clients = {};
    protoOptionsArray.forEach((protoOptions) => {
      const options = {
        keepCase: true,
        longs: String,
        enums: String,
        defaults: true,
        oneofs: true,
        ...(protoOptions.options || {}),
      };
      const packageDefinition = protoLoader.loadSync(
        protoOptions.path,
        options
      );
      const grpcObject = grpc.loadPackageDefinition(packageDefinition);
      const ServiceCtor = lodash.get(
        grpcObject,
        `${protoOptions.package}.${protoOptions.service}`
      );

      // set unlimited message size on both send and receive
      const channelOptions = {
        "grpc.max_receive_message_length": -1, // unlimited inbound
        "grpc.max_send_message_length":    -1  // unlimited outbound
      };

      const creds =
        process.env.NODE_ENV === "production" || process.env.NODE_ENV === "dev"
          ? grpc.credentials.createSsl()
          : grpc.credentials.createInsecure();

      clients[protoOptions.service] = new ServiceCtor(
        this.serverAddress,
        creds,
        channelOptions
      );
    });
    return clients;
  }

  /**
   * Call a method on a gRPC service.
   * @param {string} serviceName - Name of the gRPC service.
   * @param {string} methodName - Name of the method to call.
   * @param {Object} requestData - Data to be sent in the request.
   * @param {Object} metadata - Metadata to be added to the request.
   * @returns {Promise} - Promise resolving with the response or rejecting with an error.
   */
  async callMethod(serviceName, methodName, requestData, metadata = {}) {
    return new Promise((resolve, reject) => {
      const client = this.clients[serviceName];
      if (!client) {
        return reject(new Error(`Service ${serviceName} not found`));
      }

      // Create and populate metadata
      const meta = new grpc.Metadata();
      Object.keys(metadata).forEach((key) => {
        meta.add(key, metadata[key]);
      });

      // Call the gRPC method with request data and metadata
      client[methodName](requestData, meta, (error, response) => {
        if (error) {
          reject(error);
        } else {
          resolve(response);
        }
      });
    });
  }
}

module.exports = GrpcClient;

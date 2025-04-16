const {
  Server: GrpcServer,
  Metadata,
  ServerCredentials,
  StatusBuilder,
  credentials,
  loadPackageDefinition,
  status,
} = require("@grpc/grpc-js");
const protoLoader = require("@grpc/proto-loader");
const { addReflection } = require('grpc-server-reflection');

// Default values for gRPC port and shutdown timeout
const { GRPC_PORT = 50000, SHUTDOWN_TIMEOUT = "1000" } = process.env;
const defaultShutdownTimeout = parseInt(SHUTDOWN_TIMEOUT, 10);

/**
 * Converts an error into a gRPC StatusObject.
 * @param {Error} err - The error to convert.
 * @returns {StatusObject} The gRPC status object representing the error.
 */
const errorToStatus = (err) => {
  const details = err.message;
  const code = err.code || status.UNKNOWN;
  return new StatusBuilder().withCode(code).withDetails(details).build();
};

/**
 * Wraps a service function with middleware and error handling.
 */
const serviceRequest = (fn, middleware = []) => {
  return async (call, callback) => {
    const obj = call.request;
    delete obj.req;

    try {
      for (const mw of middleware) {
        await new Promise((resolve, reject) => {
          try {
            mw(call, callback, resolve);
          } catch (err) {
            reject(err);
          }
        });
      }
      const result = await fn(call);
      callback(null, result);
    } catch (error) {
      callback(errorToStatus(error));
    }
  };
};

/**
 * Creates insecure credentials for gRPC connections.
 */
const createInsecure = () => credentials.createInsecure();

class Server {
  constructor(port = GRPC_PORT, protoOptionsArray = []) {
    this.port = port;
    this.server = new GrpcServer();
    this.impl = {};
    this.services = this.loadProtoServices(protoOptionsArray);
    this.protoPaths = protoOptionsArray.map(opt => opt.path); // Store proto paths for reflection
  }

  loadProtoServices(protoOptionsArray) {
    const services = {};
    protoOptionsArray.forEach((protoOptions) => {
      const options = {
        keepCase: true,
        longs: String,
        enums: String,
        defaults: true,
        oneofs: true,
        ...(protoOptions.options || {}),
      };
      
      const definition = protoLoader.loadSync(protoOptions.path, options);
      const grpcObject = loadPackageDefinition(definition);
      
      if (!grpcObject[protoOptions.package]) {
        throw new Error(`Package ${protoOptions.package} not found in proto file`);
      }
      
      const service = grpcObject[protoOptions.package][protoOptions.service];
      if (!service || !service.service) {
        throw new Error(`Service ${protoOptions.service} not found in package ${protoOptions.package}`);
      }
      
      services[protoOptions.service] = service.service;
    });
    return services;
  }

  addService(serviceName, methodName, serviceImplementation, middleware = []) {
    if (!this.services[serviceName]) {
      throw new Error(`Service ${serviceName} not found in loaded proto definitions`);
    }
    
    if (!this.impl[serviceName]) {
      this.impl[serviceName] = {};
    }
    
    this.impl[serviceName][methodName] = serviceRequest(
      serviceImplementation,
      middleware
    );
    return this;
  }

  async start(port = this.port) {
    return new Promise((resolve, reject) => {
      // Add all services to the server
      Object.entries(this.services).forEach(([serviceName, serviceDefinition]) => {
        this.server.addService(
          serviceDefinition,
          this.impl[serviceName] || {}
        );
      });

      // Enable reflection
      try {
        addReflection(this.server, this.protoPaths);
        console.log('gRPC reflection enabled for proto files:', this.protoPaths);
      } catch (err) {
        console.error('Failed to enable reflection:', err);
        // Don't reject here as the server can still operate without reflection
      }

      this.server.bindAsync(
        `0.0.0.0:${port}`,
        ServerCredentials.createInsecure(),
        (err) => {
          if (err) {
            reject(err);
            return;
          }
          // this.server.start();
          console.log(`gRPC Server started on port ${port}`);
          resolve();
        }
      );
     
      process.on("SIGINT", this.handleShutdown.bind(this));
      process.on("SIGTERM", this.handleShutdown.bind(this));
    });
  }

  async stop(timeout = defaultShutdownTimeout) {
    try {
      await new Promise((resolve, reject) => {
        this.server.tryShutdown((err) => {
          if (err) {
            reject(err);
            return;
          }
          console.log('gRPC server gracefully stopped');
          resolve();
        });
        
        setTimeout(() => {
          this.server.forceShutdown();
          console.log('gRPC server force stopped after timeout');
          resolve();
        }, timeout).unref();
      });
    } catch (e) {
      this.server.forceShutdown();
      console.log('gRPC server force stopped due to error');
    }
  }

  handleShutdown() {
    console.log("Shutting down gRPC server...");
    this.stop().then(() => process.exit(0));
  }
}

module.exports = {
  Metadata,
  Server,
  createInsecure,
  serviceRequest,
};
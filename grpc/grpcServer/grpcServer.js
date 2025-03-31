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
  
  // Default values for gRPC port and shutdown timeout
  const { GRPC_PORT = 50000, SHUTDOWN_TIMEOUT = "1000" } = process.env;
  const defaultShutdownTimeout = parseInt(SHUTDOWN_TIMEOUT, 10);
  
  /**
   * Converts an error into a gRPC StatusObject.
   * @param {Error} err - The error to convert.
   * @returns {StatusObject} The gRPC status object representing the error.
   */
  const errorToStatus = (err) => {
    const details = err.message; // Extract error details
    const code = err.code || status.UNKNOWN; // Use the provided error code or default to UNKNOWN
    return new StatusBuilder().withCode(code).withDetails(details).build();
  };
  
  /**
   * Wraps a service function with middleware and error handling.
   * @param {Function} fn - The service function to wrap.
   * @param {Function[]} [middleware=[]] - An array of middleware functions to execute before the service function.
   * @returns {Function} The wrapped service function.
   */
  const serviceRequest = (fn, middleware = []) => {
    return async (call, callback) => {
      const obj = call.request;
      delete obj.req; // Remove any unwanted properties from the request object
  
      try {
        // Execute each middleware function in sequence
        for (const mw of middleware) {
          await new Promise((resolve, reject) => {
            try {
              mw(call, callback, resolve); // Pass control to middleware
            } catch (err) {
              reject(err);
            }
          });
        }
        // Call the service function and pass the result to the callback
        const result = await fn(call);
        callback(null, result);
      } catch (error) {
        // Convert and send the error as a gRPC status object
        callback(errorToStatus(error));
      }
    };
  };
  
  /**
   * Creates insecure credentials for gRPC connections.
   * @returns {ChannelCredentials} The insecure channel credentials.
   */
  const createInsecure = () => credentials.createInsecure();
  
  /**
   * Represents a gRPC server.
   */
  class Server {
    /**
     * Creates an instance of the gRPC Server.
     * @param {number} [port=GRPC_PORT] - The port on which the server will listen.
     * @param {Object[]} [protoOptionsArray=[]] - An array of options for loading proto files.
     */
    constructor(port = GRPC_PORT, protoOptionsArray = []) {
      this.port = port; // Port to bind the server
      this.server = new GrpcServer(); // Initialize the gRPC server
      this.impl = {}; // Store service implementations
      this.services = this.loadProtoServices(protoOptionsArray); // Load proto services
    }
  
    /**
     * Loads gRPC services from the provided proto file options.
     * @param {Object[]} protoOptionsArray - An array of options for loading proto files.
     * @returns {Object} An object mapping service names to their definitions.
     */
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
        // Load proto file definition
        const definition = protoLoader.loadSync(protoOptions.path, options);
        // Load gRPC package definition
        const grpcObject = loadPackageDefinition(definition);
        // Map the service definition to the services object
        services[protoOptions.service] =
          grpcObject[protoOptions.package][protoOptions.service].service;
      });
      return services;
    }
  
    /**
     * Adds a gRPC service to the server.
     * @param {string} serviceName - The name of the service.
     * @param {string} methodName - The name of the method.
     * @param {Function} serviceImplementation - The implementation of the service method.
     * @param {Function[]} [middleware=[]] - An array of middleware functions for the service method.
     * @returns {Server} The gRPC server instance.
     */
    addService(serviceName, methodName, serviceImplementation, middleware = []) {
      if (!this.impl[serviceName]) {
        this.impl[serviceName] = {};
      }
      // Add the service method with its implementation and middleware
      this.impl[serviceName][methodName] = serviceRequest(
        serviceImplementation,
        middleware
      );
      return this;
    }
  
    /**
     * Starts the gRPC server.
     * @param {number} [port=this.port] - The port on which the server will listen.
     * @returns {Promise<void>} A promise that resolves when the server starts.
     */
    async start(port = this.port) {
      return new Promise((resolve, reject) => {
        // Add each service to the server
        Object.keys(this.services).forEach((serviceName) => {
          this.server.addService(
            this.services[serviceName],
            this.impl[serviceName]
          );
        });
  
        // Bind the server to the specified port
        this.server.bindAsync(
          `0.0.0.0:${port}`,
          ServerCredentials.createInsecure(),
          (err) => {
            if (err) {
              reject(err); // Reject the promise if there's an error
              process.exit(1);
            }
            console.log(`GRPC Server started at ${port}`);
            resolve(); // Resolve the promise once the server starts
          }
        );
  
        // Handle shutdown signals for graceful termination
        process.on("SIGINT", this.handleShutdown.bind(this));
        process.on("SIGTERM", this.handleShutdown.bind(this));
      });
    }
  
    /**
     * Stops the gRPC server.
     * @param {number} [timeout=defaultShutdownTimeout] - The timeout for graceful shutdown.
     * @returns {Promise<void>} A promise that resolves when the server stops.
     */
    async stop(timeout = defaultShutdownTimeout) {
      try {
        await new Promise((resolve, reject) => {
          this.server.tryShutdown((err) => {
            if (err) {
              process.exit(1); // Exit the process if shutdown fails
            }
            resolve();
          });
          const timer = setTimeout(() => {
            this.server.forceShutdown(); // Force shutdown if graceful shutdown times out
            resolve();
          }, timeout);
          timer.unref();
        });
      } catch (e) {
        this.server.forceShutdown(); // Force shutdown in case of unexpected errors
      }
    }
  
    /**
     * Handles server shutdown signals.
     * Initiates a graceful shutdown and exits the process.
     */
    handleShutdown() {
      console.log("Shutting down gRPC server.");
      this.server.forceShutdown();
      process.exit(0);
    }
  }
  
  module.exports = {
    Metadata,
    Server,
    createInsecure,
    serviceRequest,
  };
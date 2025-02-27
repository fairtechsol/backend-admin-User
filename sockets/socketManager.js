const socketIO = require("socket.io");
const { createAdapter } = require("@socket.io/redis-adapter");
const Redis = require("ioredis");
const { verifyToken, getUserTokenFromRedis } = require("../utils/authUtils");
require("dotenv").config();

let io;

/**
 * Handles a new socket connection.
 * @param {object} client - The socket client object representing the connection.
 */
const handleConnection = async (client) => {
  try {
    // Extract the token from the client's handshake headers or auth object
    const token = client.handshake.headers.authorization || client.handshake.auth.token;

    // If no token is provided, disconnect the client
    if (!token) {
      client.disconnect();
      return;
    }

    // Verify the token to get user information
    const decodedUser = verifyToken(token);

    // If the token is invalid, disconnect the client
    if (!decodedUser) {
      client.disconnect();
      return;
    }

    // Extract user ID from the decoded user object
    const { id: userId } = decodedUser;

    // Retrieve the user's token from Redis
    const userTokenRedis = await getUserTokenFromRedis(userId);

    // If the token doesn't match the one stored in Redis, disconnect the client
    if (userTokenRedis !== token) {
      client.disconnect();
      return;
    }

    // Join the room with the user's ID
    client.join(userId);
  } catch (err) {
    console.error(err);
    client.disconnect();
  }
};

/**
 * Handles a disconnect socket connection.
 * @param {object} client - The socket client object representing the connection.
 */
const handleDisconnect = async (client) => {
  try {
    // Extract the token from the client's handshake headers or auth object
    const token = client.handshake.headers.authorization || client.handshake.auth.token;

    // If no token is provided, disconnect the client
    if (!token) {
      return;
    }

    // Verify the token to get user information
    const decodedUser = verifyToken(token);

    // If the token is invalid, disconnect the client
    if (!decodedUser) {
      return;
    }

    // Extract user ID from the decoded user object
    const { id: userId } = decodedUser;

    // Leave the room with the user's ID
    client.leave(userId);
  } catch (err) {
    console.error(err);
    client.disconnect();
  }
};

/**
 * Initializes and manages socket connections.
 * @param {object} server - The HTTP server instance.
 */
exports.socketManager = (server) => {
  // Ensure server.app is initialized
  if (!server.app) server.app = {};
  // Create a storage for socket connections
  server.app.socketConnections = {};

  // Create a Socket.io instance attached to the server
  io = socketIO(server, {
    cors: {
      origin: "*",
      methods: ["GET", "POST"]
    },
    perMessageDeflate: {
      threshold: 1024, // Compress messages larger than 1KB
      zlibDeflateOptions: {
        level: 3
      }
    }
  });

  // Create Redis clients using ioredis
  const pubClient = new Redis({
    host: process.env.INTERNAL_REDIS_HOST || "localhost",
    port: process.env.INTERNAL_REDIS_PORT || 6379,
    password: process.env.INTERNAL_REDIS_PASSWORD
  });
  const subClient = pubClient.duplicate();

  // Use the Redis adapter with ioredis pub/sub clients
  io.adapter(createAdapter(pubClient, subClient));

  // Event listener for a new socket connection
  io.on("connect", (client) => {
    // Delegate connection handling to a separate function
    handleConnection(client);

    // Event listener for socket disconnection
    client.on("disconnect", () => {
      // Delegate disconnection handling to a separate function
      handleDisconnect(client);
    });
  });
};

/**
 * Sends a message to a specific user or room.
 *
 * @param {string} roomId - The ID of the user or room to send the message to.
 * @param {string} event - The name of the event to emit.
 * @param {any} data - The data to send with the message.
 */
exports.sendMessageToUser = (roomId, event, data) => {
  io.to(roomId).emit(event, data);
};

/**
 * Broadcasts an event to all connected clients.
 * @param {string} event - The event name to broadcast.
 * @param {any} data - The data to send with the broadcast.
 */
exports.broadcastEvent = (event, data) => {
  io.sockets.emit(event, data);
};

const socketIO = require("socket.io");
const { createAdapter } = require("@socket.io/redis-adapter");
const { createClient } = require("redis");
const { verifyToken, getUserTokenFromRedis } = require("../utils/authUtils");
require("dotenv").config();

let io;

/**
 * Handles a new socket connection.
 * @param {object} client - The socket client object representing the connection.
 */
const handleConnection = async (client) => {
  try {
    const token = client.handshake.headers.authorization || client.handshake.auth.token;

    if (!token) {
      client.disconnect();
      return;
    }

    const decodedUser = verifyToken(token);
    if (!decodedUser) {
      client.disconnect();
      return;
    }

    const { id: userId } = decodedUser;
    const userTokenRedis = await getUserTokenFromRedis(userId);

    if (userTokenRedis !== token) {
      client.disconnect();
      return;
    }

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
    const token = client.handshake.headers.authorization || client.handshake.auth.token;

    if (!token) {
      return;
    }

    const decodedUser = verifyToken(token);
    if (!decodedUser) {
      return;
    }

    const { id: userId } = decodedUser;
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
exports.socketManager = async (server) => {
  if (!server.app) server.app = {};
  server.app.socketConnections = {};

  io = socketIO(server, {
    cors: {
      origin: "*",
      methods: ["GET", "POST"]
    }
  });

  // Create Redis clients for pub/sub
  const pubClient = createClient({
    url: `redis://${process.env.INTERNAL_REDIS_HOST || "localhost"}:${process.env.INTERNAL_REDIS_PORT || 6379}`,
    password: process.env.INTERNAL_REDIS_PASSWORD
  });

  const subClient = pubClient.duplicate();

  // Handle Redis connection errors
  pubClient.on("error", (err) => console.error("Redis Pub Client Error:", err));
  subClient.on("error", (err) => console.error("Redis Sub Client Error:", err));

  await Promise.all([pubClient.connect(), subClient.connect()]);

  // Use Redis adapter with pub/sub clients
  io.adapter(createAdapter(pubClient, subClient));

  io.on("connect", (client) => {
    handleConnection(client);
    client.on("disconnect", () => handleDisconnect(client));
  });
};

/**
 * Sends a message to a specific user or room.
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

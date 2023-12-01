const socketIO = require("socket.io");
const { verifyToken, getUserTokenFromRedis } = require("../utils/authUtils");
const { userRoleConstant } = require("../config/contants");
const internalRedis = require("../config/internalRedisConnection");

/**
 * Handles a new socket connection.
 * @param {object} io - The Socket.io server instance.
 * @param {object} client - The socket client object representing the connection.
 */
const handleConnection = async (io, client) => {
  try {
    // Extract the token from the client's handshake headers or auth object
    const token =
      client.handshake.headers.authorization || client.handshake.auth.token;

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

    // Extract user ID and role from the decoded user object
    const { id: userId, role } = decodedUser;

    // Retrieve the user's token from Redis
    const userTokenRedis = await getUserTokenFromRedis(userId);

    // If the token doesn't match the one stored in Redis, disconnect the client
    if (userTokenRedis !== token) {
      client.disconnect();
      return;
    }

    // Join the room with the user's ID
    client.join(userId);

    // Handle additional logic based on the user's role
    if (role === userRoleConstant.expert) {
      // If the user is an expert, add their ID to the "expertLoginIds" set and join the room
      internalRedis.sadd("expertLoginIds", userId);
      client.join("expertUserCountRoom");
    } else if (role === userRoleConstant.user) {
      const userCount = parseInt(await internalRedis.get("loginUserCount"));

      // If the user is a regular user, manage user login count
      const incrementCount = async () => {
        const count = await internalRedis.incr("loginUserCount");
        io.to("expertUserCountRoom").emit("loginUserCount", { count });
      };

      // Increment and emit the login user count if greater than 0; otherwise, set it to 1
      if (userCount > 0) {
        incrementCount();
      } else {
        internalRedis.set("loginUserCount", 1);
        io.to("expertUserCountRoom").emit("loginUserCount", { count: 1 });
      }
    }
  } catch (err) {
    // Handle any errors by disconnecting the client
    console.error(err);
    client.disconnect();
  }
};

/**
 * Handles a disconnect socket connection.
 * @param {object} io - The Socket.io server instance.
 * @param {object} client - The socket client object representing the connection.
 */
const handleDisconnect = async (io, client) => {
  try {
    // Extract the token from the client's handshake headers or auth object
    const token =
      client.handshake.headers.authorization || client.handshake.auth.token;

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

    // Extract user ID and role from the decoded user object
    const { id: userId, role } = decodedUser;

    // Leave the room with the user's ID
    client.leave(userId);

    // Handle additional logic based on the user's role
    if (role === userRoleConstant.expert) {
      // If the user is an expert, remove their ID from the "expertLoginIds" set
      internalRedis.srem("expertLoginIds", userId);
      // Leave the "expertUserCountRoom" room
      client.leave("expertUserCountRoom");
    } else if (role === userRoleConstant.user) {
      const userCount = parseInt(await internalRedis.get("loginUserCount"));
      // If the user is a regular user, manage user login count
      const decrementCount = async () => {
        const userCount = await internalRedis.decr("loginUserCount");
        io.to("expertUserCountRoom").emit("loginUserCount", {
          count: userCount,
        });
      };

      // Decrement and emit the login user count if greater than 0; otherwise, set it to 0
      userCount > 0 ? decrementCount() : internalRedis.set("loginUserCount", 0);
    }
  } catch (err) {
    // Handle any errors by disconnecting the client
    console.error(err);
    client.disconnect();
  }
};

/**
 * Initializes and manages socket connections.
 * @param {object} server - The HTTP server instance.
 */
const socketManager = (server) => {
  // Ensure server.app is initialized
  if (!server.app) server.app = {};
  // Create a storage for socket connections
  server.app.socketConnections = {};

  // Create a Socket.io instance attached to the server
  const io = socketIO(server);

  // Event listener for a new socket connection
  io.on("connect", (client) => {
    // Delegate connection handling to a separate function
    handleConnection(io, client);

    // Event listener for socket disconnection
    client.on("disconnect", () => {
      // Delegate disconnection handling to a separate function
      handleDisconnect(io, client);
    });
  });
};

module.exports = socketManager;

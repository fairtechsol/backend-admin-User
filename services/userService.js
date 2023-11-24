const { AppDataSource } = require("../config/postGresConnection");
const bcrypt = require("bcryptjs");
const userSchema = require("../models/user.entity");
const user = AppDataSource.getRepository(userSchema);
const internalRedis = require("../config/internalRedisConnection");
const externalRedis = require("../config/externalRedisConnection");
const publisherService = require("./redis/externalRedisPublisher");
const subscribeService = require("./redis/externalRedisSubscriber");
const internalRedisSubscribe = require("./redis/internalRedisSubscriber");
const internalRedisPublisher = require("./redis/internalRedisPublisher");

// this is the dummy function to test the functionality

exports.getUserById = async(id) =>{
    return await user.findOne({id})
}

exports.addUser = async(body) =>{
        let insertUser = await user.save(body);
        return insertUser;
}

exports.getUserByUserName = async(userName) =>{
    return await user.findOne({userName});
}
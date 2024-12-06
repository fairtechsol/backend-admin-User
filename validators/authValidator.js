const Joi = require('joi');
const { authenticatorType } = require('../config/contants');

module.exports.signUp = Joi.object({
    name : Joi.string().required(),
    email : Joi.string().email().required(),
    password : Joi.string().required()
});

module.exports.Login = Joi.object({
    userName : Joi.string().trim().required(),
    password : Joi.string().required(),
    loginType : Joi.string().required(),
});

module.exports.connectUserAuthValidator = Joi.object({ 
    userName : Joi.string().trim().required(),
    password : Joi.string().required(),
    authToken : Joi.string().required(),
    deviceId: Joi.string().required()
});

module.exports.verifyAuthTokenValidator = Joi.object({ 
    authToken : Joi.string().length(6).required()
});

module.exports.generateAuthTokenValidator = Joi.object({ 
    password : Joi.string().allow(null),
    type : Joi.valid(...Object.values(authenticatorType)).required(),
});
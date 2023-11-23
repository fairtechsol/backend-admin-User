const Joi = require('joi')

module.exports.signUp = Joi.object({
    name : Joi.string().required(),
    email : Joi.string().email().required(),
    password : Joi.string().required()
})

module.exports.Login = Joi.object({
    email : Joi.string().email().required(),
    password : Joi.string().required()
})
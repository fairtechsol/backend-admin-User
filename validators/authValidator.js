const Joi = require('joi')

module.exports.signUp = Joi.object({
    name : Joi.string().required(),
    email : Joi.string().email().required(),
    password : Joi.string().required()
})

module.exports.Login = Joi.object({
    userName : Joi.string().required(),
    password : Joi.string().required(),
    loginType : Joi.string().required(),

})
const Joi = require('joi')
const { userRoleConstant } = require('../config/contants')

const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[#$@!%&*?])[A-Za-z\d#$@!%&*?]{6,30}$/;

module.exports.CreateUser = Joi.object({
    userName : Joi.string().trim().required(),
    fullName : Joi.string().required(),
    password : Joi.string().pattern(passwordRegex).required().messages({
        'string.pattern.base': 'user.passwordMatch',
      }),
    phoneNumber : Joi.string().required(),
    city : Joi.string().required(),
    roleName : Joi.string().valid(...Object.values(userRoleConstant)).required(),
    myPartnership : Joi.number().required(),
    createdBy : Joi.string().pattern(uuidPattern).messages({
        'string.pattern.base': 'invalidId',
    }),
    creditRefrence :  Joi.number(),
    })

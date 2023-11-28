const Joi = require('joi')
const { userRoleConstant } = require('../config/contants')

const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[#$@!%&*?])[A-Za-z\d#$@!%&*?]{6,30}$/;
let uuidPattern =/^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/
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

    module.exports.ChangePassword=Joi.object({
      oldPassword:Joi.string(),
      newPassword:Joi.string().required(),
      transactionPassword:Joi.string().length(6),
      confirmPassword:Joi.string().required(),
      userId:Joi.string()
    })

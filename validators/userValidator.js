const Joi = require('joi')
const { userRoleConstant } = require('../config/contants')

const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[#$@!%&*?])[A-Za-z\d#$@!%&*?]{6,30}$/;

module.exports.CreateUser = Joi.object({
  userName: Joi.string().trim().required(),
  fullName: Joi.string().trim().required(),
  password: Joi.string().pattern(passwordRegex).required().messages({
    'string.pattern.base': 'user.passwordMatch',
  }),
  phoneNumber: Joi.string().required(),
  city: Joi.string().trim().required(),
  roleName: Joi.string().valid(...Object.values(userRoleConstant)).required(),
  myPartnership: Joi.number().required(),
  createdBy: Joi.string().guid({ version: 'uuidv4' }),
  creditRefrence: Joi.number(),
})

module.exports.LockUnlockUser = Joi.object({
  userId: Joi.string().guid({ version: 'uuidv4' }).required(),
  transPassword: Joi.string().required().messages({
    'string.base': '"Transaction Password" must be a string',
    'any.required': '"Transaction Password" is required',
    'string.empty': '"Transaction Password" can not be empty.'
  }),
  userBlock: Joi.boolean().required(),
  betBlock: Joi.boolean().required(),
  createBy: Joi.string().guid({  version: 'uuidv4' })
})

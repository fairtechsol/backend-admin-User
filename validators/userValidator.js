const Joi = require('joi')
const { userRoleConstant, matchComissionTypeConstant } = require('../config/contants')

const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[#$@!%&*?])[A-Za-z\d#$@!%&*?]{6,30}$/;
module.exports.CreateUser = Joi.object({
  userName: Joi.string().trim().required(),
  fullName: Joi.string().min(3).max(255),
  password: Joi.string().pattern(passwordRegex).required().label('password').messages({
    'string.pattern.base': 'user.passwordMatch',
    'any.required': 'Password is required',
  }),
  phoneNumber: Joi.string().required().messages({
    'any.required': 'Phone number is required',
  }),
  city: Joi.string().max(255),
  roleName: Joi.string().valid(...Object.values(userRoleConstant)).required(),
  myPartnership: Joi.number().required(),
  createdBy: Joi.string().required().guid({ version: 'uuidv4' }).messages({
    'string.pattern.base': 'invalidId',
  }),
  creditRefrence: Joi.number(),
  exposureLimit: Joi.number(),
  maxBetLimit: Joi.number(),
  minBetLimit: Joi.number(),
  confirmPassword: Joi.string().required().valid(Joi.ref('password')).label('Confirm Password').messages({
    'string.base': 'Confirm Password must be a string',
    'any.required': 'Confirm Password is required',
    'any.only': 'Confirm Password must match Password',
  }),
})

module.exports.ChangePassword = Joi.object({
  oldPassword: Joi.string(),
  newPassword: Joi.string().required(),
  transactionPassword: Joi.string().length(6),
  confirmPassword: Joi.string().required(),
  userId: Joi.string().guid({ version: 'uuidv4' })
})

module.exports.updateUserValid = Joi.object({
  //sessionCommission,matchComissionType,matchCommission,id,createBy
  sessionCommission: Joi.number(),
  matchComissionType: Joi.string().valid(...Object.values(matchComissionTypeConstant)),
  matchCommission: Joi.number(),
  id: Joi.string().guid({ version: 'uuidv4' }).required(),
  createBy: Joi.string().guid({ version: 'uuidv4' }).required(),
})

module.exports.setExposureLimitValid = Joi.object({
  //sessionCommission,matchComissionType,matchCommission,id,createBy
  amount: Joi.number().required(),
  transPassword: Joi.string(),
  userid: Joi.string().guid({ version: 'uuidv4' }).required(),
  createBy: Joi.string().guid({ version: 'uuidv4' }).required(),
})
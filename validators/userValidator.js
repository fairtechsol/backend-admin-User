const Joi = require('joi')
const { userRoleConstant, blockType, matchComissionTypeConstant, matchWiseBlockType } = require('../config/contants')

const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[#$@!%&*?])[A-Za-z\d#$@!%&*?]{6,30}$/;

module.exports.CreateUser = Joi.object({
  userName: Joi.string().trim().required(),
  fullName: Joi.string().min(3).max(255).allow(""),
  password: Joi.string().pattern(passwordRegex).required().label('password').messages({
    'string.pattern.base': 'user.passwordMatch',
    'any.required': 'Password is required',
  }),
  phoneNumber: Joi.string().allow(""),
  city: Joi.string().max(255).allow(""),
  roleName: Joi.string().valid(...Object.values(userRoleConstant)).required(),
  myPartnership: Joi.number().required(),
  creditRefrence: Joi.number(),
  exposureLimit: Joi.number(),
  transactionPassword: Joi.string().required().messages({
    'any.required': 'Transaction Password is required'
  }),
  maxBetLimit: Joi.number(),
  minBetLimit: Joi.number(),
  confirmPassword: Joi.string().required().valid(Joi.ref('password')).label('Confirm Password').messages({
    'string.base': 'Confirm Password must be a string',
    'any.required': 'Confirm Password is required',
    'any.only': 'Confirm Password must match Password',
  }),
  delayTime: Joi.string().allow("")
});

module.exports.ChangePassword = Joi.object({
  oldPassword: Joi.string(),
  newPassword: Joi.string().pattern(passwordRegex).required().label('password').messages({
    'string.pattern.base': 'user.passwordMatch',
    'any.required': 'Password is required',
  }),
  userId: Joi.string().guid({ version: 'uuidv4' }),
  transactionPassword: Joi.string()
  ,
  confirmPassword: Joi.string()
    .required()
    .valid(Joi.ref("newPassword"))
    .label("Confirm Password")
    .messages({
      "string.base": "Confirm Password must be a string",
      "any.required": "Confirm Password is required",
      "any.only": "Confirm Password must match new password",
    }),
});

module.exports.generateTransactionPass = Joi.object({
  transPassword: Joi.string()
    .required()
    .label("Transaction password")
    .length(6)
    .message("Transaction password must be 6 characters long"),
  confirmTransPassword: Joi.string()
    .required()
    .valid(Joi.ref("transPassword"))
    .label("Confirm transaction password")
    .messages({
      "string.base": "Confirm transaction Password must be a string",
      "any.required": "Confirm transaction password is required",
      "any.only": "Confirm Transaction Password must match transaction password",
    }),
});

module.exports.updateUserValid = Joi.object({
  //sessionCommission,matchComissionType,matchCommission,id,createBy
  fullName: Joi.string().allow(""),
  city: Joi.string().allow(""),
  phoneNumber: Joi.string().allow(""),
  id: Joi.string().guid({ version: 'uuidv4' }).required(),
  transactionPassword: Joi.string().required().messages({
    'string.base': '"Transaction Password" must be a string',
    'any.required': '"Transaction Password" is required',
    'string.empty': '"Transaction Password" can not be empty.'
  }),
});

module.exports.setExposureLimitValid = Joi.object({
  //sessionCommission,matchComissionType,matchCommission,id,createBy
  amount: Joi.number().required(),
  transactionPassword: Joi.string().required(),
  userId: Joi.string().guid({ version: 'uuidv4' }).required(),
});

module.exports.LockUnlockUser = Joi.object({
  userId: Joi.string().guid({ version: 'uuidv4' }).required(),
  transactionPassword: Joi.string().required().messages({
    'string.base': '"Transaction Password" must be a string',
    'any.required': '"Transaction Password" is required',
    'string.empty': '"Transaction Password" can not be empty.'
  }),
  betBlock: Joi.boolean().required(),
  userBlock:  Joi.boolean().required()
});

module.exports.setCreditRefValidate = Joi.object({
  //sessionCommission,matchComissionType,matchCommission,id,createBy
  amount: Joi.number().required(),
  transactionPassword: Joi.string().required(),
  userId: Joi.string().guid({ version: 'uuidv4' }).required(),
  remark: Joi.string().allow("")
})

module.exports.userMatchLockValidate = Joi.object({
  userId: Joi.string().guid({ version: 'uuidv4' }).required(),
  matchId: Joi.string().guid({ version: 'uuidv4' }).required(),
  type: Joi.string().valid(...Object.values(matchWiseBlockType)).required(),
  block: Joi.boolean().required(),
  operationToAll: Joi.boolean(),
})

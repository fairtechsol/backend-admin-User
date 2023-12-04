const Joi = require('joi')
const { userRoleConstant } = require('../config/contants')

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
  createdBy: Joi.string().guid({ version: 'uuidv4' }).required().messages({
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

module.exports.ChangePassword=Joi.object({
  oldPassword:Joi.string(),
  newPassword:Joi.string().pattern(passwordRegex).required().label('password').messages({
      'string.pattern.base': 'user.passwordMatch',
        'any.required': 'Password is required',
    }),
    userId:Joi.string(),
  transactionPassword: Joi.string()
    .length(6)
    .message("Transaction password must be 6 character long"),
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
    .length(6)
    .messages({
      "string.base": "Confirm transaction Password must be a string",
      "any.required": "Confirm transaction password is required",
      "any.only": "Confirm Transaction Password must match transaction password",
      "string.length.base": "Confirm transaction password must be 6 characters long",
    }),
});

module.exports.LockUnlockUser = Joi.object({
  userId: Joi.string().guid({ version: 'uuidv4' }).required(),
  transPassword: Joi.string().required().messages({
    'string.base': '"Transaction Password" must be a string',
    'any.required': '"Transaction Password" is required',
    'string.empty': '"Transaction Password" can not be empty.'
  }),
  userBlock: Joi.boolean().required(),
  betBlock: Joi.boolean().required(),
  createBy: Joi.string().guid({ version: 'uuidv4' })
})

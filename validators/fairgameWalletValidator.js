const Joi = require("joi");
const { userRoleConstant, transType } = require("../config/contants");

module.exports.CreateSuperAdmin = Joi.object({
  userName: Joi.string().trim(),
  fullName: Joi.string().min(3).max(255),
  password: Joi.string(),
  phoneNumber: Joi.string(),
  betBlock: Joi.boolean(),
  userBlock: Joi.boolean(),
  city: Joi.string().max(255),
  roleName: Joi.string().valid(...Object.values(userRoleConstant)),
  fwPartnership: Joi.number(),
  faPartnership: Joi.number(),
  saPartnership: Joi.number(),
  aPartnership: Joi.number(),
  smPartnership: Joi.number(),
  mPartnership: Joi.number(),
  creditRefrence: Joi.number(),
  exposureLimit: Joi.number(),
  maxBetLimit: Joi.number(),
  minBetLimit: Joi.number(),
  id: Joi.string().guid({ version: "uuidv4" }),
  domain: Joi.object({
    domain: Joi.string(),
    sidebarColor: Joi.string(),
    headerColor: Joi.string(),
    footerColor: Joi.string(),
    logo: Joi.string(),
  }),
});

module.exports.UpdateSuperAdmin = Joi.object({
    id: Joi.string().guid({ version: "uuidv4" }).required(),
    user: Joi.object({
    city: Joi.string(),
    phoneNumber: Joi.string(),
    fullName: Joi.string(),
  }),
  domain: Joi.object({
    logo: Joi.string(),
    sidebarColor: Joi.string(),
    headerColor: Joi.string(),
    footerColor: Joi.string(),
  }),
});

module.exports.SuperAdminBalance = Joi.object({
  userId: Joi.string().guid({ version: "uuidv4" }).required(),
  transactionType: Joi.string().valid(...Object.values(transType)),
  amount: Joi.number(),
  remark: Joi.string().allow(""),
});

module.exports.SuperAdminExposureLimit = Joi.object({
  id: Joi.string().guid({ version: "uuidv4" }).required(),
  exposureLimit: Joi.number(),
});

module.exports.SuperAdminCreditReference = Joi.object({
  userId: Joi.string().guid({ version: "uuidv4" }).required(),
  amount: Joi.number(),
  remark: Joi.string().allow(""),
});

module.exports.SuperAdminLockUnlock = Joi.object({
  userId: Joi.string().guid({ version: "uuidv4" }).required(),
  loginId: Joi.string().guid({ version: "uuidv4" }).required(),
  
  betBlock: Joi.boolean().allow(null),
  userBlock:  Joi.boolean().allow(null)
});

module.exports.SuperAdminChangePassword = Joi.object({
    userId: Joi.string().guid({ version: "uuidv4" }).required(),
    password:Joi.string().required()
  });
  

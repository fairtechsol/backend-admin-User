const Joi = require("joi");
const { userRoleConstant, transType, matchComissionTypeConstant } = require("../config/contants");

module.exports.CreateSuperAdmin = Joi.object({
  userName: Joi.string().trim(),
  fullName: Joi.string().trim().allow("").min(3).max(255),
  password: Joi.string(),
  phoneNumber: Joi.string().trim().allow(""),
  betBlock: Joi.boolean(),
  userBlock: Joi.boolean(),
  city: Joi.string().trim().allow("").max(255),
  roleName: Joi.string().valid(...Object.values(userRoleConstant)),
  fwPartnership: Joi.number(),
  faPartnership: Joi.number(),
  saPartnership: Joi.number(),
  aPartnership: Joi.number(),
  smPartnership: Joi.number(),
  mPartnership: Joi.number(),
  agPartnership: Joi.number(),
  creditRefrence: Joi.number(),
  exposureLimit: Joi.number(),
  maxBetLimit: Joi.number(),
  minBetLimit: Joi.number(),
  isOldFairGame: Joi.boolean(),
  id: Joi.string().guid({ version: "uuidv4" }).required(),
  domain: Joi.object({
    domain: Joi.string(),
    sidebarColor: Joi.string(),
    headerColor: Joi.string(),
    footerColor: Joi.string(),
    logo: Joi.string(),
  }),
  sessionCommission: Joi.number(),
  matchComissionType: Joi.string().valid(...Object.values(matchComissionTypeConstant)).allow(null),
  matchCommission: Joi.number(),
  superParentType: Joi.string().valid(userRoleConstant.fairGameAdmin, userRoleConstant.fairGameWallet),
  superParentId: Joi.string().guid({ version: "uuidv4" }),
});

module.exports.UpdateSuperAdmin = Joi.object({
  id: Joi.string().guid({ version: "uuidv4" }).required(),
  user: Joi.object({
    city: Joi.string().trim().allow(""),
    phoneNumber: Joi.string().trim().allow(""),
    fullName: Joi.string().trim().allow(""),

    sessionCommission: Joi.number(),
     matchComissionType: Joi.string().valid(...Object.values(matchComissionTypeConstant)).allow(null),

    matchCommission: Joi.number(),
  }),
  domain: Joi.object({
    logo: Joi.string(),
    sidebarColor: Joi.string(),
    headerColor: Joi.string(),
    footerColor: Joi.string(),
  }),
  isOldFairGame: Joi.boolean(),
});

module.exports.SuperAdminBalance = Joi.object({
  userId: Joi.string().guid({ version: "uuidv4" }).required(),
  transactionType: Joi.string().valid(...Object.values(transType)),
  amount: Joi.number(),
  remark: Joi.string().trim().allow(""),
});

module.exports.SuperAdminExposureLimit = Joi.object({
  id: Joi.string().guid({ version: "uuidv4" }).required(),
  exposureLimit: Joi.number(),
});

module.exports.SuperAdminCreditReference = Joi.object({
  userId: Joi.string().guid({ version: "uuidv4" }).required(),
  amount: Joi.number(),
  remark: Joi.string().trim().allow(""),
});

module.exports.SuperAdminLockUnlock = Joi.object({
  userId: Joi.string().guid({ version: "uuidv4" }).required(),
  loginId: Joi.string().guid({ version: "uuidv4" }).required(),
  
  betBlock: Joi.boolean().allow(null),
  userBlock:  Joi.boolean().allow(null)
});

module.exports.SuperAdminChangePassword = Joi.object({
  userId: Joi.string().guid({ version: "uuidv4" }).required(),
  password: Joi.string().required()
});


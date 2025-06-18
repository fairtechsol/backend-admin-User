const Joi = require('joi')
const { transType, maxAmount } = require('../config/contants')

module.exports.SetUserBalance = Joi.object({
    userId: Joi.string().guid({ version: 'uuidv4' }),
    transactionType: Joi.string().valid(...Object.values(transType)).required(),
    amount : Joi.number().max(maxAmount).required(),
    remark: Joi.string().trim().allow(""),
    createBy: Joi.string().guid({ version: 'uuidv4' }),
    transactionPassword: Joi.string(),
});

module.exports.settleCommission = Joi.object({
    userId: Joi.string().guid({ version: 'uuidv4' }).required()
});
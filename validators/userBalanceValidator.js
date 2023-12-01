const Joi = require('joi')
const { transType } = require('../config/contants')

module.exports.SetUserBalance = Joi.object({
    userId: Joi.string().guid({ version: 'uuidv4' }),
    transactionType: Joi.string().valid(...Object.values(transType)).required(),
    amount : Joi.number().required(),
    remark: Joi.string().trim(),
    createBy: Joi.string().guid({ version: 'uuidv4' }).required(),
    transactionPassword: Joi.string().trim(),
})

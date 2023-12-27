const Joi = require('joi')
const { betType } = require('../config/contants')

module.exports.SetUserBalance = Joi.object({
    matchId: Joi.string().guid({ version: 'uuidv4' }),
    betId: Joi.string().guid({ version: 'uuidv4' }),
    transactionType: Joi.string().valid(...Object.values(transType)).required(),
    amount : Joi.number().required(),
    remark: Joi.string().trim(),
    createBy: Joi.string().guid({ version: 'uuidv4' }),
    transactionPassword: Joi.string(),
})

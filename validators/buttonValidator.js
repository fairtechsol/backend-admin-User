const Joi = require('joi')
const { userRoleConstant } = require('../config/contants')

const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[#$@!%&*?])[A-Za-z\d#$@!%&*?]{6,30}$/;
let uuidPattern = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/
module.exports.CreateButton = Joi.object({
  type: Joi.string().trim().required(),
  value: Joi.string().required(),
  id: Joi.string().pattern(uuidPattern).messages({
    'string.pattern.base': 'invalidId',
  }),
})

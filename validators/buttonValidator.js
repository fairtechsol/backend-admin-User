const Joi = require('joi')


module.exports.CreateButton = Joi.object({
  type: Joi.string().trim().required(),
  value: Joi.string().required(),
  id: Joi.string().guid({ version: 'uuidv4' }).messages({
    'string.pattern.base': 'invalidId',
  }),
})

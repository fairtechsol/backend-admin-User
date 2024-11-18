const Joi = require("joi");

module.exports.casinoLoginValidate = Joi.object({
    gameId: Joi.string().required().messages({
        "any.required": "Game id is required",
    }),
    platformId: Joi.string().required().messages({
        "any.required": "Platform id is required",
    }),

});
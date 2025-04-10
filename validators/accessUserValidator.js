
const Joi = require('joi');
const { passwordRegex } = require('../config/contants');

module.exports.CreateAccessUser = Joi.object({
    userName: Joi.string().trim().required(),
    fullName: Joi.string().min(3).max(255).allow(""),
    password: Joi.string().pattern(passwordRegex).required().label('password').messages({
        'string.pattern.base': 'user.passwordMatch',
        'any.required': 'Password is required',
    }),
    confirmPassword: Joi.string().required().valid(Joi.ref('password')).label('Confirm Password').messages({
        'string.base': 'Confirm Password must be a string',
        'any.required': 'Confirm Password is required',
        'any.only': 'Confirm Password must match Password',
    }),
    permission: Joi.object().required().messages({
        'any.required': 'Permission is required',
    })
});

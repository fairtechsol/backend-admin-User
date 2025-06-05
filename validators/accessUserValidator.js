const Joi = require('joi');
const { passwordRegex } = require('../config/contants');

module.exports.CreateAccessUser = Joi.object({
    userName: Joi.string().trim().required(),
    fullName: Joi.string().min(3).max(255).allow(""),
    transactionPassword: Joi.string().required().messages({
        'any.required': 'Transaction Password is required'
    }),
    permission: Joi.object().required().messages({
        'any.required': 'Permission is required',
    }),
    id: Joi.string().optional()
})
    .when(Joi.object({ id: Joi.exist() }).unknown(), {
        then: Joi.object({
            password: Joi.forbidden(),
            confirmPassword: Joi.forbidden()
        }),
        otherwise: Joi.object({
            password: Joi.string().pattern(passwordRegex).required().label('password').messages({
                'string.pattern.base': 'user.passwordMatch',
                'any.required': 'Password is required',
            }),
            confirmPassword: Joi.string().required().valid(Joi.ref('password')).label('Confirm Password').messages({
                'string.base': 'Confirm Password must be a string',
                'any.required': 'Confirm Password is required',
                'any.only': 'Confirm Password must match Password',
            })
        })
    });


module.exports.LockAccessUser = Joi.object({
    id: Joi.string().required().messages({
        'any.required': 'Id is required',
    }),
    isBlock: Joi.boolean().required().messages({
        'any.required': 'isBlock is required',
    }),
    transactionPassword: Joi.string().required().messages({
        'any.required': 'Transaction Password is required'
    }),
})

module.exports.ChangePassword = Joi.object({
    transactionPassword: Joi.string().required().messages({
        'any.required': 'Transaction Password is required'
    }),
    id: Joi.string().required().messages({
        'any.required': 'Id is required',
    }),
    password: Joi.string().pattern(passwordRegex).required().label('password').messages({
        'string.pattern.base': 'user.passwordMatch',
        'any.required': 'Password is required',
    }),
    confirmPassword: Joi.string().required().valid(Joi.ref('password')).label('Confirm Password').messages({
        'string.base': 'Confirm Password must be a string',
        'any.required': 'Confirm Password is required',
        'any.only': 'Confirm Password must match Password',
    })
});

const { ErrorResponse } = require("../utils/response")


module.exports = function (Schema) {
    return async function (req, res, next) {
        try {
            if (!req.body) return ErrorResponse({ statusCode: 400, message: { msg: "invalidData" } }, req, res)
            const validated = await Schema.validateAsync(req.body)
            req.body = validated
            next()
        } catch (err) {
            if (err.isJoi)
                return ErrorResponse({ statusCode: 400, message: { msg: err.message.replace(/"/g, "") } }, req, res)
        }
    }
}


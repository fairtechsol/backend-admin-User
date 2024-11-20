
const fs = require('fs');
const { ErrorResponse } = require('../utils/response');
const crypto = require("crypto");

// Middleware function for rate limiting
const verifyRSA = async (req, res, next) => {
    try {
        const { signature } = req.headers;

        const data = req.body;
        const publicKey = fs.readFileSync("mac88casinoPublic.pem", "utf8");

	const verifier = crypto.createVerify('sha256'); // Use the same hash algorithm
        verifier.update(JSON.stringify(data));

        verifier.end();
console.log(publicKey,signature,data)
        const isValid = verifier.verify(publicKey, signature, 'base64');
console.log(isValid)
        if (!isValid) {
            return res.status(400).json({ status: "OP_INVALID_SIGNATURE" })
        }
        next(); // Proceed to the next middleware
    } catch (error) {
console.log(error)
        return ErrorResponse({ statusCode: 400, message: { msg: "internalServerError" } }, req, res);
    }
};


module.exports = verifyRSA;

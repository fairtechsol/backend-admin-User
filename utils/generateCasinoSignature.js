const crypto = require("crypto");
const fs = require("fs");
exports.generateRSASignature = (data) => {
    const privateKey = fs.readFileSync("mac88casino.pem", "utf8");
    // Create the signer object using SHA256
    const sign = crypto.createSign("SHA256");

    // Add the data to be signed
    sign.update(data);
    sign.end();

    // Sign the data using the private key
    return sign.sign(privateKey, "base64");
};

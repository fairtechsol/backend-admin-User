const crypto = require("crypto");
const fs = require('fs');


// AES Encryption
exports.encryptWithAES = (data, aesKey) => {
    try {
        // Ensure aesKey is a 32-byte Buffer
        let keyBuffer = Buffer.isBuffer(aesKey) ? aesKey : Buffer.from(aesKey, 'utf8');

        // If the key is shorter than 32 bytes, pad it to 32 bytes
        if (keyBuffer.length < 32) {
            keyBuffer = Buffer.concat([keyBuffer, Buffer.alloc(32 - keyBuffer.length)]);
        } else if (keyBuffer.length > 32) {
            keyBuffer = keyBuffer.slice(0, 32);
        }

        // Now aesKey is guaranteed to be 32 bytes
        const iv = keyBuffer.slice(0, 16); // You can use a random IV here for better security
        const cipher = crypto.createCipheriv("aes-256-cbc", keyBuffer, iv);
        let encrypted = cipher.update(JSON.stringify(data), "utf8", "base64");
        encrypted += cipher.final("base64");

        return encrypted; // Base64 encoded string
    } catch (error) {
        console.log("Encryption error:", error);
    }
};

// AES Decryption
exports.decryptWithAES = (encryptedData, aesKey) => {
    try {
        // Ensure aesKey is a 32-byte Buffer
        let keyBuffer = Buffer.isBuffer(aesKey) ? aesKey : Buffer.from(aesKey, 'utf8');

        // If the key is shorter than 32 bytes, pad it to 32 bytes
        if (keyBuffer.length < 32) {
            keyBuffer = Buffer.concat([keyBuffer, Buffer.alloc(32 - keyBuffer.length)]);
        } else if (keyBuffer.length > 32) {
            keyBuffer = keyBuffer.slice(0, 32);
        }

        // Now aesKey is guaranteed to be 32 bytes
        const decipher = crypto.createDecipheriv("aes-256-cbc", keyBuffer, keyBuffer.slice(0, 16));
        let decrypted = decipher.update(encryptedData, "base64", "utf8");
        decrypted += decipher.final("utf8");

        // Return parsed decrypted data
        return JSON.parse(decrypted);
    } catch (error) {
        console.log("Decryption error:", error);
    }
}

// RSA Encryption/Decryption
exports.decryptAESKeyWithRSA = (encryptedAESKey, isServerToServer) => {
    try {
        const rsaPrivateKey = fs.readFileSync(`rsaKeys/${isServerToServer ? "frontendPrivateKey" : "backendPrivateKey"}.pem`, "utf8");
        return crypto.privateDecrypt(rsaPrivateKey, Buffer.from(encryptedAESKey, "base64"));
    } catch (error) {
        console.log("RSA Decryption Error:", error);
    }
}

exports.encryptAESKeyWithRSA = (aesKey, isServerToServer) => {
    try {
        const rsaPublicKey = fs.readFileSync(`rsaKeys/${isServerToServer ? "backendPublicKey" : "frontendPublicKey"}.pem`, "utf8");
        return crypto.publicEncrypt(rsaPublicKey, aesKey).toString("base64");
    } catch (error) {
        console.log("RSA Encryption Error:", error);
    }
}
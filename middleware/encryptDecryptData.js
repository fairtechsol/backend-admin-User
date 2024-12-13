const { decryptAESKeyWithRSA, decryptWithAES } = require("../utils/encryptDecrypt");

module.exports = (req, res, next) => {
    // Decrypt `req.query`
    if (Object.keys(req.query).length > 0) {
      const aesKey = decryptAESKeyWithRSA(req.query.encryptedKey);
      req.query = decryptWithAES(req.query.encryptedData, aesKey);
    }
  
    // Decrypt `req.body`
    if (Object.keys(req.body).length > 0) {
      const aesKey = decryptAESKeyWithRSA(req.body.encryptedKey);
      req.body = decryptWithAES(req.body.encryptedData, aesKey);
    }
    next();
  };
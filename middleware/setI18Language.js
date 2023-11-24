const i18n = require("../config/i18n");

const setI18Language = async (req, res, next) => {
  try {
    const userLang = req.headers["accept-language"];

    // Extract the primary language from the 'accept-language' header
    const lang = userLang ? userLang.split(",")[0] : "en";

    // Set the locale for this request
    i18n.setLocale(req, lang);

    next();
  } catch (error) {
    console.log(error);
  }
};

module.exports = setI18Language;

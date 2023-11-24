const i18n = require("../config/i18n");
const catchAsyncErrors = require("../utils/catchAsyncErrors");

const setI18Language = catchAsyncErrors(async (req, res, next) => {
  const userLang = req.headers["accept-language"];

  // Extract the primary language from the 'accept-language' header
  const lang = userLang ? userLang.split(",")[0] : "en";

  // Set the locale for this request
  i18n.setLocale(req, lang);

  next();
});

module.exports = setI18Language;

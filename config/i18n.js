// i18n.js
const i18n = require("i18n");

i18n.configure({
  locales: ["en"], // Add more locales as needed
  directory: __dirname + "/../i18n",
  defaultLocale: "en",
  cookie: "locale",
  queryParameter: "lang",
  autoReload: true,
  updateFiles: false,
  syncFiles: true,
  objectNotation: true,
  logDebugFn: function (msg) {
  
  },
  logWarnFn: function (msg) {
 
  },
  logErrorFn: function (msg) {
   
  },
});

module.exports = i18n;

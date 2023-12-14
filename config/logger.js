const winston = require('winston');
const DailyRotateFile = require('winston-daily-rotate-file');

// Create separate transports for different log levels
const errorTransport = new DailyRotateFile({
  level: 'error',
  filename: 'logs/error-%DATE%.log',
  datePattern: 'YYYY-MM-DD',
  zippedArchive: true,
  maxSize: '20m',
  maxFiles: '14d'
});

const infoTransport = new DailyRotateFile({
  level: 'info',
  filename: 'logs/info-%DATE%.log',
  datePattern: 'YYYY-MM-DD',
  zippedArchive: true,
  maxSize: '20m',
  maxFiles: '14d'
});

const debugTransport = new DailyRotateFile({
  level: 'debug',
  filename: 'logs/debug-%DATE%.log',
  datePattern: 'YYYY-MM-DD',
  zippedArchive: true,
  maxSize: '20m',
  maxFiles: '14d'
});

// Create a logger and add transports
const logger = winston.createLogger({
  transports: [
    new winston.transports.Console(),
    errorTransport,
    infoTransport,
    debugTransport
    // Add other transports for different log levels as needed
  ]
});

exports.LOGGER = logger
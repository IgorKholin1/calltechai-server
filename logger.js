// logger.js
const winston = require('winston');

const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.printf(function(info) {
      const timestamp = info.timestamp;
      const level = info.level;
      const message = info.message;
      return timestamp + ' [' + level.toUpperCase() + ']: ' + message;
    })
  ),
  transports: [new winston.transports.Console()]
});

module.exports = logger;
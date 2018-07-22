const winston = require('winston');
const {createLogger, format, transports} = require('winston');
const {combine, timestamp, label, printf, prettyPrint} = format;

const myFormat = printf(info => {
    return `${info.timestamp} ${info.level}: ${(typeof info.message === 'object') ? JSON.stringify(info.message) : info.message}`;
});

const logger = createLogger({
    format: combine(
        label(),
        timestamp(),
        myFormat
    ),
    transports: [new transports.Console(), new transports.File({filename: 'log.txt'})]
});

module.exports = logger;
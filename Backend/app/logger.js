import { createLogger, format, transports } from 'winston';

// simple console logger with timestamp and level
const logger = createLogger({
    level: process.env.LOG_LEVEL || 'info',
    format: format.combine(
        format.timestamp(),
        format.printf(({ timestamp, level, message, ...meta }) => {
            let msg = `${timestamp} [${level.toUpperCase()}] ${message}`;
            if (Object.keys(meta).length) {
                msg += ` ${JSON.stringify(meta)}`;
            }
            return msg;
        })
    ),
    transports: [new transports.Console()]
});

export default logger;

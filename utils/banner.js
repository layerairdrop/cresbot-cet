const winston = require('winston');
const chalk = require('chalk');

// Define custom log levels and colors
const logLevels = {
  levels: {
    error: 0,
    warn: 1,
    info: 2,
    http: 3,
    debug: 4,
    success: 5
  },
  colors: {
    error: 'red',
    warn: 'yellow',
    info: 'cyan',
    http: 'magenta',
    debug: 'blue',
    success: 'green'
  }
};

// Add colors to Winston
winston.addColors(logLevels.colors);

// Custom format for console output
const customFormat = winston.format.combine(
  winston.format.timestamp({
    format: 'YYYY-MM-DD HH:mm:ss'
  }),
  winston.format.printf(({ level, message, timestamp, wallet, proxy }) => {
    // Format wallet address for display (truncate if needed)
    const walletStr = wallet ? chalk.yellow(`[${wallet.substring(0, 6)}...${wallet.substring(38)}]`) : '';
    
    // Format proxy for display
    const proxyStr = proxy ? chalk.magenta(`[Proxy: ${proxy}]`) : '';
    
    // Colorize based on log level
    let colorizedMessage;
    switch (level) {
      case 'error':
        colorizedMessage = chalk.red(message);
        break;
      case 'warn':
        colorizedMessage = chalk.yellow(message);
        break;
      case 'info':
        colorizedMessage = chalk.cyan(message);
        break;
      case 'http':
        colorizedMessage = chalk.magenta(message);
        break;
      case 'debug':
        colorizedMessage = chalk.blue(message);
        break;
      case 'success':
        colorizedMessage = chalk.green(message);
        break;
      default:
        colorizedMessage = message;
    }
    
    // Combine all components
    return `${chalk.gray(`[${timestamp}]`)} ${walletStr} ${proxyStr} ${colorizedMessage}`;
  })
);

// Create the logger
const logger = winston.createLogger({
  levels: logLevels.levels,
  format: customFormat,
  transports: [
    new winston.transports.Console(),
    new winston.transports.File({ 
      filename: 'layer-airdrop.log',
      format: winston.format.combine(
        winston.format.uncolorize(),
        winston.format.timestamp(),
        winston.format.json()
      )
    })
  ]
});

module.exports = logger;

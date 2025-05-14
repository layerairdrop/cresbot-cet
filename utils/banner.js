const chalk = require('chalk');
const figlet = require('figlet');
const gradient = require('gradient-string');

/**
 * Display a colorful banner for the application
 */
function displayBanner() {
  // Create a colorful gradient
  const layerGradient = gradient(['#00c6ff', '#0072ff', '#00c6ff']);
  
  console.log('\n');
  console.log(layerGradient(figlet.textSync('LAYER AIRDROP', {
    font: 'Standard',
    horizontalLayout: 'default',
    verticalLayout: 'default'
  })));
  
  console.log(chalk.cyan('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'));
  console.log(chalk.white("The script and tutorial were written by Telegram user ") + chalk.cyan("@rmndkyl") + chalk.white(", free and open source, please do not believe in the paid version"));
  console.log(chalk.white("Node community Telegram channel: ") + chalk.cyan("https://t.me/layerairdrop"));
  console.log(chalk.white("Node community Telegram group: ") + chalk.cyan("https://t.me/layerairdropdiskusi"));
  console.log(chalk.cyan('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'));
  console.log('\n');
}

module.exports = {
  displayBanner
};
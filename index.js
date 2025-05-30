#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const inquirer = require('inquirer');
const ora = require('ora');
const chalk = require('chalk');

// Import utilities
const logger = require('./utils/logger');
const { displayBanner } = require('./utils/banner');
const { 
  readPrivateKeys, 
  readChatPrompts, 
  sleep, 
  randomDelay 
} = require('./utils/utils');
const {
  loadProxiesFromFile,
  fetchMonosansProxies,
  getWorkingProxy,
  createProxyAgent
} = require('./utils/proxy');

// Import core modules
const { processWallet } = require('./src/wallet');
const { startChatSession } = require('./src/chat');

// Import config
const config = require('./config.json');

// File paths
const PRIVATE_KEYS_PATH = path.join(__dirname, 'priv.txt');
const QUESTIONS_PATH = path.join(__dirname, 'questions.txt');
const PROXY_PATH = path.join(__dirname, 'proxy.txt');

// Global variables
let chatPrompts = [];
let proxies = [];
let proxyMode = null;

/**
 * Initialize application
 */
async function initialize() {
  displayBanner();
  
  // Check if required files exist
  if (!fs.existsSync(PRIVATE_KEYS_PATH)) {
    logger.error(`Private keys file not found: ${PRIVATE_KEYS_PATH}`);
    console.log(chalk.red(`Please create a 'priv.txt' file with your private keys (one per line) in the root directory.`));
    process.exit(1);
  }
  
  // Load chat prompts
  chatPrompts = readChatPrompts(QUESTIONS_PATH, config.chatPrompts);
  logger.info(`Loaded ${chatPrompts.length} chat prompts`);
  
  // Ask user for proxy mode
  const { mode } = await inquirer.prompt([{
    type: 'list',
    name: 'mode',
    message: 'Select proxy mode:',
    choices: [
      { name: '1. Run With Monosans Proxy (Public)', value: 'monosans' },
      { name: '2. Run With Private Proxy (proxy.txt)', value: 'private' },
      { name: '3. Run Without Proxy', value: 'none' }
    ]
  }]);
  
  proxyMode = mode;
  
  // Load proxies based on selected mode
  if (proxyMode === 'monosans') {
    const spinner = ora('Fetching public proxies from Monosans...').start();
    proxies = await fetchMonosansProxies();
    spinner.succeed(`Fetched ${proxies.length} public proxies`);
  } else if (proxyMode === 'private') {
    if (!fs.existsSync(PROXY_PATH)) {
      logger.warn(`Proxy file not found: ${PROXY_PATH}`);
      console.log(chalk.yellow(`'proxy.txt' file not found. Running without proxies.`));
      proxyMode = 'none';
    } else {
      proxies = loadProxiesFromFile(PROXY_PATH);
      logger.info(`Loaded ${proxies.length} proxies from proxy.txt`);
    }
  }
  
  if (proxyMode !== 'none' && (!proxies || proxies.length === 0)) {
    logger.warn('No working proxies found. Running without proxies.');
    proxyMode = 'none';
  }
}

/**
 * Get a proxy for the current session
 * @returns {object} Proxy agent or null if not using proxies
 */
async function getSessionProxy() {
  if (proxyMode === 'none') {
    return null;
  }
  
  const proxy = await getWorkingProxy(proxies);
  
  if (!proxy) {
    logger.warn('No working proxy found. Using direct connection.');
    return null;
  }
  
  const agent = createProxyAgent(proxy);
  
  if (agent) {
    logger.info(`Using proxy: ${proxy.formatted}`);
    return agent;
  }
  
  logger.warn('Failed to create proxy agent. Using direct connection.');
  return null;
}

/**
 * Process a single wallet
 * @param {string} privateKey - Wallet private key
 * @returns {boolean} Success or failure
 */
async function processWalletSession(privateKey) {
  // Get a proxy for this session
  const proxyAgent = await getSessionProxy();
  
  // Process wallet (authenticate and check credit)
  const walletData = await processWallet(privateKey, proxyAgent);
  
  if (!walletData) {
    return false;
  }
  
  const { wallet, authData, creditData } = walletData;
  
  // Check if wallet has enough credits
  // Wallet has enough credits if totalAvailableCredits >= minCreditBalance
  // (Make sure to check free credits too)
  if (creditData.totalAvailableCredits < config.minCreditBalance) {
    logger.warn(`Insufficient credits for wallet ${wallet.address}. Total available: ${creditData.totalAvailableCredits.toFixed(4)} (Balance: ${creditData.creditBalance.toFixed(4)}, Free: ${creditData.freeCredits.toFixed(4)}). Skipping.`, { wallet: wallet.address });
    return false;
  }
  
  // Log the credit information
  logger.info(`Wallet ${wallet.address} has sufficient credits. Total available: ${creditData.totalAvailableCredits.toFixed(4)} (Balance: ${creditData.creditBalance.toFixed(4)}, Free: ${creditData.freeCredits.toFixed(4)})`, { wallet: wallet.address });
  
  // Start chat session
  logger.info(`Starting chat session for wallet ${wallet.address}`, { wallet: wallet.address });
  const success = await startChatSession(authData, chatPrompts, proxyAgent);
  
  if (success) {
    logger.success(`Successfully completed chat session for wallet ${wallet.address}`, { wallet: wallet.address });
    return true;
  } else {
    logger.error(`Failed to complete chat session for wallet ${wallet.address}`, { wallet: wallet.address });
    return false;
  }
}

/**
 * Main application function
 */
async function main() {
  try {
    await initialize();
    
    // Load private keys
    const privateKeys = readPrivateKeys(PRIVATE_KEYS_PATH);
    logger.info(`Loaded ${privateKeys.length} private keys`);
    
    // Process each wallet
    let successCount = 0;
    let failCount = 0;
    
    for (let i = 0; i < privateKeys.length; i++) {
      const privateKey = privateKeys[i];
      console.log(chalk.cyan(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`));
      logger.info(`Processing wallet ${i + 1}/${privateKeys.length}`);
      
      const success = await processWalletSession(privateKey);
      
      if (success) {
        successCount++;
      } else {
        failCount++;
      }
      
      // Add delay between wallets
      if (i < privateKeys.length - 1) {
        const delay = randomDelay(
          config.chatSession.sessionDelay.min, 
          config.chatSession.sessionDelay.max
        );
        logger.info(`Waiting ${Math.round(delay / 1000)} seconds before next wallet...`);
        await sleep(delay);
      }
    }
    
    // Summary
    console.log(chalk.cyan(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`));
    logger.info(`Completed processing ${privateKeys.length} wallets.`);
    logger.success(`Success: ${successCount} wallets`);
    
    if (failCount > 0) {
      logger.warn(`Failed: ${failCount} wallets`);
    }
    
    console.log(chalk.cyan(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`));
  } catch (error) {
    logger.error(`Fatal error: ${error.message}`);
    process.exit(1);
  }
}

// Run the application
main();

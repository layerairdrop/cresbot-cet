const ethers = require('ethers');
const logger = require('../utils/logger');
const { authenticate } = require('./auth');
const { createAxiosInstance, checkCredit } = require('./api');
const { formatWalletAddress } = require('../utils/utils');

/**
 * Initialize wallet from private key
 * @param {string} privateKey - Private key for wallet
 * @returns {object} Wallet object or null if invalid
 */
function initWallet(privateKey) {
  try {
    // Validate and format private key if needed
    if (!privateKey.startsWith('0x')) {
      privateKey = `0x${privateKey}`;
    }
    
    const wallet = new ethers.Wallet(privateKey);
    return {
      address: wallet.address,
      privateKey
    };
  } catch (error) {
    logger.error(`Failed to initialize wallet: ${error.message}`);
    return null;
  }
}

/**
 * Check wallet credit balance
 * @param {object} authData - Authentication data
 * @param {object} proxyAgent - Proxy agent to use
 * @returns {object} Credit data or null if failed
 */
async function checkWalletCredit(authData, proxyAgent = null) {
  try {
    const { accessToken, walletAddress } = authData;
    
    // Create axios instance with authentication
    const api = createAxiosInstance(proxyAgent, accessToken, authData.userAgent);
    
    // Check credit balance
    const creditData = await checkCredit(api);
    
    if (!creditData) {
      logger.error(`Failed to get credit data for ${walletAddress}`, { wallet: walletAddress });
      return null;
    }
    
    const creditBalance = parseFloat(creditData.credits || 0);
    const freeCredits = parseFloat(creditData.free_credits || 0);
    const totalAvailableCredits = creditBalance + freeCredits;
    
    logger.info(`Credit balance for ${formatWalletAddress(walletAddress)}: ${creditBalance.toFixed(4)} (Free: ${freeCredits.toFixed(4)}, Total Available: ${totalAvailableCredits.toFixed(4)})`, { wallet: walletAddress });
    
    return {
      creditBalance,
      freeCredits,
      totalAvailableCredits,
      rawData: creditData
    };
  } catch (error) {
    logger.error(`Error checking wallet credit: ${error.message}`);
    return null;
  }
}

/**
 * Process wallet (authenticate and check credit)
 * @param {string} privateKey - Wallet private key
 * @param {object} proxyAgent - Proxy agent to use
 * @returns {object} Processed wallet data or null if failed
 */
async function processWallet(privateKey, proxyAgent = null) {
  try {
    // Initialize wallet
    const wallet = initWallet(privateKey);
    
    if (!wallet) {
      logger.error(`Invalid private key`);
      return null;
    }
    
    logger.info(`Processing wallet ${formatWalletAddress(wallet.address)}`, { wallet: wallet.address });
    
    // Authenticate
    const authData = await authenticate(privateKey, proxyAgent);
    
    if (!authData) {
      logger.error(`Authentication failed for ${formatWalletAddress(wallet.address)}`, { wallet: wallet.address });
      return null;
    }
    
    // Check credit
    const creditData = await checkWalletCredit(authData, proxyAgent);
    
    if (!creditData) {
      logger.error(`Failed to check credit for ${formatWalletAddress(wallet.address)}`, { wallet: wallet.address });
      return null;
    }
    
    return {
      wallet,
      authData,
      creditData
    };
  } catch (error) {
    logger.error(`Error processing wallet: ${error.message}`);
    return null;
  }
}

module.exports = {
  initWallet,
  checkWalletCredit,
  processWallet
};
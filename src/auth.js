const axios = require('axios');
const ethers = require('ethers');
const logger = require('../utils/logger');
const { sleep, randomDelay, withRetry, getRandomUserAgent } = require('../utils/utils');
const config = require('../config.json');

/**
 * Generate authentication signature
 * @param {string} privateKey - Wallet private key
 * @param {object} messageData - Message data to sign
 * @returns {string} Signature
 */
function generateSignature(privateKey, messageData) {
  try {
    const wallet = new ethers.Wallet(privateKey);
    const message = ethers.utils.toUtf8Bytes(messageData.message);
    const messageHash = ethers.utils.keccak256(message);
    const signature = wallet.signMessage(message);
    return signature;
  } catch (error) {
    logger.error(`Failed to generate signature: ${error.message}`);
    return null;
  }
}

/**
 * Initialize SIWE (Sign-In with Ethereum)
 * @param {string} walletAddress - Wallet address
 * @param {object} proxyAgent - Proxy agent to use
 * @param {string} userAgent - User agent to use (random if not provided)
 * @returns {object} Nonce and other SIWE data or null if failed
 */
async function initSIWE(walletAddress, proxyAgent = null, userAgent = null) {
  try {
    // Use provided user agent or get a random one
    const ua = userAgent || getRandomUserAgent();
    logger.debug(`Using User-Agent for SIWE init: ${ua.substring(0, 50)}...`);
    
    const headers = {
      'Accept': 'application/json',
      'Content-Type': 'application/json',
      'Origin': 'https://nation.fun',
      'Referer': 'https://nation.fun/',
      'User-Agent': ua,
      'privy-app-id': 'cm4v61vl108sdivml83sbeykh'
    };
    
    const payload = { address: walletAddress };
    
    // Use retry logic for SIWE initialization
    const response = await withRetry(async () => {
      return await axios.post('https://auth.privy.io/api/v1/siwe/init', payload, {
        headers,
        httpAgent: proxyAgent,
        httpsAgent: proxyAgent
      });
    }, 3, 5000, 60000); // 3 retries, starting with 5s delay, max 60s delay
    
    return response.data;
  } catch (error) {
    logger.error(`Failed to initialize SIWE: ${error.message}`);
    return null;
  }
}

/**
 * Authenticate with SIWE
 * @param {string} message - SIWE message
 * @param {string} signature - Message signature
 * @param {string} chainId - Chain ID (e.g., "eip155:8453")
 * @param {object} proxyAgent - Proxy agent to use
 * @param {string} userAgent - User agent to use (random if not provided)
 * @returns {object} Authentication data or null if failed
 */
async function authenticateSIWE(message, signature, chainId, proxyAgent = null, userAgent = null) {
  try {
    // Use provided user agent or get a random one
    const ua = userAgent || getRandomUserAgent();
    logger.debug(`Using User-Agent for SIWE auth: ${ua.substring(0, 50)}...`);
    
    const headers = {
      'Accept': 'application/json',
      'Content-Type': 'application/json',
      'Origin': 'https://nation.fun',
      'Referer': 'https://nation.fun/',
      'User-Agent': ua,
      'privy-app-id': 'cm4v61vl108sdivml83sbeykh'
    };
    
    const payload = {
      message,
      signature,
      chainId,
      walletClientType: 'metamask',
      connectorType: 'injected',
      mode: 'login-or-sign-up'
    };
    
    // Use retry logic for SIWE authentication
    const response = await withRetry(async () => {
      return await axios.post('https://auth.privy.io/api/v1/siwe/authenticate', payload, {
        headers,
        httpAgent: proxyAgent,
        httpsAgent: proxyAgent
      });
    }, 3, 5000, 60000); // 3 retries, starting with 5s delay, max 60s delay
    
    return response.data;
  } catch (error) {
    logger.error(`Failed to authenticate with SIWE: ${error.message}`);
    return null;
  }
}

/**
 * Login to the API
 * @param {string} privyToken - Privy token from SIWE authentication
 * @param {string} walletAddress - Wallet address
 * @param {object} proxyAgent - Proxy agent to use
 * @param {string} userAgent - User agent to use (random if not provided)
 * @returns {object} Login data or null if failed
 */
async function login(privyToken, walletAddress, proxyAgent = null, userAgent = null) {
  try {
    // Use provided user agent or get a random one
    const ua = userAgent || getRandomUserAgent();
    logger.debug(`Using User-Agent for login: ${ua.substring(0, 50)}...`);
    
    const headers = {
      'Accept': 'application/json, text/plain, */*',
      'Content-Type': 'application/json',
      'Origin': 'https://nation.fun',
      'Referer': 'https://nation.fun/',
      'User-Agent': ua
    };
    
    const payload = {
      privy_token: privyToken,
      user_address: walletAddress
    };
    
    // Use retry logic for login, but handle 404 differently
    try {
      const response = await withRetry(async () => {
        const res = await axios.post('https://api.service.crestal.network/v1/login?is_privy=true', payload, {
          headers,
          httpAgent: proxyAgent,
          httpsAgent: proxyAgent
        });
        return res;
      }, 3, 5000, 60000); // 3 retries, starting with 5s delay, max 60s delay
      
      return response.data;
    } catch (error) {
      // If we get a 404, it likely means this wallet hasn't been registered with the platform
      // or the privy token is invalid
      if (error.response && error.response.status === 404) {
        logger.error(`Wallet ${walletAddress} login returned 404 - This wallet may not be registered with Layer Airdrop`, { wallet: walletAddress });
        return null;
      }
      
      // For other errors, just propagate them
      throw error;
    }
  } catch (error) {
    logger.error(`Failed to login: ${error.message}`);
    return null;
  }
}

/**
 * Link accounts
 * @param {string} walletAddress - Wallet address
 * @param {array} accounts - Account data to link
 * @param {string} privyToken - Privy token
 * @param {object} axiosInstance - Configured axios instance
 * @returns {array} Linked accounts or empty array if failed
 */
async function linkAccounts(walletAddress, accounts, privyToken, axiosInstance) {
  try {
    const payload = {
      user_address: walletAddress,
      accounts,
      privy_token: privyToken
    };
    
    const response = await axiosInstance.post('/v1/users/accounts/link', payload);
    return response.data;
  } catch (error) {
    logger.error(`Failed to link accounts: ${error.message}`);
    return [];
  }
}

/**
 * Perform full authentication flow
 * @param {string} privateKey - Wallet private key
 * @param {object} proxyAgent - Proxy agent to use
 * @returns {object} Authentication result (token, wallet, etc.) or null if failed
 */
async function authenticate(privateKey, proxyAgent = null) {
  try {
    // Create wallet from private key
    const wallet = new ethers.Wallet(privateKey);
    const walletAddress = wallet.address;
    
    logger.info(`Starting authentication for wallet ${walletAddress}`, { wallet: walletAddress });
    
    // Get a random user agent to use throughout the authentication flow
    const userAgent = getRandomUserAgent();
    logger.debug(`Selected User-Agent for wallet ${walletAddress}: ${userAgent.substring(0, 30)}...`, { wallet: walletAddress });
    
    // Make multiple attempts at the SIWE process with different user agents if needed
    let authSuccess = false;
    let authData = null;
    let attemptCount = 0;
    const maxAttempts = 2; // Try up to 2 different user agents
    
    while (!authSuccess && attemptCount < maxAttempts) {
      attemptCount++;
      
      // If this is not the first attempt, get a new user agent
      const currentUserAgent = attemptCount === 1 ? userAgent : getRandomUserAgent();
      if (attemptCount > 1) {
        logger.info(`Retrying authentication with new User-Agent for wallet ${walletAddress}`, { wallet: walletAddress });
      }
      
      try {
        // Step 1: Initialize SIWE
        const siweData = await initSIWE(walletAddress, proxyAgent, currentUserAgent);
        if (!siweData) {
          logger.error(`SIWE initialization failed for ${walletAddress}`, { wallet: walletAddress });
          continue; // Try next attempt
        }
        
        // Prepare SIWE message
        const message = `nation.fun wants you to sign in with your Ethereum account:
${walletAddress}

By signing, you are proving you own this wallet and logging in. This does not initiate a transaction or cost any fees.

URI: https://nation.fun
Version: 1
Chain ID: 8453
Nonce: ${siweData.nonce}
Issued At: ${new Date().toISOString()}
Resources:
- https://privy.io`;

        // Step 2: Sign the message
        const signature = await wallet.signMessage(message);
        if (!signature) {
          logger.error(`Failed to sign SIWE message for ${walletAddress}`, { wallet: walletAddress });
          continue; // Try next attempt
        }
        
        // Step 3: Authenticate with SIWE
        const siweAuthData = await authenticateSIWE(message, signature, 'eip155:8453', proxyAgent, currentUserAgent);
        if (!siweAuthData || !siweAuthData.token) {
          logger.error(`SIWE authentication failed for ${walletAddress}`, { wallet: walletAddress });
          continue; // Try next attempt
        }
        
        // Step 4: Login to API
        const loginData = await login(siweAuthData.token, walletAddress, proxyAgent, currentUserAgent);
        if (!loginData || !loginData.access_token) {
          logger.error(`API login failed for ${walletAddress}`, { wallet: walletAddress });
          
          // If we got a 404, this wallet might not be registered, skip retries
          if (loginData === null) {
            break;
          }
          
          continue; // Try next attempt
        }
        
        // Store successful auth data
        authData = {
          accessToken: loginData.access_token,
          refreshToken: loginData.refresh_token,
          walletAddress,
          privyToken: siweAuthData.token,
          userAgent: currentUserAgent
        };
        
        authSuccess = true;
        break; // Exit the retry loop
      } catch (error) {
        logger.error(`Authentication attempt ${attemptCount} failed for ${walletAddress}: ${error.message}`, { wallet: walletAddress });
      }
      
      // Add a delay before trying the next user agent
      if (!authSuccess && attemptCount < maxAttempts) {
        const retryDelay = 5000 + Math.random() * 5000; // 5-10 seconds
        logger.info(`Waiting ${Math.round(retryDelay / 1000)}s before next authentication attempt...`, { wallet: walletAddress });
        await sleep(retryDelay);
      }
    }
    
    if (authSuccess) {
      logger.success(`Authentication successful for wallet ${walletAddress}`, { wallet: walletAddress });
      return authData;
    } else {
      logger.error(`All authentication attempts failed for ${walletAddress}`, { wallet: walletAddress });
      return null;
    }
  } catch (error) {
    logger.error(`Authentication failed: ${error.message}`);
    return null;
  }
}

module.exports = {
  authenticate,
  linkAccounts
};

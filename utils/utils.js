const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const logger = require('./logger');
const userAgents = require('./userAgents');

/**
 * Get a random user agent from the list
 * @returns {string} Random user agent
 */
function getRandomUserAgent() {
  return userAgents[Math.floor(Math.random() * userAgents.length)];
}

/**
 * Read file content from disk
 * @param {string} filePath - Path to the file
 * @returns {string|null} File content or null if not found
 */
function readFile(filePath) {
  try {
    if (!fs.existsSync(filePath)) {
      logger.warn(`File not found: ${filePath}`);
      return null;
    }
    
    return fs.readFileSync(filePath, 'utf-8');
  } catch (error) {
    logger.error(`Error reading file ${filePath}: ${error.message}`);
    return null;
  }
}

/**
 * Write content to file
 * @param {string} filePath - Path to the file
 * @param {string} content - Content to write
 * @returns {boolean} Success or failure
 */
function writeFile(filePath, content) {
  try {
    // Make sure the directory exists
    const dirPath = path.dirname(filePath);
    if (!fs.existsSync(dirPath)) {
      fs.mkdirSync(dirPath, { recursive: true });
    }
    
    fs.writeFileSync(filePath, content, 'utf-8');
    return true;
  } catch (error) {
    logger.error(`Error writing to file ${filePath}: ${error.message}`);
    return false;
  }
}

/**
 * Read private keys from file
 * @param {string} filePath - Path to the private keys file
 * @returns {array} Array of private keys
 */
function readPrivateKeys(filePath) {
  const content = readFile(filePath);
  if (!content) return [];
  
  return content
    .split('\n')
    .map(line => line.trim())
    .filter(line => line !== '' && !line.startsWith('#'));
}

/**
 * Read chat prompts from file or config
 * @param {string} filePath - Path to custom prompts file
 * @param {array} defaultPrompts - Default prompts from config
 * @returns {array} Array of prompts
 */
function readChatPrompts(filePath, defaultPrompts) {
  // Try to read from file first
  const content = readFile(filePath);
  
  if (content) {
    const filePrompts = content
      .split('\n')
      .map(line => line.trim())
      .filter(line => line !== '' && !line.startsWith('#'));
      
    if (filePrompts.length > 0) {
      return filePrompts;
    }
  }
  
  // Fall back to default prompts from config
  return defaultPrompts;
}

/**
 * Generate a random delay between min and max
 * @param {number} min - Minimum delay in milliseconds
 * @param {number} max - Maximum delay in milliseconds
 * @returns {number} Random delay duration
 */
function randomDelay(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

/**
 * Sleep for specified duration
 * @param {number} ms - Duration in milliseconds
 * @returns {Promise} Promise that resolves after the delay
 */
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Execute a function with retry logic
 * @param {Function} fn - Function to execute
 * @param {number} [maxRetries=3] - Maximum number of retries
 * @param {number} [baseDelay=2000] - Base delay in ms between retries
 * @param {number} [maxDelay=30000] - Maximum delay in ms between retries
 * @returns {Promise<*>} Result of the function
 */
async function withRetry(fn, maxRetries = 3, baseDelay = 2000, maxDelay = 30000) {
  let retries = 0;
  
  while (true) {
    try {
      return await fn();
    } catch (error) {
      // If we've reached max retries or this isn't a retryable error, throw
      if (retries >= maxRetries || 
         (error.response && error.response.status !== 429 && error.response.status !== 503)) {
        throw error;
      }
      
      // Calculate delay with exponential backoff and jitter
      const delay = Math.min(
        maxDelay,
        baseDelay * Math.pow(2, retries) * (0.8 + Math.random() * 0.4)
      );
      
      logger.warn(`Request failed with ${error.message}. Retrying in ${Math.round(delay / 1000)}s (${retries + 1}/${maxRetries})...`);
      
      await sleep(delay);
      retries++;
    }
  }
}

/**
 * Get a random item from an array
 * @param {array} arr - Source array
 * @param {number} [index] - Optional specific index to use
 * @returns {*} Random item from array or item at specified index
 */
function getRandomItem(arr, index) {
  if (index !== undefined && index >= 0 && index < arr.length) {
    return arr[index];
  }
  return arr[Math.floor(Math.random() * arr.length)];
}

/**
 * Generate a unique chat ID
 * @param {string} walletAddress - Wallet address
 * @returns {string} Unique chat ID
 */
function generateChatId(walletAddress) {
  const timestamp = Math.floor(Date.now() / 1000);
  return `${walletAddress}-${timestamp}`;
}

/**
 * Format wallet address for display (truncate and add ellipsis)
 * @param {string} address - Full wallet address
 * @returns {string} Formatted address for display
 */
function formatWalletAddress(address) {
  if (!address || address.length < 10) return address;
  return `${address.substring(0, 6)}...${address.substring(address.length - 4)}`;
}

module.exports = {
  readFile,
  writeFile,
  readPrivateKeys,
  readChatPrompts,
  randomDelay,
  sleep,
  withRetry,
  getRandomItem,
  generateChatId,
  formatWalletAddress,
  getRandomUserAgent
};

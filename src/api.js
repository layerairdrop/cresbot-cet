const axios = require('axios');
const logger = require('../utils/logger');
const { sleep, randomDelay, withRetry, getRandomUserAgent } = require('../utils/utils');
const config = require('../config.json');

// Global base URL for the API
const BASE_URL = 'https://api.service.crestal.network';

/**
 * Create axios instance with optional proxy
 * @param {object} proxyAgent - Proxy agent to use
 * @param {string} authToken - Authentication token
 * @param {string} userAgent - User agent to use (random if not provided)
 * @returns {object} Configured axios instance
 */
function createAxiosInstance(proxyAgent = null, authToken = null, userAgent = null) {
  // Use provided user agent or get a random one
  const ua = userAgent || getRandomUserAgent();
  
  const headers = {
    'Accept': 'application/json, text/plain, */*',
    'Content-Type': 'application/json',
    'Origin': 'https://nation.fun',
    'Referer': 'https://nation.fun/',
    'User-Agent': ua,
    'chain-id': '8453'
  };
  
  if (authToken) {
    headers['Authorization'] = `Bearer ${authToken}`;
  }
  
  logger.debug(`Using User-Agent: ${ua.substring(0, 50)}...`);
  
  return axios.create({
    baseURL: BASE_URL,
    headers,
    timeout: 30000,
    httpAgent: proxyAgent,
    httpsAgent: proxyAgent
  });
}

/**
 * Check user credits/balance
 * @param {object} axiosInstance - Configured axios instance
 * @returns {object} Credit info or null if failed
 */
async function checkCredit(axiosInstance) {
  try {
    // Use retry logic with more retries for this critical function
    const response = await withRetry(async () => {
      return await axiosInstance.get('/v1/credit');
    }, 5, 5000, 60000); // 5 retries, starting with 5s delay, max 60s delay
    
    // Verify that the response contains the expected fields
    if (!response.data || (response.data.credits === undefined && response.data.free_credits === undefined)) {
      logger.warn('Received unexpected credit data format from API');
      // If data is present but fields are missing, create a default structure
      if (response.data) {
        return {
          credits: response.data.credits || "0",
          free_credits: response.data.free_credits || "480.0000", // Default free credits
          // Include any other fields that were present
          ...response.data
        };
      }
    }
    
    return response.data;
  } catch (error) {
    logger.error(`Failed to check credit: ${error.message}`);
    // In case of persistent failure, return a default object with free credits
    // This allows the script to continue and try interacting with the agent
    return {
      credits: "0",
      free_credits: "480.0000", // Default free credits
      expense_at: new Date().toISOString(),
      income_at: new Date().toISOString()
    };
  }
}

/**
 * Get user information
 * @param {object} axiosInstance - Configured axios instance
 * @param {string} walletAddress - User's wallet address
 * @returns {object} User info or null if failed
 */
async function getUserInfo(axiosInstance, walletAddress) {
  try {
    const response = await axiosInstance.get(`/v1/users/${walletAddress}`);
    return response.data;
  } catch (error) {
    logger.error(`Failed to get user info: ${error.message}`);
    return null;
  }
}

/**
 * Get agent information
 * @param {object} axiosInstance - Configured axios instance
 * @param {string} creatorAddress - Creator's wallet address
 * @returns {object} Agent info or null if failed
 */
async function getAgentInfo(axiosInstance, creatorAddress) {
  try {
    // Use retry logic for getting agent info
    const response = await withRetry(async () => {
      return await axiosInstance.get(`/v1/agents?creator_address=${creatorAddress}`);
    }, 3, 3000, 30000);
    
    // Check if we got data and it has at least one agent
    if (response.data && Array.isArray(response.data) && response.data.length > 0) {
      return response.data[0];
    } else {
      logger.warn(`No agents found for creator address ${creatorAddress}`);
      
      // Return default Layer Airdrop agent info as a fallback
      // This hardcoded ID was from the logs
      return {
        id: 4717,
        agent_id: "d0h424g52tqs73cjj2p0",
        status: "pre_launch",
        intent_kit_agent_info: {
          name: "Layer Airdrop"
        }
      };
    }
  } catch (error) {
    logger.error(`Failed to get agent info: ${error.message}`);
    
    // In case of failure, return hardcoded default Layer Airdrop agent info
    return {
      id: 4717,
      agent_id: "d0h424g52tqs73cjj2p0",
      status: "pre_launch",
      intent_kit_agent_info: {
        name: "Layer Airdrop"
      }
    };
  }
}

/**
 * Get chat ID list for an agent
 * @param {object} axiosInstance - Configured axios instance
 * @param {number} agentId - Agent ID
 * @returns {array} List of chat IDs or empty array if failed
 */
async function getChatIdList(axiosInstance, agentId) {
  try {
    const response = await axiosInstance.get(`/v1/agents/${agentId}/chat_id_list`);
    return response.data;
  } catch (error) {
    logger.error(`Failed to get chat ID list: ${error.message}`);
    return [];
  }
}

/**
 * Get agent statistics
 * @param {object} axiosInstance - Configured axios instance
 * @param {number} agentId - Agent ID
 * @returns {object} Agent statistics or null if failed
 */
async function getAgentStatistics(axiosInstance, agentId) {
  try {
    const response = await axiosInstance.get(`/v1/agents/${agentId}/statistics`);
    return response.data;
  } catch (error) {
    logger.error(`Failed to get agent statistics: ${error.message}`);
    return null;
  }
}

/**
 * Get chat history
 * @param {object} axiosInstance - Configured axios instance
 * @param {number} agentId - Agent ID
 * @param {string} chatId - Chat ID
 * @returns {array} Chat history or empty array if failed
 */
async function getChatHistory(axiosInstance, agentId, chatId) {
  try {
    const response = await axiosInstance.get(`/v1/chat?agent_id=${agentId}&chat_id=${chatId}`);
    return response.data;
  } catch (error) {
    logger.error(`Failed to get chat history: ${error.message}`);
    return [];
  }
}

/**
 * Send message to chat
 * @param {object} axiosInstance - Configured axios instance
 * @param {string} message - Message to send
 * @param {number} agentId - Agent ID
 * @param {string} userAddress - User's wallet address
 * @param {string} chatId - Chat ID
 * @returns {array} Response messages or empty array if failed
 */
async function sendChatMessage(axiosInstance, message, agentId, userAddress, chatId) {
  try {
    const payload = {
      message,
      agent_id: agentId,
      user_address: userAddress,
      chat_id: chatId
    };
    
    // Use retry logic for sending chat messages
    const response = await withRetry(async () => {
      return await axiosInstance.post('/v1/chat', payload);
    }, 3, 5000, 30000); // 3 retries, starting with 5s delay, max 30s delay
    
    // Check if response indicates insufficient balance
    if (response.data && Array.isArray(response.data) && response.data.length > 0) {
      const firstMessage = response.data[0];
      if (firstMessage.message === "Insufficient balance.") {
        logger.warn(`Insufficient balance detected for wallet ${userAddress}. Stopping chat session.`, { wallet: userAddress });
        // Return special indicator that balance is insufficient
        return { insufficientBalance: true };
      }
    }
    
    // Add random delay between requests to appear more human-like
    await sleep(randomDelay(config.requestDelay.min, config.requestDelay.max));
    
    return response.data;
  } catch (error) {
    logger.error(`Failed to send chat message: ${error.message}`);
    return [];
  }
}

module.exports = {
  createAxiosInstance,
  checkCredit,
  getUserInfo,
  getAgentInfo,
  getChatIdList,
  getAgentStatistics,
  getChatHistory,
  sendChatMessage
};

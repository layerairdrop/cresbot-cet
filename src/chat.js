const logger = require('../utils/logger');
const { generateChatId, getRandomItem, sleep, randomDelay } = require('../utils/utils');
const { 
  createAxiosInstance, 
  getAgentInfo, 
  sendChatMessage, 
  getChatHistory 
} = require('./api');
const config = require('../config.json');

/**
 * Start a new chat session
 * @param {object} authData - Authentication data
 * @param {array} chatPrompts - Array of chat prompts to use
 * @param {object} proxyAgent - Proxy agent to use
 * @returns {boolean} Success or failure
 */
async function startChatSession(authData, chatPrompts, proxyAgent = null) {
  try {
    const { accessToken, walletAddress } = authData;
    
    // Create axios instance with authentication
    const api = createAxiosInstance(proxyAgent, accessToken, authData.userAgent);
    
    // Get Layer Airdrop agent info
    logger.info(`Getting agent info for wallet ${walletAddress}`, { wallet: walletAddress });
    const agent = await getAgentInfo(api, "0x9E89C1B5AeD05632C29e89E5e4EbB1E96BbE5Bfc");
    
    if (!agent || !agent.id) {
      logger.error(`Failed to get agent info`, { wallet: walletAddress });
      return false;
    }
    
    const agentId = agent.id;
    logger.success(`Found Layer Airdrop agent with ID: ${agentId}`, { wallet: walletAddress });
    
    // Generate a unique chat ID
    const chatId = generateChatId(walletAddress);
    logger.info(`Starting new chat session with ID: ${chatId}`, { wallet: walletAddress });
    
    // Track already used prompts to avoid repetition
    const usedPromptIndices = new Set();
    
    // Use a random prompt from the list as our initial greeting
    const initialPromptIndex = Math.floor(Math.random() * chatPrompts.length);
    usedPromptIndices.add(initialPromptIndex);
    const initialPrompt = getRandomItem(chatPrompts, initialPromptIndex);
    logger.info(`Sending initial message: "${initialPrompt}"`, { wallet: walletAddress });
    
    const initialResponse = await sendChatMessage(api, initialPrompt, agentId, walletAddress, chatId);
    
    if (!initialResponse || initialResponse.length === 0) {
      logger.error(`Failed to get initial response`, { wallet: walletAddress });
      return false;
    }
    
    logger.success(`Received initial response from Layer Airdrop`, { wallet: walletAddress });
    
    // Get chat history to verify
    let chatHistory;
    try {
      chatHistory = await getChatHistory(api, agentId, chatId);
    } catch (error) {
      logger.warn(`Failed to get chat history: ${error.message}`, { wallet: walletAddress });
      // Continue anyway, assuming the chat was created successfully
      chatHistory = [];
    }
    
    // We don't need to check chatHistory length here; proceed with sending messages
    
    // Start conversation with random prompts based on config settings
    const { min, max } = config.chatSession.messageCount;
    // Subtract 1 from min and max since we've already sent the first message
    const promptCount = Math.floor(Math.random() * (max - min + 1)) + min - 1; 
    
    logger.info(`Will send ${promptCount} more messages in this chat session`, { wallet: walletAddress });
    
    for (let i = 0; i < promptCount; i++) {
      // Get a random prompt (ensuring no repetition if possible)
      let promptIndex;
      let attempts = 0;
      
      do {
        promptIndex = Math.floor(Math.random() * chatPrompts.length);
        attempts++;
        // Prevent infinite loop if we have more messages than available prompts
        if (attempts > chatPrompts.length) {
          // Reset used prompts if we've used all available ones
          usedPromptIndices.clear();
          // Keep the initial prompt in the used set to avoid repeating it
          usedPromptIndices.add(initialPromptIndex);
        }
      } while (usedPromptIndices.has(promptIndex) && attempts <= chatPrompts.length);
      
      usedPromptIndices.add(promptIndex);
      const prompt = chatPrompts[promptIndex];
      
      // Add natural delay between messages (using typing delay config)
      const messageDelay = randomDelay(
        config.chatSession.typingDelay.min, 
        config.chatSession.typingDelay.max
      );
      await sleep(messageDelay);
      
      logger.info(`Sending message ${i+1}/${promptCount}: "${prompt}"`, { wallet: walletAddress });
      
      const response = await sendChatMessage(api, prompt, agentId, walletAddress, chatId);
      
      if (!response || response.length === 0) {
        logger.warn(`No response received for message ${i+1}`, { wallet: walletAddress });
        continue;
      }
      
      logger.success(`Received response for message ${i+1}`, { wallet: walletAddress });
      
      // Add a small random pause to simulate reading the response
      const readingDelay = randomDelay(2000, 8000);
      await sleep(readingDelay);
    }
    
    logger.success(`Chat session completed successfully with ${promptCount + 1} messages`, { wallet: walletAddress });
    return true;
  } catch (error) {
    logger.error(`Error in chat session: ${error.message}`);
    return false;
  }
}

module.exports = {
  startChatSession
};

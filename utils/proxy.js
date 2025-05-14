const axios = require('axios');
const { HttpsProxyAgent } = require('https-proxy-agent');
const { SocksProxyAgent } = require('socks-proxy-agent');
const fs = require('fs');
const path = require('path');
const logger = require('./logger');
const config = require('../config.json');

/**
 * Parse proxy string into usable format
 * @param {string} proxyString - Proxy string in various formats
 * @returns {object} Parsed proxy object with protocol, host, port, etc.
 */
function parseProxy(proxyString) {
  // Default protocol is http if not specified
  if (!proxyString.includes('://')) {
    proxyString = `http://${proxyString}`;
  }
  
  try {
    const url = new URL(proxyString);
    
    return {
      protocol: url.protocol.replace(':', ''),
      host: url.hostname,
      port: url.port,
      auth: url.username && url.password ? {
        username: url.username,
        password: url.password
      } : undefined,
      formatted: proxyString
    };
  } catch (error) {
    logger.error(`Failed to parse proxy: ${proxyString}`, { error: error.message });
    return null;
  }
}

/**
 * Create appropriate proxy agent based on protocol
 * @param {object} proxy - Parsed proxy object
 * @returns {object} Proxy agent
 */
function createProxyAgent(proxy) {
  if (!proxy) return null;
  
  try {
    // Format proxy URL for agent
    let proxyUrl;
    
    if (proxy.auth) {
      proxyUrl = `${proxy.protocol}://${proxy.auth.username}:${proxy.auth.password}@${proxy.host}:${proxy.port}`;
    } else {
      proxyUrl = `${proxy.protocol}://${proxy.host}:${proxy.port}`;
    }
    
    // Create the appropriate agent based on protocol
    if (proxy.protocol.startsWith('socks')) {
      return new SocksProxyAgent(proxyUrl);
    } else {
      return new HttpsProxyAgent(proxyUrl);
    }
  } catch (error) {
    logger.error(`Failed to create proxy agent: ${error.message}`);
    return null;
  }
}

/**
 * Load proxies from a file
 * @param {string} filePath - Path to the proxy file
 * @returns {array} Array of parsed proxy objects
 */
function loadProxiesFromFile(filePath) {
  try {
    if (!fs.existsSync(filePath)) {
      logger.warn(`Proxy file not found: ${filePath}`);
      return [];
    }
    
    const content = fs.readFileSync(filePath, 'utf-8');
    const lines = content.split('\n').filter(line => 
      line.trim() !== '' && !line.startsWith('#')
    );
    
    const proxies = lines.map(line => parseProxy(line.trim()));
    return proxies.filter(proxy => proxy !== null);
  } catch (error) {
    logger.error(`Error loading proxies: ${error.message}`);
    return [];
  }
}

/**
 * Fetch public proxies from Monosans repository
 * @returns {array} Array of parsed proxy objects
 */
async function fetchMonosansProxies() {
  try {
    const response = await axios.get('https://raw.githubusercontent.com/monosans/proxy-list/main/proxies/all.txt');
    const lines = response.data.split('\n').filter(line => 
      line.trim() !== '' && !line.startsWith('#')
    );
    
    const proxies = lines.map(line => parseProxy(line.trim()));
    return proxies.filter(proxy => proxy !== null);
  } catch (error) {
    logger.error(`Error fetching Monosans proxies: ${error.message}`);
    return [];
  }
}

/**
 * Check if a proxy is working by making a test request
 * @param {object} proxy - Parsed proxy object
 * @returns {boolean} Whether the proxy is working
 */
async function isProxyWorking(proxy) {
  if (!proxy) return false;
  
  const agent = createProxyAgent(proxy);
  if (!agent) return false;
  
  try {
    // Try one of the IP check services randomly
    const service = config.ipCheckServices[Math.floor(Math.random() * config.ipCheckServices.length)];
    
    const response = await axios.get(service, {
      httpAgent: agent,
      httpsAgent: agent,
      timeout: 10000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
      }
    });
    
    // Check if we got a valid response
    if (response.status === 200) {
      let ip;
      
      if (typeof response.data === 'string') {
        ip = response.data.trim();
      } else if (response.data && response.data.ip) {
        ip = response.data.ip;
      }
      
      if (ip) {
        logger.debug(`Proxy ${proxy.formatted} is working. IP: ${ip}`);
        return true;
      }
    }
    
    return false;
  } catch (error) {
    logger.debug(`Proxy ${proxy.formatted} is not working: ${error.message}`);
    return false;
  }
}

/**
 * Get a working proxy from the list, testing if necessary
 * @param {array} proxies - Array of parsed proxy objects
 * @returns {object} Working proxy object or null if none work
 */
async function getWorkingProxy(proxies) {
  if (!proxies || proxies.length === 0) return null;
  
  // Shuffle the proxies array to randomize selection
  const shuffled = [...proxies].sort(() => 0.5 - Math.random());
  
  // Try finding a working proxy
  for (let i = 0; i < Math.min(5, shuffled.length); i++) {
    const proxy = shuffled[i];
    if (await isProxyWorking(proxy)) {
      return proxy;
    }
  }
  
  // If we couldn't verify any proxy, just return a random one
  return shuffled[0];
}

module.exports = {
  parseProxy,
  createProxyAgent,
  loadProxiesFromFile,
  fetchMonosansProxies,
  isProxyWorking,
  getWorkingProxy
};
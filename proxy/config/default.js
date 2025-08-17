module.exports = {
  // WebSocket server configuration
  websocket: {
    port: process.env.WS_PORT || 8080,
    host: process.env.WS_HOST || '0.0.0.0'
  },

  // Telnet server configuration
  telnet: {
    host: process.env.TELNET_HOST || 'ranvier',
    port: process.env.TELNET_PORT || 3000
  },

  // Connection management
  connection: {
    timeout: process.env.CONNECTION_TIMEOUT || 30000,
    reconnectDelay: process.env.RECONNECT_DELAY || 5000,
    keepaliveInterval: process.env.KEEPALIVE_INTERVAL || 30000,
    keepaliveTimeout: process.env.KEEPALIVE_TIMEOUT || 60000
  },

  // Logging configuration
  logging: {
    level: process.env.LOG_LEVEL || 'info',
    enableConnectionLogs: process.env.ENABLE_CONNECTION_LOGS !== 'false',
    enableMessageLogs: process.env.ENABLE_MESSAGE_LOGS === 'true'
  },

  // Security settings
  security: {
    maxConnections: process.env.MAX_CONNECTIONS || 100,
    rateLimitWindow: process.env.RATE_LIMIT_WINDOW || 60000, // 1 minute
    rateLimitMax: process.env.RATE_LIMIT_MAX || 100 // messages per window
  }
};
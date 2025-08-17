module.exports = {
  // WebSocket server configuration
  websocket: {
    port: process.env.WS_PORT || 8080,
    pingInterval: 30000,
    pongTimeout: 5000
  },
  
  // Telnet client configuration
  telnet: {
    host: process.env.TELNET_HOST || 'ranvier',
    port: process.env.TELNET_PORT || 3000,
    timeout: 10000,
    keepAlive: true
  },
  
  // Proxy configuration
  proxy: {
    maxConnections: 100,
    bufferSize: 8192,
    reconnectAttempts: 5,
    reconnectDelay: 1000
  },
  
  // Logging configuration
  logging: {
    level: process.env.NODE_ENV === 'production' ? 'info' : 'debug'
  }
};
module.exports = {
  // HTTP server configuration
  server: {
    port: process.env.PORT || 3001,
    staticPath: './public'
  },
  
  // WebSocket client configuration
  websocket: {
    url: process.env.WS_URL || 'ws://localhost:8080',
    reconnectAttempts: 5,
    reconnectDelay: 1000
  },
  
  // Terminal configuration
  terminal: {
    fontSize: 14,
    fontFamily: 'Courier New, monospace',
    cursorBlink: true,
    scrollback: 1000
  },
  
  // Logging configuration
  logging: {
    level: process.env.NODE_ENV === 'production' ? 'info' : 'debug'
  }
};
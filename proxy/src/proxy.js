const WebSocket = require('ws');
const net = require('net');
const express = require('express');
const http = require('http');
const EventEmitter = require('events');

class WebSocketTelnetProxy extends EventEmitter {
  constructor(options = {}) {
    super();
    
    this.wsPort = options.wsPort || process.env.WS_PORT || 8080;
    this.telnetHost = options.telnetHost || process.env.TELNET_HOST || 'ranvier';
    this.telnetPort = options.telnetPort || process.env.TELNET_PORT || 3000;
    this.connectionTimeout = options.connectionTimeout || 30000; // 30 seconds
    this.reconnectDelay = options.reconnectDelay || 5000; // 5 seconds
    
    // Track active connections
    this.connections = new Map();
    this.connectionId = 0;
    
    // Create HTTP server for health checks
    this.app = express();
    this.server = http.createServer(this.app);
    this.wss = new WebSocket.Server({ server: this.server });
    
    this.setupHealthCheck();
    this.setupWebSocketServer();
  }

  setupHealthCheck() {
    this.app.get('/health', (req, res) => {
      res.status(200).json({ 
        status: 'healthy', 
        timestamp: new Date().toISOString(),
        telnetTarget: `${this.telnetHost}:${this.telnetPort}`,
        activeConnections: this.connections.size,
        uptime: process.uptime()
      });
    });
  }

  setupWebSocketServer() {
    this.wss.on('connection', (ws, req) => {
      const connectionId = ++this.connectionId;
      const clientIP = req.socket.remoteAddress;
      
      console.log(`[${connectionId}] New WebSocket connection from: ${clientIP}`);
      
      // Create connection object to track state
      const connection = {
        id: connectionId,
        ws: ws,
        telnet: null,
        connected: false,
        lastActivity: Date.now(),
        clientIP: clientIP
      };
      
      this.connections.set(connectionId, connection);
      this.emit('connection', connection);
      
      // Create and configure telnet connection
      this.createTelnetConnection(connection);
      
      // Set up WebSocket event handlers
      this.setupWebSocketHandlers(connection);
    });
  }

  createTelnetConnection(connection) {
    const telnetSocket = new net.Socket();
    connection.telnet = telnetSocket;
    
    // Set connection timeout
    telnetSocket.setTimeout(this.connectionTimeout);
    
    // Connect to Ranvier server
    telnetSocket.connect(this.telnetPort, this.telnetHost, () => {
      console.log(`[${connection.id}] Connected to Ranvier server`);
      connection.connected = true;
      this.emit('telnetConnected', connection);
    });

    // Handle Telnet data
    telnetSocket.on('data', (data) => {
      this.handleTelnetData(connection, data);
    });

    // Handle Telnet connection close
    telnetSocket.on('close', (hadError) => {
      console.log(`[${connection.id}] Telnet connection closed${hadError ? ' with error' : ''}`);
      connection.connected = false;
      this.emit('telnetDisconnected', connection);
      
      if (connection.ws.readyState === WebSocket.OPEN) {
        connection.ws.close(1011, 'Telnet server disconnected');
      }
      this.cleanupConnection(connection.id);
    });

    // Handle Telnet errors
    telnetSocket.on('error', (error) => {
      console.error(`[${connection.id}] Telnet error:`, error.message);
      this.emit('telnetError', connection, error);
      
      if (connection.ws.readyState === WebSocket.OPEN) {
        connection.ws.close(1011, `Telnet error: ${error.message}`);
      }
      this.cleanupConnection(connection.id);
    });

    // Handle timeout
    telnetSocket.on('timeout', () => {
      console.log(`[${connection.id}] Telnet connection timeout`);
      telnetSocket.destroy();
    });
  }

  setupWebSocketHandlers(connection) {
    const { ws } = connection;

    // Handle WebSocket messages
    ws.on('message', (data) => {
      this.handleWebSocketMessage(connection, data);
    });

    // Handle WebSocket close
    ws.on('close', (code, reason) => {
      console.log(`[${connection.id}] WebSocket connection closed: ${code} ${reason}`);
      this.emit('websocketDisconnected', connection);
      
      if (connection.telnet && !connection.telnet.destroyed) {
        connection.telnet.destroy();
      }
      this.cleanupConnection(connection.id);
    });

    // Handle WebSocket errors
    ws.on('error', (error) => {
      console.error(`[${connection.id}] WebSocket error:`, error.message);
      this.emit('websocketError', connection, error);
      
      if (connection.telnet && !connection.telnet.destroyed) {
        connection.telnet.destroy();
      }
      this.cleanupConnection(connection.id);
    });

    // Handle WebSocket pong (keepalive)
    ws.on('pong', () => {
      connection.lastActivity = Date.now();
    });
  }

  handleWebSocketMessage(connection, data) {
    try {
      connection.lastActivity = Date.now();
      
      if (!connection.connected || !connection.telnet || connection.telnet.destroyed) {
        console.warn(`[${connection.id}] Received message but Telnet not connected`);
        return;
      }

      const message = this.processWebSocketMessage(data);
      console.log(`[${connection.id}] WS -> Telnet:`, message.replace(/\r?\n/g, '\\n'));
      
      connection.telnet.write(message);
      this.emit('messageForwarded', connection, 'ws-to-telnet', message);
      
    } catch (error) {
      console.error(`[${connection.id}] Error forwarding WS message:`, error);
      this.emit('forwardError', connection, error);
    }
  }

  handleTelnetData(connection, data) {
    try {
      connection.lastActivity = Date.now();
      
      if (connection.ws.readyState !== WebSocket.OPEN) {
        console.warn(`[${connection.id}] Received Telnet data but WebSocket not open`);
        return;
      }

      const message = this.processTelnetMessage(data);
      console.log(`[${connection.id}] Telnet -> WS:`, message.replace(/\r?\n/g, '\\n'));
      
      connection.ws.send(message);
      this.emit('messageForwarded', connection, 'telnet-to-ws', message);
      
    } catch (error) {
      console.error(`[${connection.id}] Error forwarding Telnet message:`, error);
      this.emit('forwardError', connection, error);
    }
  }

  processWebSocketMessage(data) {
    // Convert WebSocket message to Telnet format
    let message = data.toString();
    
    // Ensure proper line endings for Telnet
    if (!message.endsWith('\r\n') && !message.endsWith('\n')) {
      message += '\r\n';
    }
    
    return message;
  }

  processTelnetMessage(data) {
    // Process Telnet data for WebSocket
    let message = data.toString('binary');
    
    // Handle Telnet IAC (Interpret As Command) sequences
    message = this.filterTelnetIAC(message);
    
    // Convert back to UTF-8 for WebSocket
    return Buffer.from(message, 'binary').toString('utf8');
  }

  filterTelnetIAC(data) {
    // Remove Telnet IAC sequences that browsers don't need
    // IAC = 255 (0xFF), followed by command codes
    const buffer = Buffer.from(data, 'binary');
    const filtered = [];
    
    for (let i = 0; i < buffer.length; i++) {
      if (buffer[i] === 255 && i + 1 < buffer.length) {
        const command = buffer[i + 1];
        
        // Handle IAC commands
        if (command >= 240 && command <= 254) {
          i++; // Skip the command byte
          
          // Commands that require an option byte (WILL/WONT/DO/DONT)
          if (command >= 251 && command <= 254 && i + 1 < buffer.length) {
            i++; // Skip option byte
          }
          continue;
        }
        // If not a valid IAC command, treat as regular data
      }
      
      // Add byte to filtered output
      filtered.push(buffer[i]);
    }
    
    return Buffer.from(filtered).toString('binary');
  }

  cleanupConnection(connectionId) {
    const connection = this.connections.get(connectionId);
    if (connection) {
      console.log(`[${connectionId}] Cleaning up connection`);
      this.connections.delete(connectionId);
      this.emit('connectionClosed', connection);
    }
  }

  // Keepalive mechanism
  startKeepalive() {
    this.keepaliveInterval = setInterval(() => {
      const now = Date.now();
      const timeout = 60000; // 1 minute timeout
      
      this.connections.forEach((connection) => {
        if (now - connection.lastActivity > timeout) {
          console.log(`[${connection.id}] Connection timeout, closing`);
          connection.ws.close(1000, 'Timeout');
        } else if (connection.ws.readyState === WebSocket.OPEN) {
          // Send ping to keep connection alive
          connection.ws.ping();
        }
      });
    }, 30000); // Check every 30 seconds
  }

  stopKeepalive() {
    if (this.keepaliveInterval) {
      clearInterval(this.keepaliveInterval);
      this.keepaliveInterval = null;
    }
  }

  start() {
    return new Promise((resolve, reject) => {
      this.server.listen(this.wsPort, (error) => {
        if (error) {
          reject(error);
          return;
        }
        
        console.log(`WebSocket proxy listening on port ${this.wsPort}`);
        console.log(`Proxying to Telnet server at ${this.telnetHost}:${this.telnetPort}`);
        
        this.startKeepalive();
        this.emit('started');
        resolve();
      });
    });
  }

  stop() {
    return new Promise((resolve) => {
      console.log('Stopping WebSocket proxy...');
      
      this.stopKeepalive();
      
      // Close all active connections
      this.connections.forEach((connection) => {
        if (connection.ws.readyState === WebSocket.OPEN) {
          connection.ws.close(1001, 'Server shutting down');
        }
        if (connection.telnet && !connection.telnet.destroyed) {
          connection.telnet.destroy();
        }
      });
      
      this.connections.clear();
      
      // Close WebSocket server
      this.wss.close(() => {
        // Close HTTP server
        this.server.close(() => {
          console.log('WebSocket proxy stopped');
          this.emit('stopped');
          resolve();
        });
      });
    });
  }

  getConnectionCount() {
    return this.connections.size;
  }

  getConnections() {
    return Array.from(this.connections.values()).map(conn => ({
      id: conn.id,
      clientIP: conn.clientIP,
      connected: conn.connected,
      lastActivity: conn.lastActivity
    }));
  }
}

// Export the class for testing
module.exports = WebSocketTelnetProxy;

// Start proxy if this file is run directly
if (require.main === module) {
  const proxy = new WebSocketTelnetProxy();
  
  proxy.start().catch((error) => {
    console.error('Failed to start proxy:', error);
    process.exit(1);
  });

  // Graceful shutdown
  const shutdown = async () => {
    console.log('Received shutdown signal, shutting down gracefully...');
    try {
      await proxy.stop();
      process.exit(0);
    } catch (error) {
      console.error('Error during shutdown:', error);
      process.exit(1);
    }
  };

  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);
}
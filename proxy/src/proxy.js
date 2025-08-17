const WebSocket = require('ws');
const net = require('net');
const express = require('express');
const http = require('http');

class WebSocketTelnetProxy {
  constructor() {
    this.wsPort = process.env.WS_PORT || 8080;
    this.telnetHost = process.env.TELNET_HOST || 'ranvier';
    this.telnetPort = process.env.TELNET_PORT || 3000;
    
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
        telnetTarget: `${this.telnetHost}:${this.telnetPort}`
      });
    });
  }

  setupWebSocketServer() {
    this.wss.on('connection', (ws, req) => {
      console.log('New WebSocket connection from:', req.socket.remoteAddress);
      
      // Create telnet connection
      const telnetSocket = new net.Socket();
      
      // Connect to Ranvier server
      telnetSocket.connect(this.telnetPort, this.telnetHost, () => {
        console.log('Connected to Ranvier server');
      });

      // Forward data from WebSocket to Telnet
      ws.on('message', (data) => {
        try {
          const message = data.toString();
          console.log('WS -> Telnet:', message);
          telnetSocket.write(message + '\r\n');
        } catch (error) {
          console.error('Error forwarding WS message:', error);
        }
      });

      // Forward data from Telnet to WebSocket
      telnetSocket.on('data', (data) => {
        try {
          const message = data.toString();
          console.log('Telnet -> WS:', message);
          if (ws.readyState === WebSocket.OPEN) {
            ws.send(message);
          }
        } catch (error) {
          console.error('Error forwarding Telnet message:', error);
        }
      });

      // Handle WebSocket close
      ws.on('close', () => {
        console.log('WebSocket connection closed');
        telnetSocket.destroy();
      });

      // Handle Telnet close
      telnetSocket.on('close', () => {
        console.log('Telnet connection closed');
        if (ws.readyState === WebSocket.OPEN) {
          ws.close();
        }
      });

      // Handle errors
      ws.on('error', (error) => {
        console.error('WebSocket error:', error);
        telnetSocket.destroy();
      });

      telnetSocket.on('error', (error) => {
        console.error('Telnet error:', error);
        if (ws.readyState === WebSocket.OPEN) {
          ws.close();
        }
      });
    });
  }

  start() {
    this.server.listen(this.wsPort, () => {
      console.log(`WebSocket proxy listening on port ${this.wsPort}`);
      console.log(`Proxying to Telnet server at ${this.telnetHost}:${this.telnetPort}`);
    });
  }
}

// Start proxy
const proxy = new WebSocketTelnetProxy();
proxy.start();

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('Received SIGTERM, shutting down gracefully');
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('Received SIGINT, shutting down gracefully');
  process.exit(0);
});
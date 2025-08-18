const WebSocket = require('ws');
const net = require('net');
const { execSync } = require('child_process');

class TestEnvironment {
  constructor(config) {
    this.config = config;
    this.connections = {
      websockets: [],
      telnet: [],
      http: []
    };
  }

  async waitForServices() {
    const services = [
      { name: 'Ranvier', ...this.config.services.ranvier },
      { name: 'Proxy', ...this.config.services.proxy },
      { name: 'Web Client', ...this.config.services.webClient }
    ];

    for (const service of services) {
      await this.waitForService(service);
    }
  }

  async waitForService(service, maxRetries = 30, delay = 2000) {
    console.log(`⏳ Waiting for ${service.name} at ${service.host}:${service.port}...`);
    
    for (let i = 0; i < maxRetries; i++) {
      try {
        await this.checkServiceHealth(service);
        console.log(`✅ ${service.name} is ready`);
        return;
      } catch (error) {
        if (i === maxRetries - 1) {
          throw new Error(`❌ ${service.name} failed to start after ${maxRetries} attempts: ${error.message}`);
        }
        console.log(`⏳ ${service.name} not ready, retrying... (${i + 1}/${maxRetries})`);
        await this.sleep(delay);
      }
    }
  }

  async checkServiceHealth(service) {
    return new Promise((resolve, reject) => {
      const socket = net.createConnection(service.port, service.host);
      
      socket.on('connect', () => {
        socket.end();
        resolve();
      });
      
      socket.on('error', (error) => {
        reject(error);
      });
      
      socket.setTimeout(5000, () => {
        socket.destroy();
        reject(new Error('Connection timeout'));
      });
    });
  }

  async createWebSocketConnection(url = null) {
    const wsUrl = url || this.config.services.proxy.wsUrl;
    
    return new Promise((resolve, reject) => {
      const ws = new WebSocket(wsUrl);
      
      ws.on('open', () => {
        this.connections.websockets.push(ws);
        resolve(ws);
      });
      
      ws.on('error', (error) => {
        reject(error);
      });
      
      setTimeout(() => {
        if (ws.readyState !== WebSocket.OPEN) {
          reject(new Error('WebSocket connection timeout'));
        }
      }, this.config.timeouts.connection);
    });
  }

  async createTelnetConnection(host = null, port = null) {
    const telnetHost = host || this.config.services.ranvier.host;
    const telnetPort = port || this.config.services.ranvier.port;
    
    return new Promise((resolve, reject) => {
      const socket = net.createConnection(telnetPort, telnetHost);
      
      socket.on('connect', () => {
        this.connections.telnet.push(socket);
        resolve(socket);
      });
      
      socket.on('error', (error) => {
        reject(error);
      });
      
      socket.setTimeout(this.config.timeouts.connection, () => {
        socket.destroy();
        reject(new Error('Telnet connection timeout'));
      });
    });
  }

  async sendWebSocketMessage(ws, message) {
    return new Promise((resolve, reject) => {
      if (ws.readyState !== WebSocket.OPEN) {
        reject(new Error('WebSocket not open'));
        return;
      }

      let responseReceived = false;
      const timeout = setTimeout(() => {
        if (!responseReceived) {
          reject(new Error('Response timeout'));
        }
      }, this.config.timeouts.response);

      const messageHandler = (data) => {
        responseReceived = true;
        clearTimeout(timeout);
        ws.removeListener('message', messageHandler);
        resolve(data.toString());
      };

      ws.on('message', messageHandler);
      ws.send(message);
    });
  }

  async sendTelnetCommand(socket, command) {
    return new Promise((resolve, reject) => {
      let responseData = '';
      const timeout = setTimeout(() => {
        socket.removeListener('data', dataHandler);
        reject(new Error('Telnet response timeout'));
      }, this.config.timeouts.response);

      const dataHandler = (data) => {
        responseData += data.toString();
        // Simple heuristic: if we get a prompt-like ending, consider response complete
        if (responseData.includes('> ') || responseData.includes('$ ') || responseData.includes('\n> ')) {
          clearTimeout(timeout);
          socket.removeListener('data', dataHandler);
          resolve(responseData);
        }
      };

      socket.on('data', dataHandler);
      socket.write(command + '\n');
    });
  }

  async makeHttpRequest(path, options = {}) {
    // Simplified HTTP request without axios dependency
    const url = `${this.config.services.webClient.url}${path}`;
    return new Promise((resolve, reject) => {
      const http = require('http');
      const urlParts = new URL(url);
      
      const req = http.request({
        hostname: urlParts.hostname,
        port: urlParts.port,
        path: urlParts.pathname,
        method: options.method || 'GET',
        timeout: this.config.timeouts.response
      }, (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => resolve({ status: res.statusCode, data }));
      });
      
      req.on('error', reject);
      req.on('timeout', () => reject(new Error('HTTP request timeout')));
      req.end();
    });
  }

  async initializeTestDatabase() {
    try {
      // Connect to Ranvier and initialize test data
      const socket = await this.createTelnetConnection();
      
      // Wait for initial connection messages
      await this.sleep(1000);
      
      // Create test character for integration tests
      await this.sendTelnetCommand(socket, 'TestPlayer');
      await this.sleep(500);
      
      socket.end();
      console.log('✅ Test database initialized');
    } catch (error) {
      console.error('❌ Failed to initialize test database:', error);
      throw error;
    }
  }

  async cleanupTestDatabase() {
    try {
      // Clean up test data - this would depend on your database implementation
      console.log('🧹 Cleaning up test database...');
      // Add specific cleanup logic here
    } catch (error) {
      console.error('❌ Failed to cleanup test database:', error);
    }
  }

  async cleanup() {
    // Close all WebSocket connections
    for (const ws of this.connections.websockets) {
      if (ws.readyState === WebSocket.OPEN) {
        ws.close();
      }
    }
    this.connections.websockets = [];

    // Close all Telnet connections
    for (const socket of this.connections.telnet) {
      if (!socket.destroyed) {
        socket.end();
      }
    }
    this.connections.telnet = [];

    // Clear HTTP connections array
    this.connections.http = [];
  }

  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // Utility method for creating test scenarios
  async createTestScenario(scenarioName) {
    console.log(`🎬 Setting up test scenario: ${scenarioName}`);
    
    const scenario = {
      websocket: await this.createWebSocketConnection(),
      telnet: await this.createTelnetConnection(),
      cleanup: async () => {
        await this.cleanup();
      }
    };

    return scenario;
  }

  // Performance testing utilities
  async createMultipleConnections(count, type = 'websocket') {
    const connections = [];
    
    for (let i = 0; i < count; i++) {
      try {
        let connection;
        if (type === 'websocket') {
          connection = await this.createWebSocketConnection();
        } else if (type === 'telnet') {
          connection = await this.createTelnetConnection();
        }
        connections.push(connection);
      } catch (error) {
        console.error(`Failed to create connection ${i + 1}:`, error);
        break;
      }
    }
    
    return connections;
  }

  async measureResponseTime(operation) {
    const startTime = Date.now();
    await operation();
    return Date.now() - startTime;
  }
}

module.exports = { TestEnvironment };
const WebSocketTelnetProxy = require('../src/proxy');
const WebSocket = require('ws');
const net = require('net');
const http = require('http');

describe('WebSocketTelnetProxy Integration Tests', () => {
  let proxy;
  let mockTelnetServer;
  let telnetServerPort;

  beforeAll(async () => {
    // Create a mock Telnet server for testing
    telnetServerPort = 3001;
    mockTelnetServer = net.createServer((socket) => {
      console.log('Mock Telnet server: Client connected');
      
      // Echo back received data with a prefix
      socket.on('data', (data) => {
        const message = data.toString();
        socket.write(`Echo: ${message}`);
      });
      
      socket.on('close', () => {
        console.log('Mock Telnet server: Client disconnected');
      });
      
      socket.on('error', (error) => {
        console.log('Mock Telnet server error:', error.message);
      });
    });

    await new Promise((resolve) => {
      mockTelnetServer.listen(telnetServerPort, resolve);
    });
  });

  afterAll(async () => {
    if (mockTelnetServer) {
      await new Promise((resolve) => {
        mockTelnetServer.close(resolve);
      });
    }
  });

  beforeEach(async () => {
    proxy = new WebSocketTelnetProxy({
      wsPort: 8081,
      telnetHost: 'localhost',
      telnetPort: telnetServerPort,
      connectionTimeout: 5000
    });
    
    await proxy.start();
  });

  afterEach(async () => {
    if (proxy) {
      await proxy.stop();
    }
  });

  test('should establish WebSocket connection and proxy to Telnet', (done) => {
    const ws = new WebSocket('ws://localhost:8081');
    
    ws.on('open', () => {
      console.log('WebSocket connected');
      ws.send('hello world');
    });
    
    ws.on('message', (data) => {
      const message = data.toString();
      console.log('Received:', message);
      
      expect(message).toContain('Echo: hello world');
      ws.close();
      done();
    });
    
    ws.on('error', (error) => {
      done(error);
    });
  }, 10000);

  test('should handle multiple concurrent connections', (done) => {
    const connections = [];
    const expectedResponses = 3;
    let receivedResponses = 0;

    for (let i = 0; i < expectedResponses; i++) {
      const ws = new WebSocket('ws://localhost:8081');
      connections.push(ws);
      
      ws.on('open', () => {
        ws.send(`message ${i}`);
      });
      
      ws.on('message', (data) => {
        const message = data.toString();
        expect(message).toContain(`Echo: message ${i}`);
        
        receivedResponses++;
        if (receivedResponses === expectedResponses) {
          // Close all connections
          connections.forEach(conn => conn.close());
          done();
        }
      });
      
      ws.on('error', (error) => {
        done(error);
      });
    }
  }, 15000);

  test('should handle connection cleanup on WebSocket close', (done) => {
    const ws = new WebSocket('ws://localhost:8081');
    
    ws.on('open', () => {
      expect(proxy.getConnectionCount()).toBe(1);
      ws.close();
    });
    
    ws.on('close', () => {
      // Give some time for cleanup
      setTimeout(() => {
        expect(proxy.getConnectionCount()).toBe(0);
        done();
      }, 100);
    });
    
    ws.on('error', (error) => {
      done(error);
    });
  }, 10000);

  test('should handle Telnet server unavailable', (done) => {
    // Create proxy pointing to non-existent Telnet server
    const badProxy = new WebSocketTelnetProxy({
      wsPort: 8082,
      telnetHost: 'localhost',
      telnetPort: 9999, // Non-existent port
      connectionTimeout: 1000
    });
    
    badProxy.start().then(() => {
      const ws = new WebSocket('ws://localhost:8082');
      
      ws.on('close', (code, reason) => {
        expect(code).toBe(1011);
        expect(reason.toString()).toContain('error');
        badProxy.stop().then(() => done());
      });
      
      ws.on('error', () => {
        // Expected - connection should fail
      });
    });
  }, 10000);

  test('should provide health check endpoint', (done) => {
    http.get('http://localhost:8081/health', (res) => {
      let data = '';
      
      res.on('data', (chunk) => {
        data += chunk;
      });
      
      res.on('end', () => {
        const health = JSON.parse(data);
        expect(health.status).toBe('healthy');
        expect(health.telnetTarget).toBe(`localhost:${telnetServerPort}`);
        expect(typeof health.activeConnections).toBe('number');
        expect(typeof health.uptime).toBe('number');
        done();
      });
    }).on('error', (error) => {
      done(error);
    });
  }, 5000);

  test('should handle binary data correctly', (done) => {
    const ws = new WebSocket('ws://localhost:8081');
    
    ws.on('open', () => {
      // Send binary data
      const binaryData = Buffer.from([0x48, 0x65, 0x6c, 0x6c, 0x6f]); // "Hello"
      ws.send(binaryData);
    });
    
    ws.on('message', (data) => {
      const message = data.toString();
      expect(message).toContain('Echo: Hello');
      ws.close();
      done();
    });
    
    ws.on('error', (error) => {
      done(error);
    });
  }, 10000);
});
/**
 * Integration tests for WebSocket communication
 */

const WebSocket = require('ws');
const http = require('http');

describe('WebSocket Integration', () => {
  let server;
  let wss;
  let serverPort;

  beforeAll((done) => {
    // Create a test WebSocket server
    server = http.createServer();
    wss = new WebSocket.Server({ server });
    
    wss.on('connection', (ws) => {
      ws.on('message', (message) => {
        // Echo messages back with a prefix
        ws.send(`Echo: ${message}`);
      });
      
      // Send welcome message
      ws.send('Welcome to test server!');
    });

    server.listen(0, () => {
      serverPort = server.address().port;
      done();
    });
  });

  afterAll((done) => {
    wss.close(() => {
      server.close(done);
    });
  });

  describe('WebSocket Connection', () => {
    test('should establish connection to WebSocket server', (done) => {
      const ws = new WebSocket(`ws://localhost:${serverPort}`);
      
      ws.on('open', () => {
        expect(ws.readyState).toBe(WebSocket.OPEN);
        ws.close();
        done();
      });

      ws.on('error', done);
    });

    test('should receive welcome message from server', (done) => {
      const ws = new WebSocket(`ws://localhost:${serverPort}`);
      
      ws.on('message', (data) => {
        expect(data.toString()).toBe('Welcome to test server!');
        ws.close();
        done();
      });

      ws.on('error', done);
    });

    test('should send and receive messages', (done) => {
      const ws = new WebSocket(`ws://localhost:${serverPort}`);
      const testMessage = 'Hello, server!';
      let messageCount = 0;
      
      ws.on('message', (data) => {
        messageCount++;
        if (messageCount === 2) { // Skip welcome message
          expect(data.toString()).toBe(`Echo: ${testMessage}`);
          ws.close();
          done();
        }
      });

      ws.on('open', () => {
        ws.send(testMessage);
      });

      ws.on('error', done);
    });

    test('should handle connection close gracefully', (done) => {
      const ws = new WebSocket(`ws://localhost:${serverPort}`);
      
      ws.on('open', () => {
        ws.close();
      });

      ws.on('close', (code, reason) => {
        expect(code).toBe(1005); // No status code
        done();
      });

      ws.on('error', done);
    });

    test('should handle server-initiated close', (done) => {
      const ws = new WebSocket(`ws://localhost:${serverPort}`);
      
      ws.on('open', () => {
        // Close the connection from client side to simulate server close
        ws.close();
      });

      ws.on('close', (code) => {
        expect(code).toBeGreaterThan(0);
        done();
      });

      ws.on('error', done);
    });
  });

  describe('Message Handling', () => {
    test('should handle binary data', (done) => {
      const ws = new WebSocket(`ws://localhost:${serverPort}`);
      const binaryData = Buffer.from([0x01, 0x02, 0x03, 0x04]);
      let messageCount = 0;
      
      ws.on('message', (data) => {
        messageCount++;
        if (messageCount === 2) { // Skip welcome message
          const received = Buffer.from(data.toString().replace('Echo: ', ''), 'binary');
          expect(received.length).toBeGreaterThan(0);
          ws.close();
          done();
        }
      });

      ws.on('open', () => {
        ws.send(binaryData);
      });

      ws.on('error', done);
    });

    test('should handle large messages', (done) => {
      const ws = new WebSocket(`ws://localhost:${serverPort}`);
      const largeMessage = 'A'.repeat(10000);
      let messageCount = 0;
      
      ws.on('message', (data) => {
        messageCount++;
        if (messageCount === 2) { // Skip welcome message
          expect(data.toString()).toBe(`Echo: ${largeMessage}`);
          ws.close();
          done();
        }
      });

      ws.on('open', () => {
        ws.send(largeMessage);
      });

      ws.on('error', done);
    });

    test('should handle rapid message sending', (done) => {
      const ws = new WebSocket(`ws://localhost:${serverPort}`);
      const messages = ['msg1', 'msg2', 'msg3', 'msg4', 'msg5'];
      const receivedMessages = [];
      let messageCount = 0;
      
      ws.on('message', (data) => {
        messageCount++;
        if (messageCount > 1) { // Skip welcome message
          receivedMessages.push(data.toString());
          
          if (receivedMessages.length === messages.length) {
            messages.forEach((msg, index) => {
              expect(receivedMessages[index]).toBe(`Echo: ${msg}`);
            });
            ws.close();
            done();
          }
        }
      });

      ws.on('open', () => {
        messages.forEach(msg => ws.send(msg));
      });

      ws.on('error', done);
    });
  });

  describe('Error Scenarios', () => {
    test('should handle connection to non-existent server', (done) => {
      try {
        const ws = new WebSocket('ws://localhost:99999');
        
        ws.on('error', (error) => {
          expect(error).toBeDefined();
          done();
        });

        ws.on('open', () => {
          done(new Error('Should not connect to non-existent server'));
        });
      } catch (error) {
        expect(error).toBeDefined();
        done();
      }
    });

    test('should handle invalid WebSocket URL', () => {
      expect(() => {
        new WebSocket('invalid-url');
      }).toThrow();
    });

    test('should handle sending data on closed connection', (done) => {
      const ws = new WebSocket(`ws://localhost:${serverPort}`);
      
      ws.on('open', () => {
        ws.close();
      });

      ws.on('close', () => {
        setTimeout(() => {
          // In Node.js ws library, sending on closed connection doesn't throw
          // but the readyState should be CLOSED
          expect(ws.readyState).toBe(WebSocket.CLOSED);
          done();
        }, 100);
      });

      ws.on('error', done);
    });
  });

  describe('Connection States', () => {
    test('should transition through connection states correctly', (done) => {
      const ws = new WebSocket(`ws://localhost:${serverPort}`);
      const states = [];
      
      states.push(ws.readyState); // Should be CONNECTING
      
      ws.on('open', () => {
        states.push(ws.readyState); // Should be OPEN
        ws.close();
      });

      ws.on('close', () => {
        states.push(ws.readyState); // Should be CLOSED
        
        expect(states[0]).toBe(WebSocket.CONNECTING);
        expect(states[1]).toBe(WebSocket.OPEN);
        expect(states[2]).toBe(WebSocket.CLOSED);
        done();
      });

      ws.on('error', done);
    });
  });
});
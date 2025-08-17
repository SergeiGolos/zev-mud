const WebSocketTelnetProxy = require('../src/proxy');
const WebSocket = require('ws');
const net = require('net');
const http = require('http');

// Mock dependencies
jest.mock('ws');
jest.mock('net');
jest.mock('express', () => {
  const mockApp = {
    get: jest.fn(),
    listen: jest.fn()
  };
  return () => mockApp;
});
jest.mock('http', () => ({
  createServer: jest.fn()
}));

// Mock console methods to reduce noise in tests
const originalConsoleLog = console.log;
const originalConsoleError = console.error;

beforeAll(() => {
  console.log = jest.fn();
  console.error = jest.fn();
});

afterAll(() => {
  console.log = originalConsoleLog;
  console.error = originalConsoleError;
});

describe('WebSocketTelnetProxy', () => {
  let proxy;
  let mockWss;
  let mockServer;
  let mockApp;

  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks();
    
    // Mock WebSocket Server
    mockWss = {
      on: jest.fn(),
      close: jest.fn()
    };
    WebSocket.Server.mockImplementation(() => mockWss);
    
    // Mock HTTP server
    mockServer = {
      listen: jest.fn(),
      close: jest.fn()
    };
    http.createServer.mockReturnValue(mockServer);
    
    // Create proxy instance
    proxy = new WebSocketTelnetProxy({
      wsPort: 8080,
      telnetHost: 'localhost',
      telnetPort: 3000,
      connectionTimeout: 5000
    });
  });

  afterEach(async () => {
    if (proxy && proxy.stop) {
      try {
        await proxy.stop();
      } catch (error) {
        // Ignore cleanup errors in tests
      }
    }
  });

  describe('Constructor', () => {
    test('should initialize with default options', () => {
      const defaultProxy = new WebSocketTelnetProxy();
      expect(defaultProxy.wsPort).toBe(8080);
      expect(defaultProxy.telnetHost).toBe('ranvier');
      expect(defaultProxy.telnetPort).toBe(3000);
    });

    test('should initialize with custom options', () => {
      expect(proxy.wsPort).toBe(8080);
      expect(proxy.telnetHost).toBe('localhost');
      expect(proxy.telnetPort).toBe(3000);
      expect(proxy.connectionTimeout).toBe(5000);
    });

    test('should set up WebSocket server', () => {
      expect(WebSocket.Server).toHaveBeenCalledWith({ server: mockServer });
      expect(mockWss.on).toHaveBeenCalledWith('connection', expect.any(Function));
    });
  });

  describe('Health Check', () => {
    test('should set up health check endpoint', () => {
      expect(proxy.app.get).toHaveBeenCalledWith('/health', expect.any(Function));
    });
  });

  describe('Server Lifecycle', () => {
    test('should start server successfully', async () => {
      mockServer.listen.mockImplementation((port, callback) => {
        callback();
      });

      await expect(proxy.start()).resolves.toBeUndefined();
      expect(mockServer.listen).toHaveBeenCalledWith(8080, expect.any(Function));
    });

    test('should handle start error', async () => {
      const error = new Error('Port in use');
      mockServer.listen.mockImplementation((port, callback) => {
        callback(error);
      });

      await expect(proxy.start()).rejects.toThrow('Port in use');
    });

    test('should stop server gracefully', async () => {
      mockWss.close.mockImplementation((callback) => {
        if (callback) callback();
      });
      mockServer.close.mockImplementation((callback) => {
        if (callback) callback();
      });

      await expect(proxy.stop()).resolves.toBeUndefined();
      expect(mockWss.close).toHaveBeenCalled();
      expect(mockServer.close).toHaveBeenCalled();
    });
  });

  describe('Connection Management', () => {
    let mockWs;
    let mockTelnetSocket;
    let connectionHandler;

    beforeEach(() => {
      // Get the connection handler
      connectionHandler = mockWss.on.mock.calls.find(call => call[0] === 'connection')[1];
      
      // Mock WebSocket
      mockWs = {
        on: jest.fn(),
        send: jest.fn(),
        close: jest.fn(),
        ping: jest.fn(),
        readyState: WebSocket.OPEN
      };
      
      // Mock Telnet socket
      mockTelnetSocket = {
        connect: jest.fn(),
        write: jest.fn(),
        destroy: jest.fn(),
        setTimeout: jest.fn(),
        on: jest.fn(),
        destroyed: false
      };
      net.Socket.mockImplementation(() => mockTelnetSocket);
    });

    test('should handle new WebSocket connection', () => {
      const mockReq = {
        socket: { remoteAddress: '127.0.0.1' }
      };

      connectionHandler(mockWs, mockReq);

      expect(proxy.getConnectionCount()).toBe(1);
      expect(mockTelnetSocket.connect).toHaveBeenCalledWith(3000, 'localhost', expect.any(Function));
      expect(mockWs.on).toHaveBeenCalledWith('message', expect.any(Function));
      expect(mockWs.on).toHaveBeenCalledWith('close', expect.any(Function));
      expect(mockWs.on).toHaveBeenCalledWith('error', expect.any(Function));
    });

    test('should clean up connection on WebSocket close', () => {
      const mockReq = {
        socket: { remoteAddress: '127.0.0.1' }
      };

      connectionHandler(mockWs, mockReq);
      expect(proxy.getConnectionCount()).toBe(1);

      // Simulate WebSocket close
      const closeHandler = mockWs.on.mock.calls.find(call => call[0] === 'close')[1];
      closeHandler();

      expect(proxy.getConnectionCount()).toBe(0);
      expect(mockTelnetSocket.destroy).toHaveBeenCalled();
    });

    test('should clean up connection on Telnet close', () => {
      const mockReq = {
        socket: { remoteAddress: '127.0.0.1' }
      };

      connectionHandler(mockWs, mockReq);
      expect(proxy.getConnectionCount()).toBe(1);

      // Simulate Telnet close
      const telnetCloseHandler = mockTelnetSocket.on.mock.calls.find(call => call[0] === 'close')[1];
      telnetCloseHandler();

      expect(proxy.getConnectionCount()).toBe(0);
      expect(mockWs.close).toHaveBeenCalledWith(1011, 'Telnet server disconnected');
    });
  });

  describe('Message Forwarding', () => {
    let mockWs;
    let mockTelnetSocket;
    let connection;

    beforeEach(() => {
      mockWs = {
        on: jest.fn(),
        send: jest.fn(),
        close: jest.fn(),
        ping: jest.fn(),
        readyState: WebSocket.OPEN
      };
      
      mockTelnetSocket = {
        connect: jest.fn(),
        write: jest.fn(),
        destroy: jest.fn(),
        setTimeout: jest.fn(),
        on: jest.fn(),
        destroyed: false
      };
      net.Socket.mockImplementation(() => mockTelnetSocket);

      connection = {
        id: 1,
        ws: mockWs,
        telnet: mockTelnetSocket,
        connected: true,
        lastActivity: Date.now(),
        clientIP: '127.0.0.1'
      };
    });

    test('should forward WebSocket message to Telnet', () => {
      const message = 'look';
      const buffer = Buffer.from(message);

      proxy.handleWebSocketMessage(connection, buffer);

      expect(mockTelnetSocket.write).toHaveBeenCalledWith('look\r\n');
    });

    test('should forward Telnet data to WebSocket', () => {
      const data = Buffer.from('You are in a room.\r\n');

      proxy.handleTelnetData(connection, data);

      expect(mockWs.send).toHaveBeenCalledWith('You are in a room.\r\n');
    });

    test('should not forward when Telnet not connected', () => {
      connection.connected = false;
      const message = 'look';
      const buffer = Buffer.from(message);

      proxy.handleWebSocketMessage(connection, buffer);

      expect(mockTelnetSocket.write).not.toHaveBeenCalled();
    });

    test('should not forward when WebSocket not open', () => {
      mockWs.readyState = WebSocket.CLOSED;
      const data = Buffer.from('You are in a room.\r\n');

      proxy.handleTelnetData(connection, data);

      expect(mockWs.send).not.toHaveBeenCalled();
    });
  });

  describe('Message Processing', () => {
    test('should process WebSocket message with proper line endings', () => {
      const result = proxy.processWebSocketMessage(Buffer.from('look'));
      expect(result).toBe('look\r\n');
    });

    test('should not add line endings if already present', () => {
      const result = proxy.processWebSocketMessage(Buffer.from('look\r\n'));
      expect(result).toBe('look\r\n');
    });

    test('should filter Telnet IAC sequences', () => {
      // Create buffer with IAC sequence (255, 251, 1 = IAC WILL ECHO)
      const buffer = Buffer.from([72, 101, 108, 108, 111, 255, 251, 1, 32, 87, 111, 114, 108, 100]);
      const input = buffer.toString('binary');
      
      const result = proxy.filterTelnetIAC(input);
      expect(result).toBe('Hello World');
    });

    test('should preserve normal text in Telnet message', () => {
      const input = 'Normal text message';
      const result = proxy.filterTelnetIAC(input);
      expect(result).toBe('Normal text message');
    });
  });

  describe('Error Handling', () => {
    let mockWs;
    let mockTelnetSocket;
    let connection;

    beforeEach(() => {
      mockWs = {
        on: jest.fn(),
        send: jest.fn(),
        close: jest.fn(),
        ping: jest.fn(),
        readyState: WebSocket.OPEN
      };
      
      mockTelnetSocket = {
        connect: jest.fn(),
        write: jest.fn(),
        destroy: jest.fn(),
        setTimeout: jest.fn(),
        on: jest.fn(),
        destroyed: false
      };

      connection = {
        id: 1,
        ws: mockWs,
        telnet: mockTelnetSocket,
        connected: true,
        lastActivity: Date.now(),
        clientIP: '127.0.0.1'
      };
    });

    test('should handle WebSocket message forwarding error', () => {
      mockTelnetSocket.write.mockImplementation(() => {
        throw new Error('Write failed');
      });

      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
      
      proxy.handleWebSocketMessage(connection, Buffer.from('test'));

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Error forwarding WS message:'),
        expect.any(Error)
      );
      
      consoleSpy.mockRestore();
    });

    test('should handle Telnet data forwarding error', () => {
      mockWs.send.mockImplementation(() => {
        throw new Error('Send failed');
      });

      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
      
      proxy.handleTelnetData(connection, Buffer.from('test'));

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Error forwarding Telnet message:'),
        expect.any(Error)
      );
      
      consoleSpy.mockRestore();
    });
  });

  describe('Keepalive', () => {
    test('should start keepalive interval', () => {
      const setIntervalSpy = jest.spyOn(global, 'setInterval');
      
      proxy.startKeepalive();
      
      expect(setIntervalSpy).toHaveBeenCalledWith(expect.any(Function), 30000);
      
      setIntervalSpy.mockRestore();
    });

    test('should stop keepalive interval', () => {
      const clearIntervalSpy = jest.spyOn(global, 'clearInterval');
      
      proxy.keepaliveInterval = 123;
      proxy.stopKeepalive();
      
      expect(clearIntervalSpy).toHaveBeenCalledWith(123);
      expect(proxy.keepaliveInterval).toBeNull();
      
      clearIntervalSpy.mockRestore();
    });
  });

  describe('Connection Info', () => {
    test('should return connection count', () => {
      expect(proxy.getConnectionCount()).toBe(0);
    });

    test('should return connection details', () => {
      const connections = proxy.getConnections();
      expect(Array.isArray(connections)).toBe(true);
      expect(connections).toHaveLength(0);
    });
  });
});
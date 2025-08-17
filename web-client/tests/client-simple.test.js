/**
 * Simplified unit tests for MudClient core functionality
 */

describe('MudClient Core Functionality', () => {
  // Mock xterm.js
  const mockTerminal = {
    open: jest.fn(),
    writeln: jest.fn(),
    write: jest.fn(),
    onData: jest.fn(),
    loadAddon: jest.fn()
  };

  const mockFitAddon = {
    fit: jest.fn()
  };

  // Mock WebSocket
  class MockWebSocket {
    constructor(url) {
      this.url = url;
      this.readyState = MockWebSocket.OPEN;
      this.onopen = null;
      this.onclose = null;
      this.onmessage = null;
      this.onerror = null;
    }
    
    send(data) {
      this.lastSentData = data;
    }
    
    close() {
      this.readyState = MockWebSocket.CLOSED;
    }
  }
  
  MockWebSocket.CONNECTING = 0;
  MockWebSocket.OPEN = 1;
  MockWebSocket.CLOSING = 2;
  MockWebSocket.CLOSED = 3;

  // Mock DOM elements
  const mockStatusElement = {
    className: '',
    textContent: '',
    closest: jest.fn(() => ({ className: '' }))
  };

  const mockContainer = {
    appendChild: jest.fn()
  };

  // Global mocks
  global.Terminal = jest.fn(() => mockTerminal);
  global.FitAddon = { FitAddon: jest.fn(() => mockFitAddon) };
  global.WebSocket = MockWebSocket;
  global.WebSocket.CONNECTING = 0;
  global.WebSocket.OPEN = 1;
  global.WebSocket.CLOSING = 2;
  global.WebSocket.CLOSED = 3;
  global.window = {
    location: { hostname: 'localhost' },
    addEventListener: jest.fn()
  };
  global.document = {
    getElementById: jest.fn((id) => {
      if (id === 'connection-status') return mockStatusElement;
      if (id === 'terminal-container') return mockContainer;
      return null;
    }),
    addEventListener: jest.fn()
  };

  // Ensure document.getElementById works in tests
  beforeEach(() => {
    global.document.getElementById = jest.fn((id) => {
      if (id === 'connection-status') return mockStatusElement;
      if (id === 'terminal-container') return mockContainer;
      return null;
    });
  });

  // Import the client
  const MudClient = require('../src/client.js');

  beforeEach(() => {
    jest.clearAllMocks();
    mockStatusElement.className = '';
    mockStatusElement.textContent = '';
  });

  test('should create MudClient instance', () => {
    const client = new MudClient();
    expect(client).toBeDefined();
    expect(client.wsUrl).toBe('ws://localhost:8080');
  });

  test('should initialize terminal', () => {
    new MudClient();
    expect(Terminal).toHaveBeenCalled();
    expect(mockTerminal.open).toHaveBeenCalledWith(mockContainer);
    expect(mockTerminal.loadAddon).toHaveBeenCalledWith(mockFitAddon);
  });

  test('should handle input correctly', () => {
    const client = new MudClient();
    client.websocket = new MockWebSocket('ws://localhost:8080');
    
    // Test printable character
    client.handleTerminalInput('a');
    expect(client.currentInput).toBe('a');
    expect(client.websocket.lastSentData).toBe('a');
  });

  test('should manage command history', () => {
    const client = new MudClient();
    client.websocket = new MockWebSocket('ws://localhost:8080');
    
    // Add command to history
    client.currentInput = 'test command';
    client.handleTerminalInput('\r'); // Enter key
    
    expect(client.commandHistory[0]).toBe('test command');
    expect(client.currentInput).toBe('');
  });

  test('should process server messages', () => {
    const client = new MudClient();
    const testData = 'Hello from server';
    
    client.processServerMessage(testData);
    expect(mockTerminal.write).toHaveBeenCalledWith(testData);
  });

  test('should handle connection states', () => {
    const client = new MudClient();
    
    expect(client.getConnectionState()).toBeDefined();
    
    client.connectionState = 'connected';
    client.websocket = new MockWebSocket('ws://localhost:8080');
    expect(client.isConnected()).toBe(true);
    
    client.connectionState = 'disconnected';
    expect(client.isConnected()).toBe(false);
  });

  test('should handle reconnection logic', () => {
    const client = new MudClient();
    client.reconnectAttempts = 2;
    client.connectionState = 'disconnected'; // Ensure not connecting
    
    // Mock setTimeout to avoid actual delays in tests
    const originalSetTimeout = global.setTimeout;
    global.setTimeout = jest.fn((fn) => fn());
    
    client.attemptReconnect();
    
    expect(client.reconnectAttempts).toBe(3);
    expect(mockTerminal.writeln).toHaveBeenCalledWith(
      expect.stringContaining('Reconnect attempt 3/5')
    );
    
    global.setTimeout = originalSetTimeout;
  });

  test('should handle max reconnection attempts', () => {
    const client = new MudClient();
    client.reconnectAttempts = 5;
    client.connectionState = 'disconnected'; // Ensure not connecting
    
    client.attemptReconnect();
    
    expect(mockTerminal.writeln).toHaveBeenCalledWith(
      expect.stringContaining('Max reconnection attempts reached')
    );
    expect(client.connectionState).toBe('failed');
  });

  test('should handle escape sequences for command history', () => {
    const client = new MudClient();
    client.commandHistory = ['command1', 'command2'];
    client.currentInput = '';
    
    // Mock sendCommand to avoid WebSocket dependency
    client.sendCommand = jest.fn();
    
    // Test up arrow
    client.handleEscapeSequence('\x1b[A');
    expect(client.historyIndex).toBe(0);
    
    // Test down arrow
    client.handleEscapeSequence('\x1b[B');
    expect(client.historyIndex).toBe(-1);
  });

  test('should limit command history size', () => {
    const client = new MudClient();
    client.websocket = new MockWebSocket('ws://localhost:8080');
    
    // Add 51 commands to exceed the limit
    for (let i = 0; i < 51; i++) {
      client.currentInput = `command${i}`;
      client.handleTerminalInput('\r');
    }
    
    expect(client.commandHistory.length).toBe(50);
  });

  test('should handle ANSI code processing', () => {
    const client = new MudClient();
    const ansiData = '\x1b[31mRed text\x1b[0m';
    
    const processed = client.processAnsiCodes(ansiData);
    expect(processed).toBe(ansiData); // Pass-through for now
  });
});
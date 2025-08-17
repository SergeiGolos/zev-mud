/**
 * Jest setup file for web-client tests
 */

// Global test setup
beforeAll(() => {
  // Suppress console.log during tests unless explicitly needed
  if (process.env.NODE_ENV === 'test') {
    global.console = {
      ...console,
      log: jest.fn(),
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn()
    };
  }
});

// Global test teardown
afterAll(() => {
  // Clean up any global resources
});

// Mock WebSocket constants
global.WebSocket = {
  CONNECTING: 0,
  OPEN: 1,
  CLOSING: 2,
  CLOSED: 3
};

// Mock performance API for timing tests
global.performance = {
  now: jest.fn(() => Date.now())
};

// Mock requestAnimationFrame for terminal rendering tests
global.requestAnimationFrame = jest.fn(cb => setTimeout(cb, 16));
global.cancelAnimationFrame = jest.fn(id => clearTimeout(id));
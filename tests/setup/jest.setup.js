const { TestEnvironment } = require('./test-environment');

// Global test configuration
global.testConfig = {
  services: {
    ranvier: {
      host: process.env.RANVIER_HOST || 'localhost',
      port: parseInt(process.env.RANVIER_PORT) || 3002
    },
    proxy: {
      host: process.env.PROXY_HOST || 'localhost',
      port: parseInt(process.env.PROXY_PORT) || 8082,
      wsUrl: `ws://${process.env.PROXY_HOST || 'localhost'}:${parseInt(process.env.PROXY_PORT) || 8082}`
    },
    webClient: {
      host: process.env.WEB_CLIENT_HOST || 'localhost',
      port: parseInt(process.env.WEB_CLIENT_PORT) || 3003,
      url: `http://${process.env.WEB_CLIENT_HOST || 'localhost'}:${parseInt(process.env.WEB_CLIENT_PORT) || 3003}`
    }
  },
  timeouts: {
    connection: 10000,
    response: 5000,
    test: 30000
  },
  retries: {
    connection: 3,
    command: 2
  }
};

// Global test environment instance
global.testEnv = new TestEnvironment(global.testConfig);

// Setup before each test
beforeEach(async () => {
  // Clean up any existing connections
  await global.testEnv.cleanup();
});

// Cleanup after each test
afterEach(async () => {
  await global.testEnv.cleanup();
});

// Global error handler
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

// Increase timeout for integration tests
jest.setTimeout(30000);
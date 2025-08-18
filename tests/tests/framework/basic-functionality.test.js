const { TestEnvironment } = require('../../setup/test-environment');

describe('Integration Test Framework - Basic Functionality', () => {
  let testEnv;

  beforeAll(async () => {
    testEnv = new TestEnvironment({
      services: {
        ranvier: { host: 'localhost', port: 3002 },
        proxy: { host: 'localhost', port: 8082 },
        webClient: { host: 'localhost', port: 3003 }
      },
      timeouts: { connection: 5000, response: 3000 },
      retries: { connection: 2, command: 1 }
    });
  });

  afterEach(async () => {
    await testEnv.cleanup();
  });

  describe('Test Environment', () => {
    test('should create TestEnvironment instance', () => {
      expect(testEnv).toBeDefined();
      expect(testEnv.config).toBeDefined();
      expect(testEnv.connections).toBeDefined();
    });

    test('should have correct configuration', () => {
      expect(testEnv.config.services.ranvier.host).toBe('localhost');
      expect(testEnv.config.services.ranvier.port).toBe(3002);
      expect(testEnv.config.services.proxy.port).toBe(8082);
      expect(testEnv.config.services.webClient.port).toBe(3003);
    });

    test('should initialize connection arrays', () => {
      expect(Array.isArray(testEnv.connections.websockets)).toBe(true);
      expect(Array.isArray(testEnv.connections.telnet)).toBe(true);
      expect(Array.isArray(testEnv.connections.http)).toBe(true);
    });

    test('should have utility methods', () => {
      expect(typeof testEnv.sleep).toBe('function');
      expect(typeof testEnv.cleanup).toBe('function');
      expect(typeof testEnv.createTestScenario).toBe('function');
    });
  });

  describe('Utility Functions', () => {
    test('should sleep for specified duration', async () => {
      const startTime = Date.now();
      await testEnv.sleep(100);
      const endTime = Date.now();
      
      expect(endTime - startTime).toBeGreaterThanOrEqual(90); // Allow some variance
      expect(endTime - startTime).toBeLessThan(200);
    });

    test('should measure response time', async () => {
      const responseTime = await testEnv.measureResponseTime(async () => {
        await testEnv.sleep(50);
      });
      
      expect(responseTime).toBeGreaterThanOrEqual(40);
      expect(responseTime).toBeLessThan(100);
    });

    test('should cleanup connections', async () => {
      // This test verifies cleanup doesn't throw errors
      await expect(testEnv.cleanup()).resolves.not.toThrow();
    });
  });

  describe('Configuration Validation', () => {
    test('should validate service configuration', () => {
      const services = testEnv.config.services;
      
      // All services should have host and port
      Object.values(services).forEach(service => {
        expect(service.host).toBeDefined();
        expect(service.port).toBeDefined();
        expect(typeof service.port).toBe('number');
      });
    });

    test('should validate timeout configuration', () => {
      const timeouts = testEnv.config.timeouts;
      
      expect(timeouts.connection).toBeDefined();
      expect(timeouts.response).toBeDefined();
      expect(typeof timeouts.connection).toBe('number');
      expect(typeof timeouts.response).toBe('number');
    });

    test('should validate retry configuration', () => {
      const retries = testEnv.config.retries;
      
      expect(retries.connection).toBeDefined();
      expect(retries.command).toBeDefined();
      expect(typeof retries.connection).toBe('number');
      expect(typeof retries.command).toBe('number');
    });
  });
});
#!/usr/bin/env node

const { TestEnvironment } = require('../setup/test-environment');

async function validateFramework() {
  console.log('🔍 Validating Integration Test Framework...');
  console.log('==========================================');
  
  try {
    // Test 1: Test Environment Creation
    console.log('1. Testing TestEnvironment creation...');
    const testConfig = {
      services: {
        ranvier: { host: 'localhost', port: 3002 },
        proxy: { host: 'localhost', port: 8082 },
        webClient: { host: 'localhost', port: 3003 }
      },
      timeouts: { connection: 5000, response: 3000 },
      retries: { connection: 2, command: 1 }
    };
    
    const testEnv = new TestEnvironment(testConfig);
    console.log('✅ TestEnvironment created successfully');
    
    // Test 2: Configuration Validation
    console.log('2. Testing configuration validation...');
    expect(testEnv.config.services.ranvier.host).toBe('localhost');
    expect(testEnv.config.services.ranvier.port).toBe(3002);
    console.log('✅ Configuration validation passed');
    
    // Test 3: Utility Methods
    console.log('3. Testing utility methods...');
    await testEnv.sleep(100);
    console.log('✅ Utility methods working');
    
    // Test 4: Connection Arrays
    console.log('4. Testing connection management...');
    expect(Array.isArray(testEnv.connections.websockets)).toBe(true);
    expect(Array.isArray(testEnv.connections.telnet)).toBe(true);
    expect(Array.isArray(testEnv.connections.http)).toBe(true);
    console.log('✅ Connection management initialized');
    
    // Test 5: Cleanup Method
    console.log('5. Testing cleanup functionality...');
    await testEnv.cleanup();
    console.log('✅ Cleanup functionality working');
    
    console.log('\n🎉 Integration Test Framework Validation Complete!');
    console.log('✅ All framework components are working correctly');
    console.log('\nNext steps:');
    console.log('1. Start test services: docker-compose -f docker-compose.test.yml up -d');
    console.log('2. Run tests: npm test');
    console.log('3. Or run specific suite: npm run test:integration');
    
  } catch (error) {
    console.error('❌ Framework validation failed:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

// Simple expect function for validation
function expect(actual) {
  return {
    toBe: (expected) => {
      if (actual !== expected) {
        throw new Error(`Expected ${actual} to be ${expected}`);
      }
    }
  };
}

// Run validation if called directly
if (require.main === module) {
  validateFramework();
}

module.exports = { validateFramework };
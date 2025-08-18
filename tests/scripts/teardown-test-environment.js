#!/usr/bin/env node

const { execSync } = require('child_process');
const { TestEnvironment } = require('../setup/test-environment');

async function teardownTestEnvironment() {
  console.log('🧹 Tearing down test environment...');
  
  try {
    // Clean up test database
    console.log('🗄️ Cleaning up test database...');
    const testEnv = new TestEnvironment({
      services: {
        ranvier: {
          host: 'localhost',
          port: 3002
        },
        proxy: {
          host: 'localhost',
          port: 8082
        },
        webClient: {
          host: 'localhost',
          port: 3003
        }
      }
    });
    
    await testEnv.cleanupTestDatabase();
    await testEnv.cleanup();
    
    // Stop test services
    console.log('🛑 Stopping test services...');
    execSync('docker-compose -f docker-compose.test.yml down -v', {
      stdio: 'inherit',
      cwd: process.cwd().replace('/tests', '')
    });
    
    // Clean up Docker resources
    console.log('🧹 Cleaning up Docker resources...');
    try {
      execSync('docker system prune -f --volumes', { stdio: 'pipe' });
    } catch (error) {
      console.log('ℹ️ Docker cleanup completed with warnings');
    }
    
    console.log('✅ Test environment teardown completed successfully');
    
  } catch (error) {
    console.error('❌ Test environment teardown failed:', error.message);
    // Don't exit with error code in teardown to avoid masking test failures
  }
}

// Run teardown if called directly
if (require.main === module) {
  teardownTestEnvironment();
}

module.exports = { teardownTestEnvironment };
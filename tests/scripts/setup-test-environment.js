#!/usr/bin/env node

const { execSync } = require('child_process');
const { TestEnvironment } = require('../setup/test-environment');

async function setupTestEnvironment() {
  console.log('🚀 Setting up test environment...');
  
  try {
    // Check if Docker is available
    console.log('🐳 Checking Docker availability...');
    execSync('docker --version', { stdio: 'pipe' });
    execSync('docker-compose --version', { stdio: 'pipe' });
    console.log('✅ Docker is available');
    
    // Start test services
    console.log('🏗️ Starting test services...');
    execSync('docker-compose -f docker-compose.test.yml up -d --build', {
      stdio: 'inherit',
      cwd: process.cwd().replace('/tests', '')
    });
    
    // Wait for services to be ready
    console.log('⏳ Waiting for services to be ready...');
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
    
    await testEnv.waitForServices();
    
    // Initialize test database
    console.log('🗄️ Initializing test database...');
    await testEnv.initializeTestDatabase();
    
    console.log('✅ Test environment setup completed successfully');
    
  } catch (error) {
    console.error('❌ Test environment setup failed:', error.message);
    process.exit(1);
  }
}

// Run setup if called directly
if (require.main === module) {
  setupTestEnvironment();
}

module.exports = { setupTestEnvironment };
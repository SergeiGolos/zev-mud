const { execSync } = require('child_process');
const { TestEnvironment } = require('./test-environment');

module.exports = async () => {
  console.log('🚀 Starting global test setup...');
  
  try {
    // Wait for services to be ready
    const testEnv = new TestEnvironment({
      services: {
        ranvier: {
          host: process.env.RANVIER_HOST || 'ranvier-test',
          port: parseInt(process.env.RANVIER_PORT) || 3000
        },
        proxy: {
          host: process.env.PROXY_HOST || 'proxy-test',
          port: parseInt(process.env.PROXY_PORT) || 8080
        },
        webClient: {
          host: process.env.WEB_CLIENT_HOST || 'web-client-test',
          port: parseInt(process.env.WEB_CLIENT_PORT) || 3001
        }
      }
    });

    // Wait for all services to be healthy
    console.log('⏳ Waiting for services to be ready...');
    await testEnv.waitForServices();
    
    // Initialize test database
    console.log('🗄️ Initializing test database...');
    await testEnv.initializeTestDatabase();
    
    console.log('✅ Global test setup completed successfully');
    
  } catch (error) {
    console.error('❌ Global test setup failed:', error);
    throw error;
  }
};
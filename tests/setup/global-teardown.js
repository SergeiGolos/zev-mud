const { TestEnvironment } = require('./test-environment');

module.exports = async () => {
  console.log('🧹 Starting global test teardown...');
  
  try {
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

    // Clean up test database
    console.log('🗄️ Cleaning up test database...');
    await testEnv.cleanupTestDatabase();
    
    // Close any remaining connections
    console.log('🔌 Closing connections...');
    await testEnv.cleanup();
    
    console.log('✅ Global test teardown completed successfully');
    
  } catch (error) {
    console.error('❌ Global test teardown failed:', error);
    // Don't throw error in teardown to avoid masking test failures
  }
};
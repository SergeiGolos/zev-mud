const { TestEnvironment } = require('./test-environment');

async function globalSetup() {
  console.log('🎭 Starting Playwright global setup...');
  
  try {
    // Wait for services to be ready
    const testEnv = new TestEnvironment({
      services: {
        ranvier: {
          host: process.env.RANVIER_HOST || 'localhost',
          port: parseInt(process.env.RANVIER_PORT) || 3002
        },
        proxy: {
          host: process.env.PROXY_HOST || 'localhost',
          port: parseInt(process.env.PROXY_PORT) || 8082
        },
        webClient: {
          host: process.env.WEB_CLIENT_HOST || 'localhost',
          port: parseInt(process.env.WEB_CLIENT_PORT) || 3003
        }
      }
    });

    // Only wait for services if they should be running
    if (!process.env.SKIP_SERVICE_CHECK) {
      console.log('⏳ Waiting for services to be ready...');
      try {
        await testEnv.waitForServices();
        console.log('✅ All services are ready for browser testing');
      } catch (error) {
        console.log('⚠️ Services not ready, browser tests may fail:', error.message);
        console.log('💡 Start services with: docker-compose -f docker-compose.test.yml up -d');
      }
    }
    
    console.log('✅ Playwright global setup completed');
    
  } catch (error) {
    console.error('❌ Playwright global setup failed:', error);
    // Don't throw error to allow tests to run even if services aren't ready
  }
}

module.exports = globalSetup;
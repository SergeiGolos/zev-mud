async function globalTeardown() {
  console.log('🎭 Starting Playwright global teardown...');
  
  try {
    // Clean up any global resources
    console.log('🧹 Cleaning up browser test resources...');
    
    // Add any cleanup logic here
    
    console.log('✅ Playwright global teardown completed');
    
  } catch (error) {
    console.error('❌ Playwright global teardown failed:', error);
    // Don't throw error to avoid masking test failures
  }
}

module.exports = globalTeardown;
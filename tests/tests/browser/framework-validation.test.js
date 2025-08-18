const { test, expect } = require('@playwright/test');
const { BrowserTestUtils } = require('../../setup/browser-test-utils');

test.describe('Browser Testing Framework Validation', () => {
  test('should validate BrowserTestUtils functionality', async ({ page }) => {
    console.log('🔍 Validating BrowserTestUtils...');
    
    // Test BrowserTestUtils creation
    const browserUtils = new BrowserTestUtils(page);
    expect(browserUtils).toBeDefined();
    expect(browserUtils.config).toBeDefined();
    expect(browserUtils.config.baseURL).toBeDefined();
    
    console.log('✅ BrowserTestUtils created successfully');
    
    // Test utility methods exist
    expect(typeof browserUtils.navigateToGame).toBe('function');
    expect(typeof browserUtils.waitForTerminal).toBe('function');
    expect(typeof browserUtils.sendCommand).toBe('function');
    expect(typeof browserUtils.getTerminalContent).toBe('function');
    expect(typeof browserUtils.takeScreenshot).toBe('function');
    
    console.log('✅ All utility methods are available');
    
    // Test configuration
    expect(browserUtils.config.timeout).toBe(10000);
    expect(browserUtils.config.retries).toBe(3);
    
    console.log('✅ Configuration is correct');
    
    // Test basic page functionality
    await page.goto('about:blank');
    expect(page.url()).toBe('about:blank');
    
    console.log('✅ Basic page functionality working');
    
    console.log('🎉 Browser testing framework validation completed!');
  });

  test('should validate Playwright configuration', async ({ page, browserName }) => {
    console.log(`🎭 Validating Playwright configuration for ${browserName}...`);
    
    // Test browser capabilities
    expect(page).toBeDefined();
    expect(browserName).toBeDefined();
    
    // Test basic navigation to data URL (no external dependency)
    await page.goto('data:text/html,<html><head><title>Test Page</title></head><body><h1>Test</h1></body></html>');
    await expect(page).toHaveTitle('Test Page');
    
    // Test screenshot capability
    await page.screenshot({ path: `test-results/validation-${browserName}.png` });
    
    // Test viewport
    const viewport = page.viewportSize();
    expect(viewport).toBeDefined();
    expect(viewport.width).toBeGreaterThan(0);
    expect(viewport.height).toBeGreaterThan(0);
    
    console.log(`✅ Playwright configuration validated for ${browserName}`);
  });

  test('should validate test environment setup', async ({ page }) => {
    console.log('🔧 Validating test environment setup...');
    
    // Test environment variables
    const baseURL = process.env.WEB_CLIENT_URL || 'http://localhost:3003';
    expect(baseURL).toBeDefined();
    
    console.log(`📍 Base URL: ${baseURL}`);
    
    // Test that we can create screenshots directory
    const browserUtils = new BrowserTestUtils(page);
    
    try {
      await page.goto('about:blank');
      await browserUtils.takeScreenshot('environment-validation');
      console.log('✅ Screenshot functionality working');
    } catch (error) {
      console.log('⚠️ Screenshot functionality may not be fully configured');
    }
    
    // Test performance measurement
    const responseTime = await browserUtils.measureResponseTime(async () => {
      await page.waitForTimeout(100);
    });
    
    expect(responseTime).toBeGreaterThanOrEqual(90);
    expect(responseTime).toBeLessThan(200);
    
    console.log(`✅ Performance measurement working: ${responseTime}ms`);
    
    console.log('✅ Test environment setup validated');
  });

  test('should provide framework usage examples', async ({ page }) => {
    console.log('📚 Demonstrating framework usage...');
    
    const browserUtils = new BrowserTestUtils(page);
    
    // Example 1: Basic navigation
    console.log('Example 1: Basic navigation');
    await page.goto('data:text/html,<html><head><title>Example Page</title></head><body><h1>Example</h1></body></html>');
    await expect(page).toHaveTitle('Example Page');
    console.log('✅ Navigation example completed');
    
    // Example 2: Screenshot taking
    console.log('Example 2: Screenshot functionality');
    await browserUtils.takeScreenshot('usage-example');
    console.log('✅ Screenshot example completed');
    
    // Example 3: Performance measurement
    console.log('Example 3: Performance measurement');
    const loadTime = await browserUtils.measureResponseTime(async () => {
      await page.reload();
    });
    console.log(`✅ Page reload took ${loadTime}ms`);
    
    // Example 4: Error handling
    console.log('Example 4: Error handling');
    try {
      await page.goto('invalid://url', { timeout: 1000 });
    } catch (error) {
      console.log('✅ Error handling working correctly');
    }
    
    console.log('📚 Framework usage examples completed');
  });
});
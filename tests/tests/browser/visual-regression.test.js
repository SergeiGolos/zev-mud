const { test, expect } = require('@playwright/test');
const { BrowserTestUtils } = require('../../setup/browser-test-utils');

test.describe('Visual Regression Tests', () => {
  let browserUtils;

  test.beforeEach(async ({ page }) => {
    browserUtils = new BrowserTestUtils(page);
    await browserUtils.navigateToGame();
    await browserUtils.waitForTerminal();
  });

  test('should maintain consistent terminal appearance', async ({ page }) => {
    console.log('👁️ Testing terminal visual consistency...');
    
    // Take baseline screenshot of empty terminal
    await expect(page).toHaveScreenshot('terminal-baseline.png');
    
    const characterName = `VisualTestPlayer_${Date.now()}`;
    await browserUtils.createCharacter(characterName);
    
    // Take screenshot after character creation
    await expect(page).toHaveScreenshot('terminal-with-character.png');
    
    // Send look command and take screenshot
    await browserUtils.sendCommand('look');
    await page.waitForTimeout(1000);
    
    await expect(page).toHaveScreenshot('terminal-with-room-description.png');
    
    console.log('✅ Terminal visual consistency verified');
  });

  test('should handle different viewport sizes correctly', async ({ page }) => {
    console.log('📐 Testing responsive design...');
    
    const characterName = `ResponsiveTestPlayer_${Date.now()}`;
    await browserUtils.createCharacter(characterName);
    
    // Test different viewport sizes
    const viewports = [
      { width: 1920, height: 1080, name: 'desktop-large' },
      { width: 1366, height: 768, name: 'desktop-medium' },
      { width: 1024, height: 768, name: 'tablet-landscape' },
      { width: 768, height: 1024, name: 'tablet-portrait' },
      { width: 375, height: 667, name: 'mobile-small' },
      { width: 414, height: 896, name: 'mobile-large' }
    ];
    
    for (const viewport of viewports) {
      console.log(`📱 Testing viewport: ${viewport.name} (${viewport.width}x${viewport.height})`);
      
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      await page.waitForTimeout(1000);
      
      // Ensure terminal is still visible and functional
      await expect(page.locator('.xterm')).toBeVisible();
      
      // Send a command to verify functionality
      await browserUtils.sendCommand('look');
      await page.waitForTimeout(1000);
      
      // Take screenshot for visual comparison
      await expect(page).toHaveScreenshot(`terminal-${viewport.name}.png`);
    }
    
    console.log('✅ Responsive design testing completed');
  });

  test('should display colors and formatting consistently', async ({ page }) => {
    console.log('🎨 Testing color and formatting consistency...');
    
    const characterName = `ColorTestPlayer_${Date.now()}`;
    await browserUtils.createCharacter(characterName);
    
    // Send commands that might produce colored output
    const colorCommands = [
      'look',
      'inventory',
      'help',
      'say This is a test message with colors'
    ];
    
    for (const command of colorCommands) {
      await browserUtils.sendCommand(command);
      await page.waitForTimeout(1000);
    }
    
    // Take screenshot to capture any color formatting
    await expect(page).toHaveScreenshot('terminal-with-colors.png');
    
    // Test different color themes if supported
    const themes = ['dark', 'light'];
    
    for (const theme of themes) {
      // Try to switch theme (this would depend on implementation)
      await page.evaluate((themeName) => {
        if (window.setTheme) {
          window.setTheme(themeName);
        }
      }, theme);
      
      await page.waitForTimeout(500);
      
      // Take screenshot of theme
      await expect(page).toHaveScreenshot(`terminal-theme-${theme}.png`);
    }
    
    console.log('✅ Color and formatting consistency verified');
  });

  test('should handle text overflow and wrapping correctly', async ({ page }) => {
    console.log('📝 Testing text overflow and wrapping...');
    
    const characterName = `OverflowTestPlayer_${Date.now()}`;
    await browserUtils.createCharacter(characterName);
    
    // Send very long message to test wrapping
    const longMessage = 'say ' + 'This is a very long message that should test the terminal\'s text wrapping capabilities and ensure that long lines are handled properly without breaking the layout or causing horizontal scrolling issues. '.repeat(3);
    
    await browserUtils.sendCommand(longMessage);
    await page.waitForTimeout(2000);
    
    // Take screenshot to verify text wrapping
    await expect(page).toHaveScreenshot('terminal-text-wrapping.png');
    
    // Test with different terminal widths
    await page.setViewportSize({ width: 800, height: 600 });
    await page.waitForTimeout(1000);
    
    await browserUtils.sendCommand('look');
    await page.waitForTimeout(1000);
    
    await expect(page).toHaveScreenshot('terminal-narrow-width.png');
    
    console.log('✅ Text overflow and wrapping verified');
  });

  test('should maintain visual consistency during scrolling', async ({ page }) => {
    console.log('📜 Testing scrolling visual consistency...');
    
    const characterName = `ScrollTestPlayer_${Date.now()}`;
    await browserUtils.createCharacter(characterName);
    
    // Generate enough content to cause scrolling
    const commands = ['look', 'inventory', 'help', 'look', 'inventory', 'help', 'look', 'inventory'];
    
    for (const command of commands) {
      await browserUtils.sendCommand(command);
      await page.waitForTimeout(500);
    }
    
    // Take screenshot with scrolled content
    await expect(page).toHaveScreenshot('terminal-scrolled-content.png');
    
    // Test scrolling behavior
    await page.keyboard.press('PageUp');
    await page.waitForTimeout(500);
    
    await expect(page).toHaveScreenshot('terminal-scrolled-up.png');
    
    await page.keyboard.press('PageDown');
    await page.waitForTimeout(500);
    
    await expect(page).toHaveScreenshot('terminal-scrolled-down.png');
    
    console.log('✅ Scrolling visual consistency verified');
  });

  test('should handle focus and selection states correctly', async ({ page }) => {
    console.log('🎯 Testing focus and selection states...');
    
    const characterName = `FocusTestPlayer_${Date.now()}`;
    await browserUtils.createCharacter(characterName);
    
    // Click on terminal to focus
    await page.click('.xterm-screen');
    await page.waitForTimeout(500);
    
    // Take screenshot with focused terminal
    await expect(page).toHaveScreenshot('terminal-focused.png');
    
    // Click outside terminal to blur (if possible)
    await page.click('body');
    await page.waitForTimeout(500);
    
    // Take screenshot with blurred terminal
    await expect(page).toHaveScreenshot('terminal-blurred.png');
    
    // Test text selection (if supported)
    await page.click('.xterm-screen');
    await page.keyboard.press('Control+A');
    await page.waitForTimeout(500);
    
    await expect(page).toHaveScreenshot('terminal-text-selected.png');
    
    console.log('✅ Focus and selection states verified');
  });

  test('should display error states consistently', async ({ page }) => {
    console.log('❌ Testing error state visuals...');
    
    const characterName = `ErrorVisualTestPlayer_${Date.now()}`;
    await browserUtils.createCharacter(characterName);
    
    // Send invalid commands to trigger error states
    const errorCommands = [
      'invalidcommand',
      'go nowhere',
      'take nonexistent',
      'attack nothing'
    ];
    
    for (const command of errorCommands) {
      await browserUtils.sendCommand(command);
      await page.waitForTimeout(1000);
    }
    
    // Take screenshot showing error messages
    await expect(page).toHaveScreenshot('terminal-with-errors.png');
    
    // Verify terminal recovers visually after errors
    await browserUtils.sendCommand('look');
    await page.waitForTimeout(1000);
    
    await expect(page).toHaveScreenshot('terminal-after-errors.png');
    
    console.log('✅ Error state visuals verified');
  });

  test('should handle loading and connection states visually', async ({ page }) => {
    console.log('🔄 Testing loading and connection state visuals...');
    
    // Take screenshot of initial loading state
    await expect(page).toHaveScreenshot('terminal-loading-state.png');
    
    // Wait for terminal to be ready
    await browserUtils.waitForTerminal();
    
    // Take screenshot of ready state
    await expect(page).toHaveScreenshot('terminal-ready-state.png');
    
    const characterName = `ConnectionTestPlayer_${Date.now()}`;
    await browserUtils.createCharacter(characterName);
    
    // Simulate connection issue
    await page.evaluate(() => {
      if (window.websocket) {
        window.websocket.close();
      }
    });
    
    await page.waitForTimeout(2000);
    
    // Take screenshot of disconnected state
    await expect(page).toHaveScreenshot('terminal-disconnected-state.png');
    
    console.log('✅ Loading and connection state visuals verified');
  });

  test('should maintain accessibility visual indicators', async ({ page }) => {
    console.log('♿ Testing accessibility visual indicators...');
    
    const characterName = `AccessibilityTestPlayer_${Date.now()}`;
    await browserUtils.createCharacter(characterName);
    
    // Test keyboard navigation visual feedback
    await browserUtils.testKeyboardNavigation();
    
    // Take screenshot showing keyboard focus
    await expect(page).toHaveScreenshot('terminal-keyboard-focus.png');
    
    // Test high contrast mode (if supported)
    await page.emulateMedia({ colorScheme: 'dark' });
    await page.waitForTimeout(500);
    
    await expect(page).toHaveScreenshot('terminal-high-contrast-dark.png');
    
    await page.emulateMedia({ colorScheme: 'light' });
    await page.waitForTimeout(500);
    
    await expect(page).toHaveScreenshot('terminal-high-contrast-light.png');
    
    console.log('✅ Accessibility visual indicators verified');
  });
});
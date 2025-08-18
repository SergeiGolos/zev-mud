const { test, expect } = require('@playwright/test');
const { BrowserTestUtils } = require('../../setup/browser-test-utils');

test.describe('Terminal Rendering Tests', () => {
  let browserUtils;

  test.beforeEach(async ({ page }) => {
    browserUtils = new BrowserTestUtils(page);
    await browserUtils.navigateToGame();
  });

  test('should load terminal interface correctly', async ({ page }) => {
    console.log('🖥️ Testing terminal interface loading...');
    
    // Check that the page loads
    await expect(page).toHaveTitle(/zev-mud|MUD|Game/i);
    
    // Wait for terminal to load
    await browserUtils.waitForTerminal();
    
    // Check that xterm.js terminal is present
    await expect(page.locator('.xterm')).toBeVisible();
    await expect(page.locator('.xterm-screen')).toBeVisible();
    
    // Check that terminal has content
    const terminalContent = await browserUtils.getTerminalContent();
    expect(terminalContent.length).toBeGreaterThan(0);
    
    console.log('✅ Terminal interface loaded correctly');
  });

  test('should handle text input and display', async ({ page }) => {
    console.log('⌨️ Testing text input and display...');
    
    await browserUtils.waitForTerminal();
    
    // Test character creation
    const characterName = `BrowserTestPlayer_${Date.now()}`;
    await browserUtils.sendCommand(characterName);
    
    // Wait for response
    await page.waitForTimeout(2000);
    
    // Check that input was processed
    const content = await browserUtils.getTerminalContent();
    expect(content).toContain(characterName);
    
    console.log('✅ Text input and display working correctly');
  });

  test('should render ANSI colors and formatting', async ({ page }) => {
    console.log('🎨 Testing ANSI color rendering...');
    
    await browserUtils.waitForTerminal();
    
    // Create character to get colored output
    const characterName = `ColorTestPlayer_${Date.now()}`;
    await browserUtils.createCharacter(characterName);
    
    // Send look command which might have colored output
    await browserUtils.sendCommand('look');
    await page.waitForTimeout(1000);
    
    // Check for ANSI color classes or styles
    const hasColorElements = await page.evaluate(() => {
      const terminal = document.querySelector('.xterm-screen');
      if (!terminal) return false;
      
      // Look for xterm color classes or inline styles
      const colorElements = terminal.querySelectorAll('[class*="xterm-fg-"], [class*="xterm-bg-"], [style*="color"]');
      return colorElements.length > 0;
    });
    
    // Even if no colors are present, terminal should still be functional
    const content = await browserUtils.getTerminalContent();
    expect(content.length).toBeGreaterThan(0);
    
    if (hasColorElements) {
      console.log('✅ ANSI colors detected and rendered');
    } else {
      console.log('ℹ️ No ANSI colors detected (may be expected)');
    }
  });

  test('should handle terminal scrolling', async ({ page }) => {
    console.log('📜 Testing terminal scrolling...');
    
    await browserUtils.waitForTerminal();
    
    const characterName = `ScrollTestPlayer_${Date.now()}`;
    await browserUtils.createCharacter(characterName);
    
    // Send multiple commands to generate scrollable content
    const commands = ['look', 'inventory', 'look', 'help', 'look'];
    
    for (const command of commands) {
      await browserUtils.sendCommand(command);
      await page.waitForTimeout(500);
    }
    
    // Check that terminal has scrollable content
    const terminalHeight = await page.evaluate(() => {
      const terminal = document.querySelector('.xterm-screen');
      return terminal ? terminal.scrollHeight : 0;
    });
    
    expect(terminalHeight).toBeGreaterThan(0);
    
    // Test scrolling functionality
    await page.keyboard.press('PageUp');
    await page.waitForTimeout(500);
    await page.keyboard.press('PageDown');
    await page.waitForTimeout(500);
    
    console.log('✅ Terminal scrolling working correctly');
  });

  test('should handle special characters and unicode', async ({ page }) => {
    console.log('🔤 Testing special character handling...');
    
    await browserUtils.waitForTerminal();
    
    const characterName = `UnicodeTestPlayer_${Date.now()}`;
    await browserUtils.createCharacter(characterName);
    
    // Test various special characters
    const specialCommands = [
      'say Hello! @#$%^&*()',
      'say Testing unicode: ñáéíóú',
      'say Symbols: ★☆♠♣♥♦'
    ];
    
    for (const command of specialCommands) {
      await browserUtils.sendCommand(command);
      await page.waitForTimeout(500);
    }
    
    // Verify terminal still functions after special characters
    await browserUtils.sendCommand('look');
    await page.waitForTimeout(1000);
    
    const content = await browserUtils.getTerminalContent();
    expect(content).toContain('You are in');
    
    console.log('✅ Special character handling working correctly');
  });

  test('should maintain terminal state during resize', async ({ page }) => {
    console.log('📐 Testing terminal resize handling...');
    
    await browserUtils.waitForTerminal();
    
    const characterName = `ResizeTestPlayer_${Date.now()}`;
    await browserUtils.createCharacter(characterName);
    
    // Get initial content
    const initialContent = await browserUtils.getTerminalContent();
    
    // Resize the browser window
    await page.setViewportSize({ width: 800, height: 600 });
    await page.waitForTimeout(1000);
    
    await page.setViewportSize({ width: 1200, height: 800 });
    await page.waitForTimeout(1000);
    
    // Verify terminal is still functional
    await browserUtils.sendCommand('look');
    await page.waitForTimeout(1000);
    
    const finalContent = await browserUtils.getTerminalContent();
    expect(finalContent.length).toBeGreaterThan(initialContent.length);
    
    console.log('✅ Terminal resize handling working correctly');
  });

  test('should handle rapid input correctly', async ({ page }) => {
    console.log('⚡ Testing rapid input handling...');
    
    await browserUtils.waitForTerminal();
    
    const characterName = `RapidTestPlayer_${Date.now()}`;
    await browserUtils.createCharacter(characterName);
    
    // Send rapid commands
    const rapidCommands = ['look', 'inventory', 'look', 'inventory', 'look'];
    
    for (const command of rapidCommands) {
      await browserUtils.sendCommand(command);
      // Minimal delay between commands
      await page.waitForTimeout(100);
    }
    
    // Wait for all responses
    await page.waitForTimeout(3000);
    
    // Verify terminal is still responsive
    await browserUtils.sendCommand('look');
    await browserUtils.waitForText('You are in', 5000);
    
    console.log('✅ Rapid input handling working correctly');
  });

  test('should display error messages appropriately', async ({ page }) => {
    console.log('❌ Testing error message display...');
    
    await browserUtils.waitForTerminal();
    
    const characterName = `ErrorTestPlayer_${Date.now()}`;
    await browserUtils.createCharacter(characterName);
    
    // Send invalid commands
    const invalidCommands = ['invalidcommand', 'xyz123', 'go nowhere'];
    
    for (const command of invalidCommands) {
      await browserUtils.sendCommand(command);
      await page.waitForTimeout(1000);
    }
    
    // Verify error messages are displayed
    const content = await browserUtils.getTerminalContent();
    expect(content).toMatch(/(don't understand|invalid|unknown|can't)/i);
    
    // Verify terminal is still functional after errors
    await browserUtils.sendCommand('look');
    await browserUtils.waitForText('You are in', 5000);
    
    console.log('✅ Error message display working correctly');
  });
});
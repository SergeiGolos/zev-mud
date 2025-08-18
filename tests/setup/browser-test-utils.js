const { expect } = require('@playwright/test');

class BrowserTestUtils {
  constructor(page) {
    this.page = page;
    this.config = {
      baseURL: process.env.WEB_CLIENT_URL || 'http://localhost:3003',
      timeout: 10000,
      retries: 3
    };
  }

  async navigateToGame() {
    console.log('🌐 Navigating to game client...');
    await this.page.goto(this.config.baseURL);
    await this.page.waitForLoadState('networkidle');
  }

  async waitForTerminal() {
    console.log('⏳ Waiting for terminal to load...');
    
    // Wait for xterm.js terminal to be initialized
    await this.page.waitForSelector('.xterm', { timeout: this.config.timeout });
    
    // Wait for terminal to be ready for input
    await this.page.waitForFunction(() => {
      const terminal = document.querySelector('.xterm-screen');
      return terminal && terminal.textContent.length > 0;
    }, { timeout: this.config.timeout });
    
    console.log('✅ Terminal is ready');
  }

  async sendCommand(command) {
    console.log(`📝 Sending command: ${command}`);
    
    // Focus on the terminal
    await this.page.click('.xterm-screen');
    
    // Type the command
    await this.page.keyboard.type(command);
    
    // Press Enter
    await this.page.keyboard.press('Enter');
    
    // Wait a moment for the response
    await this.page.waitForTimeout(1000);
  }

  async getTerminalContent() {
    // Get all text content from the terminal
    const content = await this.page.evaluate(() => {
      const terminal = document.querySelector('.xterm-screen');
      return terminal ? terminal.textContent : '';
    });
    
    return content;
  }

  async waitForText(text, timeout = 10000) {
    console.log(`⏳ Waiting for text: "${text}"`);
    
    await this.page.waitForFunction(
      (searchText) => {
        const terminal = document.querySelector('.xterm-screen');
        return terminal && terminal.textContent.includes(searchText);
      },
      text,
      { timeout }
    );
    
    console.log(`✅ Found text: "${text}"`);
  }

  async expectTextInTerminal(text) {
    const content = await this.getTerminalContent();
    expect(content).toContain(text);
  }

  async expectTextNotInTerminal(text) {
    const content = await this.getTerminalContent();
    expect(content).not.toContain(text);
  }

  async createCharacter(characterName) {
    console.log(`👤 Creating character: ${characterName}`);
    
    await this.sendCommand(characterName);
    await this.waitForText('Welcome', 5000);
    
    console.log(`✅ Character ${characterName} created`);
  }

  async performGameplaySequence() {
    console.log('🎮 Performing basic gameplay sequence...');
    
    // Look around
    await this.sendCommand('look');
    await this.waitForText('You are in', 5000);
    
    // Check inventory
    await this.sendCommand('inventory');
    await this.page.waitForTimeout(1000);
    
    // Try to move
    await this.sendCommand('north');
    await this.page.waitForTimeout(1000);
    
    console.log('✅ Gameplay sequence completed');
  }

  async takeScreenshot(name) {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `screenshot-${name}-${timestamp}.png`;
    
    await this.page.screenshot({
      path: `test-results/screenshots/${filename}`,
      fullPage: true
    });
    
    console.log(`📸 Screenshot saved: ${filename}`);
    return filename;
  }

  async measureResponseTime(action) {
    const startTime = Date.now();
    await action();
    const endTime = Date.now();
    
    return endTime - startTime;
  }

  async checkForErrors() {
    // Check for JavaScript errors in the console
    const errors = [];
    
    this.page.on('console', msg => {
      if (msg.type() === 'error') {
        errors.push(msg.text());
      }
    });
    
    this.page.on('pageerror', error => {
      errors.push(error.message);
    });
    
    return errors;
  }

  async waitForConnection() {
    console.log('🔌 Waiting for WebSocket connection...');
    
    // Wait for WebSocket connection to be established
    await this.page.waitForFunction(() => {
      return window.websocket && window.websocket.readyState === WebSocket.OPEN;
    }, { timeout: this.config.timeout });
    
    console.log('✅ WebSocket connection established');
  }

  async simulateNetworkIssue() {
    console.log('🌐 Simulating network issue...');
    
    // Simulate offline condition
    await this.page.context().setOffline(true);
    await this.page.waitForTimeout(2000);
    
    // Restore connection
    await this.page.context().setOffline(false);
    await this.page.waitForTimeout(2000);
    
    console.log('✅ Network issue simulation completed');
  }

  async testAccessibility() {
    console.log('♿ Testing accessibility...');
    
    // Check for basic accessibility features
    const hasAriaLabels = await this.page.evaluate(() => {
      const elements = document.querySelectorAll('[aria-label]');
      return elements.length > 0;
    });
    
    const hasHeadings = await this.page.evaluate(() => {
      const headings = document.querySelectorAll('h1, h2, h3, h4, h5, h6');
      return headings.length > 0;
    });
    
    const hasAltText = await this.page.evaluate(() => {
      const images = document.querySelectorAll('img');
      return Array.from(images).every(img => img.alt !== '');
    });
    
    return {
      hasAriaLabels,
      hasHeadings,
      hasAltText
    };
  }

  async testKeyboardNavigation() {
    console.log('⌨️ Testing keyboard navigation...');
    
    // Test Tab navigation
    await this.page.keyboard.press('Tab');
    await this.page.waitForTimeout(500);
    
    // Test Enter key
    await this.page.keyboard.press('Enter');
    await this.page.waitForTimeout(500);
    
    // Test Escape key
    await this.page.keyboard.press('Escape');
    await this.page.waitForTimeout(500);
    
    console.log('✅ Keyboard navigation test completed');
  }

  async getPerformanceMetrics() {
    const metrics = await this.page.evaluate(() => {
      const navigation = performance.getEntriesByType('navigation')[0];
      return {
        loadTime: navigation.loadEventEnd - navigation.loadEventStart,
        domContentLoaded: navigation.domContentLoadedEventEnd - navigation.domContentLoadedEventStart,
        firstPaint: performance.getEntriesByType('paint').find(entry => entry.name === 'first-paint')?.startTime || 0,
        firstContentfulPaint: performance.getEntriesByType('paint').find(entry => entry.name === 'first-contentful-paint')?.startTime || 0
      };
    });
    
    return metrics;
  }
}

module.exports = { BrowserTestUtils };
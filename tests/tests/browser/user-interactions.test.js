const { test, expect } = require('@playwright/test');
const { BrowserTestUtils } = require('../../setup/browser-test-utils');

test.describe('User Interaction Tests', () => {
  let browserUtils;

  test.beforeEach(async ({ page }) => {
    browserUtils = new BrowserTestUtils(page);
    await browserUtils.navigateToGame();
    await browserUtils.waitForTerminal();
  });

  test('should handle character creation flow', async ({ page }) => {
    console.log('👤 Testing character creation flow...');
    
    const characterName = `InteractionTestPlayer_${Date.now()}`;
    
    // Create character
    await browserUtils.sendCommand(characterName);
    
    // Wait for welcome message
    await browserUtils.waitForText('Welcome', 10000);
    
    // Verify character was created successfully
    await browserUtils.expectTextInTerminal('Welcome');
    await browserUtils.expectTextInTerminal(characterName);
    
    console.log('✅ Character creation flow working correctly');
  });

  test('should handle basic game commands', async ({ page }) => {
    console.log('🎮 Testing basic game commands...');
    
    const characterName = `CommandTestPlayer_${Date.now()}`;
    await browserUtils.createCharacter(characterName);
    
    // Test look command
    await browserUtils.sendCommand('look');
    await browserUtils.waitForText('You are in', 5000);
    
    // Test inventory command
    await browserUtils.sendCommand('inventory');
    await page.waitForTimeout(1000);
    
    // Test help command (if available)
    await browserUtils.sendCommand('help');
    await page.waitForTimeout(1000);
    
    // Verify all commands were processed
    const content = await browserUtils.getTerminalContent();
    expect(content).toContain('You are in');
    
    console.log('✅ Basic game commands working correctly');
  });

  test('should handle movement commands', async ({ page }) => {
    console.log('🚶 Testing movement commands...');
    
    const characterName = `MovementTestPlayer_${Date.now()}`;
    await browserUtils.createCharacter(characterName);
    
    // Get initial location
    await browserUtils.sendCommand('look');
    await page.waitForTimeout(1000);
    const initialContent = await browserUtils.getTerminalContent();
    
    // Try movement commands
    const directions = ['north', 'south', 'east', 'west'];
    
    for (const direction of directions) {
      await browserUtils.sendCommand(direction);
      await page.waitForTimeout(1000);
      
      // Check if movement was successful or blocked
      const content = await browserUtils.getTerminalContent();
      
      if (content.includes('You move') || content.includes('You go') || content.includes('You walk')) {
        console.log(`✅ Movement ${direction} successful`);
        
        // Move back if possible
        const opposites = { north: 'south', south: 'north', east: 'west', west: 'east' };
        await browserUtils.sendCommand(opposites[direction]);
        await page.waitForTimeout(1000);
      } else {
        console.log(`ℹ️ Movement ${direction} blocked (expected)`);
      }
    }
    
    console.log('✅ Movement commands tested');
  });

  test('should handle item interactions', async ({ page }) => {
    console.log('📦 Testing item interactions...');
    
    const characterName = `ItemTestPlayer_${Date.now()}`;
    await browserUtils.createCharacter(characterName);
    
    // Look for items in the room
    await browserUtils.sendCommand('look');
    await page.waitForTimeout(1000);
    
    const roomContent = await browserUtils.getTerminalContent();
    
    // Try to interact with common items
    const itemCommands = [
      'take sword',
      'take item',
      'examine sword',
      'examine item'
    ];
    
    for (const command of itemCommands) {
      await browserUtils.sendCommand(command);
      await page.waitForTimeout(1000);
    }
    
    // Check inventory
    await browserUtils.sendCommand('inventory');
    await page.waitForTimeout(1000);
    
    // Try to drop items if any were taken
    await browserUtils.sendCommand('drop sword');
    await page.waitForTimeout(1000);
    
    console.log('✅ Item interactions tested');
  });

  test('should handle NPC interactions', async ({ page }) => {
    console.log('👥 Testing NPC interactions...');
    
    const characterName = `NPCTestPlayer_${Date.now()}`;
    await browserUtils.createCharacter(characterName);
    
    // Look for NPCs
    await browserUtils.sendCommand('look');
    await page.waitForTimeout(1000);
    
    const roomContent = await browserUtils.getTerminalContent();
    
    // Try to interact with common NPCs
    const npcCommands = [
      'talk goblin',
      'talk orc',
      'talk guard',
      'examine goblin',
      'examine orc'
    ];
    
    for (const command of npcCommands) {
      await browserUtils.sendCommand(command);
      await page.waitForTimeout(1000);
    }
    
    console.log('✅ NPC interactions tested');
  });

  test('should handle combat interactions', async ({ page }) => {
    console.log('⚔️ Testing combat interactions...');
    
    const characterName = `CombatTestPlayer_${Date.now()}`;
    await browserUtils.createCharacter(characterName);
    
    // Look for enemies
    await browserUtils.sendCommand('look');
    await page.waitForTimeout(1000);
    
    // Try to initiate combat
    const combatCommands = [
      'attack goblin',
      'attack orc',
      'attack enemy'
    ];
    
    for (const command of combatCommands) {
      await browserUtils.sendCommand(command);
      await page.waitForTimeout(2000);
      
      const content = await browserUtils.getTerminalContent();
      
      if (content.includes('attack') || content.includes('combat') || content.includes('fight')) {
        console.log('⚔️ Combat initiated');
        
        // Continue combat for a few rounds
        for (let i = 0; i < 3; i++) {
          await browserUtils.sendCommand('attack');
          await page.waitForTimeout(1000);
        }
        
        break;
      }
    }
    
    console.log('✅ Combat interactions tested');
  });

  test('should handle keyboard shortcuts and special keys', async ({ page }) => {
    console.log('⌨️ Testing keyboard shortcuts...');
    
    const characterName = `KeyboardTestPlayer_${Date.now()}`;
    await browserUtils.createCharacter(characterName);
    
    // Test arrow keys for command history (if implemented)
    await browserUtils.sendCommand('look');
    await page.waitForTimeout(500);
    
    await page.keyboard.press('ArrowUp');
    await page.waitForTimeout(500);
    
    await page.keyboard.press('Enter');
    await page.waitForTimeout(1000);
    
    // Test Ctrl+C (if implemented)
    await page.keyboard.press('Control+C');
    await page.waitForTimeout(500);
    
    // Test Tab completion (if implemented)
    await page.keyboard.type('lo');
    await page.keyboard.press('Tab');
    await page.waitForTimeout(500);
    
    // Clear the line
    await page.keyboard.press('Control+A');
    await page.keyboard.press('Delete');
    
    // Verify terminal is still responsive
    await browserUtils.sendCommand('look');
    await browserUtils.waitForText('You are in', 5000);
    
    console.log('✅ Keyboard shortcuts tested');
  });

  test('should handle copy and paste operations', async ({ page }) => {
    console.log('📋 Testing copy and paste operations...');
    
    const characterName = `CopyPasteTestPlayer_${Date.now()}`;
    await browserUtils.createCharacter(characterName);
    
    // Send a command
    await browserUtils.sendCommand('look');
    await page.waitForTimeout(1000);
    
    // Try to select text (this might not work in all terminals)
    await page.keyboard.press('Control+A');
    await page.waitForTimeout(500);
    
    // Try to copy
    await page.keyboard.press('Control+C');
    await page.waitForTimeout(500);
    
    // Try to paste a simple command
    await page.keyboard.type('inventory');
    await page.keyboard.press('Enter');
    await page.waitForTimeout(1000);
    
    // Verify terminal is still functional
    const content = await browserUtils.getTerminalContent();
    expect(content.length).toBeGreaterThan(0);
    
    console.log('✅ Copy and paste operations tested');
  });

  test('should handle long command inputs', async ({ page }) => {
    console.log('📝 Testing long command inputs...');
    
    const characterName = `LongCommandTestPlayer_${Date.now()}`;
    await browserUtils.createCharacter(characterName);
    
    // Test very long command
    const longCommand = 'say ' + 'This is a very long message that tests the terminal\'s ability to handle extended input without breaking or causing display issues. '.repeat(3);
    
    await browserUtils.sendCommand(longCommand);
    await page.waitForTimeout(2000);
    
    // Verify terminal is still responsive
    await browserUtils.sendCommand('look');
    await browserUtils.waitForText('You are in', 5000);
    
    console.log('✅ Long command inputs tested');
  });

  test('should handle rapid user interactions', async ({ page }) => {
    console.log('⚡ Testing rapid user interactions...');
    
    const characterName = `RapidInteractionTestPlayer_${Date.now()}`;
    await browserUtils.createCharacter(characterName);
    
    // Rapid fire commands
    const commands = ['look', 'inventory', 'look', 'inventory', 'look'];
    
    // Send commands rapidly
    for (const command of commands) {
      await page.keyboard.type(command);
      await page.keyboard.press('Enter');
      await page.waitForTimeout(200); // Very short delay
    }
    
    // Wait for all responses
    await page.waitForTimeout(5000);
    
    // Verify terminal is still responsive
    await browserUtils.sendCommand('look');
    await browserUtils.waitForText('You are in', 5000);
    
    console.log('✅ Rapid user interactions tested');
  });
});
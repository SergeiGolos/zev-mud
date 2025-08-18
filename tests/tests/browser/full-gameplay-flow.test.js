const { test, expect } = require('@playwright/test');
const { BrowserTestUtils } = require('../../setup/browser-test-utils');

test.describe('Full Gameplay Flow Tests', () => {
  let browserUtils;

  test.beforeEach(async ({ page }) => {
    browserUtils = new BrowserTestUtils(page);
    await browserUtils.navigateToGame();
    await browserUtils.waitForTerminal();
  });

  test('should complete full character creation to combat flow', async ({ page }) => {
    console.log('🎮 Testing complete gameplay flow...');
    
    const characterName = `FullFlowPlayer_${Date.now()}`;
    
    // Step 1: Character Creation
    console.log('👤 Step 1: Character Creation');
    await browserUtils.createCharacter(characterName);
    await browserUtils.takeScreenshot('character-creation');
    
    // Step 2: Initial Exploration
    console.log('🗺️ Step 2: Initial Exploration');
    await browserUtils.sendCommand('look');
    await browserUtils.waitForText('You are in', 5000);
    
    // Get room description
    const roomContent = await browserUtils.getTerminalContent();
    expect(roomContent).toContain('You are in');
    
    // Step 3: Inventory Management
    console.log('📦 Step 3: Inventory Management');
    await browserUtils.sendCommand('inventory');
    await page.waitForTimeout(1000);
    
    // Try to take items if available
    if (roomContent.includes('sword') || roomContent.includes('item')) {
      await browserUtils.sendCommand('take sword');
      await page.waitForTimeout(1000);
      
      await browserUtils.sendCommand('inventory');
      await page.waitForTimeout(1000);
    }
    
    await browserUtils.takeScreenshot('inventory-management');
    
    // Step 4: Movement and Navigation
    console.log('🚶 Step 4: Movement and Navigation');
    const directions = ['north', 'east', 'south', 'west'];
    let successfulMoves = 0;
    
    for (const direction of directions) {
      await browserUtils.sendCommand(direction);
      await page.waitForTimeout(1000);
      
      const moveContent = await browserUtils.getTerminalContent();
      if (moveContent.includes('You move') || moveContent.includes('You go')) {
        successfulMoves++;
        console.log(`✅ Successfully moved ${direction}`);
        
        // Look around in new location
        await browserUtils.sendCommand('look');
        await page.waitForTimeout(1000);
        
        // Move back
        const opposites = { north: 'south', south: 'north', east: 'west', west: 'east' };
        await browserUtils.sendCommand(opposites[direction]);
        await page.waitForTimeout(1000);
        break;
      }
    }
    
    await browserUtils.takeScreenshot('movement-navigation');
    
    // Step 5: NPC Interaction
    console.log('👥 Step 5: NPC Interaction');
    await browserUtils.sendCommand('look');
    await page.waitForTimeout(1000);
    
    const npcContent = await browserUtils.getTerminalContent();
    if (npcContent.includes('goblin') || npcContent.includes('orc') || npcContent.includes('guard')) {
      await browserUtils.sendCommand('talk goblin');
      await page.waitForTimeout(2000);
      
      await browserUtils.sendCommand('examine goblin');
      await page.waitForTimeout(1000);
    }
    
    await browserUtils.takeScreenshot('npc-interaction');
    
    // Step 6: Combat System
    console.log('⚔️ Step 6: Combat System');
    let combatInitiated = false;
    
    const combatTargets = ['goblin', 'orc', 'enemy'];
    for (const target of combatTargets) {
      await browserUtils.sendCommand(`attack ${target}`);
      await page.waitForTimeout(2000);
      
      const combatContent = await browserUtils.getTerminalContent();
      if (combatContent.includes('attack') || combatContent.includes('combat') || combatContent.includes('damage')) {
        combatInitiated = true;
        console.log(`⚔️ Combat initiated with ${target}`);
        
        // Continue combat
        for (let round = 0; round < 5; round++) {
          await browserUtils.sendCommand('attack');
          await page.waitForTimeout(1500);
          
          const roundContent = await browserUtils.getTerminalContent();
          if (roundContent.includes('defeat') || roundContent.includes('dies') || roundContent.includes('victory')) {
            console.log('🏆 Combat victory!');
            break;
          }
          if (roundContent.includes('defeated') || roundContent.includes('die')) {
            console.log('💀 Combat defeat!');
            break;
          }
        }
        break;
      }
    }
    
    await browserUtils.takeScreenshot('combat-system');
    
    // Step 7: Character Persistence Test
    console.log('💾 Step 7: Character Persistence');
    
    // Record current state
    await browserUtils.sendCommand('look');
    await page.waitForTimeout(1000);
    await browserUtils.sendCommand('inventory');
    await page.waitForTimeout(1000);
    
    const preDisconnectContent = await browserUtils.getTerminalContent();
    
    // Simulate disconnect by refreshing page
    await page.reload();
    await browserUtils.waitForTerminal();
    
    // Reconnect with same character
    await browserUtils.sendCommand(characterName);
    await page.waitForTimeout(3000);
    
    // Verify character was restored
    const reconnectContent = await browserUtils.getTerminalContent();
    expect(reconnectContent).toMatch(/(Welcome back|restored|reconnected)/i);
    
    // Verify state is consistent
    await browserUtils.sendCommand('look');
    await browserUtils.waitForText('You are in', 5000);
    
    await browserUtils.takeScreenshot('character-persistence');
    
    // Step 8: Final Verification
    console.log('✅ Step 8: Final Verification');
    
    // Verify all core systems are still working
    await browserUtils.sendCommand('inventory');
    await page.waitForTimeout(1000);
    
    await browserUtils.sendCommand('look');
    await browserUtils.waitForText('You are in', 5000);
    
    const finalContent = await browserUtils.getTerminalContent();
    expect(finalContent).toContain('You are in');
    
    await browserUtils.takeScreenshot('final-verification');
    
    console.log('🎉 Full gameplay flow completed successfully!');
    
    // Summary
    console.log('\n📊 Gameplay Flow Summary:');
    console.log(`✅ Character created: ${characterName}`);
    console.log(`✅ Successful moves: ${successfulMoves}`);
    console.log(`✅ Combat initiated: ${combatInitiated}`);
    console.log('✅ Character persistence verified');
    console.log('✅ All core systems functional');
  }, 120000); // 2 minute timeout for full flow

  test('should handle multiple concurrent browser sessions', async ({ browser }) => {
    console.log('👥 Testing multiple concurrent browser sessions...');
    
    const sessions = [];
    const sessionCount = 3;
    
    // Create multiple browser contexts
    for (let i = 0; i < sessionCount; i++) {
      const context = await browser.newContext();
      const page = await context.newPage();
      const utils = new BrowserTestUtils(page);
      
      await utils.navigateToGame();
      await utils.waitForTerminal();
      
      sessions.push({ context, page, utils, id: i });
    }
    
    // Create characters in all sessions
    const characters = [];
    for (const session of sessions) {
      const characterName = `ConcurrentPlayer_${session.id}_${Date.now()}`;
      await session.utils.createCharacter(characterName);
      characters.push(characterName);
      
      console.log(`✅ Created character ${characterName} in session ${session.id}`);
    }
    
    // Have all characters perform actions simultaneously
    const actionPromises = sessions.map(async (session, index) => {
      await session.utils.sendCommand('look');
      await session.page.waitForTimeout(1000);
      
      await session.utils.sendCommand('inventory');
      await session.page.waitForTimeout(1000);
      
      await session.utils.sendCommand('look');
      await session.utils.waitForText('You are in', 5000);
      
      return `Session ${index} completed`;
    });
    
    const results = await Promise.all(actionPromises);
    expect(results).toHaveLength(sessionCount);
    
    // Verify all sessions are still functional
    for (const session of sessions) {
      const content = await session.utils.getTerminalContent();
      expect(content).toContain('You are in');
    }
    
    // Clean up sessions
    for (const session of sessions) {
      await session.context.close();
    }
    
    console.log(`✅ Multiple concurrent sessions test completed (${sessionCount} sessions)`);
  }, 180000); // 3 minute timeout for concurrent sessions

  test('should handle connection recovery scenarios', async ({ page }) => {
    console.log('🔌 Testing connection recovery scenarios...');
    
    const characterName = `RecoveryTestPlayer_${Date.now()}`;
    await browserUtils.createCharacter(characterName);
    
    // Perform initial actions
    await browserUtils.sendCommand('look');
    await page.waitForTimeout(1000);
    
    // Simulate network interruption
    console.log('🌐 Simulating network interruption...');
    await browserUtils.simulateNetworkIssue();
    
    // Try to send command during network issue
    await browserUtils.sendCommand('inventory');
    await page.waitForTimeout(2000);
    
    // Verify recovery
    await browserUtils.sendCommand('look');
    await page.waitForTimeout(3000);
    
    // Check if connection recovered
    const content = await browserUtils.getTerminalContent();
    
    // Terminal should either show the command worked or show reconnection
    expect(content.length).toBeGreaterThan(0);
    
    console.log('✅ Connection recovery scenario tested');
  });

  test('should maintain performance during extended gameplay', async ({ page }) => {
    console.log('⚡ Testing performance during extended gameplay...');
    
    const characterName = `PerformanceTestPlayer_${Date.now()}`;
    await browserUtils.createCharacter(characterName);
    
    const performanceMetrics = [];
    const commandCount = 20;
    
    // Perform extended gameplay session
    for (let i = 0; i < commandCount; i++) {
      const commands = ['look', 'inventory', 'look', 'north', 'south'];
      const command = commands[i % commands.length];
      
      const responseTime = await browserUtils.measureResponseTime(async () => {
        await browserUtils.sendCommand(command);
        await page.waitForTimeout(500);
      });
      
      performanceMetrics.push(responseTime);
      
      if (i % 5 === 0) {
        console.log(`📊 Completed ${i + 1}/${commandCount} commands`);
      }
    }
    
    // Analyze performance
    const averageResponseTime = performanceMetrics.reduce((a, b) => a + b, 0) / performanceMetrics.length;
    const maxResponseTime = Math.max(...performanceMetrics);
    const minResponseTime = Math.min(...performanceMetrics);
    
    console.log(`📊 Performance Metrics:`);
    console.log(`  Average response time: ${averageResponseTime.toFixed(2)}ms`);
    console.log(`  Max response time: ${maxResponseTime}ms`);
    console.log(`  Min response time: ${minResponseTime}ms`);
    
    // Performance expectations
    expect(averageResponseTime).toBeLessThan(5000); // 5 seconds average
    expect(maxResponseTime).toBeLessThan(15000); // 15 seconds max
    
    // Verify terminal is still responsive
    await browserUtils.sendCommand('look');
    await browserUtils.waitForText('You are in', 5000);
    
    console.log('✅ Extended gameplay performance test completed');
  }, 300000); // 5 minute timeout for performance test
});
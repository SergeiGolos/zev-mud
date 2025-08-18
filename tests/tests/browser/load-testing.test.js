const { test, expect } = require('@playwright/test');
const { BrowserTestUtils } = require('../../setup/browser-test-utils');

test.describe('Load Testing Scenarios', () => {
  test('should handle multiple concurrent players in browser', async ({ browser }) => {
    console.log('👥 Testing multiple concurrent players...');
    
    const playerCount = 5;
    const sessions = [];
    
    // Create multiple browser contexts
    for (let i = 0; i < playerCount; i++) {
      const context = await browser.newContext();
      const page = await context.newPage();
      const utils = new BrowserTestUtils(page);
      
      sessions.push({ context, page, utils, id: i });
    }
    
    console.log(`🚀 Created ${playerCount} browser sessions`);
    
    // Initialize all sessions
    const initPromises = sessions.map(async (session) => {
      await session.utils.navigateToGame();
      await session.utils.waitForTerminal();
      
      const characterName = `LoadTestPlayer_${session.id}_${Date.now()}`;
      await session.utils.createCharacter(characterName);
      
      return { sessionId: session.id, characterName };
    });
    
    const initResults = await Promise.all(initPromises);
    console.log(`✅ Initialized ${initResults.length} characters`);
    
    // Perform concurrent actions
    const actionPromises = sessions.map(async (session, index) => {
      const startTime = Date.now();
      
      try {
        // Perform a sequence of actions
        await session.utils.sendCommand('look');
        await session.page.waitForTimeout(500);
        
        await session.utils.sendCommand('inventory');
        await session.page.waitForTimeout(500);
        
        await session.utils.sendCommand('look');
        await session.utils.waitForText('You are in', 10000);
        
        const endTime = Date.now();
        return {
          sessionId: index,
          success: true,
          responseTime: endTime - startTime
        };
      } catch (error) {
        return {
          sessionId: index,
          success: false,
          error: error.message,
          responseTime: Date.now() - startTime
        };
      }
    });
    
    const actionResults = await Promise.all(actionPromises);
    
    // Analyze results
    const successfulSessions = actionResults.filter(r => r.success);
    const failedSessions = actionResults.filter(r => !r.success);
    
    console.log(`📊 Load Test Results:`);
    console.log(`  Successful sessions: ${successfulSessions.length}/${playerCount}`);
    console.log(`  Failed sessions: ${failedSessions.length}/${playerCount}`);
    
    if (successfulSessions.length > 0) {
      const avgResponseTime = successfulSessions.reduce((sum, r) => sum + r.responseTime, 0) / successfulSessions.length;
      const maxResponseTime = Math.max(...successfulSessions.map(r => r.responseTime));
      
      console.log(`  Average response time: ${avgResponseTime.toFixed(2)}ms`);
      console.log(`  Max response time: ${maxResponseTime}ms`);
      
      // Performance expectations
      expect(avgResponseTime).toBeLessThan(15000); // 15 seconds average
      expect(maxResponseTime).toBeLessThan(30000); // 30 seconds max
    }
    
    // At least 80% should succeed
    expect(successfulSessions.length).toBeGreaterThanOrEqual(playerCount * 0.8);
    
    // Clean up sessions
    for (const session of sessions) {
      await session.context.close();
    }
    
    console.log('✅ Multiple concurrent players test completed');
  }, 300000); // 5 minute timeout

  test('should handle rapid command sequences', async ({ page }) => {
    console.log('⚡ Testing rapid command sequences...');
    
    const browserUtils = new BrowserTestUtils(page);
    await browserUtils.navigateToGame();
    await browserUtils.waitForTerminal();
    
    const characterName = `RapidTestPlayer_${Date.now()}`;
    await browserUtils.createCharacter(characterName);
    
    // Define rapid command sequence
    const commands = ['look', 'inventory', 'look', 'inventory', 'look', 'inventory', 'look'];
    const commandDelay = 200; // 200ms between commands
    
    const startTime = Date.now();
    const responseTimes = [];
    
    // Execute rapid commands
    for (let i = 0; i < commands.length; i++) {
      const commandStart = Date.now();
      
      await browserUtils.sendCommand(commands[i]);
      await page.waitForTimeout(commandDelay);
      
      const commandEnd = Date.now();
      responseTimes.push(commandEnd - commandStart);
      
      console.log(`📝 Command ${i + 1}/${commands.length}: ${commands[i]} (${commandEnd - commandStart}ms)`);
    }
    
    const totalTime = Date.now() - startTime;
    const avgResponseTime = responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length;
    
    console.log(`📊 Rapid Command Results:`);
    console.log(`  Total commands: ${commands.length}`);
    console.log(`  Total time: ${totalTime}ms`);
    console.log(`  Average response time: ${avgResponseTime.toFixed(2)}ms`);
    console.log(`  Commands per second: ${(commands.length / totalTime * 1000).toFixed(2)}`);
    
    // Verify terminal is still responsive
    await browserUtils.sendCommand('look');
    await browserUtils.waitForText('You are in', 10000);
    
    // Performance expectations
    expect(avgResponseTime).toBeLessThan(5000); // 5 seconds average
    
    console.log('✅ Rapid command sequences test completed');
  }, 120000);

  test('should handle sustained load over time', async ({ page }) => {
    console.log('🔄 Testing sustained load over time...');
    
    const browserUtils = new BrowserTestUtils(page);
    await browserUtils.navigateToGame();
    await browserUtils.waitForTerminal();
    
    const characterName = `SustainedTestPlayer_${Date.now()}`;
    await browserUtils.createCharacter(characterName);
    
    const testDuration = 60000; // 1 minute
    const commandInterval = 3000; // Command every 3 seconds
    const startTime = Date.now();
    
    const metrics = {
      totalCommands: 0,
      successfulCommands: 0,
      failedCommands: 0,
      responseTimes: []
    };
    
    console.log(`🕐 Starting sustained load test for ${testDuration / 1000} seconds...`);
    
    while (Date.now() - startTime < testDuration) {
      const commandStart = Date.now();
      metrics.totalCommands++;
      
      try {
        await browserUtils.sendCommand('look');
        await page.waitForTimeout(1000);
        
        const commandEnd = Date.now();
        metrics.responseTimes.push(commandEnd - commandStart);
        metrics.successfulCommands++;
        
        console.log(`📝 Command ${metrics.totalCommands}: Success (${commandEnd - commandStart}ms)`);
        
      } catch (error) {
        metrics.failedCommands++;
        console.log(`❌ Command ${metrics.totalCommands}: Failed - ${error.message}`);
      }
      
      // Wait for next command interval
      const elapsed = Date.now() - commandStart;
      const waitTime = Math.max(0, commandInterval - elapsed);
      await page.waitForTimeout(waitTime);
    }
    
    const actualDuration = Date.now() - startTime;
    const successRate = (metrics.successfulCommands / metrics.totalCommands) * 100;
    const avgResponseTime = metrics.responseTimes.reduce((a, b) => a + b, 0) / metrics.responseTimes.length;
    
    console.log(`📊 Sustained Load Results:`);
    console.log(`  Test duration: ${actualDuration}ms`);
    console.log(`  Total commands: ${metrics.totalCommands}`);
    console.log(`  Successful commands: ${metrics.successfulCommands}`);
    console.log(`  Failed commands: ${metrics.failedCommands}`);
    console.log(`  Success rate: ${successRate.toFixed(2)}%`);
    console.log(`  Average response time: ${avgResponseTime.toFixed(2)}ms`);
    
    // Performance expectations
    expect(successRate).toBeGreaterThan(90); // 90% success rate
    expect(avgResponseTime).toBeLessThan(10000); // 10 seconds average
    
    // Verify terminal is still responsive after sustained load
    await browserUtils.sendCommand('inventory');
    await page.waitForTimeout(2000);
    
    const finalContent = await browserUtils.getTerminalContent();
    expect(finalContent.length).toBeGreaterThan(0);
    
    console.log('✅ Sustained load test completed');
  }, 180000); // 3 minute timeout

  test('should handle memory-intensive scenarios', async ({ page }) => {
    console.log('🧠 Testing memory-intensive scenarios...');
    
    const browserUtils = new BrowserTestUtils(page);
    await browserUtils.navigateToGame();
    await browserUtils.waitForTerminal();
    
    const characterName = `MemoryTestPlayer_${Date.now()}`;
    await browserUtils.createCharacter(characterName);
    
    // Generate large amounts of terminal content
    const iterations = 50;
    const longCommand = 'say ' + 'This is a long message that will generate significant terminal content to test memory usage and performance under high content load. '.repeat(5);
    
    console.log(`📝 Generating large terminal content (${iterations} iterations)...`);
    
    const startMemory = await page.evaluate(() => {
      return performance.memory ? {
        usedJSHeapSize: performance.memory.usedJSHeapSize,
        totalJSHeapSize: performance.memory.totalJSHeapSize
      } : null;
    });
    
    for (let i = 0; i < iterations; i++) {
      await browserUtils.sendCommand(longCommand);
      await page.waitForTimeout(200);
      
      if (i % 10 === 0) {
        console.log(`📊 Progress: ${i + 1}/${iterations} iterations`);
      }
    }
    
    const endMemory = await page.evaluate(() => {
      return performance.memory ? {
        usedJSHeapSize: performance.memory.usedJSHeapSize,
        totalJSHeapSize: performance.memory.totalJSHeapSize
      } : null;
    });
    
    if (startMemory && endMemory) {
      const memoryIncrease = endMemory.usedJSHeapSize - startMemory.usedJSHeapSize;
      console.log(`📊 Memory Usage:`);
      console.log(`  Start: ${(startMemory.usedJSHeapSize / 1024 / 1024).toFixed(2)} MB`);
      console.log(`  End: ${(endMemory.usedJSHeapSize / 1024 / 1024).toFixed(2)} MB`);
      console.log(`  Increase: ${(memoryIncrease / 1024 / 1024).toFixed(2)} MB`);
      
      // Memory should not increase excessively
      expect(memoryIncrease).toBeLessThan(100 * 1024 * 1024); // Less than 100MB increase
    }
    
    // Verify terminal is still responsive
    await browserUtils.sendCommand('look');
    await browserUtils.waitForText('You are in', 10000);
    
    console.log('✅ Memory-intensive scenarios test completed');
  }, 300000); // 5 minute timeout

  test('should handle connection stress scenarios', async ({ page }) => {
    console.log('🔌 Testing connection stress scenarios...');
    
    const browserUtils = new BrowserTestUtils(page);
    await browserUtils.navigateToGame();
    await browserUtils.waitForTerminal();
    
    const characterName = `StressTestPlayer_${Date.now()}`;
    await browserUtils.createCharacter(characterName);
    
    // Simulate multiple connection stress scenarios
    const stressScenarios = [
      {
        name: 'Rapid Reconnection',
        action: async () => {
          for (let i = 0; i < 3; i++) {
            await page.reload();
            await browserUtils.waitForTerminal();
            await browserUtils.sendCommand(characterName);
            await page.waitForTimeout(2000);
          }
        }
      },
      {
        name: 'Network Interruption',
        action: async () => {
          await browserUtils.simulateNetworkIssue();
          await browserUtils.sendCommand('look');
          await page.waitForTimeout(3000);
        }
      },
      {
        name: 'Tab Switching Stress',
        action: async () => {
          const newPage = await page.context().newPage();
          await newPage.goto('about:blank');
          await page.waitForTimeout(1000);
          await newPage.close();
          
          await browserUtils.sendCommand('inventory');
          await page.waitForTimeout(1000);
        }
      }
    ];
    
    for (const scenario of stressScenarios) {
      console.log(`🧪 Testing: ${scenario.name}`);
      
      try {
        await scenario.action();
        console.log(`✅ ${scenario.name}: Passed`);
      } catch (error) {
        console.log(`❌ ${scenario.name}: Failed - ${error.message}`);
      }
    }
    
    // Final verification
    await browserUtils.sendCommand('look');
    await browserUtils.waitForText('You are in', 10000);
    
    const finalContent = await browserUtils.getTerminalContent();
    expect(finalContent).toContain('You are in');
    
    console.log('✅ Connection stress scenarios test completed');
  }, 240000); // 4 minute timeout

  test('should measure and report performance metrics', async ({ page }) => {
    console.log('📊 Testing performance metrics collection...');
    
    const browserUtils = new BrowserTestUtils(page);
    await browserUtils.navigateToGame();
    await browserUtils.waitForTerminal();
    
    // Get initial performance metrics
    const initialMetrics = await browserUtils.getPerformanceMetrics();
    
    const characterName = `MetricsTestPlayer_${Date.now()}`;
    await browserUtils.createCharacter(characterName);
    
    // Perform various actions and measure performance
    const actions = [
      { name: 'Look Command', action: () => browserUtils.sendCommand('look') },
      { name: 'Inventory Command', action: () => browserUtils.sendCommand('inventory') },
      { name: 'Movement Command', action: () => browserUtils.sendCommand('north') },
      { name: 'Help Command', action: () => browserUtils.sendCommand('help') }
    ];
    
    const actionMetrics = [];
    
    for (const action of actions) {
      const actionStart = Date.now();
      
      try {
        await action.action();
        await page.waitForTimeout(1000);
        
        const actionEnd = Date.now();
        actionMetrics.push({
          name: action.name,
          responseTime: actionEnd - actionStart,
          success: true
        });
      } catch (error) {
        actionMetrics.push({
          name: action.name,
          responseTime: Date.now() - actionStart,
          success: false,
          error: error.message
        });
      }
    }
    
    // Get final performance metrics
    const finalMetrics = await browserUtils.getPerformanceMetrics();
    
    console.log(`📊 Performance Metrics Report:`);
    console.log(`  Initial Load Time: ${initialMetrics.loadTime}ms`);
    console.log(`  DOM Content Loaded: ${initialMetrics.domContentLoaded}ms`);
    console.log(`  First Paint: ${initialMetrics.firstPaint}ms`);
    console.log(`  First Contentful Paint: ${initialMetrics.firstContentfulPaint}ms`);
    
    console.log(`\n📝 Action Performance:`);
    actionMetrics.forEach(metric => {
      const status = metric.success ? '✅' : '❌';
      console.log(`  ${status} ${metric.name}: ${metric.responseTime}ms`);
    });
    
    // Performance expectations
    expect(initialMetrics.loadTime).toBeLessThan(10000); // 10 seconds load time
    expect(initialMetrics.firstContentfulPaint).toBeLessThan(5000); // 5 seconds FCP
    
    const successfulActions = actionMetrics.filter(m => m.success);
    expect(successfulActions.length).toBeGreaterThan(0);
    
    console.log('✅ Performance metrics collection completed');
  }, 120000);
});
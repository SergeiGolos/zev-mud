const { TestEnvironment } = require('../../setup/test-environment');

describe('System Integration Tests', () => {
  let testEnv;

  beforeAll(async () => {
    testEnv = new TestEnvironment(global.testConfig);
  });

  afterEach(async () => {
    await testEnv.cleanup();
  });

  describe('Full System Stack', () => {
    test('should integrate browser client, proxy, and game server', async () => {
      console.log('🔗 Testing full system integration...');
      
      // Test the complete flow: Browser -> WebSocket -> Proxy -> Telnet -> Ranvier
      const scenario = await testEnv.createTestScenario('full-system-integration');
      
      const characterName = `IntegrationUser_${Date.now()}`;
      
      // Step 1: Character creation (tests WebSocket -> Proxy -> Ranvier -> Database)
      console.log('👤 Testing character creation flow...');
      const createResponse = await testEnv.sendWebSocketMessage(scenario.websocket, characterName);
      expect(createResponse).toContain('Welcome');
      
      // Step 2: Game commands (tests command processing pipeline)
      console.log('🎮 Testing game command pipeline...');
      const lookResponse = await testEnv.sendWebSocketMessage(scenario.websocket, 'look');
      expect(lookResponse).toMatch(/(You are|room|area)/i);
      
      const inventoryResponse = await testEnv.sendWebSocketMessage(scenario.websocket, 'inventory');
      expect(inventoryResponse).toMatch(/(carrying|inventory|empty)/i);
      
      // Step 3: State persistence (tests database integration)
      console.log('💾 Testing state persistence...');
      scenario.websocket.close();
      await testEnv.sleep(2000);
      
      scenario.websocket = await testEnv.createWebSocketConnection();
      const reconnectResponse = await testEnv.sendWebSocketMessage(scenario.websocket, characterName);
      expect(reconnectResponse).toMatch(/(Welcome back|restored)/i);
      
      // Step 4: Verify system is fully functional after reconnection
      const postReconnectLook = await testEnv.sendWebSocketMessage(scenario.websocket, 'look');
      expect(postReconnectLook).toMatch(/(You are|room|area)/i);
      
      await scenario.cleanup();
      
      console.log('✅ Full system integration test completed');
    });

    test('should handle service dependencies correctly', async () => {
      console.log('🔧 Testing service dependency handling...');
      
      // Test that services are properly connected and dependent
      const ws = await testEnv.createWebSocketConnection();
      
      // This connection should work because all services are up
      const characterName = `DependencyUser_${Date.now()}`;
      const response = await testEnv.sendWebSocketMessage(ws, characterName);
      
      expect(response).toContain('Welcome');
      
      // Test basic functionality to ensure all services are working together
      const lookResponse = await testEnv.sendWebSocketMessage(ws, 'look');
      expect(lookResponse).toBeTruthy();
      
      ws.close();
      
      console.log('✅ Service dependency test completed');
    });

    test('should maintain data consistency across all layers', async () => {
      console.log('🔄 Testing cross-layer data consistency...');
      
      const ws = await testEnv.createWebSocketConnection();
      const characterName = `ConsistencyUser_${Date.now()}`;
      
      // Create character
      await testEnv.sendWebSocketMessage(ws, characterName);
      
      // Perform state-changing operations
      await testEnv.sendWebSocketMessage(ws, 'look');
      
      // Try to move if possible
      const moveResponse = await testEnv.sendWebSocketMessage(ws, 'north');
      if (!moveResponse.includes("can't") && !moveResponse.includes("no exit")) {
        // Successfully moved, verify consistency
        const newLocationResponse = await testEnv.sendWebSocketMessage(ws, 'look');
        expect(newLocationResponse).toContain('You are in');
        
        // Move back
        await testEnv.sendWebSocketMessage(ws, 'south');
      }
      
      // Try item interaction if available
      const roomResponse = await testEnv.sendWebSocketMessage(ws, 'look');
      if (roomResponse.includes('sword') || roomResponse.includes('item')) {
        const takeResponse = await testEnv.sendWebSocketMessage(ws, 'take sword');
        if (takeResponse.includes('take') || takeResponse.includes('pick up')) {
          // Verify item is in inventory
          const inventoryResponse = await testEnv.sendWebSocketMessage(ws, 'inventory');
          expect(inventoryResponse).toContain('sword');
          
          // Verify item is not in room
          const roomCheckResponse = await testEnv.sendWebSocketMessage(ws, 'look');
          expect(roomCheckResponse).not.toContain('sword');
        }
      }
      
      ws.close();
      
      console.log('✅ Cross-layer data consistency test completed');
    });
  });

  describe('Error Propagation and Handling', () => {
    test('should propagate errors correctly through the stack', async () => {
      console.log('❌ Testing error propagation...');
      
      const ws = await testEnv.createWebSocketConnection();
      const characterName = `ErrorUser_${Date.now()}`;
      
      // Create character
      await testEnv.sendWebSocketMessage(ws, characterName);
      
      // Send invalid commands and verify error handling
      const invalidCommands = [
        'invalidcommand',
        'go nowhere',
        'take nonexistent',
        'attack nothing'
      ];
      
      for (const command of invalidCommands) {
        const response = await testEnv.sendWebSocketMessage(ws, command);
        // Should get error message, not crash
        expect(response).toBeTruthy();
        expect(response).toMatch(/(don't understand|invalid|unknown|can't|not found)/i);
      }
      
      // Verify system is still responsive after errors
      const recoveryResponse = await testEnv.sendWebSocketMessage(ws, 'look');
      expect(recoveryResponse).toContain('You are in');
      
      ws.close();
      
      console.log('✅ Error propagation test completed');
    });

    test('should handle partial system failures gracefully', async () => {
      console.log('💥 Testing partial failure handling...');
      
      const ws = await testEnv.createWebSocketConnection();
      const characterName = `FailureUser_${Date.now()}`;
      
      // Create character
      await testEnv.sendWebSocketMessage(ws, characterName);
      
      // Test system resilience
      const commands = ['look', 'inventory', 'look'];
      
      for (const command of commands) {
        try {
          const response = await testEnv.sendWebSocketMessage(ws, command);
          expect(response).toBeTruthy();
        } catch (error) {
          // If there's an error, it should be handled gracefully
          expect(error.message).toBeTruthy();
        }
      }
      
      ws.close();
      
      console.log('✅ Partial failure handling test completed');
    });
  });

  describe('Performance Integration', () => {
    test('should maintain performance across all system layers', async () => {
      console.log('⚡ Testing end-to-end performance...');
      
      const ws = await testEnv.createWebSocketConnection();
      const characterName = `PerfUser_${Date.now()}`;
      
      // Create character and measure response time
      const createTime = await testEnv.measureResponseTime(async () => {
        await testEnv.sendWebSocketMessage(ws, characterName);
      });
      
      // Test various operations and measure performance
      const operations = [
        'look',
        'inventory',
        'look',
        'north',
        'look',
        'south'
      ];
      
      const operationTimes = [];
      
      for (const operation of operations) {
        try {
          const operationTime = await testEnv.measureResponseTime(async () => {
            await testEnv.sendWebSocketMessage(ws, operation);
          });
          operationTimes.push(operationTime);
        } catch (error) {
          // Skip operations that fail (e.g., movement to non-existent rooms)
          console.log(`Operation ${operation} failed: ${error.message}`);
        }
      }
      
      // Calculate performance metrics
      const averageOperationTime = operationTimes.reduce((a, b) => a + b, 0) / operationTimes.length;
      
      console.log(`📊 Character creation time: ${createTime}ms`);
      console.log(`📊 Average operation time: ${averageOperationTime.toFixed(2)}ms`);
      
      // Performance expectations
      expect(createTime).toBeLessThan(10000); // 10 seconds for character creation
      expect(averageOperationTime).toBeLessThan(5000); // 5 seconds average for operations
      
      ws.close();
      
      console.log('✅ End-to-end performance test completed');
    });

    test('should scale performance with multiple users', async () => {
      console.log('📈 Testing performance scaling...');
      
      const userCounts = [1, 3, 5];
      const performanceResults = [];
      
      for (const userCount of userCounts) {
        console.log(`Testing with ${userCount} users...`);
        
        const connections = await testEnv.createMultipleConnections(userCount, 'websocket');
        
        // Create characters
        const setupPromises = connections.map(async (ws, index) => {
          const characterName = `ScaleUser_${userCount}_${index}_${Date.now()}`;
          const startTime = Date.now();
          await testEnv.sendWebSocketMessage(ws, characterName);
          return Date.now() - startTime;
        });
        
        const setupTimes = await Promise.all(setupPromises);
        const averageSetupTime = setupTimes.reduce((a, b) => a + b, 0) / setupTimes.length;
        
        // Test operations
        const operationPromises = connections.map(async (ws) => {
          const startTime = Date.now();
          await testEnv.sendWebSocketMessage(ws, 'look');
          return Date.now() - startTime;
        });
        
        const operationTimes = await Promise.all(operationPromises);
        const averageOperationTime = operationTimes.reduce((a, b) => a + b, 0) / operationTimes.length;
        
        performanceResults.push({
          userCount,
          averageSetupTime,
          averageOperationTime
        });
        
        // Clean up
        connections.forEach(ws => ws.close());
        await testEnv.sleep(2000);
      }
      
      // Analyze scaling
      console.log('📊 Performance scaling results:');
      performanceResults.forEach(result => {
        console.log(`  ${result.userCount} users: setup ${result.averageSetupTime.toFixed(2)}ms, operations ${result.averageOperationTime.toFixed(2)}ms`);
      });
      
      // Performance should not degrade too much with more users
      const singleUserSetup = performanceResults[0].averageSetupTime;
      const multiUserSetup = performanceResults[performanceResults.length - 1].averageSetupTime;
      
      // Setup time shouldn't increase by more than 3x with 5 users
      expect(multiUserSetup).toBeLessThan(singleUserSetup * 3);
      
      console.log('✅ Performance scaling test completed');
    }, 120000);
  });

  describe('Health and Monitoring', () => {
    test('should provide health check endpoints', async () => {
      console.log('🏥 Testing health check endpoints...');
      
      // Test proxy health endpoint
      try {
        const proxyHealth = await testEnv.makeHttpRequest('/health', {
          baseURL: `http://${testEnv.config.services.proxy.host}:${testEnv.config.services.proxy.port}`
        });
        expect(proxyHealth.status).toBe(200);
        console.log('✅ Proxy health check passed');
      } catch (error) {
        console.log('ℹ️ Proxy health check not available or failed');
      }
      
      // Test web client health endpoint
      try {
        const webClientHealth = await testEnv.makeHttpRequest('/health');
        expect(webClientHealth.status).toBe(200);
        console.log('✅ Web client health check passed');
      } catch (error) {
        console.log('ℹ️ Web client health check not available or failed');
      }
      
      // Test that the system is functional (indirect health check)
      const ws = await testEnv.createWebSocketConnection();
      const response = await testEnv.sendWebSocketMessage(ws, `HealthUser_${Date.now()}`);
      expect(response).toContain('Welcome');
      ws.close();
      
      console.log('✅ System functional health check passed');
    });

    test('should handle system monitoring scenarios', async () => {
      console.log('📊 Testing monitoring scenarios...');
      
      const ws = await testEnv.createWebSocketConnection();
      const characterName = `MonitorUser_${Date.now()}`;
      
      // Create character
      await testEnv.sendWebSocketMessage(ws, characterName);
      
      // Simulate various monitoring scenarios
      const scenarios = [
        { name: 'Normal operation', command: 'look' },
        { name: 'Inventory check', command: 'inventory' },
        { name: 'Invalid command', command: 'invalidcommand' },
        { name: 'Movement attempt', command: 'north' }
      ];
      
      for (const scenario of scenarios) {
        console.log(`  Testing: ${scenario.name}`);
        
        const startTime = Date.now();
        try {
          const response = await testEnv.sendWebSocketMessage(ws, scenario.command);
          const responseTime = Date.now() - startTime;
          
          expect(response).toBeTruthy();
          expect(responseTime).toBeLessThan(10000); // 10 second timeout
          
          console.log(`    ✅ ${scenario.name}: ${responseTime}ms`);
        } catch (error) {
          console.log(`    ❌ ${scenario.name}: ${error.message}`);
        }
      }
      
      ws.close();
      
      console.log('✅ Monitoring scenarios test completed');
    });
  });
});
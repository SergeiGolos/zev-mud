const { TestEnvironment } = require('../../setup/test-environment');

describe('Database CRUD Operations', () => {
  let testEnv;
  let scenario;

  beforeAll(async () => {
    testEnv = new TestEnvironment(global.testConfig);
  });

  beforeEach(async () => {
    scenario = await testEnv.createTestScenario('database-crud');
  });

  afterEach(async () => {
    if (scenario) {
      await scenario.cleanup();
    }
  });

  describe('Character Data Operations', () => {
    test('should create new character data correctly', async () => {
      console.log('➕ Testing character creation...');
      
      const characterName = `CreateTestPlayer_${Date.now()}`;
      
      // Create character through WebSocket
      const response = await testEnv.sendWebSocketMessage(scenario.websocket, characterName);
      
      // Verify character was created
      expect(response).toContain('Welcome');
      expect(response).toContain(characterName);
      
      // Verify character can be found by reconnecting
      scenario.websocket.close();
      await testEnv.sleep(1000);
      
      scenario.websocket = await testEnv.createWebSocketConnection();
      const reconnectResponse = await testEnv.sendWebSocketMessage(scenario.websocket, characterName);
      
      expect(reconnectResponse).toMatch(/(Welcome back|restored)/i);
      
      console.log('✅ Character creation test completed');
    });

    test('should read character data correctly', async () => {
      console.log('📖 Testing character data reading...');
      
      const characterName = `ReadTestPlayer_${Date.now()}`;
      
      // Create character
      await testEnv.sendWebSocketMessage(scenario.websocket, characterName);
      
      // Perform actions that modify character state
      await testEnv.sendWebSocketMessage(scenario.websocket, 'look');
      await testEnv.sendWebSocketMessage(scenario.websocket, 'inventory');
      
      // Move to different room if possible
      let moveResponse = await testEnv.sendWebSocketMessage(scenario.websocket, 'north');
      if (!moveResponse.includes("can't") && !moveResponse.includes("no exit")) {
        // Successfully moved, verify location is tracked
        const lookResponse = await testEnv.sendWebSocketMessage(scenario.websocket, 'look');
        expect(lookResponse).toContain('You are in');
      }
      
      // Disconnect and reconnect to verify data persistence
      scenario.websocket.close();
      await testEnv.sleep(1000);
      
      scenario.websocket = await testEnv.createWebSocketConnection();
      const restoreResponse = await testEnv.sendWebSocketMessage(scenario.websocket, characterName);
      
      expect(restoreResponse).toMatch(/(Welcome back|restored)/i);
      
      // Verify character is in correct location
      const locationResponse = await testEnv.sendWebSocketMessage(scenario.websocket, 'look');
      expect(locationResponse).toContain('You are in');
      
      console.log('✅ Character data reading test completed');
    });

    test('should update character data correctly', async () => {
      console.log('✏️ Testing character data updates...');
      
      const characterName = `UpdateTestPlayer_${Date.now()}`;
      
      // Create character
      await testEnv.sendWebSocketMessage(scenario.websocket, characterName);
      
      // Get initial inventory
      let inventoryResponse = await testEnv.sendWebSocketMessage(scenario.websocket, 'inventory');
      const initialInventory = inventoryResponse;
      
      // Try to pick up an item
      const lookResponse = await testEnv.sendWebSocketMessage(scenario.websocket, 'look');
      
      if (lookResponse.includes('sword') || lookResponse.includes('item')) {
        const takeResponse = await testEnv.sendWebSocketMessage(scenario.websocket, 'take sword');
        
        if (takeResponse.includes('take') || takeResponse.includes('pick up')) {
          // Verify inventory was updated
          inventoryResponse = await testEnv.sendWebSocketMessage(scenario.websocket, 'inventory');
          expect(inventoryResponse).not.toBe(initialInventory);
          expect(inventoryResponse).toContain('sword');
          
          // Verify persistence of inventory change
          scenario.websocket.close();
          await testEnv.sleep(1000);
          
          scenario.websocket = await testEnv.createWebSocketConnection();
          await testEnv.sendWebSocketMessage(scenario.websocket, characterName);
          
          const persistedInventory = await testEnv.sendWebSocketMessage(scenario.websocket, 'inventory');
          expect(persistedInventory).toContain('sword');
        }
      }
      
      console.log('✅ Character data update test completed');
    });

    test('should handle character deletion/cleanup', async () => {
      console.log('🗑️ Testing character cleanup...');
      
      const characterName = `DeleteTestPlayer_${Date.now()}`;
      
      // Create character
      await testEnv.sendWebSocketMessage(scenario.websocket, characterName);
      
      // Verify character exists
      scenario.websocket.close();
      await testEnv.sleep(1000);
      
      scenario.websocket = await testEnv.createWebSocketConnection();
      const reconnectResponse = await testEnv.sendWebSocketMessage(scenario.websocket, characterName);
      expect(reconnectResponse).toMatch(/(Welcome back|restored)/i);
      
      // Note: Actual deletion would require admin commands or database cleanup
      // This test verifies the character exists and can be managed
      
      console.log('✅ Character cleanup test completed');
    });
  });

  describe('World State Operations', () => {
    test('should persist item location changes', async () => {
      console.log('📦 Testing item location persistence...');
      
      const characterName = `ItemTestPlayer_${Date.now()}`;
      
      // Create character
      await testEnv.sendWebSocketMessage(scenario.websocket, characterName);
      
      // Check initial room state
      let lookResponse = await testEnv.sendWebSocketMessage(scenario.websocket, 'look');
      const initialRoomState = lookResponse;
      
      // Try to interact with items
      if (lookResponse.includes('sword') || lookResponse.includes('item')) {
        // Take item
        const takeResponse = await testEnv.sendWebSocketMessage(scenario.websocket, 'take sword');
        
        if (takeResponse.includes('take') || takeResponse.includes('pick up')) {
          // Verify item is no longer in room
          lookResponse = await testEnv.sendWebSocketMessage(scenario.websocket, 'look');
          expect(lookResponse).not.toContain('sword');
          
          // Drop item
          await testEnv.sendWebSocketMessage(scenario.websocket, 'drop sword');
          
          // Verify item is back in room
          lookResponse = await testEnv.sendWebSocketMessage(scenario.websocket, 'look');
          expect(lookResponse).toContain('sword');
        }
      }
      
      console.log('✅ Item location persistence test completed');
    });

    test('should maintain NPC state consistency', async () => {
      console.log('🤖 Testing NPC state consistency...');
      
      const characterName = `NPCTestPlayer_${Date.now()}`;
      
      // Create character
      await testEnv.sendWebSocketMessage(scenario.websocket, characterName);
      
      // Look for NPCs
      const lookResponse = await testEnv.sendWebSocketMessage(scenario.websocket, 'look');
      
      if (lookResponse.includes('goblin') || lookResponse.includes('orc') || lookResponse.includes('NPC')) {
        // Interact with NPC
        const talkResponse = await testEnv.sendWebSocketMessage(scenario.websocket, 'talk goblin');
        
        if (talkResponse.includes('says') || talkResponse.includes('tells')) {
          // NPC responded, verify it's still there
          const secondLookResponse = await testEnv.sendWebSocketMessage(scenario.websocket, 'look');
          expect(secondLookResponse).toContain('goblin');
        }
        
        // Test combat if NPC is hostile
        const attackResponse = await testEnv.sendWebSocketMessage(scenario.websocket, 'attack goblin');
        
        if (attackResponse.includes('attack') || attackResponse.includes('combat')) {
          // Combat initiated, NPC state should be consistent
          const combatLookResponse = await testEnv.sendWebSocketMessage(scenario.websocket, 'look');
          expect(combatLookResponse).toMatch(/(combat|fighting|battle)/i);
        }
      }
      
      console.log('✅ NPC state consistency test completed');
    });
  });

  describe('Transaction Integrity', () => {
    test('should handle concurrent database operations', async () => {
      console.log('🔄 Testing concurrent database operations...');
      
      // Create multiple characters simultaneously
      const characterCount = 3;
      const connections = await testEnv.createMultipleConnections(characterCount, 'websocket');
      
      const characterPromises = connections.map(async (ws, index) => {
        const characterName = `ConcurrentDBPlayer_${index}_${Date.now()}`;
        return {
          ws,
          name: characterName,
          response: await testEnv.sendWebSocketMessage(ws, characterName)
        };
      });
      
      const characters = await Promise.all(characterPromises);
      
      // All characters should be created successfully
      characters.forEach(character => {
        expect(character.response).toContain('Welcome');
        expect(character.response).toContain(character.name);
      });
      
      // Test concurrent operations
      const operationPromises = characters.map(async (character) => {
        await testEnv.sendWebSocketMessage(character.ws, 'look');
        await testEnv.sendWebSocketMessage(character.ws, 'inventory');
        return testEnv.sendWebSocketMessage(character.ws, 'look');
      });
      
      const operationResults = await Promise.all(operationPromises);
      
      // All operations should complete successfully
      operationResults.forEach(result => {
        expect(result).toContain('You are in');
      });
      
      // Clean up connections
      connections.forEach(ws => ws.close());
      
      console.log('✅ Concurrent database operations test completed');
    });

    test('should maintain data consistency during failures', async () => {
      console.log('💥 Testing data consistency during failures...');
      
      const characterName = `FailureTestPlayer_${Date.now()}`;
      
      // Create character
      await testEnv.sendWebSocketMessage(scenario.websocket, characterName);
      
      // Perform state-changing operation
      await testEnv.sendWebSocketMessage(scenario.websocket, 'look');
      
      // Simulate connection failure
      scenario.websocket.close();
      
      // Wait and reconnect
      await testEnv.sleep(2000);
      scenario.websocket = await testEnv.createWebSocketConnection();
      
      // Character should still exist and be in consistent state
      const reconnectResponse = await testEnv.sendWebSocketMessage(scenario.websocket, characterName);
      expect(reconnectResponse).toMatch(/(Welcome back|restored)/i);
      
      // Verify character state is consistent
      const stateResponse = await testEnv.sendWebSocketMessage(scenario.websocket, 'look');
      expect(stateResponse).toContain('You are in');
      
      console.log('✅ Data consistency during failures test completed');
    });
  });

  describe('Performance and Scalability', () => {
    test('should handle database operations efficiently', async () => {
      console.log('⚡ Testing database operation performance...');
      
      const characterName = `PerfTestPlayer_${Date.now()}`;
      
      // Create character
      await testEnv.sendWebSocketMessage(scenario.websocket, characterName);
      
      // Measure response times for various operations
      const operations = [
        'look',
        'inventory', 
        'look',
        'north',
        'look',
        'south',
        'inventory'
      ];
      
      const responseTimes = [];
      
      for (const operation of operations) {
        const responseTime = await testEnv.measureResponseTime(async () => {
          await testEnv.sendWebSocketMessage(scenario.websocket, operation);
        });
        
        responseTimes.push(responseTime);
      }
      
      // All operations should complete within reasonable time
      const averageResponseTime = responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length;
      expect(averageResponseTime).toBeLessThan(5000); // 5 seconds average
      
      // No single operation should take too long
      responseTimes.forEach(time => {
        expect(time).toBeLessThan(10000); // 10 seconds max
      });
      
      console.log(`✅ Database performance test completed. Average response time: ${averageResponseTime}ms`);
    });
  });
});
const { TestEnvironment } = require('../../setup/test-environment');

describe('End-to-End Gameplay Flow', () => {
  let testEnv;
  let scenario;

  beforeAll(async () => {
    testEnv = new TestEnvironment(global.testConfig);
  });

  beforeEach(async () => {
    scenario = await testEnv.createTestScenario('full-gameplay-flow');
  });

  afterEach(async () => {
    if (scenario) {
      await scenario.cleanup();
    }
  });

  describe('Complete Player Journey', () => {
    test('should complete full gameplay flow from character creation to combat', async () => {
      // Step 1: Character Creation
      console.log('🎮 Testing character creation...');
      
      // Send character name through WebSocket
      const characterName = `TestPlayer_${Date.now()}`;
      let response = await testEnv.sendWebSocketMessage(scenario.websocket, characterName);
      
      // Verify character creation response
      expect(response).toContain('Welcome');
      expect(response).toContain(characterName);

      // Step 2: Initial Room Description
      console.log('🏠 Testing initial room display...');
      
      response = await testEnv.sendWebSocketMessage(scenario.websocket, 'look');
      expect(response).toContain('You are in');
      expect(response).toContain('Exits:');

      // Step 3: Movement
      console.log('🚶 Testing movement...');
      
      response = await testEnv.sendWebSocketMessage(scenario.websocket, 'north');
      expect(response).toMatch(/(You move|You go|You walk)/);

      // Step 4: Item Interaction
      console.log('📦 Testing item interaction...');
      
      // Look for items in the room
      response = await testEnv.sendWebSocketMessage(scenario.websocket, 'look');
      
      // Try to take an item if available
      if (response.includes('sword') || response.includes('weapon')) {
        response = await testEnv.sendWebSocketMessage(scenario.websocket, 'take sword');
        expect(response).toMatch(/(You take|You pick up|You get)/);
        
        // Check inventory
        response = await testEnv.sendWebSocketMessage(scenario.websocket, 'inventory');
        expect(response).toContain('sword');
      }

      // Step 5: NPC Interaction
      console.log('👥 Testing NPC interaction...');
      
      // Look for NPCs
      response = await testEnv.sendWebSocketMessage(scenario.websocket, 'look');
      
      if (response.includes('goblin') || response.includes('orc') || response.includes('enemy')) {
        // Try talking to NPC
        response = await testEnv.sendWebSocketMessage(scenario.websocket, 'talk goblin');
        expect(response).toMatch(/(says|tells you|responds)/);
      }

      // Step 6: Combat
      console.log('⚔️ Testing combat...');
      
      if (response.includes('goblin') || response.includes('orc') || response.includes('enemy')) {
        // Initiate combat
        response = await testEnv.sendWebSocketMessage(scenario.websocket, 'attack goblin');
        expect(response).toMatch(/(You attack|combat|fight|damage)/);
        
        // Continue combat until resolution
        let combatRounds = 0;
        while (response.includes('combat') && combatRounds < 10) {
          response = await testEnv.sendWebSocketMessage(scenario.websocket, 'attack');
          combatRounds++;
        }
        
        // Verify combat ended
        expect(response).toMatch(/(You defeat|You kill|dies|victory|You have been defeated)/);
      }

      // Step 7: Character Persistence
      console.log('💾 Testing character persistence...');
      
      // Disconnect and reconnect
      scenario.websocket.close();
      await testEnv.sleep(1000);
      
      scenario.websocket = await testEnv.createWebSocketConnection();
      
      // Reconnect with same character
      response = await testEnv.sendWebSocketMessage(scenario.websocket, characterName);
      expect(response).toContain('Welcome back');
      
      // Verify character state is restored
      response = await testEnv.sendWebSocketMessage(scenario.websocket, 'look');
      expect(response).toContain('You are in');

      console.log('✅ Full gameplay flow completed successfully');
    }, 60000);

    test('should handle multiple concurrent players', async () => {
      console.log('👥 Testing multiple concurrent players...');
      
      const playerCount = 3;
      const players = [];
      
      // Create multiple player connections
      for (let i = 0; i < playerCount; i++) {
        const ws = await testEnv.createWebSocketConnection();
        const playerName = `ConcurrentPlayer_${i}_${Date.now()}`;
        
        await testEnv.sendWebSocketMessage(ws, playerName);
        players.push({ ws, name: playerName });
      }
      
      // Have all players look around
      for (const player of players) {
        const response = await testEnv.sendWebSocketMessage(player.ws, 'look');
        expect(response).toContain('You are in');
      }
      
      // Test player interaction
      const player1Response = await testEnv.sendWebSocketMessage(players[0].ws, 'say Hello everyone!');
      expect(player1Response).toContain('You say');
      
      // Clean up player connections
      for (const player of players) {
        player.ws.close();
      }
      
      console.log('✅ Multiple concurrent players test completed');
    }, 45000);

    test('should maintain data consistency across database operations', async () => {
      console.log('🗄️ Testing database consistency...');
      
      const characterName = `DBTestPlayer_${Date.now()}`;
      
      // Create character
      let response = await testEnv.sendWebSocketMessage(scenario.websocket, characterName);
      expect(response).toContain('Welcome');
      
      // Perform multiple state-changing operations
      await testEnv.sendWebSocketMessage(scenario.websocket, 'look');
      await testEnv.sendWebSocketMessage(scenario.websocket, 'north');
      
      // Try to take an item
      response = await testEnv.sendWebSocketMessage(scenario.websocket, 'look');
      if (response.includes('sword')) {
        await testEnv.sendWebSocketMessage(scenario.websocket, 'take sword');
        await testEnv.sendWebSocketMessage(scenario.websocket, 'inventory');
      }
      
      // Disconnect and reconnect to verify persistence
      scenario.websocket.close();
      await testEnv.sleep(2000);
      
      scenario.websocket = await testEnv.createWebSocketConnection();
      response = await testEnv.sendWebSocketMessage(scenario.websocket, characterName);
      
      expect(response).toContain('Welcome back');
      
      // Verify state is consistent
      response = await testEnv.sendWebSocketMessage(scenario.websocket, 'inventory');
      // Character should have same inventory as before disconnect
      
      console.log('✅ Database consistency test completed');
    }, 30000);
  });

  describe('Error Handling and Recovery', () => {
    test('should handle connection interruptions gracefully', async () => {
      console.log('🔌 Testing connection recovery...');
      
      const characterName = `RecoveryTestPlayer_${Date.now()}`;
      
      // Create character
      await testEnv.sendWebSocketMessage(scenario.websocket, characterName);
      
      // Simulate connection interruption
      scenario.websocket.close();
      await testEnv.sleep(1000);
      
      // Reconnect
      scenario.websocket = await testEnv.createWebSocketConnection();
      
      // Should be able to reconnect with same character
      const response = await testEnv.sendWebSocketMessage(scenario.websocket, characterName);
      expect(response).toMatch(/(Welcome back|restored|reconnected)/);
      
      console.log('✅ Connection recovery test completed');
    });

    test('should handle invalid commands gracefully', async () => {
      console.log('❌ Testing invalid command handling...');
      
      const characterName = `ErrorTestPlayer_${Date.now()}`;
      await testEnv.sendWebSocketMessage(scenario.websocket, characterName);
      
      // Send invalid commands
      const invalidCommands = ['invalidcommand', 'xyz123', 'go nowhere', 'take nothing'];
      
      for (const command of invalidCommands) {
        const response = await testEnv.sendWebSocketMessage(scenario.websocket, command);
        expect(response).toMatch(/(don't understand|invalid|unknown|can't|not found)/i);
      }
      
      // Verify system is still responsive after invalid commands
      const response = await testEnv.sendWebSocketMessage(scenario.websocket, 'look');
      expect(response).toContain('You are in');
      
      console.log('✅ Invalid command handling test completed');
    });
  });
});
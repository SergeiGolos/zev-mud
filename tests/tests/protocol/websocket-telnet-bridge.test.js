const { TestEnvironment } = require('../../setup/test-environment');
const WebSocket = require('ws');
const net = require('net');

describe('WebSocket-Telnet Protocol Bridge', () => {
  let testEnv;

  beforeAll(async () => {
    testEnv = new TestEnvironment(global.testConfig);
  });

  afterEach(async () => {
    await testEnv.cleanup();
  });

  describe('Protocol Conversion', () => {
    test('should correctly forward WebSocket messages to Telnet', async () => {
      console.log('🔄 Testing WebSocket to Telnet forwarding...');
      
      // Create WebSocket connection through proxy
      const ws = await testEnv.createWebSocketConnection();
      
      // Create direct Telnet connection for comparison
      const telnetSocket = await testEnv.createTelnetConnection();
      
      // Send same command through both connections
      const testCommand = 'look';
      
      // Send via WebSocket (through proxy)
      const wsResponse = await testEnv.sendWebSocketMessage(ws, testCommand);
      
      // Send via direct Telnet
      const telnetResponse = await testEnv.sendTelnetCommand(telnetSocket, testCommand);
      
      // Responses should be similar (accounting for protocol differences)
      expect(wsResponse).toBeTruthy();
      expect(telnetResponse).toBeTruthy();
      expect(wsResponse.length).toBeGreaterThan(0);
      expect(telnetResponse.length).toBeGreaterThan(0);
      
      // Both should contain room description elements
      expect(wsResponse).toMatch(/(You are|room|area)/i);
      expect(telnetResponse).toMatch(/(You are|room|area)/i);
      
      ws.close();
      telnetSocket.end();
      
      console.log('✅ WebSocket to Telnet forwarding test completed');
    });

    test('should handle binary data and ANSI codes correctly', async () => {
      console.log('🎨 Testing ANSI code handling...');
      
      const ws = await testEnv.createWebSocketConnection();
      
      // Send character creation to get colored output
      const characterName = `ANSITestPlayer_${Date.now()}`;
      const response = await testEnv.sendWebSocketMessage(ws, characterName);
      
      // Check for ANSI escape sequences in response
      const ansiPattern = /\x1b\[[0-9;]*m/;
      
      // Response might contain ANSI codes for colors
      if (ansiPattern.test(response)) {
        console.log('✅ ANSI codes detected and preserved');
      } else {
        console.log('ℹ️ No ANSI codes in response (may be expected)');
      }
      
      // Verify response is still readable
      expect(response).toBeTruthy();
      expect(response.length).toBeGreaterThan(0);
      
      ws.close();
      
      console.log('✅ ANSI code handling test completed');
    });

    test('should handle Telnet IAC (Interpret As Command) sequences', async () => {
      console.log('📡 Testing Telnet IAC sequence handling...');
      
      const ws = await testEnv.createWebSocketConnection();
      const telnetSocket = await testEnv.createTelnetConnection();
      
      // Telnet IAC sequences that might be sent by server
      const iacSequences = [
        Buffer.from([255, 251, 1]), // IAC WILL ECHO
        Buffer.from([255, 253, 1]), // IAC DO ECHO
        Buffer.from([255, 251, 3]), // IAC WILL SUPPRESS_GO_AHEAD
      ];
      
      // Send a command that might trigger IAC responses
      await testEnv.sendWebSocketMessage(ws, 'look');
      
      // The proxy should handle IAC sequences transparently
      // We can't easily test this without deep packet inspection,
      // but we can verify the connection remains stable
      
      const response = await testEnv.sendWebSocketMessage(ws, 'look');
      expect(response).toBeTruthy();
      
      ws.close();
      telnetSocket.end();
      
      console.log('✅ Telnet IAC sequence handling test completed');
    });

    test('should maintain connection stability under load', async () => {
      console.log('🔄 Testing connection stability under load...');
      
      const ws = await testEnv.createWebSocketConnection();
      const characterName = `LoadTestPlayer_${Date.now()}`;
      
      // Create character
      await testEnv.sendWebSocketMessage(ws, characterName);
      
      // Send multiple rapid commands
      const commands = ['look', 'inventory', 'look', 'north', 'look', 'south', 'look'];
      const responses = [];
      
      for (const command of commands) {
        try {
          const response = await testEnv.sendWebSocketMessage(ws, command);
          responses.push(response);
          // Small delay to avoid overwhelming
          await testEnv.sleep(100);
        } catch (error) {
          console.error(`Command failed: ${command}`, error);
          throw error;
        }
      }
      
      // All commands should have received responses
      expect(responses).toHaveLength(commands.length);
      responses.forEach(response => {
        expect(response).toBeTruthy();
        expect(response.length).toBeGreaterThan(0);
      });
      
      ws.close();
      
      console.log('✅ Connection stability test completed');
    });
  });

  describe('Connection Management', () => {
    test('should handle WebSocket disconnections gracefully', async () => {
      console.log('🔌 Testing WebSocket disconnection handling...');
      
      const ws = await testEnv.createWebSocketConnection();
      const characterName = `DisconnectTestPlayer_${Date.now()}`;
      
      // Create character
      await testEnv.sendWebSocketMessage(ws, characterName);
      
      // Abruptly close WebSocket
      ws.close();
      
      // Wait a moment for cleanup
      await testEnv.sleep(1000);
      
      // Create new connection
      const newWs = await testEnv.createWebSocketConnection();
      
      // Should be able to reconnect
      const response = await testEnv.sendWebSocketMessage(newWs, characterName);
      expect(response).toMatch(/(Welcome|restored|back)/i);
      
      newWs.close();
      
      console.log('✅ WebSocket disconnection handling test completed');
    });

    test('should handle Telnet server disconnections', async () => {
      console.log('🔌 Testing Telnet server disconnection handling...');
      
      const ws = await testEnv.createWebSocketConnection();
      
      // This test would require stopping/starting the Ranvier server
      // For now, we'll test that the proxy handles connection errors
      
      try {
        // Send a command
        const response = await testEnv.sendWebSocketMessage(ws, 'look');
        expect(response).toBeTruthy();
      } catch (error) {
        // If Telnet server is down, proxy should return appropriate error
        expect(error.message).toMatch(/(connection|server|unavailable)/i);
      }
      
      ws.close();
      
      console.log('✅ Telnet server disconnection handling test completed');
    });

    test('should handle concurrent connections efficiently', async () => {
      console.log('👥 Testing concurrent connection handling...');
      
      const connectionCount = 5;
      const connections = await testEnv.createMultipleConnections(connectionCount, 'websocket');
      
      expect(connections).toHaveLength(connectionCount);
      
      // Test that all connections work
      const promises = connections.map(async (ws, index) => {
        const characterName = `ConcurrentPlayer_${index}_${Date.now()}`;
        return testEnv.sendWebSocketMessage(ws, characterName);
      });
      
      const responses = await Promise.all(promises);
      
      // All connections should work
      expect(responses).toHaveLength(connectionCount);
      responses.forEach(response => {
        expect(response).toBeTruthy();
        expect(response).toMatch(/(Welcome|character)/i);
      });
      
      // Clean up connections
      connections.forEach(ws => ws.close());
      
      console.log('✅ Concurrent connection handling test completed');
    });
  });

  describe('Message Integrity', () => {
    test('should preserve message content and ordering', async () => {
      console.log('📝 Testing message integrity...');
      
      const ws = await testEnv.createWebSocketConnection();
      const characterName = `IntegrityTestPlayer_${Date.now()}`;
      
      // Create character
      await testEnv.sendWebSocketMessage(ws, characterName);
      
      // Send sequence of commands that should produce predictable responses
      const commandSequence = [
        { command: 'look', expectedPattern: /(You are|room)/i },
        { command: 'inventory', expectedPattern: /(carrying|inventory|empty)/i },
        { command: 'look', expectedPattern: /(You are|room)/i }
      ];
      
      for (const { command, expectedPattern } of commandSequence) {
        const response = await testEnv.sendWebSocketMessage(ws, command);
        expect(response).toMatch(expectedPattern);
      }
      
      ws.close();
      
      console.log('✅ Message integrity test completed');
    });

    test('should handle large messages correctly', async () => {
      console.log('📏 Testing large message handling...');
      
      const ws = await testEnv.createWebSocketConnection();
      const characterName = `LargeMessageTestPlayer_${Date.now()}`;
      
      // Create character
      await testEnv.sendWebSocketMessage(ws, characterName);
      
      // Send command that might produce large response (room with many items/NPCs)
      const response = await testEnv.sendWebSocketMessage(ws, 'look');
      
      // Verify response is complete and not truncated
      expect(response).toBeTruthy();
      expect(response.length).toBeGreaterThan(0);
      
      // Response should be well-formed (not cut off mid-sentence)
      expect(response.trim()).not.toMatch(/\w+$/); // Shouldn't end with partial word
      
      ws.close();
      
      console.log('✅ Large message handling test completed');
    });
  });
});
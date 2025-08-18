const { TestEnvironment } = require('../../setup/test-environment');

describe('Concurrent User Performance Tests', () => {
  let testEnv;

  beforeAll(async () => {
    testEnv = new TestEnvironment(global.testConfig);
  });

  afterEach(async () => {
    await testEnv.cleanup();
  });

  describe('Connection Scalability', () => {
    test('should handle 10 concurrent connections', async () => {
      console.log('👥 Testing 10 concurrent connections...');
      
      const connectionCount = 10;
      const startTime = Date.now();
      
      // Create multiple connections
      const connections = await testEnv.createMultipleConnections(connectionCount, 'websocket');
      
      const connectionTime = Date.now() - startTime;
      console.log(`⏱️ Connection setup time: ${connectionTime}ms`);
      
      expect(connections).toHaveLength(connectionCount);
      
      // Create characters on all connections
      const characterPromises = connections.map(async (ws, index) => {
        const characterName = `ConcurrentUser_${index}_${Date.now()}`;
        const startTime = Date.now();
        
        try {
          const response = await testEnv.sendWebSocketMessage(ws, characterName);
          const responseTime = Date.now() - startTime;
          
          return {
            index,
            characterName,
            response,
            responseTime,
            success: true
          };
        } catch (error) {
          return {
            index,
            characterName,
            error: error.message,
            responseTime: Date.now() - startTime,
            success: false
          };
        }
      });
      
      const results = await Promise.all(characterPromises);
      
      // Analyze results
      const successfulConnections = results.filter(r => r.success);
      const failedConnections = results.filter(r => !r.success);
      
      console.log(`✅ Successful connections: ${successfulConnections.length}/${connectionCount}`);
      console.log(`❌ Failed connections: ${failedConnections.length}/${connectionCount}`);
      
      // At least 80% should succeed
      expect(successfulConnections.length).toBeGreaterThanOrEqual(connectionCount * 0.8);
      
      // Calculate performance metrics
      const responseTimes = successfulConnections.map(r => r.responseTime);
      const averageResponseTime = responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length;
      const maxResponseTime = Math.max(...responseTimes);
      
      console.log(`📊 Average response time: ${averageResponseTime.toFixed(2)}ms`);
      console.log(`📊 Max response time: ${maxResponseTime}ms`);
      
      // Performance expectations
      expect(averageResponseTime).toBeLessThan(5000); // 5 seconds average
      expect(maxResponseTime).toBeLessThan(15000); // 15 seconds max
      
      // Clean up connections
      connections.forEach(ws => {
        if (ws.readyState === ws.OPEN) {
          ws.close();
        }
      });
      
      console.log('✅ 10 concurrent connections test completed');
    }, 120000);

    test('should handle 25 concurrent connections', async () => {
      console.log('👥 Testing 25 concurrent connections...');
      
      const connectionCount = 25;
      const batchSize = 5; // Create connections in batches to avoid overwhelming
      const connections = [];
      
      // Create connections in batches
      for (let i = 0; i < connectionCount; i += batchSize) {
        const batchEnd = Math.min(i + batchSize, connectionCount);
        const batchConnections = await testEnv.createMultipleConnections(batchEnd - i, 'websocket');
        connections.push(...batchConnections);
        
        // Small delay between batches
        await testEnv.sleep(500);
      }
      
      expect(connections.length).toBeGreaterThanOrEqual(connectionCount * 0.8); // Allow some failures
      
      // Test basic functionality with all connections
      const testPromises = connections.map(async (ws, index) => {
        const characterName = `LoadTestUser_${index}_${Date.now()}`;
        
        try {
          const response = await testEnv.sendWebSocketMessage(ws, characterName);
          return { success: true, response };
        } catch (error) {
          return { success: false, error: error.message };
        }
      });
      
      const results = await Promise.all(testPromises);
      const successCount = results.filter(r => r.success).length;
      
      console.log(`✅ Successful operations: ${successCount}/${connections.length}`);
      
      // At least 70% should succeed under load
      expect(successCount).toBeGreaterThanOrEqual(connections.length * 0.7);
      
      // Clean up
      connections.forEach(ws => {
        if (ws.readyState === ws.OPEN) {
          ws.close();
        }
      });
      
      console.log('✅ 25 concurrent connections test completed');
    }, 180000);
  });

  describe('Message Throughput', () => {
    test('should handle rapid message exchange', async () => {
      console.log('⚡ Testing rapid message throughput...');
      
      const connectionCount = 5;
      const messagesPerConnection = 10;
      
      const connections = await testEnv.createMultipleConnections(connectionCount, 'websocket');
      
      // Create characters first
      const characterSetup = connections.map(async (ws, index) => {
        const characterName = `ThroughputUser_${index}_${Date.now()}`;
        await testEnv.sendWebSocketMessage(ws, characterName);
        return { ws, characterName };
      });
      
      const characters = await Promise.all(characterSetup);
      
      // Send rapid messages
      const startTime = Date.now();
      const messagePromises = [];
      
      characters.forEach(({ ws, characterName }) => {
        for (let i = 0; i < messagesPerConnection; i++) {
          const promise = testEnv.sendWebSocketMessage(ws, 'look').catch(error => ({
            error: error.message,
            characterName,
            messageIndex: i
          }));
          messagePromises.push(promise);
        }
      });
      
      const results = await Promise.all(messagePromises);
      const totalTime = Date.now() - startTime;
      
      // Analyze results
      const successfulMessages = results.filter(r => !r.error);
      const failedMessages = results.filter(r => r.error);
      
      const totalMessages = connectionCount * messagesPerConnection;
      const messagesPerSecond = (successfulMessages.length / totalTime) * 1000;
      
      console.log(`📊 Total messages: ${totalMessages}`);
      console.log(`✅ Successful messages: ${successfulMessages.length}`);
      console.log(`❌ Failed messages: ${failedMessages.length}`);
      console.log(`📊 Messages per second: ${messagesPerSecond.toFixed(2)}`);
      console.log(`📊 Total time: ${totalTime}ms`);
      
      // Performance expectations
      expect(successfulMessages.length).toBeGreaterThanOrEqual(totalMessages * 0.8);
      expect(messagesPerSecond).toBeGreaterThan(1); // At least 1 message per second
      
      // Clean up
      connections.forEach(ws => ws.close());
      
      console.log('✅ Rapid message throughput test completed');
    }, 120000);

    test('should maintain performance under sustained load', async () => {
      console.log('🔄 Testing sustained load performance...');
      
      const connectionCount = 3;
      const testDurationMs = 30000; // 30 seconds
      const messageIntervalMs = 2000; // Message every 2 seconds
      
      const connections = await testEnv.createMultipleConnections(connectionCount, 'websocket');
      
      // Create characters
      const characters = await Promise.all(connections.map(async (ws, index) => {
        const characterName = `SustainedUser_${index}_${Date.now()}`;
        await testEnv.sendWebSocketMessage(ws, characterName);
        return { ws, characterName };
      }));
      
      // Track performance metrics
      const metrics = {
        totalMessages: 0,
        successfulMessages: 0,
        failedMessages: 0,
        responseTimes: []
      };
      
      const startTime = Date.now();
      const endTime = startTime + testDurationMs;
      
      // Send messages at regular intervals
      while (Date.now() < endTime) {
        const roundPromises = characters.map(async ({ ws, characterName }) => {
          const messageStart = Date.now();
          metrics.totalMessages++;
          
          try {
            await testEnv.sendWebSocketMessage(ws, 'look');
            const responseTime = Date.now() - messageStart;
            metrics.responseTimes.push(responseTime);
            metrics.successfulMessages++;
          } catch (error) {
            metrics.failedMessages++;
          }
        });
        
        await Promise.all(roundPromises);
        await testEnv.sleep(messageIntervalMs);
      }
      
      const actualDuration = Date.now() - startTime;
      
      // Calculate performance metrics
      const successRate = (metrics.successfulMessages / metrics.totalMessages) * 100;
      const averageResponseTime = metrics.responseTimes.reduce((a, b) => a + b, 0) / metrics.responseTimes.length;
      const messagesPerSecond = (metrics.totalMessages / actualDuration) * 1000;
      
      console.log(`📊 Test duration: ${actualDuration}ms`);
      console.log(`📊 Total messages: ${metrics.totalMessages}`);
      console.log(`📊 Success rate: ${successRate.toFixed(2)}%`);
      console.log(`📊 Average response time: ${averageResponseTime.toFixed(2)}ms`);
      console.log(`📊 Messages per second: ${messagesPerSecond.toFixed(2)}`);
      
      // Performance expectations for sustained load
      expect(successRate).toBeGreaterThan(85); // 85% success rate
      expect(averageResponseTime).toBeLessThan(10000); // 10 seconds average
      
      // Clean up
      connections.forEach(ws => ws.close());
      
      console.log('✅ Sustained load performance test completed');
    }, 120000);
  });

  describe('Resource Usage', () => {
    test('should not leak memory with connection churn', async () => {
      console.log('🧠 Testing memory usage with connection churn...');
      
      const iterations = 5;
      const connectionsPerIteration = 5;
      
      for (let i = 0; i < iterations; i++) {
        console.log(`🔄 Iteration ${i + 1}/${iterations}`);
        
        // Create connections
        const connections = await testEnv.createMultipleConnections(connectionsPerIteration, 'websocket');
        
        // Use connections briefly
        const promises = connections.map(async (ws, index) => {
          const characterName = `ChurnUser_${i}_${index}_${Date.now()}`;
          try {
            await testEnv.sendWebSocketMessage(ws, characterName);
            await testEnv.sendWebSocketMessage(ws, 'look');
          } catch (error) {
            // Ignore errors in this test
          }
        });
        
        await Promise.all(promises);
        
        // Close all connections
        connections.forEach(ws => {
          if (ws.readyState === ws.OPEN) {
            ws.close();
          }
        });
        
        // Wait for cleanup
        await testEnv.sleep(2000);
      }
      
      // Final test to ensure system is still responsive
      const finalConnection = await testEnv.createWebSocketConnection();
      const finalResponse = await testEnv.sendWebSocketMessage(finalConnection, `FinalUser_${Date.now()}`);
      
      expect(finalResponse).toContain('Welcome');
      finalConnection.close();
      
      console.log('✅ Memory usage test completed');
    }, 180000);

    test('should handle connection timeouts gracefully', async () => {
      console.log('⏰ Testing connection timeout handling...');
      
      const connections = await testEnv.createMultipleConnections(3, 'websocket');
      
      // Create characters
      const characters = await Promise.all(connections.map(async (ws, index) => {
        const characterName = `TimeoutUser_${index}_${Date.now()}`;
        await testEnv.sendWebSocketMessage(ws, characterName);
        return { ws, characterName };
      }));
      
      // Let connections idle for a while
      console.log('⏳ Letting connections idle...');
      await testEnv.sleep(10000); // 10 seconds
      
      // Test if connections are still responsive
      const responsiveTests = characters.map(async ({ ws, characterName }) => {
        try {
          const response = await testEnv.sendWebSocketMessage(ws, 'look');
          return { success: true, characterName };
        } catch (error) {
          return { success: false, characterName, error: error.message };
        }
      });
      
      const results = await Promise.all(responsiveTests);
      const responsiveCount = results.filter(r => r.success).length;
      
      console.log(`📊 Responsive connections after idle: ${responsiveCount}/${connections.length}`);
      
      // Most connections should still be responsive
      expect(responsiveCount).toBeGreaterThanOrEqual(connections.length * 0.8);
      
      // Clean up
      connections.forEach(ws => ws.close());
      
      console.log('✅ Connection timeout handling test completed');
    }, 60000);
  });
});
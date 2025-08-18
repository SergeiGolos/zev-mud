#!/usr/bin/env node

const { execSync, spawn } = require('child_process');
const path = require('path');
const { setupTestEnvironment } = require('./setup-test-environment');
const { teardownTestEnvironment } = require('./teardown-test-environment');

class IntegrationTestRunner {
  constructor() {
    this.testResults = {
      total: 0,
      passed: 0,
      failed: 0,
      skipped: 0,
      suites: []
    };
  }

  async runTests() {
    console.log('🧪 Starting Integration Test Suite');
    console.log('=====================================');
    
    try {
      // Setup test environment
      await setupTestEnvironment();
      
      // Run test suites
      await this.runTestSuites();
      
      // Generate report
      this.generateReport();
      
    } catch (error) {
      console.error('❌ Integration tests failed:', error.message);
      process.exit(1);
    } finally {
      // Always cleanup
      await teardownTestEnvironment();
    }
  }

  async runTestSuites() {
    const testSuites = [
      {
        name: 'Protocol Tests',
        pattern: 'tests/protocol/**/*.test.js',
        timeout: 60000
      },
      {
        name: 'Database Integration Tests',
        pattern: 'tests/database/**/*.test.js',
        timeout: 60000
      },
      {
        name: 'System Integration Tests',
        pattern: 'tests/integration/**/*.test.js',
        timeout: 120000
      },
      {
        name: 'End-to-End Tests',
        pattern: 'tests/e2e/**/*.test.js',
        timeout: 180000
      },
      {
        name: 'Performance Tests',
        pattern: 'tests/performance/**/*.test.js',
        timeout: 300000
      }
    ];

    for (const suite of testSuites) {
      console.log(`\n🏃 Running ${suite.name}...`);
      console.log('─'.repeat(50));
      
      try {
        const result = await this.runTestSuite(suite);
        this.testResults.suites.push({
          name: suite.name,
          ...result,
          status: 'passed'
        });
      } catch (error) {
        console.error(`❌ ${suite.name} failed:`, error.message);
        this.testResults.suites.push({
          name: suite.name,
          status: 'failed',
          error: error.message
        });
      }
    }
  }

  async runTestSuite(suite) {
    return new Promise((resolve, reject) => {
      const jestArgs = [
        '--testPathPattern', suite.pattern,
        '--verbose',
        '--runInBand',
        '--forceExit',
        '--detectOpenHandles',
        '--testTimeout', suite.timeout.toString()
      ];

      const jestProcess = spawn('npx', ['jest', ...jestArgs], {
        stdio: 'inherit',
        cwd: __dirname + '/..'
      });

      jestProcess.on('close', (code) => {
        if (code === 0) {
          resolve({ exitCode: code });
        } else {
          reject(new Error(`Test suite exited with code ${code}`));
        }
      });

      jestProcess.on('error', (error) => {
        reject(error);
      });
    });
  }

  generateReport() {
    console.log('\n📊 Integration Test Results');
    console.log('============================');
    
    const passedSuites = this.testResults.suites.filter(s => s.status === 'passed');
    const failedSuites = this.testResults.suites.filter(s => s.status === 'failed');
    
    console.log(`✅ Passed Suites: ${passedSuites.length}`);
    console.log(`❌ Failed Suites: ${failedSuites.length}`);
    console.log(`📊 Total Suites: ${this.testResults.suites.length}`);
    
    if (passedSuites.length > 0) {
      console.log('\n✅ Passed Test Suites:');
      passedSuites.forEach(suite => {
        console.log(`  • ${suite.name}`);
      });
    }
    
    if (failedSuites.length > 0) {
      console.log('\n❌ Failed Test Suites:');
      failedSuites.forEach(suite => {
        console.log(`  • ${suite.name}: ${suite.error}`);
      });
    }
    
    const successRate = (passedSuites.length / this.testResults.suites.length) * 100;
    console.log(`\n📈 Success Rate: ${successRate.toFixed(2)}%`);
    
    if (failedSuites.length > 0) {
      console.log('\n❌ Some integration tests failed. Check the output above for details.');
      process.exit(1);
    } else {
      console.log('\n🎉 All integration tests passed!');
    }
  }
}

// Command line options
const args = process.argv.slice(2);
const options = {
  suite: null,
  skipSetup: false,
  skipTeardown: false
};

// Parse command line arguments
for (let i = 0; i < args.length; i++) {
  switch (args[i]) {
    case '--suite':
      options.suite = args[i + 1];
      i++;
      break;
    case '--skip-setup':
      options.skipSetup = true;
      break;
    case '--skip-teardown':
      options.skipTeardown = true;
      break;
    case '--help':
      console.log(`
Integration Test Runner

Usage: node run-integration-tests.js [options]

Options:
  --suite <name>     Run specific test suite (protocol, database, integration, e2e, performance)
  --skip-setup       Skip test environment setup
  --skip-teardown    Skip test environment teardown
  --help             Show this help message

Examples:
  node run-integration-tests.js                    # Run all tests
  node run-integration-tests.js --suite protocol   # Run only protocol tests
  node run-integration-tests.js --skip-setup       # Skip environment setup
      `);
      process.exit(0);
  }
}

// Run specific suite if requested
if (options.suite) {
  console.log(`🎯 Running specific test suite: ${options.suite}`);
  
  const suitePatterns = {
    protocol: 'tests/protocol/**/*.test.js',
    database: 'tests/database/**/*.test.js',
    integration: 'tests/integration/**/*.test.js',
    e2e: 'tests/e2e/**/*.test.js',
    performance: 'tests/performance/**/*.test.js'
  };
  
  if (!suitePatterns[options.suite]) {
    console.error(`❌ Unknown test suite: ${options.suite}`);
    console.error(`Available suites: ${Object.keys(suitePatterns).join(', ')}`);
    process.exit(1);
  }
  
  // Run single suite
  const runner = new IntegrationTestRunner();
  runner.runTestSuite({
    name: options.suite,
    pattern: suitePatterns[options.suite],
    timeout: 180000
  }).then(() => {
    console.log(`✅ ${options.suite} tests completed`);
  }).catch(error => {
    console.error(`❌ ${options.suite} tests failed:`, error.message);
    process.exit(1);
  });
} else {
  // Run all tests
  const runner = new IntegrationTestRunner();
  runner.runTests();
}
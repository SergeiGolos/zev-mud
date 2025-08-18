# Integration Test Framework

This directory contains the comprehensive integration test suite for the zev-mud project. The test framework provides end-to-end testing capabilities that validate the entire system from browser client through WebSocket proxy to the Ranvier game server and database.

## Overview

The integration test framework consists of:

- **End-to-End Tests**: Complete gameplay flows from character creation to combat
- **Protocol Tests**: WebSocket-Telnet bridge functionality and message integrity
- **Database Tests**: CRUD operations and data consistency validation
- **Performance Tests**: Concurrent user handling and system scalability
- **System Integration Tests**: Full stack integration and error handling

## Architecture

```
tests/
├── setup/                    # Test environment configuration
│   ├── test-environment.js   # Core test utilities and environment management
│   ├── jest.setup.js         # Jest configuration and global setup
│   ├── global-setup.js       # Global test initialization
│   └── global-teardown.js    # Global test cleanup
├── tests/                    # Test suites
│   ├── e2e/                  # End-to-end gameplay tests
│   ├── protocol/             # WebSocket-Telnet protocol tests
│   ├── database/             # Database integration tests
│   ├── performance/          # Performance and load tests
│   └── integration/          # System integration tests
├── scripts/                  # Test automation scripts
│   ├── setup-test-environment.js
│   ├── teardown-test-environment.js
│   └── run-integration-tests.js
├── package.json              # Test dependencies and scripts
├── Dockerfile               # Test container configuration
└── README.md                # This file
```

## Prerequisites

- Docker and Docker Compose
- Node.js 18+
- All project services (ranvier, proxy, web-client) built and ready

## Quick Start

### Run All Tests

```bash
# From the project root
docker-compose -f docker-compose.test.yml up --build integration-tests
```

### Run Tests Locally

```bash
# Install test dependencies
cd tests
npm install

# Start test environment
npm run setup

# Run all tests
npm test

# Run specific test suites
npm run test:integration
npm run test:e2e
npm run test:performance
npm run test:protocol
npm run test:database

# Cleanup
npm run teardown
```

### Run Specific Test Suite

```bash
# Run only protocol tests
node scripts/run-integration-tests.js --suite protocol

# Run only performance tests
node scripts/run-integration-tests.js --suite performance
```

## Test Suites

### End-to-End Tests (`tests/e2e/`)

Tests complete user journeys through the system:

- **Full Gameplay Flow**: Character creation → Movement → Item interaction → Combat → Persistence
- **Multiple Concurrent Players**: Multi-user scenarios and interactions
- **Data Consistency**: Database persistence across disconnections
- **Error Recovery**: Connection interruption and system recovery

### Protocol Tests (`tests/protocol/`)

Validates WebSocket-Telnet bridge functionality:

- **Message Forwarding**: Bidirectional communication between WebSocket and Telnet
- **ANSI Code Handling**: Color codes and terminal formatting preservation
- **Telnet IAC Sequences**: Proper handling of Telnet control sequences
- **Connection Management**: Graceful handling of disconnections and reconnections

### Database Tests (`tests/database/`)

Ensures data integrity and CRUD operations:

- **Character Data Operations**: Create, read, update, delete character information
- **World State Persistence**: Item locations, NPC states, room changes
- **Transaction Integrity**: Concurrent operations and failure recovery
- **Performance**: Database operation response times and scalability

### Performance Tests (`tests/performance/`)

Validates system performance under load:

- **Concurrent Connections**: 10, 25+ simultaneous user connections
- **Message Throughput**: Rapid message exchange and system responsiveness
- **Sustained Load**: Long-running performance under continuous usage
- **Resource Usage**: Memory usage and connection cleanup

### Integration Tests (`tests/integration/`)

Tests full system integration:

- **Service Dependencies**: Proper service startup and dependency management
- **Cross-Layer Consistency**: Data consistency across all system layers
- **Error Propagation**: Error handling through the entire stack
- **Health Monitoring**: System health checks and monitoring capabilities

## Test Environment

The test framework uses a containerized environment that mirrors production:

### Services

- **ranvier-test**: Game server on port 3002
- **proxy-test**: WebSocket proxy on port 8082  
- **web-client-test**: Web client on port 3003
- **integration-tests**: Test runner container

### Configuration

Test environment configuration is managed through:

- `docker-compose.test.yml`: Service definitions and networking
- `tests/setup/test-environment.js`: Test utilities and connection management
- Environment variables for service endpoints and timeouts

## Writing Tests

### Basic Test Structure

```javascript
const { TestEnvironment } = require('../../setup/test-environment');

describe('My Test Suite', () => {
  let testEnv;
  let scenario;

  beforeAll(async () => {
    testEnv = new TestEnvironment(global.testConfig);
  });

  beforeEach(async () => {
    scenario = await testEnv.createTestScenario('my-test');
  });

  afterEach(async () => {
    if (scenario) {
      await scenario.cleanup();
    }
  });

  test('should do something', async () => {
    const response = await testEnv.sendWebSocketMessage(
      scenario.websocket, 
      'test command'
    );
    expect(response).toContain('expected result');
  });
});
```

### Test Utilities

The `TestEnvironment` class provides utilities for:

- **Connection Management**: WebSocket and Telnet connections
- **Message Handling**: Sending commands and receiving responses
- **Performance Measurement**: Response time tracking
- **Scenario Setup**: Pre-configured test scenarios
- **Cleanup**: Automatic resource cleanup

### Best Practices

1. **Use Scenarios**: Always use `createTestScenario()` for consistent setup
2. **Clean Up**: Ensure proper cleanup in `afterEach` hooks
3. **Timeouts**: Set appropriate timeouts for different test types
4. **Error Handling**: Test both success and failure cases
5. **Performance**: Include performance assertions where relevant

## Configuration

### Test Timeouts

- **Unit Tests**: 30 seconds
- **Integration Tests**: 60 seconds
- **End-to-End Tests**: 180 seconds
- **Performance Tests**: 300 seconds

### Service Endpoints

Test services run on different ports to avoid conflicts:

- **Ranvier**: localhost:3002 (vs production 3000)
- **Proxy**: localhost:8082 (vs production 8080)
- **Web Client**: localhost:3003 (vs production 3001)

### Environment Variables

- `NODE_ENV=test`: Enables test mode
- `RANVIER_HOST`, `PROXY_HOST`, `WEB_CLIENT_HOST`: Service hostnames
- `RANVIER_PORT`, `PROXY_PORT`, `WEB_CLIENT_PORT`: Service ports

## Continuous Integration

The test framework is designed for CI/CD integration:

### GitHub Actions Example

```yaml
name: Integration Tests
on: [push, pull_request]

jobs:
  integration-tests:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      - name: Run Integration Tests
        run: |
          docker-compose -f docker-compose.test.yml up --build --abort-on-container-exit integration-tests
```

### Test Reports

Tests generate coverage reports and performance metrics:

- **Coverage**: HTML and LCOV reports in `tests/coverage/`
- **Performance**: Response time metrics logged to console
- **Results**: JUnit XML format for CI integration

## Troubleshooting

### Common Issues

1. **Services Not Ready**: Increase health check timeouts in docker-compose.test.yml
2. **Port Conflicts**: Ensure test ports (3002, 8082, 3003) are available
3. **Memory Issues**: Increase Docker memory limits for performance tests
4. **Timeout Errors**: Adjust test timeouts in jest configuration

### Debug Mode

Enable verbose logging:

```bash
DEBUG=true npm test
```

### Manual Testing

Start services manually for debugging:

```bash
docker-compose -f docker-compose.test.yml up -d ranvier-test proxy-test web-client-test
```

## Performance Benchmarks

Expected performance baselines:

- **Character Creation**: < 5 seconds
- **Game Commands**: < 2 seconds average
- **Concurrent Users**: 25+ simultaneous connections
- **Message Throughput**: > 10 messages/second
- **Success Rate**: > 95% under normal load

## Contributing

When adding new tests:

1. Follow the existing directory structure
2. Use the `TestEnvironment` utilities
3. Include both positive and negative test cases
4. Add performance assertions where appropriate
5. Update this README if adding new test categories

## Requirements Coverage

This test framework addresses the following requirements:

- **Requirement 8.1**: Core game mechanics have corresponding unit tests
- **Requirement 8.2**: WebSocket proxy has integration tests for telnet communication  
- **Requirement 8.3**: Player actions are validated through automated tests
- **Requirement 8.4**: Tests provide clear feedback on system functionality

The integration test framework ensures comprehensive validation of the entire zev-mud system, from browser client to database persistence, providing confidence in system reliability and performance.
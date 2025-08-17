# WebSocket-to-Telnet Proxy

A Node.js proxy service that bridges WebSocket connections from browsers to Telnet connections for MUD servers.

## Features

- **Protocol Bridge**: Converts WebSocket messages to Telnet format and vice versa
- **Connection Management**: Handles multiple concurrent connections with proper cleanup
- **Telnet IAC Filtering**: Removes Telnet control sequences that browsers don't need
- **Health Monitoring**: Built-in health check endpoint for monitoring
- **Error Handling**: Comprehensive error handling and logging
- **Keepalive**: Automatic connection monitoring and timeout handling

## Installation

```bash
npm install
```

## Usage

### Development
```bash
npm run dev
```

### Production
```bash
npm start
```

### Testing
```bash
# Run all tests
npm test

# Run specific test suites
npm run test:unit
npm run test:integration
npm run test:telnet

# Run with coverage
npm run test:coverage
```

## Configuration

The proxy can be configured using environment variables:

- `WS_PORT`: WebSocket server port (default: 8080)
- `WS_HOST`: WebSocket server host (default: 0.0.0.0)
- `TELNET_HOST`: Telnet server hostname (default: ranvier)
- `TELNET_PORT`: Telnet server port (default: 3000)
- `CONNECTION_TIMEOUT`: Connection timeout in ms (default: 30000)
- `LOG_LEVEL`: Logging level (default: info)
- `MAX_CONNECTIONS`: Maximum concurrent connections (default: 100)

## API

### Health Check
```
GET /health
```

Returns server status and connection information:
```json
{
  "status": "healthy",
  "timestamp": "2024-01-01T00:00:00.000Z",
  "telnetTarget": "ranvier:3000",
  "activeConnections": 5,
  "uptime": 3600
}
```

## Docker

Build and run with Docker:

```bash
docker build -t zev-mud-proxy .
docker run -p 8080:8080 -e TELNET_HOST=your-mud-server zev-mud-proxy
```

## Architecture

The proxy operates as a bridge between WebSocket clients (browsers) and Telnet servers (MUD engines):

```
Browser Client <--WebSocket--> Proxy <--Telnet--> MUD Server
```

### Message Processing

1. **WebSocket to Telnet**: Adds proper line endings (CRLF) for Telnet protocol
2. **Telnet to WebSocket**: Filters IAC (Interpret As Command) sequences and preserves ANSI escape codes

### Connection Lifecycle

1. Browser establishes WebSocket connection
2. Proxy creates corresponding Telnet connection to MUD server
3. Messages are bidirectionally forwarded with protocol conversion
4. Connection cleanup occurs when either side disconnects

## Testing

The proxy includes comprehensive test coverage:

- **Unit Tests**: Core functionality, message processing, error handling
- **Integration Tests**: End-to-end WebSocket-Telnet communication
- **Protocol Tests**: Telnet IAC filtering and ANSI preservation

## Error Handling

The proxy handles various error scenarios:

- WebSocket connection failures
- Telnet server unavailability
- Message forwarding errors
- Connection timeouts
- Protocol conversion errors

All errors are logged with appropriate context for debugging.
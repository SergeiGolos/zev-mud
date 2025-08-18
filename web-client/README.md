# Web Client for zev-mud

A browser-based terminal client for connecting to MUD servers via WebSocket connections. This component provides a modern web interface for traditional text-based MUD gameplay.

## Overview

The web client creates a terminal-like experience in the browser using xterm.js, allowing players to interact with MUD servers without requiring telnet clients. It connects to the game through a WebSocket proxy that bridges browser connections to the Ranvier MUD server.

## Features

- **Terminal Emulation**: Full-featured terminal interface using xterm.js
- **WebSocket Connection**: Real-time communication with the proxy server
- **ANSI Color Support**: Rich text rendering with color codes and formatting
- **Connection Management**: Automatic reconnection and connection state handling
- **Command History**: Navigate through previous commands using arrow keys
- **Responsive Design**: Works on desktop and mobile devices
- **Health Monitoring**: Built-in health check endpoint for monitoring

## Architecture

```
Browser Client <--HTTP/WebSocket--> Web Client Server <--WebSocket--> Proxy <--Telnet--> Ranvier
```

### Components

**Client Side (`client.js`)**
- MudClient class that handles WebSocket connections
- Terminal initialization and event handling
- User input processing and command history
- Connection state management and automatic reconnection

**Server Side (`server.js`)**
- Express.js server serving static files
- Health check endpoint for monitoring
- Static file serving for the web interface

**Frontend (`index.html` + CSS)**
- Terminal container and styling
- Connection status indicators
- Responsive layout for various screen sizes

## Installation

```bash
cd web-client
npm install
```

## Usage

### Development Mode

```bash
npm run dev
```

Starts the server with nodemon for automatic reloading on file changes.

### Production Mode

```bash
npm start
```

Starts the server in production mode.

### Testing

```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Run tests with coverage
npm run test:coverage
```

## Configuration

The web client can be configured using environment variables:

- `PORT`: HTTP server port (default: 3001)
- `NODE_ENV`: Environment mode (development/production)

### WebSocket Connection

The client automatically connects to the WebSocket proxy at:
- Development: `ws://localhost:8080`
- Production: `ws://{current-host}:8080`

## API Endpoints

### Health Check
```
GET /health
```

Returns server status:
```json
{
  "status": "healthy",
  "timestamp": "2024-01-01T00:00:00.000Z"
}
```

### Static Files
```
GET /
GET /index.html
GET /client.js
```

Serves the web interface and client-side JavaScript.

## Browser Support

- Modern browsers with WebSocket support
- Chrome 50+
- Firefox 50+
- Safari 13+
- Edge 79+

## Docker

The web client includes Docker support:

```bash
# Build the image
docker build -t zev-mud-web-client .

# Run the container
docker run -p 3001:3001 zev-mud-web-client
```

### Docker Configuration

- **Base Image**: Node.js 18 Alpine
- **Port**: 3001
- **Health Check**: HTTP GET /health
- **Security**: Non-root user execution

## Development

### File Structure

```
web-client/
├── src/
│   ├── server.js          # Express server
│   └── client.js          # Browser client logic
├── public/
│   ├── index.html         # Main web interface
│   └── client.js          # Client-side JavaScript (served)
├── tests/                 # Test files
├── config/                # Configuration files
├── package.json           # Dependencies and scripts
├── jest.config.js         # Jest testing configuration
├── Dockerfile            # Container configuration
└── README.md             # This file
```

### Key Classes

**MudClient**
- Manages WebSocket connections to the proxy
- Handles terminal initialization and user input
- Implements automatic reconnection with exponential backoff
- Maintains command history and navigation

**WebClientServer**
- Express.js server for serving static files
- Health check endpoints for monitoring
- Static file serving with proper MIME types

### Testing Strategy

- **Unit Tests**: Client connection logic, terminal handling
- **Integration Tests**: Server endpoints, static file serving
- **Browser Tests**: Cross-browser compatibility testing

## Troubleshooting

### Connection Issues

**WebSocket Connection Failed**
- Check that the WebSocket proxy is running on port 8080
- Verify network connectivity between client and proxy
- Check browser console for specific error messages

**Terminal Not Loading**
- Ensure xterm.js CDN is accessible
- Check browser JavaScript console for errors
- Verify all static files are being served correctly

**Display Issues**
- Try refreshing the browser cache
- Check that ANSI color codes are being processed
- Verify terminal container dimensions

### Performance Issues

**Slow Response Times**
- Check WebSocket proxy performance
- Monitor network latency to the server
- Verify sufficient browser resources

**Memory Usage**
- Terminal scrollback limited to 1000 lines
- WebSocket connections are properly cleaned up
- Check for memory leaks in browser DevTools

## Contributing

1. Follow the existing code style and patterns
2. Write tests for new functionality
3. Update documentation for any changes
4. Test across supported browsers
5. Ensure Docker builds work correctly

## Dependencies

### Production Dependencies
- **express**: Web server framework
- **xterm**: Terminal emulation library

### Development Dependencies
- **jest**: Testing framework
- **nodemon**: Development server with hot reload
- **jsdom**: DOM testing environment
- **ws**: WebSocket library for testing

## Integration with Other Components

- **WebSocket Proxy**: Connects via WebSocket on port 8080
- **Ranvier Server**: Indirect connection through proxy
- **Database**: No direct database access (handled by Ranvier)

The web client is designed to be a thin presentation layer that focuses solely on providing a great user interface for MUD gameplay.
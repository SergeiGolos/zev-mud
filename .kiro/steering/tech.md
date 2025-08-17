# Technology Stack

## Core Technologies

- **Game Server**: Ranvier MUD engine (Node.js)
- **Proxy Layer**: WebSocket-to-Telnet proxy (Node.js)
- **Frontend**: Browser-based terminal client using xterm.js
- **Database**: NeDB for development, configurable for production
- **Containerization**: Docker and Docker Compose

## Key Libraries & Frameworks

- **xterm.js**: Terminal emulation in the browser
- **WebSocket**: Real-time communication between browser and proxy
- **TCP/Telnet**: Communication between proxy and Ranvier server
- **ANSI processing**: Color codes and terminal formatting

## Development Environment

### Common Commands

```bash
# Development setup
docker-compose -f docker-compose.dev.yml up

# Build containers
docker-compose build

# Run tests
npm test

# Start individual services
npm run start:ranvier
npm run start:proxy
npm run start:web
```

### Port Configuration

- **Ranvier Server**: 3000 (Telnet)
- **WebSocket Proxy**: 8080
- **Web Client**: 3001
- **Database**: Internal container networking

## Deployment

- **Development**: Docker Compose with volume mounts
- **Production**: Container orchestration with persistent volumes
- **Security**: WSS (WebSocket Secure) for encrypted connections
- **Reverse Proxy**: Nginx for SSL termination and load balancing

## Testing Strategy

- **Unit Tests**: Game mechanics, proxy logic, data models
- **Integration Tests**: End-to-end flows, protocol conversion
- **Browser Tests**: Cross-browser compatibility, terminal rendering
- **Performance Tests**: Concurrent connections, latency, load testing
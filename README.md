# zev-mud

A browser-based Multi-User Dungeon (MUD) game built with Ranvier as the server engine. This project creates a modern web interface for traditional MUD gameplay, allowing players to connect through web browsers instead of telnet clients.

## Architecture

The system consists of three main components:

- **Ranvier Server** (`/ranvier`): Core MUD game engine running on Node.js
- **WebSocket Proxy** (`/proxy`): Bridges WebSocket connections from browsers to Telnet connections for the game server
- **Web Client** (`/web-client`): Browser-based terminal interface using xterm.js

## Quick Start

### Development Environment

1. Clone the repository
2. Start the development environment:
   ```bash
   docker-compose -f docker-compose.dev.yml up --build
   ```

3. Access the game:
   - Web Client: http://localhost:3001
   - Direct Telnet: telnet localhost 3000
   - WebSocket Proxy: ws://localhost:8080

### Production Deployment

```bash
docker-compose up --build -d
```

## Services

### Ranvier Server
- **Port**: 3000 (Telnet)
- **Health Check**: TCP connection test
- **Data**: Persistent volume for character and world data

### WebSocket Proxy
- **Port**: 8080 (WebSocket)
- **Health Check**: HTTP endpoint at `/health`
- **Function**: Bidirectional message forwarding between WebSocket and Telnet

### Web Client
- **Port**: 3001 (HTTP)
- **Health Check**: HTTP endpoint at `/health`
- **Features**: Terminal emulation, connection management, ANSI color support

## Development

### Individual Service Development

```bash
# Ranvier server
cd ranvier && npm install && npm run dev

# WebSocket proxy
cd proxy && npm install && npm run dev

# Web client
cd web-client && npm install && npm run dev
```

### Testing

```bash
# Run tests for all services
docker-compose -f docker-compose.dev.yml exec ranvier npm test
docker-compose -f docker-compose.dev.yml exec proxy npm test
docker-compose -f docker-compose.dev.yml exec web-client npm test
```

## Configuration

### Environment Variables

**Ranvier Server:**
- `PORT`: Server port (default: 3000)
- `NODE_ENV`: Environment mode

**WebSocket Proxy:**
- `WS_PORT`: WebSocket server port (default: 8080)
- `TELNET_HOST`: Ranvier server hostname (default: ranvier)
- `TELNET_PORT`: Ranvier server port (default: 3000)

**Web Client:**
- `PORT`: HTTP server port (default: 3001)

### Docker Compose Files

- `docker-compose.yml`: Production configuration
- `docker-compose.dev.yml`: Development configuration with volume mounts

## Health Checks

All services include health check endpoints:

- **Ranvier**: TCP connection test on port 3000
- **Proxy**: HTTP GET `/health` on port 8080
- **Web Client**: HTTP GET `/health` on port 3001

## Networking

Services communicate through a Docker bridge network (`mud-network`):
- Browser → WebSocket Proxy → Ranvier Server
- All inter-service communication uses service names as hostnames

## Data Persistence

- **Ranvier Data**: Persistent Docker volume (`ranvier_data`)
- **Character Data**: Stored in NeDB database files
- **Game State**: Maintained in server memory and persisted to database
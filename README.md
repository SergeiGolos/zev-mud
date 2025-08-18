# zev-mud

A browser-based Multi-User Dungeon (MUD) game built with Ranvier as the server engine. This project creates a modern web interface for traditional MUD gameplay, allowing players to connect through web browsers instead of telnet clients.

## Project Overview

zev-mud bridges classic text-based MUD gaming with modern web technologies, providing:

- **Web-based gameplay**: Browser terminal interface using WebSocket connections
- **Character persistence**: Account creation and progress saving with NeDB database
- **Classic MUD mechanics**: Room navigation, inventory management, NPC interaction, turn-based combat
- **Real-time multiplayer**: Multiple players can interact in the same game world
- **Small-scope world**: 10 interconnected rooms with 13+ items and 2+ NPCs with behaviors

## Architecture

The system uses a three-tier architecture that bridges modern web technologies with traditional MUD server architecture:

```
Browser Client → WebSocket Proxy → Ranvier MUD Server
      ↓              ↓                    ↓
   Web Interface   Protocol Bridge    Game Engine
   (Port 3001)     (Port 8080)       (Port 3000)
```

### Components

- **Ranvier Server** (`/ranvier`): Core MUD game engine running on Node.js
  - Game logic, world simulation, combat system
  - Character creation, authentication, and persistence
  - NPC behavior management and dialogue systems
  - Database operations using NeDB
  
- **WebSocket Proxy** (`/proxy`): Protocol bridge between WebSocket and Telnet
  - Accepts WebSocket connections from browsers
  - Establishes TCP connections to Ranvier telnet server
  - Bidirectional message forwarding with protocol conversion
  - Handles Telnet IAC sequences and ANSI processing
  
- **Web Client** (`/web-client`): Browser-based terminal interface using xterm.js
  - Terminal-like interface with ANSI color support
  - Connection management and automatic reconnection
  - Command history and user input handling
  - Responsive design for desktop and mobile

## Game Features

### World Design
- **10 Interconnected Rooms**: Small dungeon with entrance, chambers, storage areas, and secret passages
- **13+ Interactive Items**: Weapons, armor, consumables, treasure, and utility items with take/drop functionality  
- **2+ NPCs with Behaviors**: Stone Guardian (passive) and Skeleton Warrior (aggressive) with dialogue trees
- **Turn-based Combat**: Initiative-based combat system with damage calculation and health tracking

### Player Systems
- **Character Creation**: Persistent character accounts with validation
- **Movement System**: Six-directional movement (north/south/east/west/up/down) with exit validation
- **Inventory Management**: Take/drop mechanics with capacity limits and item tracking
- **Look/Examine Commands**: Detailed room and item descriptions
- **Death/Respawn System**: Health tracking with respawn mechanics

### Technical Features
- **Real-time Communication**: WebSocket-based messaging for immediate responses
- **Character Persistence**: NeDB database for character data and progress
- **ANSI Color Support**: Rich text rendering with color codes and formatting
- **Cross-platform**: Works on desktop browsers, tablets, and mobile devices
- **Automatic Reconnection**: Client-side reconnection with exponential backoff

## Quick Start

### Prerequisites

- Docker and Docker Compose
- Node.js 18+ (for local development)
- Modern web browser with WebSocket support

### Development Environment

1. Clone the repository:
   ```bash
   git clone https://github.com/SergeiGolos/zev-mud.git
   cd zev-mud
   ```

2. Start the development environment:
   ```bash
   docker compose -f docker-compose.dev.yml up --build
   ```

3. Access the game:
   - **Web Client**: http://localhost:3001
   - **Direct Telnet**: telnet localhost 3000
   - **WebSocket Proxy**: ws://localhost:8080

### Production Deployment

```bash
docker compose up --build -d
```

### Local Development (Individual Services)

```bash
# Terminal 1 - Start Ranvier server
cd ranvier && npm install && npm run dev

# Terminal 2 - Start WebSocket proxy  
cd proxy && npm install && npm run dev

# Terminal 3 - Start web client
cd web-client && npm install && npm run dev
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
docker compose -f docker-compose.dev.yml exec ranvier npm test
docker compose -f docker-compose.dev.yml exec proxy npm test
docker compose -f docker-compose.dev.yml exec web-client npm test

# Run specific test suites
cd ranvier && npm run test:unit
cd proxy && npm run test:integration
cd web-client && npm run test:coverage

# Integration testing
npm run test:e2e  # Full gameplay scenarios
```

### Testing Strategy

- **Unit Tests**: Game mechanics, proxy logic, client functionality
- **Integration Tests**: WebSocket-Telnet communication, database operations
- **End-to-End Tests**: Complete player workflows from login to gameplay
- **Browser Tests**: Cross-browser compatibility and terminal rendering
- **Performance Tests**: Connection handling, concurrent players, latency

## Configuration

### Environment Variables

**Ranvier Server:**
- `PORT`: Server port (default: 3000)
- `NODE_ENV`: Environment mode (development/production)
- `DATA_PATH`: Path for game data storage
- `LOG_LEVEL`: Logging verbosity (default: info)

**WebSocket Proxy:**
- `WS_PORT`: WebSocket server port (default: 8080)
- `WS_HOST`: WebSocket server host (default: 0.0.0.0)
- `TELNET_HOST`: Ranvier server hostname (default: ranvier)
- `TELNET_PORT`: Ranvier server port (default: 3000)
- `CONNECTION_TIMEOUT`: Connection timeout in ms (default: 30000)
- `MAX_CONNECTIONS`: Maximum concurrent connections (default: 100)

**Web Client:**
- `PORT`: HTTP server port (default: 3001)
- `NODE_ENV`: Environment mode
- `PROXY_URL`: WebSocket proxy URL (auto-detected in browser)

### Docker Compose Files

- `docker-compose.yml`: Production configuration with optimized images
- `docker-compose.dev.yml`: Development configuration with volume mounts and live reload

### Game Configuration

The game world is configured through YAML files in the Ranvier bundles:
- `ranvier/bundles/basic-world/areas/basic-area/rooms.yml`: Room definitions and connections
- `ranvier/bundles/basic-world/areas/basic-area/items.yml`: Item properties and behaviors  
- `ranvier/bundles/basic-world/areas/basic-area/npcs.yml`: NPC definitions and dialogue

## Health Checks

All services include health check endpoints:

- **Ranvier**: TCP connection test on port 3000
- **Proxy**: HTTP GET `/health` on port 8080
- **Web Client**: HTTP GET `/health` on port 3001

## Networking

Services communicate through a Docker bridge network (`mud-network`):
- Browser → WebSocket Proxy → Ranvier Server
- All inter-service communication uses service names as hostnames

## Deployment & Operations

### Production Deployment

**Container Orchestration:**
```bash
# Basic deployment
docker compose up --build -d

# With custom configuration
docker compose -f docker-compose.yml --env-file .env.prod up -d

# Health checks
docker compose ps
curl http://localhost:3001/health
curl http://localhost:8080/health
```

**Scaling Considerations:**
- WebSocket proxy supports up to 100 concurrent connections by default
- Ranvier server handles multiple telnet connections efficiently
- Database persistence ensures character data survives restarts
- Static file serving can be offloaded to CDN or reverse proxy

### Monitoring & Health Checks

All services include built-in health check endpoints:

- **Ranvier**: TCP connection test on port 3000
- **Proxy**: HTTP GET `/health` returns connection stats and uptime
- **Web Client**: HTTP GET `/health` returns server status

**Sample Health Check Response:**
```json
{
  "status": "healthy",
  "timestamp": "2024-01-01T00:00:00.000Z",
  "telnetTarget": "ranvier:3000",
  "activeConnections": 5,
  "uptime": 3600
}
```

### Security Considerations

- **WebSocket Security**: Use WSS (TLS) for encrypted connections in production
- **Input Validation**: All user input is sanitized before processing
- **Rate Limiting**: Prevent command flooding and abuse
- **Container Security**: Non-root users, minimal attack surface
- **Data Protection**: Character information is stored securely

### Backup & Recovery

**Database Backups:**
```bash
# Backup character data
docker compose exec ranvier tar -czf /backup/$(date +%Y%m%d_%H%M%S)_characters.tar.gz /app/data

# Restore from backup
docker compose exec ranvier tar -xzf /backup/20240101_120000_characters.tar.gz -C /app/
```

**Configuration Backup:**
- Version control all YAML configuration files
- Backup Docker Compose configurations and environment files
- Document any manual configuration changes

## Troubleshooting

### Common Issues

**Connection Problems:**
- **WebSocket fails to connect**: Check proxy service status and port 8080 availability
- **"Connection refused"**: Verify Ranvier server is running on port 3000
- **Frequent disconnections**: Check network stability and increase connection timeout
- **Browser compatibility**: Ensure WebSocket support (Chrome 50+, Firefox 50+, Safari 13+)

**Gameplay Issues:**
- **Commands not recognized**: Check spelling and available commands with `help`
- **Can't move between rooms**: Verify room exits with `look` command
- **Items won't take/drop**: Check inventory capacity and item permissions
- **NPCs not responding**: Verify NPC is present with `look` and use correct interaction commands

**Performance Issues:**
- **Slow response times**: Check server resources and network latency
- **Memory usage increasing**: Monitor for connection leaks, restart services if needed
- **Terminal rendering issues**: Clear browser cache, check ANSI color support

### Performance Optimization

**Server-side:**
- Monitor CPU and memory usage of all containers
- Adjust connection limits based on server capacity
- Use persistent volumes for database performance
- Consider load balancing for high traffic scenarios

**Client-side:**
- Terminal scrollback limited to 1000 lines for memory efficiency
- WebSocket connections include automatic cleanup
- Modern browsers handle xterm.js rendering efficiently

### Debugging

**Enable Debug Logging:**
```bash
# Ranvier server
docker compose exec ranvier npm run debug

# Proxy service
docker compose exec proxy LOG_LEVEL=debug npm start

# View container logs
docker compose logs -f [service-name]
```

**Common Debug Commands:**
```bash
# Check container status
docker compose ps

# Inspect network connectivity
docker compose exec proxy nc -zv ranvier 3000

# Monitor WebSocket connections
docker compose exec proxy curl localhost:8080/health

# Database integrity check
docker compose exec ranvier ls -la /app/data/
```

## Performance & Scaling

### Current Limits
- **Concurrent Players**: ~100 WebSocket connections per proxy instance
- **Database**: NeDB suitable for small to medium player base
- **Memory Usage**: ~50MB per service container under normal load
- **Network**: Optimized for low-latency text-based communication

### Scaling Options
- **Horizontal Scaling**: Multiple proxy instances with load balancing
- **Database Upgrade**: Replace NeDB with MongoDB or PostgreSQL for larger datasets
- **CDN Integration**: Serve static assets from CDN for better global performance
- **Container Orchestration**: Use Kubernetes for advanced scaling and management

## Contributing

We welcome contributions! Please see our documentation:

- **[CONTRIBUTING.md](CONTRIBUTING.md)** - Development setup, workflow, and standards
- **[API.md](API.md)** - Technical API reference for all components  
- **[DEPLOYMENT.md](DEPLOYMENT.md)** - Production deployment and operations guide
- **[DOCS.md](DOCS.md)** - Complete documentation index and overview

## Architecture Decision Records

Key architectural decisions and their context are documented in the `.kiro/` directory:

- [Design Document](.kiro/specs/ranvier-mud-browser-client/design.md): System architecture and component design
- [Requirements](.kiro/specs/ranvier-mud-browser-client/requirements.md): Feature requirements and acceptance criteria
- [Implementation Tasks](.kiro/specs/ranvier-mud-browser-client/tasks.md): Development progress and task tracking
- [Technology Stack](.kiro/steering/tech.md): Technology choices and justifications
- [Project Structure](.kiro/steering/structure.md): Code organization principles

## License

[Add license information here]

## Support

For questions, bug reports, or feature requests:
- Create an [Issue](https://github.com/SergeiGolos/zev-mud/issues)
- Check existing documentation in the `.kiro/` directory
- Review component-specific README files in each service directory
- Document any manual configuration changes
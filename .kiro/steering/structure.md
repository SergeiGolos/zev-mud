# Project Structure

## Directory Organization

```
zev-mud/
├── ranvier/                 # Ranvier game server
│   ├── areas/              # Game world definitions
│   ├── bundles/            # Game content bundles
│   ├── data/               # Persistent game data
│   └── src/                # Server source code
├── proxy/                  # WebSocket-Telnet proxy
│   ├── src/                # Proxy source code
│   ├── config/             # Proxy configuration
│   └── tests/              # Proxy unit tests
├── web-client/             # Browser-based client
│   ├── src/                # Client source code
│   ├── public/             # Static assets
│   └── dist/               # Built client files
├── docker-compose.yml      # Production deployment
├── docker-compose.dev.yml  # Development environment
└── README.md               # Project documentation
```

## Component Boundaries

### Ranvier Server (`/ranvier`)
- **Purpose**: Core MUD game engine and logic
- **Responsibilities**: Player management, world simulation, combat, persistence
- **Interface**: Telnet server on port 3000
- **Data**: Character data, world state, game configuration

### WebSocket Proxy (`/proxy`)
- **Purpose**: Protocol bridge between WebSocket and Telnet
- **Responsibilities**: Connection management, message forwarding, error handling
- **Interface**: WebSocket server on port 8080, Telnet client to Ranvier
- **Data**: Connection state, message buffers

### Web Client (`/web-client`)
- **Purpose**: Browser-based terminal interface
- **Responsibilities**: User interface, input handling, terminal rendering
- **Interface**: HTTP server on port 3001, WebSocket client to proxy
- **Data**: UI state, terminal history, connection status

## File Naming Conventions

- **Configuration**: `*.config.js`, `*.yml`
- **Components**: PascalCase for classes, camelCase for functions
- **Tests**: `*.test.js`, `*.spec.js`
- **Docker**: `Dockerfile`, `docker-compose*.yml`
- **Game Data**: Lowercase with hyphens (`basic-sword.yml`)

## Code Organization Patterns

### Separation of Concerns
- **Game Logic**: Isolated in Ranvier bundles and behaviors
- **Network Layer**: Proxy handles all protocol conversion
- **Presentation**: Web client focuses solely on UI/UX

### Data Flow
1. **User Input**: Browser → WebSocket → Proxy → Telnet → Ranvier
2. **Game Output**: Ranvier → Telnet → Proxy → WebSocket → Browser
3. **Persistence**: Ranvier ↔ Database (NeDB/configured DB)

### Configuration Management
- **Environment Variables**: For deployment-specific settings
- **Config Files**: For game content and behavior definitions
- **Docker Compose**: For service orchestration and networking
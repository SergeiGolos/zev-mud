# zev-mud Developer Instructions

**ALWAYS follow these instructions first and only fallback to search or bash commands when you encounter unexpected information that contradicts what is documented here.**

zev-mud is a browser-based Multi-User Dungeon (MUD) game with a 3-tier architecture: Browser Client → Web Client Server (port 3001) → WebSocket Proxy (port 8080) → Ranvier MUD Server (port 3000). The system loads 10 interconnected rooms, 13+ interactive items, and 2+ NPCs.

## Working Effectively

### Bootstrap and Development Setup
**Individual Service Development (RECOMMENDED):**
```bash
# Terminal 1 - Ranvier MUD server
cd ranvier && npm install && npm run dev

# Terminal 2 - WebSocket proxy  
cd proxy && npm install && npm run dev

# Terminal 3 - Web client server
cd web-client && npm install && npm run dev
```
- **Timing**: npm install takes 2-10 seconds per service, startup takes 5-10 seconds each
- **NEVER CANCEL**: Wait for "Ranvier MUD server listening on port 3000", "WebSocket proxy listening on port 8080", "Web client server listening on port 3001"
- **Critical**: Ranvier server currently has a runtime error on telnet connections (Ranvier.TransportStream.TelnetStream not defined) but services start successfully

**Docker Development (HAS RUNTIME ISSUES):**
```bash
# Use individual development instead - Docker has same runtime issues
docker compose -f docker-compose.dev.yml up --build
```
- **NEVER CANCEL**: Build takes 300+ seconds. WAIT FOR COMPLETION.
- **Known Issue**: Ranvier service fails on incoming connections due to missing Ranvier framework reference
- **Workaround**: Use individual service development instead

### Testing
**Run Tests (BEFORE making changes):**
```bash
# ALWAYS run these to understand current state - set appropriate timeouts:
cd web-client && npm test         # 1.3 seconds - ALL PASS (67/67)
cd ranvier && npm test            # 3.5 seconds - PARTIAL PASS (62/66, js-yaml issues in 4 tests)  
cd proxy && npm test              # 380 seconds - TIMEOUTS/FAILURES (23/49 pass)
```
- **NEVER CANCEL**: Proxy tests take 380+ seconds with many timeouts. Set timeout to 420+ seconds.
- **Expected**: Web-client tests always pass. Ranvier has 4 failing tests with js-yaml dependency issues. Proxy tests have timing issues.
- **Permission Fix**: If jest permission errors occur: `chmod +x node_modules/.bin/jest` in each service directory

### Health Check Validation
**Verify Services are Working:**
```bash
curl http://localhost:3001/health  # Web client
curl http://localhost:8080/health  # Proxy 
nc -zv localhost 3000              # Ranvier (telnet port)
```
- **Expected Response**: JSON health status from web-client and proxy, connection success from Ranvier
- **Always verify**: All services respond before proceeding with development

## Validation Scenarios

### Service Connectivity Testing
**ALWAYS test these scenarios after making changes:**
1. **Basic Connectivity**: All health endpoints respond within 5 seconds
2. **Web Client Access**: `curl http://localhost:3001/` returns HTML with xterm.js terminal interface
3. **Proxy Health**: `curl http://localhost:8080/health` shows activeConnections count and uptime
4. **Ranvier Status**: Server starts and shows "Loaded 10 rooms, 13 items, 2 NPCs"

### Current Functional Limitations
**Known Issues (DO NOT try to fix unless specifically tasked):**
- **Ranvier Runtime Error**: Telnet connections cause "Ranvier is not defined" error at line 288
- **Proxy Test Timeouts**: Integration tests timeout due to connection handling issues
- **js-yaml Dependency**: Some Ranvier tests fail due to missing lib directory, requires `npm uninstall js-yaml && npm install js-yaml` fix

## Build and Development Commands

### Individual Service Commands (VALIDATED)
```bash
# Installation (2-10 seconds each)
cd ranvier && npm install          # Installs MUD server dependencies
cd proxy && npm install            # Installs WebSocket proxy dependencies  
cd web-client && npm install       # Installs web server dependencies

# Development servers (5-10 seconds startup each)
cd ranvier && npm run dev          # Starts with nodemon on port 3000
cd proxy && npm run dev            # Starts with nodemon on port 8080  
cd web-client && npm run dev       # Starts with nodemon on port 3001

# Production servers
cd ranvier && npm start            # Runs src/server.js directly
cd proxy && npm start              # Runs src/proxy.js directly
cd web-client && npm start         # Runs src/server.js directly
```

### Docker Commands (LIMITED FUNCTIONALITY)
```bash
# Development environment - NEVER CANCEL, takes 300+ seconds
docker compose -f docker-compose.dev.yml up --build

# Production deployment
docker compose up --build -d

# Health monitoring
docker compose ps                  # Check service status
docker compose logs -f [service]  # View service logs
```
- **Critical Issue**: Ranvier container fails on telnet connections
- **Use Case**: Only use Docker for building/testing, prefer individual development

### Testing Commands (MEASURED TIMINGS)
```bash
# Web Client (1.3 seconds, always passes)
cd web-client && npm test                    # All 67 tests pass
cd web-client && npm run test:coverage      # Includes coverage report

# Ranvier Server (3.5 seconds, mostly passes)  
cd ranvier && npm test                       # 62/66 tests pass, 4 js-yaml failures

# Proxy (380+ seconds, many timeouts)
cd proxy && npm test                         # 23/49 tests pass - NEVER CANCEL
cd proxy && npm run test:unit               # Unit tests only  
cd proxy && npm run test:integration        # Integration tests - VERY SLOW
```
- **NEVER CANCEL**: Proxy tests take 380+ seconds due to connection timeouts
- **Set Timeout**: Use minimum 420 seconds for proxy tests

## Architecture and Key Locations

### Service Structure
- **Ranvier Server** (`/ranvier`): Core MUD game engine, telnet server on port 3000
  - Main: `src/server.js` - Game server and connection handling
  - Data: `bundles/basic-world/areas/` - Game world YAML files
  - Tests: `tests/` - Character, movement, item interaction tests
  
- **WebSocket Proxy** (`/proxy`): Protocol bridge between WebSocket and Telnet on port 8080
  - Main: `src/proxy.js` - WebSocket server and telnet client
  - Health: `/health` endpoint with connection stats
  - Tests: `tests/` - Proxy logic and integration tests (SLOW)
  
- **Web Client** (`/web-client`): Browser terminal interface on port 3001
  - Server: `src/server.js` - Express server for static files  
  - Client: `public/index.html` - Browser terminal using xterm.js
  - Tests: `tests/` - Client functionality and terminal rendering (ALL PASS)

### Important Files Always Check
- **Configuration**: Each service has independent `package.json` with npm scripts
- **Docker**: `docker-compose.dev.yml` for development, `docker-compose.yml` for production
- **Game Data**: `ranvier/bundles/basic-world/areas/basic-area/` contains rooms.yml, items.yml, npcs.yml
- **Health Endpoints**: All services provide `/health` except Ranvier (uses telnet connection test)

## Common Development Tasks

### Making Code Changes
1. **ALWAYS start individual services first** to establish baseline functionality
2. **Run health checks** to verify all services respond correctly  
3. **Test web-client tests** - these always pass and validate quickly (1.3 seconds)
4. **Avoid proxy tests during active development** - they take 380+ seconds with many timeouts
5. **Check Ranvier startup logs** - should show "Loaded 10 rooms, 13 items, 2 NPCs"

### Performance Expectations
- **Service Startup**: 5-10 seconds each (Ranvier loads game world data)
- **npm install**: 2-10 seconds per service
- **Docker Build**: 300+ seconds total - NEVER CANCEL
- **Web-client Tests**: 1.3 seconds (67 tests, all pass)
- **Ranvier Tests**: 3.5 seconds (66 tests, 62 pass)
- **Proxy Tests**: 380+ seconds (49 tests, 23 pass) - SET LONG TIMEOUT

### Validation Checklist
**Before concluding any development work:**
- [ ] All three services start without errors
- [ ] Health endpoints respond: `curl localhost:3001/health && curl localhost:8080/health`
- [ ] Ranvier logs show world data loaded: "Loaded 10 rooms, 13 items, 2 NPCs"
- [ ] Web client serves HTML: `curl localhost:3001/` returns xterm.js interface
- [ ] Web-client tests pass: `cd web-client && npm test` (67/67 tests)

## Critical Warnings

### Timeout Requirements
- **NEVER CANCEL** Docker builds - minimum 360 seconds timeout
- **NEVER CANCEL** Proxy tests - minimum 420 seconds timeout  
- **NEVER CANCEL** Service startup - wait for full initialization messages
- **NEVER CANCEL** npm install - dependency resolution can take time

### Known Limitations
- **Ranvier Telnet Bug**: Server starts but crashes on telnet connections (line 288 Ranvier.TransportStream.TelnetStream error)
- **Docker Runtime Issues**: Same telnet connection error occurs in containers
- **Proxy Test Instability**: Integration tests have timing issues causing failures
- **js-yaml Dependency**: May need reinstallation if Ranvier tests fail: `cd ranvier && npm uninstall js-yaml && npm install js-yaml`

### Preferred Workflows
- **Primary**: Use individual service development (`cd [service] && npm install && npm run dev`)
- **Testing**: Run web-client tests for quick validation, avoid proxy tests during active development
- **Validation**: Use health endpoints and service startup logs to verify functionality
- **Docker**: Use only for building/deployment testing, not active development
# API Documentation - zev-mud

This document provides technical API reference for the zev-mud system components.

## WebSocket Proxy API

The WebSocket proxy bridges browser WebSocket connections to Telnet connections for the Ranvier MUD server.

### Health Check Endpoint

**GET** `/health`

Returns the current status of the proxy service.

**Response:**
```json
{
  "status": "healthy",
  "timestamp": "2024-01-01T00:00:00.000Z",
  "telnetTarget": "ranvier:3000",
  "activeConnections": 5,
  "uptime": 3600,
  "version": "1.0.0"
}
```

**Status Codes:**
- `200 OK` - Service is healthy and operational
- `503 Service Unavailable` - Service is unhealthy or telnet target unreachable

### WebSocket Connection

**WebSocket** `ws://localhost:8080`

Establishes a WebSocket connection for MUD gameplay.

**Connection Flow:**
1. Client establishes WebSocket connection
2. Proxy creates corresponding Telnet connection to Ranvier
3. Messages are bidirectionally forwarded with protocol conversion
4. Connection cleanup occurs when either side disconnects

**Message Format:**
- **Client → Server**: Plain text commands (e.g., "look", "north", "say hello")
- **Server → Client**: ANSI-formatted text responses with color codes

**Connection Events:**
```javascript
// Connection established
websocket.onopen = function(event) {
  console.log('Connected to MUD server');
};

// Receive game output
websocket.onmessage = function(event) {
  terminal.write(event.data);
};

// Handle disconnection
websocket.onclose = function(event) {
  console.log('Disconnected:', event.code, event.reason);
};

// Handle errors
websocket.onerror = function(error) {
  console.error('WebSocket error:', error);
};
```

### Configuration

**Environment Variables:**
- `WS_PORT`: WebSocket server port (default: 8080)
- `WS_HOST`: WebSocket server host (default: 0.0.0.0)
- `TELNET_HOST`: Target Ranvier server hostname (default: ranvier)
- `TELNET_PORT`: Target Ranvier server port (default: 3000)
- `CONNECTION_TIMEOUT`: Connection timeout in ms (default: 30000)
- `MAX_CONNECTIONS`: Maximum concurrent connections (default: 100)

## Web Client API

The web client provides HTTP endpoints for serving the browser interface.

### Health Check Endpoint

**GET** `/health`

Returns the current status of the web client server.

**Response:**
```json
{
  "status": "healthy",
  "timestamp": "2024-01-01T00:00:00.000Z"
}
```

**Status Codes:**
- `200 OK` - Web server is operational
- `503 Service Unavailable` - Server error

### Static File Endpoints

**GET** `/`

Serves the main web interface.

**Response:** HTML page with terminal interface

---

**GET** `/client.js`

Serves the client-side JavaScript for terminal functionality.

**Response:** JavaScript file with MudClient class

**Content-Type:** `application/javascript`

### Client-Side API

The `MudClient` class provides the browser-side interface.

#### Constructor

```javascript
const client = new MudClient(options);
```

**Options:**
```javascript
{
  wsUrl: 'ws://localhost:8080',          // WebSocket proxy URL
  reconnectAttempts: 5,                  // Maximum reconnection attempts
  reconnectDelay: 1000,                  // Delay between reconnection attempts (ms)
  terminal: {
    fontSize: 14,                        // Terminal font size
    fontFamily: 'Courier New, monospace' // Terminal font family
  }
}
```

#### Methods

**connect()**
```javascript
client.connect();
```
Establishes WebSocket connection to the proxy.

**disconnect()**
```javascript
client.disconnect();
```
Closes WebSocket connection.

**send(message)**
```javascript
client.send('look');
client.send('north');
```
Sends a command to the MUD server.

**getConnectionState()**
```javascript
const state = client.getConnectionState();
// Returns: 'connecting', 'connected', 'disconnecting', 'disconnected'
```

#### Events

The client emits events that can be listened to:

```javascript
client.on('connected', () => {
  console.log('Connected to MUD server');
});

client.on('disconnected', () => {
  console.log('Disconnected from MUD server');
});

client.on('message', (data) => {
  console.log('Received:', data);
});

client.on('error', (error) => {
  console.error('Client error:', error);
});
```

## Ranvier Server API

The Ranvier server provides Telnet connections for MUD gameplay.

### Connection

**Telnet** `telnet localhost 3000`

Direct telnet connection to the MUD server.

### Available Commands

#### Movement Commands
- `north`, `south`, `east`, `west`, `up`, `down` - Move between rooms
- `look` - Examine current room
- `examine <target>` - Examine item or NPC in detail

#### Inventory Commands  
- `inventory` - Display current inventory
- `take <item>` - Pick up item from room
- `drop <item>` - Drop item from inventory
- `use <item>` - Use consumable item

#### Combat Commands
- `attack <target>` - Initiate combat with NPC
- `flee` - Attempt to escape from combat

#### Communication Commands
- `say <message>` - Speak to other players in room
- `tell <player> <message>` - Private message to player
- `who` - List online players

#### NPC Interaction
- `talk <npc>` - Initiate dialogue with NPC
- `greet <npc>` - Greet an NPC

### Game Data Formats

#### Room Definition (YAML)
```yaml
- id: dungeon-entrance
  title: "Dungeon Entrance"
  description: "A dark stone archway marks the entrance to an ancient dungeon."
  exits:
    - direction: north
      roomId: narrow-corridor
    - direction: east  
      roomId: guard-post
  items:
    - torch
  npcs:
    - stone-guardian
```

#### Item Definition (YAML)
```yaml
- id: rusty-sword
  name: "Rusty Sword"
  description: "An old sword with rust covering the blade."
  type: weapon
  takeable: true
  properties:
    damage: 5
    durability: 80
    weight: 3
```

#### NPC Definition (YAML)
```yaml
- id: skeleton-warrior
  name: "Skeleton Warrior"  
  description: "A reanimated skeleton clad in ancient armor."
  level: 3
  health: 50
  behaviors: ["aggressive", "undead"]
  dialogue:
    - text: "The skeleton rattles menacingly as you approach."
      responses: []
```

### Database Schema

The Ranvier server uses NeDB for character persistence.

#### Character Document
```json
{
  "_id": "unique_character_id",
  "name": "PlayerName",
  "created": "2024-01-01T00:00:00.000Z",
  "lastLogin": "2024-01-01T12:00:00.000Z",
  "location": "dungeon-entrance",
  "stats": {
    "health": 100,
    "maxHealth": 100,
    "level": 1,
    "experience": 0
  },
  "inventory": [
    {
      "id": "torch",
      "quantity": 1
    }
  ],
  "equipment": {
    "weapon": null,
    "armor": null,
    "shield": null
  }
}
```

## Message Formats

### WebSocket Messages

**Client to Proxy:**
```
look
north
take sword
say Hello everyone!
```

**Proxy to Client:**
```
\x1b[32mDungeon Entrance\x1b[0m
A dark stone archway marks the entrance to an ancient dungeon.

Exits: north, east

You see:
  - a flickering torch
  - Stone Guardian Statue (sleeping)

> 
```

### Telnet Protocol Handling

The proxy handles Telnet protocol negotiation:

**Filtered IAC Sequences:**
- `IAC WILL/WONT/DO/DONT` negotiations
- `IAC SB ... SE` subnegotiation blocks  
- `IAC GA` (Go Ahead) signals

**Preserved Sequences:**
- ANSI escape codes for colors and formatting
- Printable text content
- Line endings (converted to proper format)

## Error Handling

### Common Error Responses

**WebSocket Errors:**
```json
{
  "error": "connection_failed",
  "message": "Unable to connect to Telnet server",
  "timestamp": "2024-01-01T00:00:00.000Z"
}
```

**Game Command Errors:**
```
That direction is blocked.
You don't see that item here.
You cannot attack that target.
Your inventory is full.
```

### HTTP Status Codes

- `200 OK` - Successful request
- `404 Not Found` - Endpoint or resource not found
- `500 Internal Server Error` - Server error
- `503 Service Unavailable` - Service unhealthy or unavailable

## Rate Limiting

### WebSocket Connections
- Maximum 100 concurrent connections per proxy instance
- Connection timeout: 30 seconds for inactive connections
- Automatic cleanup of broken connections

### Command Rate Limiting
- Maximum 10 commands per second per connection
- Temporary throttling for excessive command rates
- Auto-disconnect for sustained abuse

## Security Considerations

### Input Sanitization
- All user input is validated before processing
- Special characters are escaped appropriately
- Command length limits enforced

### WebSocket Security
- Origin checking for WebSocket connections
- Connection state validation
- Proper error message sanitization

### Container Security  
- Non-root user execution
- Minimal container attack surface
- Network isolation between services

## Development & Testing

### Testing Endpoints

**WebSocket Connection Test:**
```javascript
// Test WebSocket connectivity
const ws = new WebSocket('ws://localhost:8080');
ws.onopen = () => console.log('Connected');
ws.send('look');
```

**Health Check Test:**
```bash
# Test all service health endpoints
curl http://localhost:3001/health  # Web client
curl http://localhost:8080/health  # Proxy
nc -zv localhost 3000              # Ranvier telnet
```

### Mock Services

For testing, mock services can be configured:

**Mock Telnet Server:**
```javascript
const net = require('net');
const server = net.createServer((socket) => {
  socket.write('Welcome to mock MUD server\n> ');
  socket.on('data', (data) => {
    socket.write(`Echo: ${data}> `);
  });
});
server.listen(3000);
```

This API documentation provides the technical foundation for developing with and integrating the zev-mud system components.
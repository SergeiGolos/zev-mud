# Ranvier MUD Server for zev-mud

This is the Ranvier MUD server component of the zev-mud project, providing a basic world with rooms, items, and NPCs.

## Features

- **NeDB Database**: Character persistence using NeDB
- **Basic World**: 10 interconnected rooms forming a small dungeon
- **Items**: 13 different items including weapons, consumables, and treasure
- **NPCs**: 2 NPCs with behaviors and dialogue trees
- **Commands**: Movement, inventory management, item interactions, and communication

## World Structure

### Rooms
The world consists of 10 interconnected rooms:
- **Dungeon Entrance** (room1) - Starting area with a torch
- **Narrow Corridor** (room2) - Connects entrance to central chamber
- **Central Chamber** (room3) - Hub with exits in all directions and an ancient key
- **Storage Room** (room4) - Contains a rusty sword and health potion
- **Guard Post** (room5) - Guarded by a skeleton warrior with an iron shield
- **Library Ruins** (room6) - Contains spell scrolls and ancient tomes
- **Armory** (room7) - Weapons and armor storage
- **Dungeon Exit** (room8) - Safe area outside the dungeon
- **Upper Chamber** (room9) - Treasure room accessible from central chamber
- **Secret Passage** (room10) - Hidden connection between library and armory

### Items
13 different items with take/drop functionality:
- **Weapons**: Rusty sword, iron sword
- **Armor**: Iron shield, leather armor
- **Consumables**: Health potion, bread
- **Magical**: Spell scroll, mysterious gem
- **Treasure**: Gold coins, treasure chest
- **Utility**: Torch, ancient key, ancient tome

### NPCs
2 NPCs with different behaviors:
- **Stone Guardian Statue**: Passive guardian that activates when threatened
- **Skeleton Warrior**: Aggressive undead creature that attacks on sight

## Available Commands

### Movement
- `north`, `n` - Move north
- `south`, `s` - Move south  
- `east`, `e` - Move east
- `west`, `w` - Move west
- `up`, `u` - Move up
- `down`, `d` - Move down

### Interaction
- `look`, `l` - Look around the current room
- `inventory`, `inv`, `i` - Show your inventory
- `take <item>`, `get <item>` - Pick up an item
- `drop <item>` - Drop an item from inventory
- `say <message>` - Say something to other players in the room

### System
- `quit` - Disconnect from the game

## Installation and Setup

1. Install dependencies:
```bash
npm install
```

2. Start the server:
```bash
npm start
```

3. For development with auto-restart:
```bash
npm run dev
```

## Testing

Run the test suite:
```bash
npm test
```

The test suite includes:
- Room navigation tests
- Item interaction tests
- Database functionality tests
- Server integration tests

## Configuration

Server configuration is in `config/config.js`:
- **Port**: Default 3000
- **Database**: NeDB with file storage
- **Starting Room**: basic-area:room1
- **Save Interval**: 30 seconds

## Database

Character data is persisted using NeDB in the `data/` directory:
- Character attributes (health, mana, stamina)
- Current room location
- Inventory contents
- Creation and login timestamps

## Architecture

The server uses a simplified architecture:
- **GameState**: Manages world data and player state
- **TelnetServer**: Handles network connections and commands
- **Room/Item/NPC/Player**: Core game entity classes
- **NedbDataSource**: Database abstraction layer

## Development

### Adding New Rooms
Edit `bundles/basic-world/areas/basic-area/rooms.yml` to add new rooms with:
- Unique ID
- Title and description
- Exit connections
- Default items and NPCs

### Adding New Items
Edit `bundles/basic-world/areas/basic-area/items.yml` to add new items with:
- Unique ID
- Name and description
- Type and metadata (weight, value, etc.)

### Adding New NPCs
Edit `bundles/basic-world/areas/basic-area/npcs.yml` to add new NPCs with:
- Unique ID
- Name, description, and stats
- Behaviors and dialogue trees
- Hostility settings

### Creating NPC Behaviors
Add behavior files in `bundles/basic-world/behaviors/npc/` with:
- Event listeners (playerEnter, hit, etc.)
- Custom methods for NPC actions
- Combat and interaction logic

## Testing the Server

Connect to the server using telnet:
```bash
telnet localhost 3000
```

Or use the WebSocket proxy and web client for browser-based access.

## Requirements Fulfilled

This implementation satisfies the following requirements:
- ✅ Set up Ranvier server with NeDB database configuration
- ✅ Create 6-12 interconnected rooms with descriptions and exits (10 rooms)
- ✅ Add basic items with take/drop functionality (13 items)
- ✅ Configure 1-2 NPCs with simple behaviors and dialogue trees (2 NPCs)
- ✅ Write unit tests for room navigation and item interactions (25 tests)
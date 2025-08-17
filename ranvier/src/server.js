const path = require('path');
const fs = require('fs');
const yaml = require('js-yaml');
const config = require('../config/config');
const NedbDataSource = require('./datasources/nedb');

// Simple game state management
class GameState {
  constructor() {
    this.players = new Map();
    this.rooms = new Map();
    this.items = new Map();
    this.npcs = new Map();
    this.accounts = new Map();
    
    // Initialize database
    this.db = new NedbDataSource(config.database);
    
    // Load world data
    this.loadWorld();
  }

  loadWorld() {
    try {
      // Load rooms
      const roomsPath = path.join(__dirname, '../bundles/basic-world/areas/basic-area/rooms.yml');
      const roomsData = yaml.load(fs.readFileSync(roomsPath, 'utf8'));
      
      roomsData.forEach(roomDef => {
        const room = new Room(roomDef);
        this.rooms.set(room.id, room);
      });

      // Load items
      const itemsPath = path.join(__dirname, '../bundles/basic-world/areas/basic-area/items.yml');
      const itemsData = yaml.load(fs.readFileSync(itemsPath, 'utf8'));
      
      itemsData.forEach(itemDef => {
        const item = new Item(itemDef);
        this.items.set(item.id, item);
      });

      // Load NPCs
      const npcsPath = path.join(__dirname, '../bundles/basic-world/areas/basic-area/npcs.yml');
      const npcsData = yaml.load(fs.readFileSync(npcsPath, 'utf8'));
      
      npcsData.forEach(npcDef => {
        const npc = new NPC(npcDef);
        this.npcs.set(npc.id, npc);
      });

      // Place items and NPCs in rooms
      this.populateRooms();
      
      console.log(`Loaded ${this.rooms.size} rooms, ${this.items.size} items, ${this.npcs.size} NPCs`);
    } catch (error) {
      console.error('Error loading world data:', error);
    }
  }

  populateRooms() {
    // Place items in rooms
    this.rooms.forEach(room => {
      if (room.def.items) {
        room.def.items.forEach(itemId => {
          const item = this.items.get(itemId.replace('basic-area:', ''));
          if (item) {
            room.items.add(new Item(item.def));
          }
        });
      }

      // Place NPCs in rooms
      if (room.def.npcs) {
        room.def.npcs.forEach(npcId => {
          const npc = this.npcs.get(npcId.replace('basic-area:', ''));
          if (npc) {
            const npcInstance = new NPC(npc.def);
            room.npcs.add(npcInstance);
          }
        });
      }
    });
  }

  getRoom(roomId) {
    // Handle both "basic-area:room1" and "room1" formats
    const id = roomId.includes(':') ? roomId.split(':')[1] : roomId;
    return this.rooms.get(id);
  }

  async savePlayer(player) {
    const playerData = {
      name: player.name,
      attributes: player.attributes,
      roomId: player.roomId,
      inventory: Array.from(player.inventory || []).map(item => ({
        id: item.id,
        name: item.name,
        description: item.description,
        type: item.type,
        metadata: item.metadata
      })),
      createdAt: player.createdAt,
      lastLogin: new Date()
    };
    
    await this.db.save('player', player.name, playerData);
  }

  async loadPlayer(name) {
    const playerData = await this.db.load('player', name);
    if (!playerData) return null;

    const player = new Player(playerData);
    return player;
  }
}

// Simple classes for game entities
class Room {
  constructor(def) {
    this.def = def;
    this.id = def.id;
    this.title = def.title;
    this.description = def.description;
    this.exits = def.exits || [];
    this.items = new Set();
    this.npcs = new Set();
    this.players = new Set();
  }

  addPlayer(player) {
    this.players.add(player);
  }

  removePlayer(player) {
    this.players.delete(player);
  }

  addItem(item) {
    this.items.add(item);
  }

  removeItem(item) {
    this.items.delete(item);
  }

  getBroadcastTargets() {
    return Array.from(this.players);
  }
}

class Item {
  constructor(def) {
    this.def = def;
    this.id = def.id;
    this.name = def.name;
    this.description = def.description;
    this.type = def.type;
    this.metadata = def.metadata || {};
  }
}

class NPC {
  constructor(def) {
    this.def = def;
    this.id = def.id;
    this.name = def.name;
    this.description = def.description;
    this.level = def.level || 1;
    this.attributes = def.attributes || { health: 50, mana: 20, stamina: 50 };
    this.stats = def.stats || {};
    this.hostile = def.hostile || false;
    this.dialogue = def.dialogue || {};
    this.behaviors = def.behaviors || [];
  }
}

class Player {
  constructor(data) {
    this.name = data.name;
    this.attributes = data.attributes || { health: 100, mana: 50, stamina: 100 };
    this.roomId = data.roomId;
    this.inventory = new Set();
    this.createdAt = data.createdAt || new Date();
    this.lastLogin = data.lastLogin || new Date();
    
    // Restore inventory
    if (data.inventory) {
      data.inventory.forEach(itemData => {
        this.inventory.add(new Item(itemData));
      });
    }
  }

  getAttribute(name) {
    return this.attributes[name] || 0;
  }

  setAttributeBase(name, value) {
    this.attributes[name] = value;
  }

  getMaxAttribute(name) {
    // Simple max calculation
    switch (name) {
      case 'health': return 100;
      case 'mana': return 50;
      case 'stamina': return 100;
      default: return this.attributes[name] || 0;
    }
  }
}

// Initialize game state
const gameState = new GameState();

// Start the telnet server
const net = require('net');

class TelnetServer {
  constructor(gameState) {
    this.gameState = gameState;
    this.port = config.port || 3000;
    this.server = null;
  }

  start() {
    this.server = net.createServer((socket) => {
      console.log('New telnet connection');
      
      // Create a transport stream for this connection
      const stream = new Ranvier.TransportStream.TelnetStream();
      stream.attach(socket);
      
      // Handle new player connection
      this.handleConnection(stream);
    });

    this.server.listen(this.port, () => {
      console.log(`Ranvier MUD server listening on port ${this.port}`);
    });

    this.server.on('error', (err) => {
      console.error('Server error:', err);
    });
  }

  handleConnection(socket) {
    // Send welcome message
    socket.write('Welcome to zev-mud!\r\n');
    socket.write('What is your character name? ');
    
    let awaitingName = true;
    let player = null;

    socket.on('data', (data) => {
      const input = data.toString().trim();
      
      if (awaitingName) {
        this.handleCharacterLogin(socket, input).then(p => {
          player = p;
          awaitingName = false;
          if (player) {
            this.enterGame(player, socket);
          }
        });
      } else if (player) {
        this.handleCommand(player, input);
      }
    });

    socket.on('close', () => {
      if (player) {
        console.log(`Player ${player.name} disconnected`);
        if (player.room) {
          player.room.removePlayer(player);
        }
        this.gameState.players.delete(player.name);
        // Save player data
        this.gameState.savePlayer(player).catch(err => {
          console.error('Error saving player:', err);
        });
      }
    });

    socket.on('error', (err) => {
      console.error('Socket error:', err);
    });
  }

  async handleCharacterLogin(socket, name) {
    if (!name || name.length < 2) {
      socket.write('Name must be at least 2 characters long.\r\n');
      socket.write('What is your character name? ');
      return null;
    }

    // Check if character exists
    let player = await this.gameState.loadPlayer(name);

    if (!player) {
      // Create new character
      socket.write(`Creating new character: ${name}\r\n`);
      
      const playerData = {
        name: name,
        attributes: { health: 100, mana: 50, stamina: 100 },
        roomId: config.game.startingRoom,
        inventory: [],
        createdAt: new Date()
      };
      
      player = new Player(playerData);
      
      // Save new character
      await this.gameState.savePlayer(player);
    } else {
      socket.write(`Welcome back, ${name}!\r\n`);
    }

    // Set starting room
    const startingRoom = this.gameState.getRoom(player.roomId || config.game.startingRoom);
    if (startingRoom) {
      player.room = startingRoom;
      startingRoom.addPlayer(player);
    }

    player.socket = socket;
    this.gameState.players.set(player.name, player);

    return player;
  }

  enterGame(player, socket) {
    // Show room description
    this.showRoom(player);
    socket.write('> ');
  }

  showRoom(player) {
    const room = player.room;
    if (!room) return;

    player.socket.write(`\r\n${room.title}\r\n`);
    player.socket.write(`${room.description}\r\n`);
    
    // Show exits
    if (room.exits && room.exits.length > 0) {
      const exitNames = room.exits.map(exit => exit.direction).join(', ');
      player.socket.write(`Exits: ${exitNames}\r\n`);
    }
    
    // Show items
    if (room.items && room.items.size > 0) {
      player.socket.write('Items here:\r\n');
      for (const item of room.items) {
        player.socket.write(`  ${item.name}\r\n`);
      }
    }
    
    // Show NPCs
    if (room.npcs && room.npcs.size > 0) {
      for (const npc of room.npcs) {
        player.socket.write(`${npc.name} is here.\r\n`);
      }
    }
    
    // Show other players
    if (room.players && room.players.size > 1) {
      for (const otherPlayer of room.players) {
        if (otherPlayer !== player) {
          player.socket.write(`${otherPlayer.name} is here.\r\n`);
        }
      }
    }
  }

  handleCommand(player, input) {
    const args = input.split(' ');
    const command = args[0].toLowerCase();
    
    switch (command) {
      case 'look':
      case 'l':
        this.showRoom(player);
        break;
        
      case 'north':
      case 'n':
        this.movePlayer(player, 'north');
        break;
        
      case 'south':
      case 's':
        this.movePlayer(player, 'south');
        break;
        
      case 'east':
      case 'e':
        this.movePlayer(player, 'east');
        break;
        
      case 'west':
      case 'w':
        this.movePlayer(player, 'west');
        break;
        
      case 'up':
      case 'u':
        this.movePlayer(player, 'up');
        break;
        
      case 'down':
      case 'd':
        this.movePlayer(player, 'down');
        break;
        
      case 'inventory':
      case 'inv':
      case 'i':
        this.showInventory(player);
        break;
        
      case 'take':
      case 'get':
        if (args.length > 1) {
          this.takeItem(player, args.slice(1).join(' '));
        } else {
          player.socket.write('Take what?\r\n');
        }
        break;
        
      case 'drop':
        if (args.length > 1) {
          this.dropItem(player, args.slice(1).join(' '));
        } else {
          player.socket.write('Drop what?\r\n');
        }
        break;
        
      case 'say':
        if (args.length > 1) {
          this.sayToRoom(player, args.slice(1).join(' '));
        } else {
          player.socket.write('Say what?\r\n');
        }
        break;
        
      case 'quit':
        player.socket.write('Goodbye!\r\n');
        player.socket.end();
        return;
        
      default:
        player.socket.write(`Unknown command: ${command}\r\n`);
    }
    
    player.socket.write('> ');
  }

  movePlayer(player, direction) {
    const room = player.room;
    if (!room) return;

    const exit = room.exits.find(e => e.direction === direction);
    if (!exit) {
      player.socket.write(`You cannot go ${direction}.\r\n`);
      return;
    }

    const newRoom = this.gameState.getRoom(exit.roomId);
    if (!newRoom) {
      player.socket.write(`You cannot go ${direction}.\r\n`);
      return;
    }

    // Remove from current room
    room.removePlayer(player);
    
    // Add to new room
    newRoom.addPlayer(player);
    player.room = newRoom;
    player.roomId = `basic-area:${newRoom.id}`;

    // Show new room
    this.showRoom(player);
  }

  showInventory(player) {
    if (!player.inventory || player.inventory.size === 0) {
      player.socket.write('You are not carrying anything.\r\n');
      return;
    }

    player.socket.write('You are carrying:\r\n');
    for (const item of player.inventory) {
      player.socket.write(`  ${item.name}\r\n`);
    }
  }

  takeItem(player, itemName) {
    const room = player.room;
    if (!room || !room.items) return;

    const item = Array.from(room.items).find(i => 
      i.name.toLowerCase().includes(itemName.toLowerCase())
    );

    if (!item) {
      player.socket.write(`There is no ${itemName} here.\r\n`);
      return;
    }

    room.removeItem(item);
    if (!player.inventory) {
      player.inventory = new Set();
    }
    player.inventory.add(item);
    
    player.socket.write(`You take ${item.name}.\r\n`);
    
    // Tell others in the room
    for (const otherPlayer of room.players) {
      if (otherPlayer !== player) {
        otherPlayer.socket.write(`${player.name} takes ${item.name}.\r\n`);
      }
    }
  }

  dropItem(player, itemName) {
    if (!player.inventory || player.inventory.size === 0) {
      player.socket.write('You are not carrying anything.\r\n');
      return;
    }

    const item = Array.from(player.inventory).find(i => 
      i.name.toLowerCase().includes(itemName.toLowerCase())
    );

    if (!item) {
      player.socket.write(`You are not carrying ${itemName}.\r\n`);
      return;
    }

    player.inventory.delete(item);
    player.room.addItem(item);
    
    player.socket.write(`You drop ${item.name}.\r\n`);
    
    // Tell others in the room
    for (const otherPlayer of player.room.players) {
      if (otherPlayer !== player) {
        otherPlayer.socket.write(`${player.name} drops ${item.name}.\r\n`);
      }
    }
  }

  sayToRoom(player, message) {
    player.socket.write(`You say, "${message}"\r\n`);
    
    // Tell others in the room
    for (const otherPlayer of player.room.players) {
      if (otherPlayer !== player) {
        otherPlayer.socket.write(`${player.name} says, "${message}"\r\n`);
      }
    }
  }

  stop() {
    if (this.server) {
      this.server.close();
    }
  }
}

// Start server
const server = new TelnetServer(gameState);
server.start();

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('Received SIGTERM, shutting down gracefully');
  server.stop();
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('Received SIGINT, shutting down gracefully');
  server.stop();
  process.exit(0);
});
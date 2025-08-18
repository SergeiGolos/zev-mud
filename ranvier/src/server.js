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
      stats: player.stats,
      roomId: player.roomId,
      inventory: Array.from(player.inventory || []).map(item => ({
        id: item.id,
        name: item.name,
        description: item.description,
        type: item.type,
        metadata: item.metadata
      })),
      equipment: player.equipment,
      combatState: player.combatState,
      isNewCharacter: player.isNewCharacter,
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
    this.attributes = data.attributes || { 
      health: 100, 
      maxHealth: 100, 
      mana: 50, 
      maxMana: 50, 
      stamina: 100, 
      maxStamina: 100 
    };
    this.stats = data.stats || {
      level: 1,
      experience: 0,
      strength: 10,
      intelligence: 10,
      dexterity: 10,
      constitution: 10
    };
    this.roomId = data.roomId;
    this.inventory = new Set();
    this.equipment = data.equipment || {
      weapon: null,
      armor: null,
      accessories: []
    };
    this.combatState = data.combatState || {
      inCombat: false,
      target: null,
      initiative: 0,
      lastAction: null
    };
    this.isNewCharacter = data.isNewCharacter || false;
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
    // Use max attributes from character data
    const maxName = `max${name.charAt(0).toUpperCase() + name.slice(1)}`;
    return this.attributes[maxName] || this.attributes[name] || 0;
  }

  getStat(name) {
    return this.stats[name] || 0;
  }

  setStat(name, value) {
    this.stats[name] = value;
  }

  isAlive() {
    return this.getAttribute('health') > 0;
  }

  heal(amount) {
    const currentHealth = this.getAttribute('health');
    const maxHealth = this.getMaxAttribute('health');
    const newHealth = Math.min(currentHealth + amount, maxHealth);
    this.setAttributeBase('health', newHealth);
    return newHealth - currentHealth;
  }

  takeDamage(amount) {
    const currentHealth = this.getAttribute('health');
    const newHealth = Math.max(currentHealth - amount, 0);
    this.setAttributeBase('health', newHealth);
    return amount;
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
    // Validate character name
    const validation = this.validateCharacterName(name);
    if (!validation.valid) {
      socket.write(`${validation.error}\r\n`);
      socket.write('What is your character name? ');
      return null;
    }

    // Attempt to authenticate and load existing character
    let player = await this.authenticateAndLoadCharacter(name);

    if (!player) {
      // Character not found - check if name is available for new character
      const isUnique = await this.isCharacterNameUnique(name);
      if (!isUnique) {
        socket.write(`The name "${name}" is already taken by an online player. Please choose another name.\r\n`);
        socket.write('What is your character name? ');
        return null;
      }

      // Create new character with enhanced flow
      player = await this.createNewCharacter(socket, name);
      if (!player) {
        return null;
      }
    } else {
      // Returning player - check if already online
      if (this.gameState.players.has(name)) {
        socket.write(`Character "${name}" is already logged in. Please choose another character or try again later.\r\n`);
        socket.write('What is your character name? ');
        return null;
      }

      // Welcome back returning player
      socket.write(`Welcome back, ${name}!\r\n`);
      
      // Restore character to previous state and location
      player = await this.restoreCharacterState(player);
      
      // Update last login time
      player.lastLogin = new Date();
      await this.gameState.savePlayer(player);
    }

    // Set up character in game world
    const success = await this.setupCharacterInWorld(player, socket);
    if (!success) {
      socket.write('An error occurred while entering the game world. Please try again.\r\n');
      return null;
    }

    return player;
  }

  async authenticateAndLoadCharacter(name) {
    try {
      // Load character data from database
      const player = await this.gameState.loadPlayer(name);
      
      if (!player) {
        return null; // Character not found
      }

      // Validate character data integrity
      if (!this.validateCharacterData(player)) {
        console.error(`Character data validation failed for ${name}`);
        return null;
      }

      return player;
    } catch (error) {
      console.error(`Error loading character ${name}:`, error);
      return null;
    }
  }

  async restoreCharacterState(player) {
    try {
      // Ensure character has valid room location
      if (!player.roomId) {
        player.roomId = config.game.startingRoom;
      }

      // Validate that the room still exists
      const room = this.gameState.getRoom(player.roomId);
      if (!room) {
        console.warn(`Character ${player.name} was in non-existent room ${player.roomId}, moving to starting room`);
        player.roomId = config.game.startingRoom;
      }

      // Restore character attributes to valid ranges
      this.validateAndFixAttributes(player);

      // Restore combat state (ensure not in combat on login)
      player.combatState = {
        inCombat: false,
        target: null,
        initiative: 0,
        lastAction: null
      };

      // Mark as no longer a new character
      player.isNewCharacter = false;

      return player;
    } catch (error) {
      console.error(`Error restoring character state for ${player.name}:`, error);
      return player; // Return player anyway, but log the error
    }
  }

  validateCharacterData(player) {
    // Check required fields
    if (!player.name || !player.attributes || !player.stats) {
      return false;
    }

    // Check required attributes
    const requiredAttributes = ['health', 'maxHealth', 'mana', 'maxMana', 'stamina', 'maxStamina'];
    for (const attr of requiredAttributes) {
      if (typeof player.attributes[attr] !== 'number') {
        return false;
      }
    }

    // Check required stats
    const requiredStats = ['level', 'experience'];
    for (const stat of requiredStats) {
      if (typeof player.stats[stat] !== 'number') {
        return false;
      }
    }

    return true;
  }

  validateAndFixAttributes(player) {
    // Ensure health is not above max health
    if (player.attributes.health > player.attributes.maxHealth) {
      player.attributes.health = player.attributes.maxHealth;
    }

    // Ensure health is not below 0
    if (player.attributes.health < 0) {
      player.attributes.health = 1; // Give them at least 1 health
    }

    // Ensure mana is within bounds
    if (player.attributes.mana > player.attributes.maxMana) {
      player.attributes.mana = player.attributes.maxMana;
    }
    if (player.attributes.mana < 0) {
      player.attributes.mana = 0;
    }

    // Ensure stamina is within bounds
    if (player.attributes.stamina > player.attributes.maxStamina) {
      player.attributes.stamina = player.attributes.maxStamina;
    }
    if (player.attributes.stamina < 0) {
      player.attributes.stamina = 0;
    }
  }

  async setupCharacterInWorld(player, socket) {
    try {
      // Set starting room
      const room = this.gameState.getRoom(player.roomId || config.game.startingRoom);
      if (!room) {
        console.error(`Cannot find room ${player.roomId} for player ${player.name}`);
        return false;
      }

      player.room = room;
      room.addPlayer(player);

      // Set up socket connection
      player.socket = socket;
      
      // Add to online players
      this.gameState.players.set(player.name, player);

      return true;
    } catch (error) {
      console.error(`Error setting up character ${player.name} in world:`, error);
      return false;
    }
  }

  validateCharacterName(name) {
    if (!name || typeof name !== 'string') {
      return { valid: false, error: 'Name cannot be empty.' };
    }

    const trimmedName = name.trim();
    
    if (trimmedName.length === 0) {
      return { valid: false, error: 'Name cannot be empty.' };
    }
    
    if (trimmedName.length < 2) {
      return { valid: false, error: 'Name must be at least 2 characters long.' };
    }

    if (trimmedName.length > 20) {
      return { valid: false, error: 'Name must be no more than 20 characters long.' };
    }

    // Check for valid characters (letters, numbers, basic punctuation)
    const validNameRegex = /^[a-zA-Z][a-zA-Z0-9_-]*$/;
    if (!validNameRegex.test(trimmedName)) {
      return { valid: false, error: 'Name must start with a letter and contain only letters, numbers, underscores, and hyphens.' };
    }

    // Check for reserved names
    const reservedNames = ['admin', 'god', 'system', 'server', 'null', 'undefined'];
    if (reservedNames.includes(trimmedName.toLowerCase())) {
      return { valid: false, error: 'That name is reserved. Please choose another name.' };
    }

    return { valid: true, name: trimmedName };
  }

  async isCharacterNameUnique(name) {
    try {
      // Only check if character is currently online
      // Database characters can log back in
      if (this.gameState.players.has(name)) {
        return false;
      }

      return true;
    } catch (error) {
      console.error('Error checking character name uniqueness:', error);
      return false;
    }
  }

  async createNewCharacter(socket, name) {
    try {
      socket.write(`\r\nCreating new character: ${name}\r\n`);
      socket.write('Welcome to zev-mud! You are about to embark on an adventure.\r\n');
      
      // Create character data structure with initial stats
      const characterData = {
        name: name,
        attributes: {
          health: 100,
          maxHealth: 100,
          mana: 50,
          maxMana: 50,
          stamina: 100,
          maxStamina: 100
        },
        stats: {
          level: 1,
          experience: 0,
          strength: 10,
          intelligence: 10,
          dexterity: 10,
          constitution: 10
        },
        roomId: config.game.startingRoom,
        inventory: [],
        equipment: {
          weapon: null,
          armor: null,
          accessories: []
        },
        combatState: {
          inCombat: false,
          target: null,
          initiative: 0,
          lastAction: null
        },
        isNewCharacter: true,
        createdAt: new Date(),
        lastLogin: new Date()
      };

      // Create player instance
      const player = new Player(characterData);
      
      // Save new character to database
      await this.gameState.savePlayer(player);
      
      socket.write(`Character ${name} has been created successfully!\r\n`);
      socket.write('Your adventure begins now...\r\n\r\n');
      
      return player;
    } catch (error) {
      console.error('Error creating new character:', error);
      socket.write('An error occurred while creating your character. Please try again.\r\n');
      socket.write('What is your character name? ');
      return null;
    }
  }

  enterGame(player, socket) {
    // Show room description
    this.showRoom(player);
    socket.write('> ');
  }

  showRoom(player) {
    const room = player.room;
    if (!room) {
      player.socket.write('You are not in a valid location.\r\n');
      return;
    }

    player.socket.write(`\r\n${room.title}\r\n`);
    player.socket.write(`${room.description}\r\n`);
    
    // Show exits with enhanced formatting
    if (room.exits && room.exits.length > 0) {
      const exitNames = room.exits.map(exit => exit.direction).join(', ');
      player.socket.write(`\r\nExits: ${exitNames}\r\n`);
    } else {
      player.socket.write(`\r\nExits: none\r\n`);
    }
    
    // Show items with enhanced listing
    if (room.items && room.items.size > 0) {
      player.socket.write('\r\nItems here:\r\n');
      for (const item of room.items) {
        player.socket.write(`  ${item.name}\r\n`);
      }
    }
    
    // Show NPCs with enhanced information
    if (room.npcs && room.npcs.size > 0) {
      player.socket.write('\r\nCreatures here:\r\n');
      for (const npc of room.npcs) {
        const hostileIndicator = npc.hostile ? ' (hostile)' : ' (peaceful)';
        const levelInfo = npc.level ? ` [Level ${npc.level}]` : '';
        player.socket.write(`  ${npc.name}${hostileIndicator}${levelInfo}\r\n`);
      }
    }
    
    // Show other players with enhanced information
    if (room.players && room.players.size > 1) {
      player.socket.write('\r\nOther adventurers here:\r\n');
      for (const otherPlayer of room.players) {
        if (otherPlayer !== player) {
          const levelInfo = otherPlayer.stats && otherPlayer.stats.level ? ` [Level ${otherPlayer.stats.level}]` : '';
          player.socket.write(`  ${otherPlayer.name}${levelInfo}\r\n`);
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
        if (args.length > 1) {
          this.lookAtTarget(player, args.slice(1).join(' '));
        } else {
          this.showRoom(player);
        }
        break;
        
      case 'examine':
      case 'exam':
      case 'ex':
        if (args.length > 1) {
          this.examineTarget(player, args.slice(1).join(' '));
        } else {
          player.socket.write('Examine what?\r\n');
        }
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
    if (!room) {
      player.socket.write('You are not in a valid location.\r\n');
      return;
    }

    // Validate exit exists
    const exit = room.exits.find(e => e.direction === direction);
    if (!exit) {
      player.socket.write(`You cannot go ${direction}.\r\n`);
      return;
    }

    // Validate destination room exists
    const newRoom = this.gameState.getRoom(exit.roomId);
    if (!newRoom) {
      player.socket.write(`The path ${direction} is blocked.\r\n`);
      console.error(`Invalid room reference: ${exit.roomId} from room ${room.id}`);
      return;
    }

    // Announce departure to current room
    for (const otherPlayer of room.players) {
      if (otherPlayer !== player) {
        otherPlayer.socket.write(`${player.name} leaves ${direction}.\r\n`);
      }
    }

    // Remove from current room
    room.removePlayer(player);
    
    // Add to new room
    newRoom.addPlayer(player);
    player.room = newRoom;
    player.roomId = `basic-area:${newRoom.id}`;

    // Announce arrival to new room
    for (const otherPlayer of newRoom.players) {
      if (otherPlayer !== player) {
        const oppositeDirection = this.getOppositeDirection(direction);
        if (oppositeDirection) {
          otherPlayer.socket.write(`${player.name} arrives from the ${oppositeDirection}.\r\n`);
        } else {
          otherPlayer.socket.write(`${player.name} arrives.\r\n`);
        }
      }
    }

    // Update player location in database
    this.gameState.savePlayer(player).catch(err => {
      console.error('Error saving player location:', err);
    });

    // Show new room
    this.showRoom(player);
  }

  getOppositeDirection(direction) {
    const opposites = {
      'north': 'south',
      'south': 'north',
      'east': 'west',
      'west': 'east',
      'up': 'down',
      'down': 'up',
      'northeast': 'southwest',
      'northwest': 'southeast',
      'southeast': 'northwest',
      'southwest': 'northeast'
    };
    return opposites[direction];
  }

  lookAtTarget(player, target) {
    const room = player.room;
    if (!room) {
      player.socket.write('You are not in a valid location.\r\n');
      return;
    }

    const targetLower = target.toLowerCase();

    // Look at room (same as 'look' with no arguments)
    if (targetLower === 'room' || targetLower === 'here') {
      this.showRoom(player);
      return;
    }

    // Look at items in room
    if (room.items && room.items.size > 0) {
      const item = Array.from(room.items).find(i => 
        i.name.toLowerCase().includes(targetLower) ||
        i.id.toLowerCase().includes(targetLower)
      );
      if (item) {
        player.socket.write(`${item.name}\r\n${item.description}\r\n`);
        return;
      }
    }

    // Look at NPCs in room
    if (room.npcs && room.npcs.size > 0) {
      const npc = Array.from(room.npcs).find(n => 
        n.name.toLowerCase().includes(targetLower) ||
        n.id.toLowerCase().includes(targetLower)
      );
      if (npc) {
        player.socket.write(`${npc.name}\r\n${npc.description}\r\n`);
        return;
      }
    }

    // Look at other players in room
    if (room.players && room.players.size > 1) {
      const otherPlayer = Array.from(room.players).find(p => 
        p !== player && p.name.toLowerCase().includes(targetLower)
      );
      if (otherPlayer) {
        player.socket.write(`${otherPlayer.name} is a fellow adventurer.\r\n`);
        return;
      }
    }

    // Look at items in inventory
    if (player.inventory && player.inventory.size > 0) {
      const item = Array.from(player.inventory).find(i => 
        i.name.toLowerCase().includes(targetLower) ||
        i.id.toLowerCase().includes(targetLower)
      );
      if (item) {
        player.socket.write(`${item.name}\r\n${item.description}\r\n`);
        return;
      }
    }

    player.socket.write(`You don't see '${target}' here.\r\n`);
  }

  examineTarget(player, target) {
    const room = player.room;
    if (!room) {
      player.socket.write('You are not in a valid location.\r\n');
      return;
    }

    const targetLower = target.toLowerCase();

    // Examine items in room
    if (room.items && room.items.size > 0) {
      const item = Array.from(room.items).find(i => 
        i.name.toLowerCase().includes(targetLower) ||
        i.id.toLowerCase().includes(targetLower)
      );
      if (item) {
        this.showDetailedItemInfo(player, item);
        return;
      }
    }

    // Examine NPCs in room
    if (room.npcs && room.npcs.size > 0) {
      const npc = Array.from(room.npcs).find(n => 
        n.name.toLowerCase().includes(targetLower) ||
        n.id.toLowerCase().includes(targetLower)
      );
      if (npc) {
        this.showDetailedNPCInfo(player, npc);
        return;
      }
    }

    // Examine other players in room
    if (room.players && room.players.size > 1) {
      const otherPlayer = Array.from(room.players).find(p => 
        p !== player && p.name.toLowerCase().includes(targetLower)
      );
      if (otherPlayer) {
        this.showDetailedPlayerInfo(player, otherPlayer);
        return;
      }
    }

    // Examine items in inventory
    if (player.inventory && player.inventory.size > 0) {
      const item = Array.from(player.inventory).find(i => 
        i.name.toLowerCase().includes(targetLower) ||
        i.id.toLowerCase().includes(targetLower)
      );
      if (item) {
        this.showDetailedItemInfo(player, item);
        return;
      }
    }

    // Examine room features
    if (targetLower === 'room' || targetLower === 'here') {
      this.showDetailedRoomInfo(player);
      return;
    }

    player.socket.write(`You don't see '${target}' here to examine.\r\n`);
  }

  showDetailedItemInfo(player, item) {
    player.socket.write(`${item.name}\r\n`);
    player.socket.write(`${item.description}\r\n`);
    
    if (item.metadata) {
      const details = [];
      
      if (item.type) {
        details.push(`Type: ${item.type}`);
      }
      
      if (item.metadata.weight) {
        details.push(`Weight: ${item.metadata.weight} lbs`);
      }
      
      if (item.metadata.value) {
        details.push(`Value: ${item.metadata.value} gold`);
      }
      
      if (item.metadata.damage) {
        details.push(`Damage: ${item.metadata.damage}`);
      }
      
      if (item.metadata.defense) {
        details.push(`Defense: ${item.metadata.defense}`);
      }
      
      if (item.metadata.healing) {
        details.push(`Healing: ${item.metadata.healing} HP`);
      }
      
      if (item.metadata.durability) {
        details.push(`Durability: ${item.metadata.durability}%`);
      }
      
      if (details.length > 0) {
        player.socket.write(`\r\n${details.join(', ')}\r\n`);
      }
    }
  }

  showDetailedNPCInfo(player, npc) {
    player.socket.write(`${npc.name}\r\n`);
    player.socket.write(`${npc.description}\r\n`);
    
    if (npc.level) {
      player.socket.write(`\r\nLevel: ${npc.level}\r\n`);
    }
    
    if (npc.hostile) {
      player.socket.write(`This creature appears hostile!\r\n`);
    } else {
      player.socket.write(`This creature seems peaceful.\r\n`);
    }
    
    // Show health status
    if (npc.attributes && npc.attributes.health) {
      const healthPercent = (npc.attributes.health / (npc.attributes.maxHealth || npc.attributes.health)) * 100;
      let healthStatus = 'excellent condition';
      
      if (healthPercent < 25) {
        healthStatus = 'near death';
      } else if (healthPercent < 50) {
        healthStatus = 'badly wounded';
      } else if (healthPercent < 75) {
        healthStatus = 'wounded';
      } else if (healthPercent < 100) {
        healthStatus = 'slightly injured';
      }
      
      player.socket.write(`The creature is in ${healthStatus}.\r\n`);
    }
  }

  showDetailedPlayerInfo(player, otherPlayer) {
    player.socket.write(`${otherPlayer.name}\r\n`);
    player.socket.write(`${otherPlayer.name} is a fellow adventurer exploring the dungeon.\r\n`);
    
    if (otherPlayer.stats && otherPlayer.stats.level) {
      player.socket.write(`\r\nLevel: ${otherPlayer.stats.level}\r\n`);
    }
    
    // Show basic health status
    if (otherPlayer.attributes && otherPlayer.attributes.health) {
      const healthPercent = (otherPlayer.attributes.health / otherPlayer.attributes.maxHealth) * 100;
      let healthStatus = 'excellent condition';
      
      if (healthPercent < 25) {
        healthStatus = 'near death';
      } else if (healthPercent < 50) {
        healthStatus = 'badly wounded';
      } else if (healthPercent < 75) {
        healthStatus = 'wounded';
      } else if (healthPercent < 100) {
        healthStatus = 'slightly injured';
      }
      
      player.socket.write(`${otherPlayer.name} appears to be in ${healthStatus}.\r\n`);
    }
  }

  showDetailedRoomInfo(player) {
    const room = player.room;
    if (!room) return;

    player.socket.write(`${room.title}\r\n`);
    player.socket.write(`${room.description}\r\n`);
    
    // Show detailed exit information
    if (room.exits && room.exits.length > 0) {
      player.socket.write(`\r\nExits:\r\n`);
      room.exits.forEach(exit => {
        const targetRoom = this.gameState.getRoom(exit.roomId);
        if (targetRoom) {
          player.socket.write(`  ${exit.direction}: ${targetRoom.title}\r\n`);
        } else {
          player.socket.write(`  ${exit.direction}: Unknown destination\r\n`);
        }
      });
    } else {
      player.socket.write(`\r\nThere are no obvious exits.\r\n`);
    }
    
    // Show room contents in detail
    this.showRoomContents(player);
  }

  showRoomContents(player) {
    const room = player.room;
    if (!room) return;

    // Show items with more detail
    if (room.items && room.items.size > 0) {
      player.socket.write(`\r\nItems here:\r\n`);
      for (const item of room.items) {
        player.socket.write(`  ${item.name} - ${item.description}\r\n`);
      }
    }
    
    // Show NPCs with more detail
    if (room.npcs && room.npcs.size > 0) {
      player.socket.write(`\r\nCreatures here:\r\n`);
      for (const npc of room.npcs) {
        const hostileIndicator = npc.hostile ? ' (hostile)' : ' (peaceful)';
        player.socket.write(`  ${npc.name}${hostileIndicator}\r\n`);
      }
    }
    
    // Show other players
    if (room.players && room.players.size > 1) {
      player.socket.write(`\r\nOther adventurers here:\r\n`);
      for (const otherPlayer of room.players) {
        if (otherPlayer !== player) {
          player.socket.write(`  ${otherPlayer.name} (Level ${otherPlayer.stats.level || 1})\r\n`);
        }
      }
    }
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
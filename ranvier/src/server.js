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

  // Safe socket write utility to prevent EPIPE errors
  safeWrite(socket, data) {
    if (!socket || socket.destroyed || !socket.writable || socket.readyState !== 'open') {
      return false;
    }
    
    try {
      return socket.write(data);
    } catch (error) {
      if (error.code === 'EPIPE' || error.code === 'ECONNRESET') {
        console.log('Socket connection lost during write operation');
      } else {
        console.error('Socket write error:', error);
      }
      return false;
    }
  }

  start() {
    this.server = net.createServer((socket) => {
      console.log('New telnet connection');
      
      // Handle new player connection directly with the socket
      this.handleConnection(socket);
    });

    this.server.listen(this.port, () => {
      console.log(`Ranvier MUD server listening on port ${this.port}`);
    });

    this.server.on('error', (err) => {
      console.error('Server error:', err);
    });
  }

  handleConnection(socket) {
    // Set up error handling first to prevent uncaught exceptions
    socket.on('error', (err) => {
      if (err.code === 'EPIPE' || err.code === 'ECONNRESET') {
        console.log('Socket connection lost');
      } else {
        console.error('Socket error:', err);
      }
    });

    // Send welcome message using safe write
    if (!this.safeWrite(socket, 'Welcome to zev-mud!\r\n')) {
      console.log('Failed to send welcome message - socket closed');
      return;
    }
    
    if (!this.safeWrite(socket, 'What is your character name? ')) {
      console.log('Failed to send name prompt - socket closed');
      return;
    }
    
    let awaitingName = true;
    let player = null;

    socket.on('data', (data) => {
      try {
        const input = data.toString().trim();
        
        if (awaitingName) {
          this.handleCharacterLogin(socket, input).then(p => {
            player = p;
            awaitingName = false;
            if (player) {
              this.enterGame(player, socket);
            }
          }).catch(error => {
            console.error('Error during character login:', error);
            this.safeWrite(socket, 'An error occurred during login. Please try again.\r\n');
          });
        } else if (player) {
          this.handleCommand(player, input);
        }
      } catch (error) {
        console.error('Error processing socket data:', error);
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
  }

  async handleCharacterLogin(socket, name) {
    // Validate character name
    const validation = this.validateCharacterName(name);
    if (!validation.valid) {
      if (!this.safeWrite(socket, `${validation.error}\r\n`)) return null;
      if (!this.safeWrite(socket, 'What is your character name? ')) return null;
      return null;
    }

    // Attempt to authenticate and load existing character
    let player = await this.authenticateAndLoadCharacter(name);

    if (!player) {
      // Character not found - check if name is available for new character
      const isUnique = await this.isCharacterNameUnique(name);
      if (!isUnique) {
        if (!this.safeWrite(socket, `The name "${name}" is already taken by an online player. Please choose another name.\r\n`)) return null;
        if (!this.safeWrite(socket, 'What is your character name? ')) return null;
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
        if (!this.safeWrite(socket, `Character "${name}" is already logged in. Please choose another character or try again later.\r\n`)) return null;
        if (!this.safeWrite(socket, 'What is your character name? ')) return null;
        return null;
      }

      // Welcome back returning player
      if (!this.safeWrite(socket, `Welcome back, ${name}!\r\n`)) return null;
      
      // Restore character to previous state and location
      player = await this.restoreCharacterState(player);
      
      // Update last login time
      player.lastLogin = new Date();
      await this.gameState.savePlayer(player);
    }

    // Set up character in game world
    const success = await this.setupCharacterInWorld(player, socket);
    if (!success) {
      this.safeWrite(socket, 'An error occurred while entering the game world. Please try again.\r\n');
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
      if (!this.safeWrite(socket, `\r\nCreating new character: ${name}\r\n`)) return null;
      if (!this.safeWrite(socket, 'Welcome to zev-mud! You are about to embark on an adventure.\r\n')) return null;
      
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
      
      if (!this.safeWrite(socket, `Character ${name} has been created successfully!\r\n`)) return null;
      if (!this.safeWrite(socket, 'Your adventure begins now...\r\n\r\n')) return null;
      
      return player;
    } catch (error) {
      console.error('Error creating new character:', error);
      this.safeWrite(socket, 'An error occurred while creating your character. Please try again.\r\n');
      this.safeWrite(socket, 'What is your character name? ');
      return null;
    }
  }

  enterGame(player, socket) {
    // Show room description
    this.showRoom(player);
    this.safeWrite(socket, '> ');
  }

  showRoom(player) {
    const room = player.room;
    if (!room) {
      this.safeWrite(player.socket, 'You are not in a valid location.\r\n');
      return;
    }

    if (!this.safeWrite(player.socket, `\r\n${room.title}\r\n`)) return;
    if (!this.safeWrite(player.socket, `${room.description}\r\n`)) return;
    
    // Show exits with enhanced formatting
    if (room.exits && room.exits.length > 0) {
      const exitNames = room.exits.map(exit => exit.direction).join(', ');
      if (!this.safeWrite(player.socket, `\r\nExits: ${exitNames}\r\n`)) return;
    } else {
      if (!this.safeWrite(player.socket, `\r\nExits: none\r\n`)) return;
    }
    
    // Show items with enhanced listing
    if (room.items && room.items.size > 0) {
      if (!this.safeWrite(player.socket, '\r\nItems here:\r\n')) return;
      for (const item of room.items) {
        if (!this.safeWrite(player.socket, `  ${item.name}\r\n`)) return;
      }
    }
    
    // Show NPCs with enhanced information
    if (room.npcs && room.npcs.size > 0) {
      if (!this.safeWrite(player.socket, '\r\nCreatures here:\r\n')) return;
      for (const npc of room.npcs) {
        const hostileIndicator = npc.hostile ? ' (hostile)' : ' (peaceful)';
        const levelInfo = npc.level ? ` [Level ${npc.level}]` : '';
        if (!this.safeWrite(player.socket, `  ${npc.name}${hostileIndicator}${levelInfo}\r\n`)) return;
      }
    }
    
    // Show other players with enhanced information
    if (room.players && room.players.size > 1) {
      if (!this.safeWrite(player.socket, '\r\nOther adventurers here:\r\n')) return;
      for (const otherPlayer of room.players) {
        if (otherPlayer !== player) {
          const levelInfo = otherPlayer.stats && otherPlayer.stats.level ? ` [Level ${otherPlayer.stats.level}]` : '';
          if (!this.safeWrite(player.socket, `  ${otherPlayer.name}${levelInfo}\r\n`)) return;
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
          this.safeWrite(player.socket, 'Examine what?\r\n');
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
          this.safeWrite(player.socket, 'Take what?\r\n');
        }
        break;
        
      case 'drop':
        if (args.length > 1) {
          this.dropItem(player, args.slice(1).join(' '));
        } else {
          this.safeWrite(player.socket, 'Drop what?\r\n');
        }
        break;
        
      case 'use':
      case 'consume':
        if (args.length > 1) {
          this.useItem(player, args.slice(1).join(' '));
        } else {
          this.safeWrite(player.socket, 'Use what?\r\n');
        }
        break;
        
      case 'equip':
      case 'wield':
      case 'wear':
        if (args.length > 1) {
          this.equipItem(player, args.slice(1).join(' '));
        } else {
          this.safeWrite(player.socket, 'Equip what?\r\n');
        }
        break;
        
      case 'unequip':
      case 'remove':
        if (args.length > 1) {
          this.unequipItem(player, args.slice(1).join(' '));
        } else {
          this.safeWrite(player.socket, 'Unequip what?\r\n');
        }
        break;
        
      case 'say':
        if (args.length > 1) {
          this.sayToRoom(player, args.slice(1).join(' '));
        } else {
          this.safeWrite(player.socket, 'Say what?\r\n');
        }
        break;
        
      case 'quit':
        this.safeWrite(player.socket, 'Goodbye!\r\n');
        player.socket.end();
        return;
        
      default:
        this.safeWrite(player.socket, `Unknown command: ${command}\r\n`);
    }
    
    this.safeWrite(player.socket, '> ');
  }

  movePlayer(player, direction) {
    const room = player.room;
    if (!room) {
      this.safeWrite(player.socket, 'You are not in a valid location.\r\n');
      return;
    }

    // Validate exit exists
    const exit = room.exits.find(e => e.direction === direction);
    if (!exit) {
      this.safeWrite(player.socket, `You cannot go ${direction}.\r\n`);
      return;
    }

    // Validate destination room exists
    const newRoom = this.gameState.getRoom(exit.roomId);
    if (!newRoom) {
      this.safeWrite(player.socket, `The path ${direction} is blocked.\r\n`);
      console.error(`Invalid room reference: ${exit.roomId} from room ${room.id}`);
      return;
    }

    // Announce departure to current room
    for (const otherPlayer of room.players) {
      if (otherPlayer !== player) {
        this.safeWrite(otherPlayer.socket, `${player.name} leaves ${direction}.\r\n`);
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
          this.safeWrite(otherPlayer.socket, `${player.name} arrives from the ${oppositeDirection}.\r\n`);
        } else {
          this.safeWrite(otherPlayer.socket, `${player.name} arrives.\r\n`);
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
      this.safeWrite(player.socket, 'You are not carrying anything.\r\n');
      return;
    }

    this.safeWrite(player.socket, 'You are carrying:\r\n');
    
    // Group items by type for better organization
    const itemsByType = this.groupItemsByType(player.inventory);
    
    // Calculate total weight and capacity
    const totalWeight = this.calculateInventoryWeight(player);
    const weightLimit = 100;
    const itemCount = player.inventory.size;
    const itemLimit = 20;
    
    // Display items by category
    Object.keys(itemsByType).forEach(type => {
      if (itemsByType[type].length > 0) {
        this.safeWrite(player.socket, `\r\n${type}:\r\n`);
        itemsByType[type].forEach(item => {
          const weight = item.metadata && item.metadata.weight ? ` (${item.metadata.weight} lbs)` : '';
          const value = item.metadata && item.metadata.value ? ` [${item.metadata.value} gold]` : '';
          this.safeWrite(player.socket, `  ${item.name}${weight}${value}\r\n`);
        });
      }
    });
    
    // Show capacity information
    this.safeWrite(player.socket, `\r\nCapacity: ${itemCount}/${itemLimit} items, ${totalWeight}/${weightLimit} lbs\r\n`);
    
    // Show equipped items
    this.showEquippedItems(player);
  }

  groupItemsByType(inventory) {
    const groups = {
      'Weapons': [],
      'Armor': [],
      'Consumables': [],
      'Books & Scrolls': [],
      'Valuables': [],
      'Miscellaneous': []
    };
    
    for (const item of inventory) {
      switch (item.type) {
        case 'WEAPON':
          groups['Weapons'].push(item);
          break;
        case 'ARMOR':
          groups['Armor'].push(item);
          break;
        case 'POTION':
        case 'FOOD':
          groups['Consumables'].push(item);
          break;
        case 'BOOK':
        case 'SCROLL':
          groups['Books & Scrolls'].push(item);
          break;
        case 'CURRENCY':
        case 'GEM':
          groups['Valuables'].push(item);
          break;
        default:
          groups['Miscellaneous'].push(item);
      }
    }
    
    return groups;
  }

  showEquippedItems(player) {
    if (!player.equipment) {
      return;
    }
    
    const equipped = [];
    if (player.equipment.weapon) {
      equipped.push(`Weapon: ${player.equipment.weapon.name}`);
    }
    if (player.equipment.armor) {
      equipped.push(`Armor: ${player.equipment.armor.name}`);
    }
    if (player.equipment.accessories && player.equipment.accessories.length > 0) {
      player.equipment.accessories.forEach(accessory => {
        equipped.push(`Accessory: ${accessory.name}`);
      });
    }
    
    if (equipped.length > 0) {
      this.safeWrite(player.socket, '\r\nCurrently equipped:\r\n');
      equipped.forEach(item => {
        this.safeWrite(player.socket, `  ${item}\r\n`);
      });
    }
  }

  takeItem(player, itemName) {
    const room = player.room;
    if (!room) {
      this.safeWrite(player.socket, 'You are not in a valid location.\r\n');
      return;
    }

    // Find the item in the room
    const item = this.findItemInRoom(room, itemName.toLowerCase());
    if (!item) {
      this.safeWrite(player.socket, `You don't see '${itemName}' here.\r\n`);
      return;
    }

    // Check inventory capacity (default limit of 20 items)
    const inventoryLimit = 20;
    if (player.inventory && player.inventory.size >= inventoryLimit) {
      this.safeWrite(player.socket, 'Your inventory is full. You cannot carry any more items.\r\n');
      return;
    }

    // Check if item can be taken (some items might be fixed)
    if (item.metadata && item.metadata.fixed) {
      this.safeWrite(player.socket, `You cannot take ${item.name}.\r\n`);
      return;
    }

    // Check weight limit (optional - default 100 lbs capacity)
    const weightLimit = 100;
    const currentWeight = this.calculateInventoryWeight(player);
    const itemWeight = item.metadata ? (item.metadata.weight || 0) : 0;
    
    if (currentWeight + itemWeight > weightLimit) {
      this.safeWrite(player.socket, `${item.name} is too heavy. You cannot carry any more weight.\r\n`);
      return;
    }

    // Take the item
    room.removeItem(item);
    
    // Initialize inventory if it doesn't exist
    if (!player.inventory) {
      player.inventory = new Set();
    }
    
    player.inventory.add(item);

    // Broadcast messages
    this.safeWrite(player.socket, `You take ${item.name}.\r\n`);
    
    // Tell others in the room
    for (const otherPlayer of room.players) {
      if (otherPlayer !== player) {
        this.safeWrite(otherPlayer.socket, `${player.name} takes ${item.name}.\r\n`);
      }
    }

    // Save player state
    this.gameState.savePlayer(player).catch(err => {
      console.error('Error saving player after taking item:', err);
    });
  }

  dropItem(player, itemName) {
    const room = player.room;
    
    if (!room) {
      this.safeWrite(player.socket, 'You are not in a valid location.\r\n');
      return;
    }

    // Check if player has inventory
    if (!player.inventory || player.inventory.size === 0) {
      this.safeWrite(player.socket, 'You are not carrying anything.\r\n');
      return;
    }

    // Find the item in inventory
    const item = this.findItemInInventory(player, itemName.toLowerCase());
    if (!item) {
      this.safeWrite(player.socket, `You don't have '${itemName}' in your inventory.\r\n`);
      return;
    }

    // Check if item can be dropped (some items might be cursed or bound)
    if (item.metadata && item.metadata.nodrop) {
      this.safeWrite(player.socket, `You cannot drop ${item.name}.\r\n`);
      return;
    }

    // Drop the item
    player.inventory.delete(item);
    room.addItem(item);

    // Broadcast messages
    this.safeWrite(player.socket, `You drop ${item.name}.\r\n`);
    
    // Tell others in the room
    for (const otherPlayer of room.players) {
      if (otherPlayer !== player) {
        this.safeWrite(otherPlayer.socket, `${player.name} drops ${item.name}.\r\n`);
      }
    }

    // Save player state
    this.gameState.savePlayer(player).catch(err => {
      console.error('Error saving player after dropping item:', err);
    });
  }

  findItemInRoom(room, target) {
    if (!room.items || room.items.size === 0) {
      return null;
    }

    // Try exact match first
    let item = Array.from(room.items).find(i => 
      i.name.toLowerCase() === target ||
      i.id.toLowerCase() === target
    );

    if (item) {
      return item;
    }

    // Try partial match
    item = Array.from(room.items).find(i => 
      i.name.toLowerCase().includes(target) ||
      i.id.toLowerCase().includes(target)
    );

    return item;
  }

  findItemInInventory(player, target) {
    if (!player.inventory || player.inventory.size === 0) {
      return null;
    }

    // Try exact match first
    let item = Array.from(player.inventory).find(i => 
      i.name.toLowerCase() === target ||
      i.id.toLowerCase() === target
    );

    if (item) {
      return item;
    }

    // Try partial match
    item = Array.from(player.inventory).find(i => 
      i.name.toLowerCase().includes(target) ||
      i.id.toLowerCase().includes(target)
    );

    return item;
  }

  calculateInventoryWeight(player) {
    if (!player.inventory || player.inventory.size === 0) {
      return 0;
    }

    let totalWeight = 0;
    for (const item of player.inventory) {
      if (item.metadata && item.metadata.weight) {
        totalWeight += item.metadata.weight;
      }
    }

    return totalWeight;
  }

  useItem(player, itemName) {
    if (!player.inventory || player.inventory.size === 0) {
      this.safeWrite(player.socket, 'You are not carrying anything to use.\r\n');
      return;
    }

    // Find the item in inventory
    const item = this.findItemInInventory(player, itemName.toLowerCase());
    if (!item) {
      this.safeWrite(player.socket, `You don't have '${itemName}' in your inventory.\r\n`);
      return;
    }

    // Check if item is usable
    if (!this.isItemUsable(item)) {
      this.safeWrite(player.socket, `You cannot use ${item.name}.\r\n`);
      return;
    }

    // Use the item based on its type
    const result = this.applyItemEffect(player, item);
    if (result.success) {
      this.safeWrite(player.socket, result.message);
      
      // Tell others in the room
      for (const otherPlayer of player.room.players) {
        if (otherPlayer !== player) {
          this.safeWrite(otherPlayer.socket, `${player.name} uses ${item.name}.\r\n`);
        }
      }

      // Remove consumable items after use
      if (this.isConsumable(item)) {
        player.inventory.delete(item);
        this.safeWrite(player.socket, `${item.name} is consumed.\r\n`);
      }

      // Save player state
      this.gameState.savePlayer(player).catch(err => {
        console.error('Error saving player after using item:', err);
      });
    } else {
      this.safeWrite(player.socket, result.message);
    }
  }

  equipItem(player, itemName) {
    if (!player.inventory || player.inventory.size === 0) {
      this.safeWrite(player.socket, 'You are not carrying anything to equip.\r\n');
      return;
    }

    // Find the item in inventory
    const item = this.findItemInInventory(player, itemName.toLowerCase());
    if (!item) {
      this.safeWrite(player.socket, `You don't have '${itemName}' in your inventory.\r\n`);
      return;
    }

    // Check if item is equippable
    if (!this.isItemEquippable(item)) {
      this.safeWrite(player.socket, `You cannot equip ${item.name}.\r\n`);
      return;
    }

    // Determine equipment slot
    const slot = this.getEquipmentSlot(item);
    if (!slot) {
      this.safeWrite(player.socket, `${item.name} cannot be equipped.\r\n`);
      return;
    }

    // Initialize equipment if needed
    if (!player.equipment) {
      player.equipment = {
        weapon: null,
        armor: null,
        accessories: []
      };
    }

    // Handle different equipment slots
    if (slot === 'weapon') {
      // Unequip current weapon if any
      if (player.equipment.weapon) {
        player.inventory.add(player.equipment.weapon);
        this.safeWrite(player.socket, `You unequip ${player.equipment.weapon.name}.\r\n`);
      }
      
      player.equipment.weapon = item;
      player.inventory.delete(item);
      this.safeWrite(player.socket, `You equip ${item.name} as your weapon.\r\n`);
      
    } else if (slot === 'armor' || slot === 'chest' || slot === 'shield') {
      // Unequip current armor if any
      if (player.equipment.armor) {
        player.inventory.add(player.equipment.armor);
        this.safeWrite(player.socket, `You unequip ${player.equipment.armor.name}.\r\n`);
      }
      
      player.equipment.armor = item;
      player.inventory.delete(item);
      this.safeWrite(player.socket, `You equip ${item.name} as your armor.\r\n`);
      
    } else if (slot === 'accessory') {
      // Add to accessories (allow multiple)
      if (!player.equipment.accessories) {
        player.equipment.accessories = [];
      }
      
      player.equipment.accessories.push(item);
      player.inventory.delete(item);
      this.safeWrite(player.socket, `You equip ${item.name} as an accessory.\r\n`);
    }

    // Tell others in the room
    for (const otherPlayer of player.room.players) {
      if (otherPlayer !== player) {
        this.safeWrite(otherPlayer.socket, `${player.name} equips ${item.name}.\r\n`);
      }
    }

    // Save player state
    this.gameState.savePlayer(player).catch(err => {
      console.error('Error saving player after equipping item:', err);
    });
  }

  unequipItem(player, itemName) {
    if (!player.equipment) {
      this.safeWrite(player.socket, 'You have nothing equipped.\r\n');
      return;
    }

    const itemNameLower = itemName.toLowerCase();
    let foundItem = null;
    let slot = null;

    // Check weapon
    if (player.equipment.weapon && 
        (player.equipment.weapon.name.toLowerCase().includes(itemNameLower) ||
         player.equipment.weapon.id.toLowerCase().includes(itemNameLower))) {
      foundItem = player.equipment.weapon;
      slot = 'weapon';
    }
    
    // Check armor
    if (!foundItem && player.equipment.armor && 
        (player.equipment.armor.name.toLowerCase().includes(itemNameLower) ||
         player.equipment.armor.id.toLowerCase().includes(itemNameLower))) {
      foundItem = player.equipment.armor;
      slot = 'armor';
    }
    
    // Check accessories
    if (!foundItem && player.equipment.accessories) {
      const accessoryIndex = player.equipment.accessories.findIndex(acc => 
        acc.name.toLowerCase().includes(itemNameLower) ||
        acc.id.toLowerCase().includes(itemNameLower)
      );
      if (accessoryIndex !== -1) {
        foundItem = player.equipment.accessories[accessoryIndex];
        slot = 'accessory';
      }
    }

    if (!foundItem) {
      this.safeWrite(player.socket, `You don't have '${itemName}' equipped.\r\n`);
      return;
    }

    // Check inventory space
    const inventoryLimit = 20;
    if (player.inventory && player.inventory.size >= inventoryLimit) {
      this.safeWrite(player.socket, 'Your inventory is full. You cannot unequip items.\r\n');
      return;
    }

    // Unequip the item
    if (slot === 'weapon') {
      player.equipment.weapon = null;
    } else if (slot === 'armor') {
      player.equipment.armor = null;
    } else if (slot === 'accessory') {
      const accessoryIndex = player.equipment.accessories.findIndex(acc => acc === foundItem);
      player.equipment.accessories.splice(accessoryIndex, 1);
    }

    // Add to inventory
    if (!player.inventory) {
      player.inventory = new Set();
    }
    player.inventory.add(foundItem);

    this.safeWrite(player.socket, `You unequip ${foundItem.name}.\r\n`);

    // Tell others in the room
    for (const otherPlayer of player.room.players) {
      if (otherPlayer !== player) {
        this.safeWrite(otherPlayer.socket, `${player.name} unequips ${foundItem.name}.\r\n`);
      }
    }

    // Save player state
    this.gameState.savePlayer(player).catch(err => {
      console.error('Error saving player after unequipping item:', err);
    });
  }

  isItemUsable(item) {
    const usableTypes = ['POTION', 'FOOD', 'SCROLL'];
    return usableTypes.includes(item.type);
  }

  isConsumable(item) {
    const consumableTypes = ['POTION', 'FOOD'];
    return consumableTypes.includes(item.type);
  }

  isItemEquippable(item) {
    const equippableTypes = ['WEAPON', 'ARMOR'];
    return equippableTypes.includes(item.type);
  }

  getEquipmentSlot(item) {
    if (item.type === 'WEAPON') {
      return 'weapon';
    }
    if (item.type === 'ARMOR') {
      // Check metadata for specific slot
      if (item.metadata && item.metadata.slot) {
        return item.metadata.slot;
      }
      return 'armor';
    }
    return null;
  }

  applyItemEffect(player, item) {
    switch (item.type) {
      case 'POTION':
        return this.applyPotionEffect(player, item);
      case 'FOOD':
        return this.applyFoodEffect(player, item);
      case 'SCROLL':
        return this.applyScrollEffect(player, item);
      default:
        return { success: false, message: `You cannot use ${item.name}.` };
    }
  }

  applyPotionEffect(player, item) {
    if (item.metadata && item.metadata.healing) {
      const healAmount = item.metadata.healing;
      const actualHeal = player.heal(healAmount);
      
      if (actualHeal > 0) {
        return { 
          success: true, 
          message: `You drink ${item.name} and recover ${actualHeal} health.` 
        };
      } else {
        return { 
          success: false, 
          message: `You are already at full health.` 
        };
      }
    }
    
    return { 
      success: true, 
      message: `You drink ${item.name}. You feel a strange sensation.` 
    };
  }

  applyFoodEffect(player, item) {
    if (item.metadata && item.metadata.nutrition) {
      const nutritionAmount = item.metadata.nutrition;
      // For now, just restore some stamina
      const currentStamina = player.getAttribute('stamina');
      const maxStamina = player.getMaxAttribute('stamina');
      const newStamina = Math.min(currentStamina + nutritionAmount, maxStamina);
      player.setAttributeBase('stamina', newStamina);
      
      const staminaGain = newStamina - currentStamina;
      if (staminaGain > 0) {
        return { 
          success: true, 
          message: `You eat ${item.name} and recover ${staminaGain} stamina.` 
        };
      } else {
        return { 
          success: false, 
          message: `You are not hungry right now.` 
        };
      }
    }
    
    return { 
      success: true, 
      message: `You eat ${item.name}. It tastes good.` 
    };
  }

  applyScrollEffect(player, item) {
    // For now, scrolls just provide a message
    // In a full implementation, they would cast spells
    return { 
      success: true, 
      message: `You read ${item.name}. The words glow briefly and then fade.` 
    };
  }

  sayToRoom(player, message) {
    this.safeWrite(player.socket, `You say, "${message}"\r\n`);
    
    // Tell others in the room
    for (const otherPlayer of player.room.players) {
      if (otherPlayer !== player) {
        this.safeWrite(otherPlayer.socket, `${player.name} says, "${message}"\r\n`);
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
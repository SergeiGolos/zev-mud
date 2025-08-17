const path = require('path');
const NedbDataSource = require('../src/datasources/nedb');

// Mock the server components we need for testing
class MockGameState {
  constructor() {
    this.players = new Map();
    // Use in-memory database for testing (no path = in-memory)
    this.db = new NedbDataSource({});
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

    return new Player(playerData);
  }

  getRoom(roomId) {
    // Mock room for testing
    const id = roomId.includes(':') ? roomId.split(':')[1] : roomId;
    return {
      id: id,
      title: `Test Room ${id}`,
      description: 'A test room',
      exits: [],
      items: new Set(),
      npcs: new Set(),
      players: new Set(),
      addPlayer: function(player) { this.players.add(player); },
      removePlayer: function(player) { this.players.delete(player); }
    };
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
  }
}

class MockTelnetServer {
  constructor(gameState) {
    this.gameState = gameState;
    this.config = {
      game: {
        startingRoom: 'basic-area:room1'
      }
    };
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

    const validNameRegex = /^[a-zA-Z][a-zA-Z0-9_-]*$/;
    if (!validNameRegex.test(trimmedName)) {
      return { valid: false, error: 'Name must start with a letter and contain only letters, numbers, underscores, and hyphens.' };
    }

    const reservedNames = ['admin', 'god', 'system', 'server', 'null', 'undefined'];
    if (reservedNames.includes(trimmedName.toLowerCase())) {
      return { valid: false, error: 'That name is reserved. Please choose another name.' };
    }

    return { valid: true, name: trimmedName };
  }

  async isCharacterNameUnique(name) {
    try {
      // Only check if character is currently online
      if (this.gameState.players.has(name)) {
        return false;
      }

      return true;
    } catch (error) {
      console.error('Error checking character name uniqueness:', error);
      return false;
    }
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
        player.roomId = this.config.game.startingRoom;
      }

      // Validate that the room still exists
      const room = this.gameState.getRoom(player.roomId);
      if (!room) {
        console.warn(`Character ${player.name} was in non-existent room ${player.roomId}, moving to starting room`);
        player.roomId = this.config.game.startingRoom;
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
      const room = this.gameState.getRoom(player.roomId || this.config.game.startingRoom);
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

  async createNewCharacter(name) {
    try {
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
        roomId: this.config.game.startingRoom,
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

      const player = new Player(characterData);
      await this.gameState.savePlayer(player);
      
      return player;
    } catch (error) {
      console.error('Error creating new character:', error);
      return null;
    }
  }
}

describe('Character Authentication and Loading System', () => {
  let gameState;
  let server;
  let mockSocket;

  beforeEach(() => {
    gameState = new MockGameState();
    server = new MockTelnetServer(gameState);
    mockSocket = {
      write: jest.fn(),
      end: jest.fn()
    };
  });

  describe('Character Authentication', () => {
    test('should return null for non-existent character', async () => {
      const player = await server.authenticateAndLoadCharacter('NonExistentPlayer');
      expect(player).toBeNull();
    });

    test('should load existing character from database', async () => {
      // Create a character first
      const originalPlayer = await server.createNewCharacter('ExistingPlayer');
      expect(originalPlayer).toBeDefined();

      // Authenticate and load the character
      const loadedPlayer = await server.authenticateAndLoadCharacter('ExistingPlayer');
      
      expect(loadedPlayer).toBeDefined();
      expect(loadedPlayer.name).toBe('ExistingPlayer');
      expect(loadedPlayer.attributes.health).toBe(100);
      expect(loadedPlayer.stats.level).toBe(1);
    });

    test('should validate character data integrity', async () => {
      // Create a character with invalid data
      const invalidPlayerData = {
        name: 'InvalidPlayer',
        attributes: { health: 'invalid' }, // Invalid type
        stats: { level: 1 }
      };
      
      const invalidPlayer = new Player(invalidPlayerData);
      await gameState.savePlayer(invalidPlayer);

      // Try to authenticate - should fail validation
      const loadedPlayer = await server.authenticateAndLoadCharacter('InvalidPlayer');
      expect(loadedPlayer).toBeNull();
    });

    test('should handle database errors gracefully', async () => {
      // Mock database error
      const originalLoad = gameState.loadPlayer;
      gameState.loadPlayer = jest.fn().mockRejectedValue(new Error('Database error'));

      const player = await server.authenticateAndLoadCharacter('ErrorTest');
      expect(player).toBeNull();

      // Restore original method
      gameState.loadPlayer = originalLoad;
    });
  });

  describe('Character Data Validation', () => {
    test('should validate complete character data', () => {
      const validPlayer = new Player({
        name: 'ValidPlayer',
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
          experience: 0
        }
      });

      const isValid = server.validateCharacterData(validPlayer);
      expect(isValid).toBe(true);
    });

    test('should reject character data missing required fields', () => {
      const invalidPlayers = [
        new Player({ attributes: {}, stats: {} }), // Missing name
        new Player({ name: 'Test', stats: {} }), // Missing attributes
        new Player({ name: 'Test', attributes: {} }) // Missing stats
      ];

      invalidPlayers.forEach(player => {
        const isValid = server.validateCharacterData(player);
        expect(isValid).toBe(false);
      });
    });

    test('should reject character data with invalid attribute types', () => {
      const invalidPlayer = new Player({
        name: 'InvalidPlayer',
        attributes: {
          health: 'invalid',
          maxHealth: 100,
          mana: 50,
          maxMana: 50,
          stamina: 100,
          maxStamina: 100
        },
        stats: {
          level: 1,
          experience: 0
        }
      });

      const isValid = server.validateCharacterData(invalidPlayer);
      expect(isValid).toBe(false);
    });

    test('should reject character data with invalid stat types', () => {
      const invalidPlayer = new Player({
        name: 'InvalidPlayer',
        attributes: {
          health: 100,
          maxHealth: 100,
          mana: 50,
          maxMana: 50,
          stamina: 100,
          maxStamina: 100
        },
        stats: {
          level: 'invalid',
          experience: 0
        }
      });

      const isValid = server.validateCharacterData(invalidPlayer);
      expect(isValid).toBe(false);
    });
  });

  describe('Character State Restoration', () => {
    test('should restore character to valid state', async () => {
      const player = new Player({
        name: 'RestoreTest',
        attributes: {
          health: 80,
          maxHealth: 100,
          mana: 30,
          maxMana: 50,
          stamina: 90,
          maxStamina: 100
        },
        stats: { level: 2, experience: 100 },
        roomId: 'basic-area:room2',
        combatState: {
          inCombat: true,
          target: 'enemy',
          initiative: 5,
          lastAction: new Date()
        },
        isNewCharacter: true
      });

      const restoredPlayer = await server.restoreCharacterState(player);

      expect(restoredPlayer.combatState.inCombat).toBe(false);
      expect(restoredPlayer.combatState.target).toBeNull();
      expect(restoredPlayer.combatState.initiative).toBe(0);
      expect(restoredPlayer.combatState.lastAction).toBeNull();
      expect(restoredPlayer.isNewCharacter).toBe(false);
    });

    test('should set default room if character has no room', async () => {
      const player = new Player({
        name: 'NoRoomTest',
        attributes: { health: 100, maxHealth: 100, mana: 50, maxMana: 50, stamina: 100, maxStamina: 100 },
        stats: { level: 1, experience: 0 }
      });

      const restoredPlayer = await server.restoreCharacterState(player);
      expect(restoredPlayer.roomId).toBe('basic-area:room1');
    });

    test('should move character to starting room if current room does not exist', async () => {
      // Mock getRoom to return null for non-existent room
      const originalGetRoom = gameState.getRoom;
      gameState.getRoom = jest.fn((roomId) => {
        if (roomId === 'basic-area:nonexistent') {
          return null;
        }
        return originalGetRoom.call(gameState, roomId);
      });

      const player = new Player({
        name: 'InvalidRoomTest',
        attributes: { health: 100, maxHealth: 100, mana: 50, maxMana: 50, stamina: 100, maxStamina: 100 },
        stats: { level: 1, experience: 0 },
        roomId: 'basic-area:nonexistent'
      });

      const restoredPlayer = await server.restoreCharacterState(player);
      expect(restoredPlayer.roomId).toBe('basic-area:room1');

      // Restore original method
      gameState.getRoom = originalGetRoom;
    });
  });

  describe('Attribute Validation and Fixing', () => {
    test('should fix health above maximum', () => {
      const player = new Player({
        name: 'OverHealthTest',
        attributes: {
          health: 150,
          maxHealth: 100,
          mana: 50,
          maxMana: 50,
          stamina: 100,
          maxStamina: 100
        },
        stats: { level: 1, experience: 0 }
      });

      server.validateAndFixAttributes(player);
      expect(player.attributes.health).toBe(100);
    });

    test('should fix health below zero', () => {
      const player = new Player({
        name: 'UnderHealthTest',
        attributes: {
          health: -10,
          maxHealth: 100,
          mana: 50,
          maxMana: 50,
          stamina: 100,
          maxStamina: 100
        },
        stats: { level: 1, experience: 0 }
      });

      server.validateAndFixAttributes(player);
      expect(player.attributes.health).toBe(1);
    });

    test('should fix mana above maximum', () => {
      const player = new Player({
        name: 'OverManaTest',
        attributes: {
          health: 100,
          maxHealth: 100,
          mana: 80,
          maxMana: 50,
          stamina: 100,
          maxStamina: 100
        },
        stats: { level: 1, experience: 0 }
      });

      server.validateAndFixAttributes(player);
      expect(player.attributes.mana).toBe(50);
    });

    test('should fix mana below zero', () => {
      const player = new Player({
        name: 'UnderManaTest',
        attributes: {
          health: 100,
          maxHealth: 100,
          mana: -10,
          maxMana: 50,
          stamina: 100,
          maxStamina: 100
        },
        stats: { level: 1, experience: 0 }
      });

      server.validateAndFixAttributes(player);
      expect(player.attributes.mana).toBe(0);
    });

    test('should fix stamina within bounds', () => {
      const player = new Player({
        name: 'StaminaTest',
        attributes: {
          health: 100,
          maxHealth: 100,
          mana: 50,
          maxMana: 50,
          stamina: 150,
          maxStamina: 100
        },
        stats: { level: 1, experience: 0 }
      });

      server.validateAndFixAttributes(player);
      expect(player.attributes.stamina).toBe(100);

      // Test negative stamina
      player.attributes.stamina = -10;
      server.validateAndFixAttributes(player);
      expect(player.attributes.stamina).toBe(0);
    });
  });

  describe('Character World Setup', () => {
    test('should successfully set up character in world', async () => {
      const player = new Player({
        name: 'WorldSetupTest',
        attributes: { health: 100, maxHealth: 100, mana: 50, maxMana: 50, stamina: 100, maxStamina: 100 },
        stats: { level: 1, experience: 0 },
        roomId: 'basic-area:room1'
      });

      const success = await server.setupCharacterInWorld(player, mockSocket);
      
      expect(success).toBe(true);
      expect(player.room).toBeDefined();
      expect(player.socket).toBe(mockSocket);
      expect(gameState.players.has('WorldSetupTest')).toBe(true);
    });

    test('should handle invalid room gracefully', async () => {
      // Mock getRoom to return null
      const originalGetRoom = gameState.getRoom;
      gameState.getRoom = jest.fn().mockReturnValue(null);

      const player = new Player({
        name: 'InvalidRoomSetupTest',
        attributes: { health: 100, maxHealth: 100, mana: 50, maxMana: 50, stamina: 100, maxStamina: 100 },
        stats: { level: 1, experience: 0 },
        roomId: 'basic-area:invalid'
      });

      const success = await server.setupCharacterInWorld(player, mockSocket);
      expect(success).toBe(false);

      // Restore original method
      gameState.getRoom = originalGetRoom;
    });

    test('should handle setup errors gracefully', async () => {
      const player = new Player({
        name: 'ErrorSetupTest',
        attributes: { health: 100, maxHealth: 100, mana: 50, maxMana: 50, stamina: 100, maxStamina: 100 },
        stats: { level: 1, experience: 0 },
        roomId: 'basic-area:room1'
      });

      // Mock room.addPlayer to throw error
      const originalGetRoom = gameState.getRoom;
      gameState.getRoom = jest.fn().mockReturnValue({
        addPlayer: jest.fn().mockImplementation(() => {
          throw new Error('Room error');
        })
      });

      const success = await server.setupCharacterInWorld(player, mockSocket);
      expect(success).toBe(false);

      // Restore original method
      gameState.getRoom = originalGetRoom;
    });
  });

  describe('Online Player Checking', () => {
    test('should return true for unique names when no players online', async () => {
      const isUnique = await server.isCharacterNameUnique('UniquePlayer');
      expect(isUnique).toBe(true);
    });

    test('should return false for names of online players', async () => {
      // Add player to online players
      gameState.players.set('OnlinePlayer', { name: 'OnlinePlayer' });

      const isUnique = await server.isCharacterNameUnique('OnlinePlayer');
      expect(isUnique).toBe(false);
    });

    test('should return true for database characters that are not online', async () => {
      // Create character in database but don't add to online players
      await server.createNewCharacter('OfflinePlayer');

      const isUnique = await server.isCharacterNameUnique('OfflinePlayer');
      expect(isUnique).toBe(true); // Should be true because they're not online
    });
  });

  describe('Integration Tests', () => {
    test('should complete full character loading flow', async () => {
      // Create a character
      const originalPlayer = await server.createNewCharacter('IntegrationTest');
      expect(originalPlayer).toBeDefined();

      // Modify character state
      originalPlayer.attributes.health = 80;
      originalPlayer.roomId = 'basic-area:room2';
      originalPlayer.combatState.inCombat = true;
      await gameState.savePlayer(originalPlayer);

      // Authenticate and load character
      const loadedPlayer = await server.authenticateAndLoadCharacter('IntegrationTest');
      expect(loadedPlayer).toBeDefined();
      expect(loadedPlayer.attributes.health).toBe(80);

      // Restore character state
      const restoredPlayer = await server.restoreCharacterState(loadedPlayer);
      expect(restoredPlayer.combatState.inCombat).toBe(false);
      expect(restoredPlayer.isNewCharacter).toBe(false);

      // Set up in world
      const success = await server.setupCharacterInWorld(restoredPlayer, mockSocket);
      expect(success).toBe(true);
      expect(gameState.players.has('IntegrationTest')).toBe(true);
    });

    test('should handle character with corrupted data', async () => {
      // Create character with some corrupted data
      const corruptedData = {
        name: 'CorruptedTest',
        attributes: {
          health: 'invalid', // Invalid type
          maxHealth: 100,
          mana: 50,
          maxMana: 50,
          stamina: 100,
          maxStamina: 100
        },
        stats: { level: 1, experience: 0 }
      };

      const corruptedPlayer = new Player(corruptedData);
      await gameState.savePlayer(corruptedPlayer);

      // Try to authenticate - should fail
      const loadedPlayer = await server.authenticateAndLoadCharacter('CorruptedTest');
      expect(loadedPlayer).toBeNull();
    });
  });
});
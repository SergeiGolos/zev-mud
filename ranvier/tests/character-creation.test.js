const path = require('path');
const fs = require('fs');
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
      // Check if character already exists in database
      const existingPlayer = await this.gameState.loadPlayer(name);
      if (existingPlayer) {
        return false;
      }

      // Check if character is currently online
      if (this.gameState.players.has(name)) {
        return false;
      }

      return true;
    } catch (error) {
      console.error('Error checking character name uniqueness:', error);
      return false;
    }
  }

  async createNewCharacter(name) {
    try {
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
        roomId: 'basic-area:room1',
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
      
      return player;
    } catch (error) {
      console.error('Error creating new character:', error);
      return null;
    }
  }
}

describe('Character Creation System', () => {
  let gameState;
  let server;

  beforeEach(() => {
    gameState = new MockGameState();
    server = new MockTelnetServer(gameState);
  });

  describe('Character Name Validation', () => {
    test('should accept valid character names', () => {
      const validNames = [
        'Hero',
        'Player123',
        'Test_User',
        'My-Character',
        'A1',
        'LongCharacterName123'
      ];

      validNames.forEach(name => {
        const result = server.validateCharacterName(name);
        expect(result.valid).toBe(true);
        expect(result.name).toBe(name);
      });
    });

    test('should reject empty or null names', () => {
      const invalidNames = [null, undefined, '', '   '];

      invalidNames.forEach(name => {
        const result = server.validateCharacterName(name);
        expect(result.valid).toBe(false);
        expect(result.error).toBe('Name cannot be empty.');
      });
    });

    test('should reject names that are too short', () => {
      const result = server.validateCharacterName('A');
      expect(result.valid).toBe(false);
      expect(result.error).toBe('Name must be at least 2 characters long.');
    });

    test('should reject names that are too long', () => {
      const longName = 'A'.repeat(21);
      const result = server.validateCharacterName(longName);
      expect(result.valid).toBe(false);
      expect(result.error).toBe('Name must be no more than 20 characters long.');
    });

    test('should reject names with invalid characters', () => {
      const invalidNames = [
        '123Player', // starts with number
        'Player@123', // contains @
        'Player Space', // contains space
        'Player!', // contains !
        'Player#Tag', // contains #
        'Player$', // contains $
        'Player%', // contains %
        'Player&Co' // contains &
      ];

      invalidNames.forEach(name => {
        const result = server.validateCharacterName(name);
        expect(result.valid).toBe(false);
        expect(result.error).toBe('Name must start with a letter and contain only letters, numbers, underscores, and hyphens.');
      });
    });

    test('should reject reserved names', () => {
      const reservedNames = ['admin', 'god', 'system', 'server', 'null', 'undefined'];

      reservedNames.forEach(name => {
        const result = server.validateCharacterName(name);
        expect(result.valid).toBe(false);
        expect(result.error).toBe('That name is reserved. Please choose another name.');
      });
    });

    test('should reject reserved names case-insensitively', () => {
      const reservedNames = ['ADMIN', 'God', 'SyStEm', 'SERVER'];

      reservedNames.forEach(name => {
        const result = server.validateCharacterName(name);
        expect(result.valid).toBe(false);
        expect(result.error).toBe('That name is reserved. Please choose another name.');
      });
    });
  });

  describe('Character Name Uniqueness', () => {
    test('should return true for unique names', async () => {
      const isUnique = await server.isCharacterNameUnique('UniquePlayer');
      expect(isUnique).toBe(true);
    });

    test('should return false for existing database characters', async () => {
      // Create a character first
      const player = await server.createNewCharacter('ExistingPlayer');
      expect(player).toBeDefined();

      // Check uniqueness
      const isUnique = await server.isCharacterNameUnique('ExistingPlayer');
      expect(isUnique).toBe(false);
    });

    test('should return false for currently online players', async () => {
      // Add player to online players map
      gameState.players.set('OnlinePlayer', { name: 'OnlinePlayer' });

      const isUnique = await server.isCharacterNameUnique('OnlinePlayer');
      expect(isUnique).toBe(false);
    });
  });

  describe('Character Creation', () => {
    test('should create new character with correct data structure', async () => {
      const characterName = 'TestHero';
      const player = await server.createNewCharacter(characterName);

      expect(player).toBeDefined();
      expect(player.name).toBe(characterName);
      expect(player.isNewCharacter).toBe(true);
      expect(player.createdAt).toBeInstanceOf(Date);
      expect(player.lastLogin).toBeInstanceOf(Date);
    });

    test('should create character with correct initial attributes', async () => {
      const player = await server.createNewCharacter('TestHero');

      expect(player.attributes).toEqual({
        health: 100,
        maxHealth: 100,
        mana: 50,
        maxMana: 50,
        stamina: 100,
        maxStamina: 100
      });
    });

    test('should create character with correct initial stats', async () => {
      const player = await server.createNewCharacter('TestHero');

      expect(player.stats).toEqual({
        level: 1,
        experience: 0,
        strength: 10,
        intelligence: 10,
        dexterity: 10,
        constitution: 10
      });
    });

    test('should create character with correct initial equipment', async () => {
      const player = await server.createNewCharacter('TestHero');

      expect(player.equipment).toEqual({
        weapon: null,
        armor: null,
        accessories: []
      });
    });

    test('should create character with correct initial combat state', async () => {
      const player = await server.createNewCharacter('TestHero');

      expect(player.combatState).toEqual({
        inCombat: false,
        target: null,
        initiative: 0,
        lastAction: null
      });
    });

    test('should set starting room correctly', async () => {
      const player = await server.createNewCharacter('TestHero');
      expect(player.roomId).toBe('basic-area:room1');
    });

    test('should persist character to database', async () => {
      const characterName = 'PersistentHero';
      const player = await server.createNewCharacter(characterName);
      expect(player).toBeDefined();

      // Load character from database
      const loadedPlayer = await gameState.loadPlayer(characterName);
      expect(loadedPlayer).toBeDefined();
      expect(loadedPlayer.name).toBe(characterName);
      expect(loadedPlayer.isNewCharacter).toBe(true);
      expect(loadedPlayer.attributes.health).toBe(100);
      expect(loadedPlayer.stats.level).toBe(1);
    });

    test('should handle database errors gracefully', async () => {
      // Mock database error
      const originalSave = gameState.savePlayer;
      gameState.savePlayer = jest.fn().mockRejectedValue(new Error('Database error'));

      const player = await server.createNewCharacter('ErrorTest');
      expect(player).toBeNull();

      // Restore original method
      gameState.savePlayer = originalSave;
    });
  });

  describe('Character Creation Timestamps', () => {
    test('should set creation timestamp', async () => {
      const beforeCreation = new Date();
      const player = await server.createNewCharacter('TimestampTest');
      const afterCreation = new Date();

      expect(player.createdAt).toBeInstanceOf(Date);
      expect(player.createdAt.getTime()).toBeGreaterThanOrEqual(beforeCreation.getTime());
      expect(player.createdAt.getTime()).toBeLessThanOrEqual(afterCreation.getTime());
    });

    test('should set last login timestamp', async () => {
      const beforeCreation = new Date();
      const player = await server.createNewCharacter('LoginTest');
      const afterCreation = new Date();

      expect(player.lastLogin).toBeInstanceOf(Date);
      expect(player.lastLogin.getTime()).toBeGreaterThanOrEqual(beforeCreation.getTime());
      expect(player.lastLogin.getTime()).toBeLessThanOrEqual(afterCreation.getTime());
    });

    test('should persist timestamps correctly', async () => {
      const player = await server.createNewCharacter('TimestampPersist');
      const originalCreatedAt = player.createdAt;
      const originalLastLogin = player.lastLogin;

      // Load from database
      const loadedPlayer = await gameState.loadPlayer('TimestampPersist');
      
      expect(loadedPlayer.createdAt).toEqual(originalCreatedAt);
      expect(loadedPlayer.lastLogin).toEqual(originalLastLogin);
    });
  });

  describe('Character Data Integrity', () => {
    test('should maintain data integrity after save/load cycle', async () => {
      const originalPlayer = await server.createNewCharacter('IntegrityTest');
      
      // Modify some data
      originalPlayer.attributes.health = 80;
      originalPlayer.stats.experience = 100;
      originalPlayer.roomId = 'basic-area:room2';
      
      // Save changes
      await gameState.savePlayer(originalPlayer);
      
      // Load from database
      const loadedPlayer = await gameState.loadPlayer('IntegrityTest');
      
      expect(loadedPlayer.name).toBe(originalPlayer.name);
      expect(loadedPlayer.attributes.health).toBe(80);
      expect(loadedPlayer.stats.experience).toBe(100);
      expect(loadedPlayer.roomId).toBe('basic-area:room2');
      expect(loadedPlayer.isNewCharacter).toBe(true);
    });

    test('should handle empty inventory correctly', async () => {
      const player = await server.createNewCharacter('EmptyInventoryTest');
      
      expect(player.inventory).toBeInstanceOf(Set);
      expect(player.inventory.size).toBe(0);
      
      // Load from database
      const loadedPlayer = await gameState.loadPlayer('EmptyInventoryTest');
      expect(loadedPlayer.inventory).toBeInstanceOf(Set);
      expect(loadedPlayer.inventory.size).toBe(0);
    });
  });
});
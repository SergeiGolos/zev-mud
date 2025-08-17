const path = require('path');
const fs = require('fs');
const yaml = require('js-yaml');

// Mock the config
jest.mock('../config/config', () => ({
  port: 3000,
  database: {
    type: 'nedb',
    path: './data/test-characters.db'
  },
  game: {
    maxPlayers: 50,
    saveInterval: 30000,
    startingRoom: 'basic-area:room1'
  }
}));

// Import after mocking
const NedbDataSource = require('../src/datasources/nedb');

describe('Room Navigation', () => {
  let gameState;
  let Room, Item, NPC, Player;

  beforeAll(() => {
    // Define classes locally for testing
    class TestRoom {
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

    class TestItem {
      constructor(def) {
        this.def = def;
        this.id = def.id;
        this.name = def.name;
        this.description = def.description;
        this.type = def.type;
        this.metadata = def.metadata || {};
      }
    }

    class TestNPC {
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

    class TestPlayer {
      constructor(data) {
        this.name = data.name;
        this.attributes = data.attributes || { health: 100, mana: 50, stamina: 100 };
        this.roomId = data.roomId;
        this.inventory = new Set();
        this.createdAt = data.createdAt || new Date();
        this.lastLogin = data.lastLogin || new Date();
        
        if (data.inventory) {
          data.inventory.forEach(itemData => {
            this.inventory.add(new TestItem(itemData));
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
        switch (name) {
          case 'health': return 100;
          case 'mana': return 50;
          case 'stamina': return 100;
          default: return this.attributes[name] || 0;
        }
      }
    }

    Room = TestRoom;
    Item = TestItem;
    NPC = TestNPC;
    Player = TestPlayer;

    // Create a simple game state for testing
    class TestGameState {
      constructor() {
        this.players = new Map();
        this.rooms = new Map();
        this.items = new Map();
        this.npcs = new Map();
        this.accounts = new Map();
        
        this.loadTestWorld();
      }

      loadTestWorld() {
        // Create test rooms
        const testRooms = [
          {
            id: 'room1',
            title: 'Test Room 1',
            description: 'A test room',
            exits: [{ direction: 'north', roomId: 'basic-area:room2' }],
            items: ['torch'],
            npcs: []
          },
          {
            id: 'room2',
            title: 'Test Room 2',
            description: 'Another test room',
            exits: [{ direction: 'south', roomId: 'basic-area:room1' }],
            items: [],
            npcs: []
          }
        ];

        testRooms.forEach(roomDef => {
          const room = new Room(roomDef);
          this.rooms.set(room.id, room);
        });

        // Create test items
        const testItems = [
          {
            id: 'torch',
            name: 'a flickering torch',
            description: 'A wooden torch',
            type: 'LIGHT',
            metadata: { weight: 2, value: 5 }
          }
        ];

        testItems.forEach(itemDef => {
          const item = new Item(itemDef);
          this.items.set(item.id, item);
        });

        // Populate rooms
        this.populateRooms();
      }

      populateRooms() {
        this.rooms.forEach(room => {
          if (room.def.items) {
            room.def.items.forEach(itemId => {
              const item = this.items.get(itemId);
              if (item) {
                room.items.add(new Item(item.def));
              }
            });
          }
        });
      }

      getRoom(roomId) {
        const id = roomId.includes(':') ? roomId.split(':')[1] : roomId;
        return this.rooms.get(id);
      }
    }

    gameState = new TestGameState();
  });

  test('should load rooms correctly', () => {
    expect(gameState.rooms.size).toBe(2);
    expect(gameState.rooms.has('room1')).toBe(true);
    expect(gameState.rooms.has('room2')).toBe(true);
  });

  test('should have correct room properties', () => {
    const room1 = gameState.getRoom('room1');
    expect(room1.title).toBe('Test Room 1');
    expect(room1.description).toBe('A test room');
    expect(room1.exits).toHaveLength(1);
    expect(room1.exits[0].direction).toBe('north');
  });

  test('should have items in rooms', () => {
    const room1 = gameState.getRoom('room1');
    expect(room1.items.size).toBe(1);
    const torch = Array.from(room1.items)[0];
    expect(torch.name).toBe('a flickering torch');
  });

  test('should allow player movement between rooms', () => {
    const room1 = gameState.getRoom('room1');
    const room2 = gameState.getRoom('room2');
    
    const player = new Player({
      name: 'TestPlayer',
      roomId: 'basic-area:room1'
    });

    // Add player to room1
    room1.addPlayer(player);
    player.room = room1;
    
    expect(room1.players.has(player)).toBe(true);
    expect(room2.players.has(player)).toBe(false);

    // Move player to room2
    room1.removePlayer(player);
    room2.addPlayer(player);
    player.room = room2;

    expect(room1.players.has(player)).toBe(false);
    expect(room2.players.has(player)).toBe(true);
  });

  test('should validate exits exist before movement', () => {
    const room1 = gameState.getRoom('room1');
    
    // Check valid exit
    const northExit = room1.exits.find(e => e.direction === 'north');
    expect(northExit).toBeDefined();
    expect(northExit.roomId).toBe('basic-area:room2');

    // Check invalid exit
    const westExit = room1.exits.find(e => e.direction === 'west');
    expect(westExit).toBeUndefined();
  });

  test('should handle room connections correctly', () => {
    const room1 = gameState.getRoom('room1');
    const room2 = gameState.getRoom('room2');

    // Room1 should connect north to room2
    const northExit = room1.exits.find(e => e.direction === 'north');
    expect(northExit.roomId).toBe('basic-area:room2');

    // Room2 should connect south to room1
    const southExit = room2.exits.find(e => e.direction === 'south');
    expect(southExit.roomId).toBe('basic-area:room1');
  });
});
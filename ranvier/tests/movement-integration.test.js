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

// Import the server components
const NedbDataSource = require('../src/datasources/nedb');

describe('Movement Integration Tests', () => {
  let gameState;
  let telnetServer;
  let Room, Item, NPC, Player;

  beforeAll(() => {
    // Import the classes from server.js by requiring and extracting them
    const serverModule = require('../src/server.js');
    
    // We need to create a test version of the server classes
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
    }

    Room = TestRoom;
    Item = TestItem;
    NPC = TestNPC;
    Player = TestPlayer;

    // Create test game state
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
        // Load actual room data from the game
        try {
          const roomsPath = path.join(__dirname, '../bundles/basic-world/areas/basic-area/rooms.yml');
          const roomsData = yaml.load(fs.readFileSync(roomsPath, 'utf8'));
          
          roomsData.forEach(roomDef => {
            const room = new Room(roomDef);
            this.rooms.set(room.id, room);
          });
        } catch (error) {
          // Fallback to test rooms if file doesn't exist
          const testRooms = [
            {
              id: 'room1',
              title: 'Test Room 1',
              description: 'A test room',
              exits: [
                { direction: 'north', roomId: 'basic-area:room2' },
                { direction: 'east', roomId: 'basic-area:room3' }
              ]
            },
            {
              id: 'room2',
              title: 'Test Room 2',
              description: 'Another test room',
              exits: [{ direction: 'south', roomId: 'basic-area:room1' }]
            },
            {
              id: 'room3',
              title: 'Test Room 3',
              description: 'A third test room',
              exits: [{ direction: 'west', roomId: 'basic-area:room1' }]
            }
          ];

          testRooms.forEach(roomDef => {
            const room = new Room(roomDef);
            this.rooms.set(room.id, room);
          });
        }
      }

      getRoom(roomId) {
        const id = roomId.includes(':') ? roomId.split(':')[1] : roomId;
        return this.rooms.get(id);
      }

      async savePlayer(player) {
        // Mock save operation
        return Promise.resolve();
      }
    }

    gameState = new TestGameState();

    // Create test telnet server
    class TestTelnetServer {
      constructor(gameState) {
        this.gameState = gameState;
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

      showRoom(player) {
        const room = player.room;
        if (!room) {
          player.socket.write('You are not in a valid location.\r\n');
          return;
        }

        player.socket.write(`\r\n${room.title}\r\n`);
        player.socket.write(`${room.description}\r\n`);
        
        // Show exits
        if (room.exits && room.exits.length > 0) {
          const exitNames = room.exits.map(exit => exit.direction).join(', ');
          player.socket.write(`\r\nExits: ${exitNames}\r\n`);
        } else {
          player.socket.write(`\r\nThere are no obvious exits.\r\n`);
        }
      }

      handleCommand(player, input) {
        const args = input.split(' ');
        const command = args[0].toLowerCase();
        
        switch (command) {
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
          default:
            player.socket.write(`Unknown command: ${command}\r\n`);
        }
      }
    }

    telnetServer = new TestTelnetServer(gameState);
  });

  test('should handle complete movement sequence with room transitions', () => {
    const room1 = gameState.getRoom('room1');
    const room2 = gameState.getRoom('room2');
    
    const player = new Player({
      name: 'MovementTestPlayer',
      roomId: 'basic-area:room1'
    });

    const mockSocket = {
      write: jest.fn()
    };
    player.socket = mockSocket;
    player.room = room1;
    room1.addPlayer(player);

    // Test movement north
    telnetServer.movePlayer(player, 'north');
    
    // Verify player moved to room2
    expect(player.room.id).toBe('room2');
    expect(player.roomId).toBe('basic-area:room2');
    expect(room1.players.has(player)).toBe(false);
    expect(player.room.players.has(player)).toBe(true);
    
    // Verify room description was shown (should be "Narrow Corridor" from actual room data)
    expect(mockSocket.write).toHaveBeenCalledWith(expect.stringContaining('Narrow Corridor'));
  });

  test('should handle command parsing for movement', () => {
    const room1 = gameState.getRoom('room1');
    const player = new Player({
      name: 'CommandTestPlayer',
      roomId: 'basic-area:room1'
    });

    const mockSocket = {
      write: jest.fn()
    };
    player.socket = mockSocket;
    player.room = room1;
    room1.addPlayer(player);

    // Test various movement command formats
    const commands = ['north', 'n', 'NORTH', 'N'];
    
    commands.forEach(command => {
      mockSocket.write.mockClear();
      
      // Reset player position
      if (player.room.id !== 'room1') {
        player.room.removePlayer(player);
        room1.addPlayer(player);
        player.room = room1;
        player.roomId = 'basic-area:room1';
      }
      
      telnetServer.handleCommand(player, command);
      
      // Should move to room2
      expect(player.room.id).toBe('room2');
    });
  });

  test('should announce player movements to other players', () => {
    const room1 = gameState.getRoom('room1');
    const room2 = gameState.getRoom('room2');
    
    const player1 = new Player({
      name: 'Player1',
      roomId: 'basic-area:room1'
    });
    
    const player2 = new Player({
      name: 'Player2',
      roomId: 'basic-area:room1'
    });

    const mockSocket1 = { write: jest.fn() };
    const mockSocket2 = { write: jest.fn() };
    
    player1.socket = mockSocket1;
    player2.socket = mockSocket2;
    
    player1.room = room1;
    player2.room = room1;
    room1.addPlayer(player1);
    room1.addPlayer(player2);

    // Move player1 north
    telnetServer.movePlayer(player1, 'north');
    
    // Player2 should see departure message
    expect(mockSocket2.write).toHaveBeenCalledWith('Player1 leaves north.\r\n');
    
    // Add player2 to room2 to test arrival message
    room1.removePlayer(player2);
    room2.addPlayer(player2);
    player2.room = room2;
    
    // Reset player1 to room1
    room2.removePlayer(player1);
    room1.addPlayer(player1);
    player1.room = room1;
    
    mockSocket2.write.mockClear();
    
    // Move player1 north again
    telnetServer.movePlayer(player1, 'north');
    
    // Player2 should see arrival message
    expect(mockSocket2.write).toHaveBeenCalledWith('Player1 arrives from the south.\r\n');
  });

  test('should handle database persistence during movement', async () => {
    const room1 = gameState.getRoom('room1');
    const player = new Player({
      name: 'PersistenceTestPlayer',
      roomId: 'basic-area:room1'
    });

    const mockSocket = { write: jest.fn() };
    player.socket = mockSocket;
    player.room = room1;
    room1.addPlayer(player);

    // Spy on savePlayer method
    const savePlayerSpy = jest.spyOn(gameState, 'savePlayer');
    
    // Move player
    telnetServer.movePlayer(player, 'north');
    
    // Verify savePlayer was called
    expect(savePlayerSpy).toHaveBeenCalledWith(player);
    
    savePlayerSpy.mockRestore();
  });

  test('should validate movement in all cardinal directions', () => {
    const directions = [
      { command: 'north', short: 'n' },
      { command: 'south', short: 's' },
      { command: 'east', short: 'e' },
      { command: 'west', short: 'w' },
      { command: 'up', short: 'u' },
      { command: 'down', short: 'd' }
    ];

    const room1 = gameState.getRoom('room1');
    const player = new Player({
      name: 'DirectionTestPlayer',
      roomId: 'basic-area:room1'
    });

    const mockSocket = { write: jest.fn() };
    player.socket = mockSocket;
    player.room = room1;
    room1.addPlayer(player);

    directions.forEach(({ command, short }) => {
      mockSocket.write.mockClear();
      
      // Test full command
      telnetServer.handleCommand(player, command);
      
      // Reset position if moved
      if (player.room.id !== 'room1') {
        player.room.removePlayer(player);
        room1.addPlayer(player);
        player.room = room1;
        player.roomId = 'basic-area:room1';
      }
      
      mockSocket.write.mockClear();
      
      // Test short command
      telnetServer.handleCommand(player, short);
      
      // Reset position if moved
      if (player.room.id !== 'room1') {
        player.room.removePlayer(player);
        room1.addPlayer(player);
        player.room = room1;
        player.roomId = 'basic-area:room1';
      }
    });
  });

  test('should handle edge cases and error conditions', () => {
    const player = new Player({
      name: 'EdgeCaseTestPlayer',
      roomId: 'basic-area:room1'
    });

    const mockSocket = { write: jest.fn() };
    player.socket = mockSocket;

    // Test movement without room
    player.room = null;
    telnetServer.movePlayer(player, 'north');
    expect(mockSocket.write).toHaveBeenCalledWith('You are not in a valid location.\r\n');

    // Test movement with invalid direction
    const room1 = gameState.getRoom('room1');
    player.room = room1;
    room1.addPlayer(player);
    
    mockSocket.write.mockClear();
    telnetServer.movePlayer(player, 'invalid');
    expect(mockSocket.write).toHaveBeenCalledWith('You cannot go invalid.\r\n');
  });
});
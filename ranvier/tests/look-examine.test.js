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

describe('Look and Examine Commands', () => {
  let gameState;
  let telnetServer;
  let Room, Item, NPC, Player;

  beforeAll(() => {
    // Define test classes
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
        this.stats = Object.assign({
          level: 1,
          experience: 0,
          strength: 10,
          intelligence: 10,
          dexterity: 10,
          constitution: 10
        }, data.stats || {});
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
        // Create test rooms with items and NPCs
        const testRooms = [
          {
            id: 'room1',
            title: 'Test Room 1',
            description: 'A test room with various objects',
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

        // Create test items
        const testItems = [
          {
            id: 'torch',
            name: 'a flickering torch',
            description: 'A wooden torch with a flame that flickers and dances.',
            type: 'LIGHT',
            metadata: { weight: 2, value: 5 }
          },
          {
            id: 'sword',
            name: 'an iron sword',
            description: 'A well-balanced iron sword with a sharp edge.',
            type: 'WEAPON',
            metadata: { weight: 10, value: 80, damage: 12, durability: 100 }
          },
          {
            id: 'potion',
            name: 'a health potion',
            description: 'A small glass vial containing a red liquid.',
            type: 'POTION',
            metadata: { weight: 1, value: 25, healing: 30 }
          }
        ];

        testItems.forEach(itemDef => {
          const item = new Item(itemDef);
          this.items.set(item.id, item);
        });

        // Create test NPCs
        const testNPCs = [
          {
            id: 'guard',
            name: 'a town guard',
            description: 'A sturdy guard wearing leather armor and carrying a spear.',
            level: 2,
            attributes: { health: 60, mana: 10, stamina: 50 },
            stats: { strength: 14, constitution: 16, dexterity: 10 },
            hostile: false,
            behaviors: ['guard']
          },
          {
            id: 'goblin',
            name: 'a goblin warrior',
            description: 'A small, green-skinned creature with sharp teeth and beady eyes.',
            level: 1,
            attributes: { health: 30, mana: 5, stamina: 40 },
            stats: { strength: 8, constitution: 10, dexterity: 14 },
            hostile: true,
            behaviors: ['aggressive']
          }
        ];

        testNPCs.forEach(npcDef => {
          const npc = new NPC(npcDef);
          this.npcs.set(npc.id, npc);
        });

        // Populate rooms with items and NPCs
        this.populateRooms();
      }

      populateRooms() {
        const room1 = this.rooms.get('room1');
        const room2 = this.rooms.get('room2');
        
        // Add items to rooms
        room1.items.add(new Item(this.items.get('torch').def));
        room1.items.add(new Item(this.items.get('sword').def));
        room2.items.add(new Item(this.items.get('potion').def));
        
        // Add NPCs to rooms
        room1.npcs.add(new NPC(this.npcs.get('guard').def));
        room2.npcs.add(new NPC(this.npcs.get('goblin').def));
      }

      getRoom(roomId) {
        const id = roomId.includes(':') ? roomId.split(':')[1] : roomId;
        return this.rooms.get(id);
      }

      async savePlayer(player) {
        return Promise.resolve();
      }
    }

    gameState = new TestGameState();

    // Create test telnet server
    class TestTelnetServer {
      constructor(gameState) {
        this.gameState = gameState;
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
          const maxHealth = npc.attributes.maxHealth || npc.attributes.health;
          const healthPercent = (npc.attributes.health / maxHealth) * 100;
          let healthStatus = 'excellent condition';
          
          if (healthPercent < 25) {
            healthStatus = 'near death';
          } else if (healthPercent < 50) {
            healthStatus = 'badly wounded';
          } else if (healthPercent < 75) {
            healthStatus = 'wounded';
          }
          
          player.socket.write(`Health: ${healthStatus}\r\n`);
        }
        
        // Show stats if available
        if (npc.stats) {
          const statDetails = [];
          if (npc.stats.strength) statDetails.push(`STR: ${npc.stats.strength}`);
          if (npc.stats.constitution) statDetails.push(`CON: ${npc.stats.constitution}`);
          if (npc.stats.dexterity) statDetails.push(`DEX: ${npc.stats.dexterity}`);
          if (npc.stats.intelligence) statDetails.push(`INT: ${npc.stats.intelligence}`);
          
          if (statDetails.length > 0) {
            player.socket.write(`Stats: ${statDetails.join(', ')}\r\n`);
          }
        }
        
        // Show behaviors
        if (npc.behaviors && npc.behaviors.length > 0) {
          player.socket.write(`Behaviors: ${npc.behaviors.join(', ')}\r\n`);
        }
      }

      showDetailedPlayerInfo(player, otherPlayer) {
        player.socket.write(`${otherPlayer.name} is a fellow adventurer.\r\n`);
        
        if (otherPlayer.stats && otherPlayer.stats.level) {
          player.socket.write(`Level: ${otherPlayer.stats.level}\r\n`);
        }
        
        // Show health status (general)
        if (otherPlayer.attributes && otherPlayer.attributes.health) {
          const maxHealth = otherPlayer.getMaxAttribute('health');
          const healthPercent = (otherPlayer.attributes.health / maxHealth) * 100;
          let healthStatus = 'looks healthy';
          
          if (healthPercent < 25) {
            healthStatus = 'looks near death';
          } else if (healthPercent < 50) {
            healthStatus = 'looks badly wounded';
          } else if (healthPercent < 75) {
            healthStatus = 'looks wounded';
          }
          
          player.socket.write(`They ${healthStatus}.\r\n`);
        }
        
        // Show equipment if visible
        if (otherPlayer.equipment) {
          const visibleEquipment = [];
          if (otherPlayer.equipment.weapon) {
            visibleEquipment.push(`wielding ${otherPlayer.equipment.weapon.name}`);
          }
          if (otherPlayer.equipment.armor) {
            visibleEquipment.push(`wearing ${otherPlayer.equipment.armor.name}`);
          }
          
          if (visibleEquipment.length > 0) {
            player.socket.write(`They are ${visibleEquipment.join(' and ')}.\r\n`);
          }
        }
      }

      showDetailedRoomInfo(player) {
        const room = player.room;
        if (!room) {
          player.socket.write('You are not in a valid location.\r\n');
          return;
        }

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
            
          default:
            player.socket.write(`Unknown command: ${command}\r\n`);
        }
      }
    }

    telnetServer = new TestTelnetServer(gameState);
  });

  describe('Look Command', () => {
    test('should display current room details when using look with no arguments', () => {
      const room1 = gameState.getRoom('room1');
      const player = new Player({
        name: 'TestPlayer',
        roomId: 'basic-area:room1'
      });

      const mockSocket = { write: jest.fn() };
      player.socket = mockSocket;
      player.room = room1;
      room1.addPlayer(player);

      telnetServer.showRoom(player);

      expect(mockSocket.write).toHaveBeenCalledWith('\r\nTest Room 1\r\n');
      expect(mockSocket.write).toHaveBeenCalledWith('A test room with various objects\r\n');
      expect(mockSocket.write).toHaveBeenCalledWith('\r\nExits: north, east\r\n');
      expect(mockSocket.write).toHaveBeenCalledWith('\r\nItems here:\r\n');
      expect(mockSocket.write).toHaveBeenCalledWith('  a flickering torch\r\n');
      expect(mockSocket.write).toHaveBeenCalledWith('  an iron sword\r\n');
      expect(mockSocket.write).toHaveBeenCalledWith('\r\nCreatures here:\r\n');
      expect(mockSocket.write).toHaveBeenCalledWith('  a town guard (peaceful) [Level 2]\r\n');
    });

    test('should display item details when looking at specific item', () => {
      const room1 = gameState.getRoom('room1');
      const player = new Player({
        name: 'TestPlayer',
        roomId: 'basic-area:room1'
      });

      const mockSocket = { write: jest.fn() };
      player.socket = mockSocket;
      player.room = room1;
      room1.addPlayer(player);

      telnetServer.lookAtTarget(player, 'torch');

      expect(mockSocket.write).toHaveBeenCalledWith('a flickering torch\r\nA wooden torch with a flame that flickers and dances.\r\n');
    });

    test('should display NPC details when looking at specific NPC', () => {
      const room1 = gameState.getRoom('room1');
      const player = new Player({
        name: 'TestPlayer',
        roomId: 'basic-area:room1'
      });

      const mockSocket = { write: jest.fn() };
      player.socket = mockSocket;
      player.room = room1;
      room1.addPlayer(player);

      telnetServer.lookAtTarget(player, 'guard');

      expect(mockSocket.write).toHaveBeenCalledWith('a town guard\r\nA sturdy guard wearing leather armor and carrying a spear.\r\n');
    });

    test('should display other player details when looking at another player', () => {
      const room1 = gameState.getRoom('room1');
      const player1 = new Player({
        name: 'Player1',
        roomId: 'basic-area:room1'
      });
      const player2 = new Player({
        name: 'Player2',
        roomId: 'basic-area:room1'
      });

      const mockSocket = { write: jest.fn() };
      player1.socket = mockSocket;
      player1.room = room1;
      player2.room = room1;
      room1.addPlayer(player1);
      room1.addPlayer(player2);

      telnetServer.lookAtTarget(player1, 'Player2');

      expect(mockSocket.write).toHaveBeenCalledWith('Player2 is a fellow adventurer.\r\n');
    });

    test('should handle invalid look targets with appropriate error message', () => {
      const room1 = gameState.getRoom('room1');
      const player = new Player({
        name: 'TestPlayer',
        roomId: 'basic-area:room1'
      });

      const mockSocket = { write: jest.fn() };
      player.socket = mockSocket;
      player.room = room1;
      room1.addPlayer(player);

      telnetServer.lookAtTarget(player, 'nonexistent');

      expect(mockSocket.write).toHaveBeenCalledWith("You don't see 'nonexistent' here.\r\n");
    });

    test('should look at inventory items', () => {
      const room1 = gameState.getRoom('room1');
      const player = new Player({
        name: 'TestPlayer',
        roomId: 'basic-area:room1'
      });

      // Add item to inventory
      const testItem = new Item({
        id: 'test_item',
        name: 'a test item',
        description: 'A test item in inventory',
        type: 'MISC'
      });
      player.inventory.add(testItem);

      const mockSocket = { write: jest.fn() };
      player.socket = mockSocket;
      player.room = room1;
      room1.addPlayer(player);

      telnetServer.lookAtTarget(player, 'test item');

      expect(mockSocket.write).toHaveBeenCalledWith('a test item\r\nA test item in inventory\r\n');
    });
  });

  describe('Examine Command', () => {
    test('should display detailed item information when examining item', () => {
      const room1 = gameState.getRoom('room1');
      const player = new Player({
        name: 'TestPlayer',
        roomId: 'basic-area:room1'
      });

      const mockSocket = { write: jest.fn() };
      player.socket = mockSocket;
      player.room = room1;
      room1.addPlayer(player);

      telnetServer.examineTarget(player, 'sword');

      expect(mockSocket.write).toHaveBeenCalledWith('an iron sword\r\n');
      expect(mockSocket.write).toHaveBeenCalledWith('A well-balanced iron sword with a sharp edge.\r\n');
      expect(mockSocket.write).toHaveBeenCalledWith('\r\nType: WEAPON, Weight: 10 lbs, Value: 80 gold, Damage: 12, Durability: 100%\r\n');
    });

    test('should display detailed NPC information when examining NPC', () => {
      const room1 = gameState.getRoom('room1');
      const player = new Player({
        name: 'TestPlayer',
        roomId: 'basic-area:room1'
      });

      const mockSocket = { write: jest.fn() };
      player.socket = mockSocket;
      player.room = room1;
      room1.addPlayer(player);

      telnetServer.examineTarget(player, 'guard');

      expect(mockSocket.write).toHaveBeenCalledWith('a town guard\r\n');
      expect(mockSocket.write).toHaveBeenCalledWith('A sturdy guard wearing leather armor and carrying a spear.\r\n');
      expect(mockSocket.write).toHaveBeenCalledWith('\r\nLevel: 2\r\n');
      expect(mockSocket.write).toHaveBeenCalledWith('This creature seems peaceful.\r\n');
      expect(mockSocket.write).toHaveBeenCalledWith('Health: excellent condition\r\n');
      expect(mockSocket.write).toHaveBeenCalledWith('Stats: STR: 14, CON: 16, DEX: 10\r\n');
      expect(mockSocket.write).toHaveBeenCalledWith('Behaviors: guard\r\n');
    });

    test('should display detailed player information when examining another player', () => {
      const room1 = gameState.getRoom('room1');
      const player1 = new Player({
        name: 'Player1',
        roomId: 'basic-area:room1'
      });
      const player2 = new Player({
        name: 'Player2',
        roomId: 'basic-area:room1'
      });
      
      // Manually set level after creation
      player2.stats.level = 5;

      const mockSocket = { write: jest.fn() };
      player1.socket = mockSocket;
      player1.room = room1;
      player2.room = room1;
      room1.addPlayer(player1);
      room1.addPlayer(player2);

      telnetServer.examineTarget(player1, 'Player2');

      expect(mockSocket.write).toHaveBeenCalledWith('Player2 is a fellow adventurer.\r\n');
      expect(mockSocket.write).toHaveBeenCalledWith('Level: 1\r\n');
      expect(mockSocket.write).toHaveBeenCalledWith('They looks healthy.\r\n');
    });

    test('should display detailed room information when examining room', () => {
      const room1 = gameState.getRoom('room1');
      const player = new Player({
        name: 'TestPlayer',
        roomId: 'basic-area:room1'
      });

      const mockSocket = { write: jest.fn() };
      player.socket = mockSocket;
      player.room = room1;
      room1.addPlayer(player);

      telnetServer.examineTarget(player, 'room');

      expect(mockSocket.write).toHaveBeenCalledWith('Test Room 1\r\n');
      expect(mockSocket.write).toHaveBeenCalledWith('A test room with various objects\r\n');
      expect(mockSocket.write).toHaveBeenCalledWith('\r\nExits:\r\n');
      expect(mockSocket.write).toHaveBeenCalledWith('  north: Test Room 2\r\n');
      expect(mockSocket.write).toHaveBeenCalledWith('  east: Test Room 3\r\n');
    });

    test('should handle invalid examine targets with appropriate error message', () => {
      const room1 = gameState.getRoom('room1');
      const player = new Player({
        name: 'TestPlayer',
        roomId: 'basic-area:room1'
      });

      const mockSocket = { write: jest.fn() };
      player.socket = mockSocket;
      player.room = room1;
      room1.addPlayer(player);

      telnetServer.examineTarget(player, 'nonexistent');

      expect(mockSocket.write).toHaveBeenCalledWith("You don't see 'nonexistent' here to examine.\r\n");
    });

    test('should require a target for examine command', () => {
      const room1 = gameState.getRoom('room1');
      const player = new Player({
        name: 'TestPlayer',
        roomId: 'basic-area:room1'
      });

      const mockSocket = { write: jest.fn() };
      player.socket = mockSocket;
      player.room = room1;
      room1.addPlayer(player);

      telnetServer.handleCommand(player, 'examine');

      expect(mockSocket.write).toHaveBeenCalledWith('Examine what?\r\n');
    });
  });

  describe('Command Integration', () => {
    test('should handle look command with aliases', () => {
      const room1 = gameState.getRoom('room1');
      const player = new Player({
        name: 'TestPlayer',
        roomId: 'basic-area:room1'
      });

      const mockSocket = { write: jest.fn() };
      player.socket = mockSocket;
      player.room = room1;
      room1.addPlayer(player);

      // Test 'l' alias
      telnetServer.handleCommand(player, 'l');
      expect(mockSocket.write).toHaveBeenCalledWith('\r\nTest Room 1\r\n');

      mockSocket.write.mockClear();

      // Test 'look' full command
      telnetServer.handleCommand(player, 'look');
      expect(mockSocket.write).toHaveBeenCalledWith('\r\nTest Room 1\r\n');
    });

    test('should handle examine command with aliases', () => {
      const room1 = gameState.getRoom('room1');
      const player = new Player({
        name: 'TestPlayer',
        roomId: 'basic-area:room1'
      });

      const mockSocket = { write: jest.fn() };
      player.socket = mockSocket;
      player.room = room1;
      room1.addPlayer(player);

      // Test 'ex' alias
      telnetServer.handleCommand(player, 'ex torch');
      expect(mockSocket.write).toHaveBeenCalledWith('a flickering torch\r\n');

      mockSocket.write.mockClear();

      // Test 'exam' alias
      telnetServer.handleCommand(player, 'exam torch');
      expect(mockSocket.write).toHaveBeenCalledWith('a flickering torch\r\n');

      mockSocket.write.mockClear();

      // Test 'examine' full command
      telnetServer.handleCommand(player, 'examine torch');
      expect(mockSocket.write).toHaveBeenCalledWith('a flickering torch\r\n');
    });

    test('should handle room content listing correctly', () => {
      const room2 = gameState.getRoom('room2');
      const player = new Player({
        name: 'TestPlayer',
        roomId: 'basic-area:room2'
      });

      const mockSocket = { write: jest.fn() };
      player.socket = mockSocket;
      player.room = room2;
      room2.addPlayer(player);

      telnetServer.showRoom(player);

      // Should show hostile NPC correctly
      expect(mockSocket.write).toHaveBeenCalledWith('  a goblin warrior (hostile) [Level 1]\r\n');
      // Should show potion
      expect(mockSocket.write).toHaveBeenCalledWith('  a health potion\r\n');
    });

    test('should handle empty rooms correctly', () => {
      const room3 = gameState.getRoom('room3');
      const player = new Player({
        name: 'TestPlayer',
        roomId: 'basic-area:room3'
      });

      const mockSocket = { write: jest.fn() };
      player.socket = mockSocket;
      player.room = room3;
      room3.addPlayer(player);

      telnetServer.showRoom(player);

      expect(mockSocket.write).toHaveBeenCalledWith('\r\nTest Room 3\r\n');
      expect(mockSocket.write).toHaveBeenCalledWith('A third test room\r\n');
      expect(mockSocket.write).toHaveBeenCalledWith('\r\nExits: west\r\n');
      // Should not show items or creatures sections for empty room
      expect(mockSocket.write).not.toHaveBeenCalledWith('\r\nItems here:\r\n');
      expect(mockSocket.write).not.toHaveBeenCalledWith('\r\nCreatures here:\r\n');
    });
  });

  describe('Error Handling', () => {
    test('should handle player not in valid location', () => {
      const player = new Player({
        name: 'TestPlayer',
        roomId: 'basic-area:room1'
      });

      const mockSocket = { write: jest.fn() };
      player.socket = mockSocket;
      player.room = null; // No room assigned

      telnetServer.lookAtTarget(player, 'torch');
      expect(mockSocket.write).toHaveBeenCalledWith('You are not in a valid location.\r\n');

      mockSocket.write.mockClear();

      telnetServer.examineTarget(player, 'torch');
      expect(mockSocket.write).toHaveBeenCalledWith('You are not in a valid location.\r\n');
    });

    test('should handle case-insensitive target matching', () => {
      const room1 = gameState.getRoom('room1');
      const player = new Player({
        name: 'TestPlayer',
        roomId: 'basic-area:room1'
      });

      const mockSocket = { write: jest.fn() };
      player.socket = mockSocket;
      player.room = room1;
      room1.addPlayer(player);

      // Test uppercase
      telnetServer.lookAtTarget(player, 'TORCH');
      expect(mockSocket.write).toHaveBeenCalledWith('a flickering torch\r\nA wooden torch with a flame that flickers and dances.\r\n');

      mockSocket.write.mockClear();

      // Test mixed case
      telnetServer.lookAtTarget(player, 'GuArD');
      expect(mockSocket.write).toHaveBeenCalledWith('a town guard\r\nA sturdy guard wearing leather armor and carrying a spear.\r\n');
    });

    test('should handle partial name matching', () => {
      const room1 = gameState.getRoom('room1');
      const player = new Player({
        name: 'TestPlayer',
        roomId: 'basic-area:room1'
      });

      const mockSocket = { write: jest.fn() };
      player.socket = mockSocket;
      player.room = room1;
      room1.addPlayer(player);

      // Test partial match
      telnetServer.lookAtTarget(player, 'iron');
      expect(mockSocket.write).toHaveBeenCalledWith('an iron sword\r\nA well-balanced iron sword with a sharp edge.\r\n');

      mockSocket.write.mockClear();

      // Test partial match for NPC
      telnetServer.lookAtTarget(player, 'town');
      expect(mockSocket.write).toHaveBeenCalledWith('a town guard\r\nA sturdy guard wearing leather armor and carrying a spear.\r\n');
    });
  });
});
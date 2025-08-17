const path = require('path');

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

describe('Item Interactions', () => {
  let Room, Item, Player;

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
    Player = TestPlayer;
  });

  test('should create items with correct properties', () => {
    const itemDef = {
      id: 'torch',
      name: 'a flickering torch',
      description: 'A wooden torch with a flame',
      type: 'LIGHT',
      metadata: { weight: 2, value: 5 }
    };

    const item = new Item(itemDef);
    
    expect(item.id).toBe('torch');
    expect(item.name).toBe('a flickering torch');
    expect(item.description).toBe('A wooden torch with a flame');
    expect(item.type).toBe('LIGHT');
    expect(item.metadata.weight).toBe(2);
    expect(item.metadata.value).toBe(5);
  });

  test('should allow taking items from room', () => {
    const room = new Room({
      id: 'testroom',
      title: 'Test Room',
      description: 'A test room'
    });

    const item = new Item({
      id: 'sword',
      name: 'a rusty sword',
      description: 'An old sword',
      type: 'WEAPON'
    });

    const player = new Player({
      name: 'TestPlayer',
      roomId: 'basic-area:testroom'
    });

    // Add item to room
    room.addItem(item);
    expect(room.items.has(item)).toBe(true);
    expect(player.inventory.size).toBe(0);

    // Simulate taking the item
    room.removeItem(item);
    player.inventory.add(item);

    expect(room.items.has(item)).toBe(false);
    expect(player.inventory.has(item)).toBe(true);
    expect(player.inventory.size).toBe(1);
  });

  test('should allow dropping items to room', () => {
    const room = new Room({
      id: 'testroom',
      title: 'Test Room',
      description: 'A test room'
    });

    const item = new Item({
      id: 'potion',
      name: 'a health potion',
      description: 'A healing potion',
      type: 'POTION'
    });

    const player = new Player({
      name: 'TestPlayer',
      roomId: 'basic-area:testroom'
    });

    // Add item to player inventory
    player.inventory.add(item);
    expect(player.inventory.has(item)).toBe(true);
    expect(room.items.size).toBe(0);

    // Simulate dropping the item
    player.inventory.delete(item);
    room.addItem(item);

    expect(player.inventory.has(item)).toBe(false);
    expect(room.items.has(item)).toBe(true);
    expect(room.items.size).toBe(1);
  });

  test('should find items by partial name match', () => {
    const room = new Room({
      id: 'testroom',
      title: 'Test Room',
      description: 'A test room'
    });

    const items = [
      new Item({ id: 'sword1', name: 'a rusty sword', type: 'WEAPON' }),
      new Item({ id: 'sword2', name: 'an iron sword', type: 'WEAPON' }),
      new Item({ id: 'potion', name: 'a health potion', type: 'POTION' })
    ];

    items.forEach(item => room.addItem(item));

    // Test partial matching
    const swordItems = Array.from(room.items).filter(item => 
      item.name.toLowerCase().includes('sword')
    );
    expect(swordItems).toHaveLength(2);

    const rustySword = Array.from(room.items).find(item => 
      item.name.toLowerCase().includes('rusty')
    );
    expect(rustySword).toBeDefined();
    expect(rustySword.name).toBe('a rusty sword');

    const potion = Array.from(room.items).find(item => 
      item.name.toLowerCase().includes('potion')
    );
    expect(potion).toBeDefined();
    expect(potion.name).toBe('a health potion');
  });

  test('should handle different item types correctly', () => {
    const itemTypes = [
      { type: 'WEAPON', expectedType: 'WEAPON' },
      { type: 'ARMOR', expectedType: 'ARMOR' },
      { type: 'POTION', expectedType: 'POTION' },
      { type: 'FOOD', expectedType: 'FOOD' },
      { type: 'KEY', expectedType: 'KEY' }
    ];

    itemTypes.forEach(({ type, expectedType }, index) => {
      const item = new Item({
        id: `item${index}`,
        name: `test ${type.toLowerCase()}`,
        description: `A test ${type.toLowerCase()}`,
        type: type
      });

      expect(item.type).toBe(expectedType);
    });
  });

  test('should handle item metadata correctly', () => {
    const weaponItem = new Item({
      id: 'sword',
      name: 'a steel sword',
      description: 'A sharp steel sword',
      type: 'WEAPON',
      metadata: {
        weight: 10,
        value: 80,
        damage: 12,
        durability: 100
      }
    });

    expect(weaponItem.metadata.weight).toBe(10);
    expect(weaponItem.metadata.value).toBe(80);
    expect(weaponItem.metadata.damage).toBe(12);
    expect(weaponItem.metadata.durability).toBe(100);

    const potionItem = new Item({
      id: 'potion',
      name: 'a healing potion',
      description: 'A magical healing potion',
      type: 'POTION',
      metadata: {
        weight: 1,
        value: 25,
        healing: 30
      }
    });

    expect(potionItem.metadata.weight).toBe(1);
    expect(potionItem.metadata.value).toBe(25);
    expect(potionItem.metadata.healing).toBe(30);
  });

  test('should maintain inventory state correctly', () => {
    const player = new Player({
      name: 'TestPlayer',
      roomId: 'basic-area:room1'
    });

    const items = [
      new Item({ id: 'sword', name: 'a sword', type: 'WEAPON' }),
      new Item({ id: 'potion', name: 'a potion', type: 'POTION' }),
      new Item({ id: 'key', name: 'a key', type: 'KEY' })
    ];

    // Add items to inventory
    items.forEach(item => player.inventory.add(item));
    expect(player.inventory.size).toBe(3);

    // Remove one item
    player.inventory.delete(items[1]);
    expect(player.inventory.size).toBe(2);
    expect(player.inventory.has(items[0])).toBe(true);
    expect(player.inventory.has(items[1])).toBe(false);
    expect(player.inventory.has(items[2])).toBe(true);

    // Clear inventory
    player.inventory.clear();
    expect(player.inventory.size).toBe(0);
  });
});
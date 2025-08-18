const path = require('path');

describe('Inventory Mechanics', () => {
  let Room, Item, Player;

  beforeAll(() => {
    // Define test classes that simulate the game entities
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
        player.room = this;
      }

      removePlayer(player) {
        this.players.delete(player);
        if (player.room === this) {
          player.room = null;
        }
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
        this.room = null;
        this.saveCallCount = 0;
        
        if (data.inventory) {
          data.inventory.forEach(itemData => {
            this.inventory.add(new TestItem(itemData));
          });
        }
      }

      save() {
        this.saveCallCount++;
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

  describe('Take Mechanics', () => {
    test('should successfully take item from room to inventory', () => {
      const room = new Room({
        id: 'testroom',
        title: 'Test Room',
        description: 'A test room'
      });

      const item = new Item({
        id: 'sword',
        name: 'a rusty sword',
        description: 'An old sword',
        type: 'WEAPON',
        metadata: { weight: 5 }
      });

      const player = new Player({
        name: 'TestPlayer',
        roomId: 'basic-area:testroom'
      });

      room.addItem(item);
      room.addPlayer(player);

      // Simulate take operation
      const result = simulateTakeItem(player, room, 'sword');

      expect(result.success).toBe(true);
      expect(result.message).toBe('You take a rusty sword.');
      expect(room.items.has(item)).toBe(false);
      expect(player.inventory.has(item)).toBe(true);
      expect(player.inventory.size).toBe(1);
    });

    test('should handle inventory capacity limit', () => {
      const room = new Room({
        id: 'testroom',
        title: 'Test Room',
        description: 'A test room'
      });

      const item = new Item({
        id: 'sword',
        name: 'a sword',
        type: 'WEAPON'
      });

      const player = new Player({ name: 'TestPlayer' });
      room.addItem(item);
      room.addPlayer(player);

      // Fill inventory to capacity (20 items)
      for (let i = 0; i < 20; i++) {
        player.inventory.add(new Item({
          id: `item${i}`,
          name: `item ${i}`,
          type: 'MISC'
        }));
      }

      const result = simulateTakeItem(player, room, 'sword');

      expect(result.success).toBe(false);
      expect(result.message).toBe('Your inventory is full. You cannot carry any more items.');
      expect(room.items.has(item)).toBe(true);
      expect(player.inventory.has(item)).toBe(false);
    });

    test('should handle weight limit', () => {
      const room = new Room({
        id: 'testroom',
        title: 'Test Room',
        description: 'A test room'
      });

      const heavyItem = new Item({
        id: 'boulder',
        name: 'a heavy boulder',
        type: 'MISC',
        metadata: { weight: 50 }
      });

      const player = new Player({ name: 'TestPlayer' });
      room.addItem(heavyItem);
      room.addPlayer(player);

      // Add items to reach near weight limit (100 lbs total)
      player.inventory.add(new Item({
        id: 'heavy1',
        name: 'heavy item 1',
        type: 'MISC',
        metadata: { weight: 60 }
      }));

      const result = simulateTakeItem(player, room, 'boulder');

      expect(result.success).toBe(false);
      expect(result.message).toBe('a heavy boulder is too heavy. You cannot carry any more weight.');
      expect(room.items.has(heavyItem)).toBe(true);
      expect(player.inventory.has(heavyItem)).toBe(false);
    });

    test('should handle fixed items', () => {
      const room = new Room({
        id: 'testroom',
        title: 'Test Room',
        description: 'A test room'
      });

      const fixedItem = new Item({
        id: 'statue',
        name: 'a stone statue',
        type: 'MISC',
        metadata: { fixed: true }
      });

      const player = new Player({ name: 'TestPlayer' });
      room.addItem(fixedItem);
      room.addPlayer(player);

      const result = simulateTakeItem(player, room, 'statue');

      expect(result.success).toBe(false);
      expect(result.message).toBe('You cannot take a stone statue.');
      expect(room.items.has(fixedItem)).toBe(true);
      expect(player.inventory.has(fixedItem)).toBe(false);
    });

    test('should find items by partial name match', () => {
      const room = new Room({
        id: 'testroom',
        title: 'Test Room',
        description: 'A test room'
      });

      const item = new Item({
        id: 'rusty_sword',
        name: 'a rusty iron sword',
        type: 'WEAPON'
      });

      const player = new Player({ name: 'TestPlayer' });
      room.addItem(item);
      room.addPlayer(player);

      const result = simulateTakeItem(player, room, 'rusty');

      expect(result.success).toBe(true);
      expect(result.message).toBe('You take a rusty iron sword.');
      expect(room.items.has(item)).toBe(false);
      expect(player.inventory.has(item)).toBe(true);
    });

    test('should handle item not found', () => {
      const room = new Room({
        id: 'testroom',
        title: 'Test Room',
        description: 'A test room'
      });

      const player = new Player({ name: 'TestPlayer' });
      room.addPlayer(player);

      const result = simulateTakeItem(player, room, 'nonexistent');

      expect(result.success).toBe(false);
      expect(result.message).toBe("You don't see 'nonexistent' here.");
    });
  });

  describe('Drop Mechanics', () => {
    test('should successfully drop item from inventory to room', () => {
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

      player.inventory.add(item);
      room.addPlayer(player);

      const result = simulateDropItem(player, room, 'sword');

      expect(result.success).toBe(true);
      expect(result.message).toBe('You drop a rusty sword.');
      expect(player.inventory.has(item)).toBe(false);
      expect(room.items.has(item)).toBe(true);
      expect(room.items.size).toBe(1);
    });

    test('should handle empty inventory', () => {
      const room = new Room({
        id: 'testroom',
        title: 'Test Room',
        description: 'A test room'
      });

      const player = new Player({ name: 'TestPlayer' });
      player.inventory.clear();
      room.addPlayer(player);

      const result = simulateDropItem(player, room, 'sword');

      expect(result.success).toBe(false);
      expect(result.message).toBe('You are not carrying anything.');
    });

    test('should handle nodrop items', () => {
      const room = new Room({
        id: 'testroom',
        title: 'Test Room',
        description: 'A test room'
      });

      const cursedItem = new Item({
        id: 'cursed_ring',
        name: 'a cursed ring',
        type: 'JEWELRY',
        metadata: { nodrop: true }
      });

      const player = new Player({ name: 'TestPlayer' });
      player.inventory.add(cursedItem);
      room.addPlayer(player);

      const result = simulateDropItem(player, room, 'ring');

      expect(result.success).toBe(false);
      expect(result.message).toBe('You cannot drop a cursed ring.');
      expect(player.inventory.has(cursedItem)).toBe(true);
      expect(room.items.has(cursedItem)).toBe(false);
    });

    test('should handle item not in inventory', () => {
      const room = new Room({
        id: 'testroom',
        title: 'Test Room',
        description: 'A test room'
      });

      const player = new Player({ name: 'TestPlayer' });
      // Add a different item to inventory so it's not empty
      player.inventory.add(new Item({
        id: 'other_item',
        name: 'some other item',
        type: 'MISC'
      }));
      room.addPlayer(player);

      const result = simulateDropItem(player, room, 'nonexistent');

      expect(result.success).toBe(false);
      expect(result.message).toBe("You don't have 'nonexistent' in your inventory.");
    });

    test('should find items by partial name match', () => {
      const room = new Room({
        id: 'testroom',
        title: 'Test Room',
        description: 'A test room'
      });

      const item = new Item({
        id: 'rusty_sword',
        name: 'a rusty iron sword',
        type: 'WEAPON'
      });

      const player = new Player({ name: 'TestPlayer' });
      player.inventory.add(item);
      room.addPlayer(player);

      const result = simulateDropItem(player, room, 'rusty');

      expect(result.success).toBe(true);
      expect(result.message).toBe('You drop a rusty iron sword.');
      expect(player.inventory.has(item)).toBe(false);
      expect(room.items.has(item)).toBe(true);
    });
  });

  describe('Integration Tests', () => {
    test('should handle take and drop sequence', () => {
      const room = new Room({
        id: 'testroom',
        title: 'Test Room',
        description: 'A test room'
      });

      const item = new Item({
        id: 'sword',
        name: 'a sword',
        type: 'WEAPON'
      });

      const player = new Player({ name: 'TestPlayer' });
      room.addItem(item);
      room.addPlayer(player);

      // Take the item
      const takeResult = simulateTakeItem(player, room, 'sword');
      expect(takeResult.success).toBe(true);
      expect(room.items.has(item)).toBe(false);
      expect(player.inventory.has(item)).toBe(true);

      // Drop the item
      const dropResult = simulateDropItem(player, room, 'sword');
      expect(dropResult.success).toBe(true);
      expect(player.inventory.has(item)).toBe(false);
      expect(room.items.has(item)).toBe(true);
    });

    test('should handle multiple items with similar names', () => {
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

      const player = new Player({ name: 'TestPlayer' });
      items.forEach(item => room.addItem(item));
      room.addPlayer(player);

      // Take first sword found (should be rusty sword)
      const result = simulateTakeItem(player, room, 'sword');

      expect(result.success).toBe(true);
      const takenItem = Array.from(player.inventory).find(item => 
        item.name.includes('sword')
      );
      expect(takenItem).toBeDefined();
      expect(player.inventory.size).toBe(1);
      expect(room.items.size).toBe(2);
    });
  });
});

// Helper functions that simulate the take/drop logic
function simulateTakeItem(player, room, target) {
  if (!target || target.trim() === '') {
    return { success: false, message: 'Take what?' };
  }

  const targetLower = target.trim().toLowerCase();
  
  if (!room) {
    return { success: false, message: 'You are not in a valid location.' };
  }

  // Find the item in the room
  const item = findItemInRoom(room, targetLower);
  if (!item) {
    return { success: false, message: `You don't see '${target}' here.` };
  }

  // Check inventory capacity (default limit of 20 items)
  const inventoryLimit = 20;
  if (player.inventory && player.inventory.size >= inventoryLimit) {
    return { success: false, message: 'Your inventory is full. You cannot carry any more items.' };
  }

  // Check if item can be taken (some items might be fixed)
  if (item.metadata && item.metadata.fixed) {
    return { success: false, message: `You cannot take ${item.name}.` };
  }

  // Check weight limit (optional - default 100 lbs capacity)
  const weightLimit = 100;
  const currentWeight = calculateInventoryWeight(player);
  const itemWeight = item.metadata ? (item.metadata.weight || 0) : 0;
  
  if (currentWeight + itemWeight > weightLimit) {
    return { success: false, message: `${item.name} is too heavy. You cannot carry any more weight.` };
  }

  // Take the item
  room.removeItem(item);
  
  // Initialize inventory if it doesn't exist
  if (!player.inventory) {
    player.inventory = new Set();
  }
  
  player.inventory.add(item);

  return { success: true, message: `You take ${item.name}.` };
}

function simulateDropItem(player, room, target) {
  if (!target || target.trim() === '') {
    return { success: false, message: 'Drop what?' };
  }

  const targetLower = target.trim().toLowerCase();
  
  if (!room) {
    return { success: false, message: 'You are not in a valid location.' };
  }

  // Check if player has inventory
  if (!player.inventory || player.inventory.size === 0) {
    return { success: false, message: 'You are not carrying anything.' };
  }

  // Find the item in inventory
  const item = findItemInInventory(player, targetLower);
  if (!item) {
    return { success: false, message: `You don't have '${target}' in your inventory.` };
  }

  // Check if item can be dropped (some items might be cursed or bound)
  if (item.metadata && item.metadata.nodrop) {
    return { success: false, message: `You cannot drop ${item.name}.` };
  }

  // Drop the item
  player.inventory.delete(item);
  room.addItem(item);

  return { success: true, message: `You drop ${item.name}.` };
}

function findItemInRoom(room, target) {
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

function findItemInInventory(player, target) {
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

function calculateInventoryWeight(player) {
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
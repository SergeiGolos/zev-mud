const path = require('path');

describe('Inventory Management System', () => {
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
        this.equipment = {};
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

  describe('Inventory Display', () => {
    test('should display empty inventory message', () => {
      const player = new Player({ name: 'TestPlayer' });
      player.inventory.clear();

      const result = simulateInventoryCommand(player);

      expect(result.success).toBe(true);
      expect(result.message).toBe('You are not carrying anything.');
    });

    test('should display inventory with single item', () => {
      const player = new Player({ name: 'TestPlayer' });
      const item = new Item({
        id: 'sword',
        name: 'a rusty sword',
        type: 'WEAPON',
        metadata: { weight: 8 }
      });

      player.inventory.add(item);

      const result = simulateInventoryCommand(player);

      expect(result.success).toBe(true);
      expect(result.message).toContain('You are carrying:');
      expect(result.message).toContain('Weapons:');
      expect(result.message).toContain('a rusty sword');
      expect(result.message).toContain('Total items: 1/20');
      expect(result.message).toContain('Total weight: 8.0/100.0 lbs');
    });

    test('should group identical items and show quantities', () => {
      const player = new Player({ name: 'TestPlayer' });
      
      // Add multiple identical items
      for (let i = 0; i < 3; i++) {
        player.inventory.add(new Item({
          id: 'health_potion',
          name: 'a health potion',
          type: 'POTION',
          metadata: { weight: 1 }
        }));
      }

      const result = simulateInventoryCommand(player);

      expect(result.success).toBe(true);
      expect(result.message).toContain('a health potion (3)');
      expect(result.message).toContain('Total items: 3/20');
      expect(result.message).toContain('Total weight: 3.0/100.0 lbs');
    });

    test('should categorize items by type', () => {
      const player = new Player({ name: 'TestPlayer' });
      
      const items = [
        new Item({ id: 'sword', name: 'a sword', type: 'WEAPON', metadata: { weight: 8 } }),
        new Item({ id: 'armor', name: 'leather armor', type: 'ARMOR', metadata: { weight: 15 } }),
        new Item({ id: 'potion', name: 'a health potion', type: 'POTION', metadata: { weight: 1 } }),
        new Item({ id: 'bread', name: 'a loaf of bread', type: 'FOOD', metadata: { weight: 2 } })
      ];

      items.forEach(item => player.inventory.add(item));

      const result = simulateInventoryCommand(player);

      expect(result.success).toBe(true);
      expect(result.message).toContain('Weapons:');
      expect(result.message).toContain('Armor & Shields:');
      expect(result.message).toContain('Potions:');
      expect(result.message).toContain('Food & Drink:');
    });

    test('should show equipped items in inventory', () => {
      const player = new Player({ name: 'TestPlayer' });
      const weapon = new Item({
        id: 'sword',
        name: 'a sword',
        type: 'WEAPON',
        metadata: { weight: 8 }
      });

      player.inventory.add(weapon);
      player.equipment.weapon = weapon;

      const result = simulateInventoryCommand(player);

      expect(result.success).toBe(true);
      expect(result.message).toContain('a sword [equipped]');
    });

    test('should show capacity warnings', () => {
      const player = new Player({ name: 'TestPlayer' });
      
      // Add items near capacity limit
      for (let i = 0; i < 19; i++) {
        player.inventory.add(new Item({
          id: `item${i}`,
          name: `item ${i}`,
          type: 'MISC',
          metadata: { weight: 1 }
        }));
      }

      const result = simulateInventoryCommand(player);

      expect(result.success).toBe(true);
      expect(result.message).toContain('Your inventory is nearly full!');
    });

    test('should show weight warnings', () => {
      const player = new Player({ name: 'TestPlayer' });
      
      // Add heavy item near weight limit
      player.inventory.add(new Item({
        id: 'heavy_item',
        name: 'a heavy item',
        type: 'MISC',
        metadata: { weight: 95 }
      }));

      const result = simulateInventoryCommand(player);

      expect(result.success).toBe(true);
      expect(result.message).toContain('You are carrying a heavy load!');
    });
  });

  describe('Equipment System', () => {
    test('should equip weapon successfully', () => {
      const player = new Player({ name: 'TestPlayer' });
      const weapon = new Item({
        id: 'sword',
        name: 'a sword',
        type: 'WEAPON',
        metadata: { damage: 10 }
      });

      player.inventory.add(weapon);

      const result = simulateEquipCommand(player, 'sword');

      expect(result.success).toBe(true);
      expect(result.message).toBe('You wield a sword.');
      expect(player.equipment.weapon).toBe(weapon);
    });

    test('should equip armor to correct slot', () => {
      const player = new Player({ name: 'TestPlayer' });
      const armor = new Item({
        id: 'leather_armor',
        name: 'leather armor',
        type: 'ARMOR',
        metadata: { slot: 'chest', defense: 5 }
      });

      player.inventory.add(armor);

      const result = simulateEquipCommand(player, 'armor');

      expect(result.success).toBe(true);
      expect(result.message).toBe('You wear leather armor.');
      expect(player.equipment.chest).toBe(armor);
    });

    test('should prevent equipping when slot is occupied', () => {
      const player = new Player({ name: 'TestPlayer' });
      const weapon1 = new Item({
        id: 'sword1',
        name: 'a rusty sword',
        type: 'WEAPON'
      });
      const weapon2 = new Item({
        id: 'sword2',
        name: 'an iron sword',
        type: 'WEAPON'
      });

      player.inventory.add(weapon1);
      player.inventory.add(weapon2);
      player.equipment.weapon = weapon1;

      const result = simulateEquipCommand(player, 'iron');

      expect(result.success).toBe(false);
      expect(result.message).toContain('You are already wearing a rusty sword on your weapon');
    });

    test('should prevent equipping non-equipable items', () => {
      const player = new Player({ name: 'TestPlayer' });
      const potion = new Item({
        id: 'potion',
        name: 'a health potion',
        type: 'POTION'
      });

      player.inventory.add(potion);

      const result = simulateEquipCommand(player, 'potion');

      expect(result.success).toBe(false);
      expect(result.message).toBe('You cannot equip a health potion.');
    });

    test('should unequip item successfully', () => {
      const player = new Player({ name: 'TestPlayer' });
      const weapon = new Item({
        id: 'sword',
        name: 'a sword',
        type: 'WEAPON'
      });

      player.equipment.weapon = weapon;

      const result = simulateUnequipCommand(player, 'sword');

      expect(result.success).toBe(true);
      expect(result.message).toBe('You unwield a sword.');
      expect(player.equipment.weapon).toBeUndefined();
      expect(player.inventory.has(weapon)).toBe(true);
    });

    test('should prevent unequipping cursed items', () => {
      const player = new Player({ name: 'TestPlayer' });
      const cursedRing = new Item({
        id: 'cursed_ring',
        name: 'a cursed ring',
        type: 'ARMOR',
        metadata: { cursed: true, slot: 'finger' }
      });

      player.equipment.finger = cursedRing;

      const result = simulateUnequipCommand(player, 'ring');

      expect(result.success).toBe(false);
      expect(result.message).toContain('You cannot remove a cursed ring. It appears to be cursed!');
      expect(player.equipment.finger).toBe(cursedRing);
    });

    test('should display equipment status', () => {
      const player = new Player({ name: 'TestPlayer' });
      const weapon = new Item({
        id: 'sword',
        name: 'a sword',
        type: 'WEAPON',
        metadata: { damage: 10 }
      });
      const armor = new Item({
        id: 'armor',
        name: 'leather armor',
        type: 'ARMOR',
        metadata: { defense: 5, slot: 'chest' }
      });

      player.equipment.weapon = weapon;
      player.equipment.chest = armor;

      const result = simulateEquipmentCommand(player);

      expect(result.success).toBe(true);
      expect(result.message).toContain('You are currently equipped with:');
      expect(result.message).toContain('Wielded: a sword (+10 damage)');
      expect(result.message).toContain('Chest: leather armor (+5 defense)');
      expect(result.message).toContain('Total damage bonus: +10');
      expect(result.message).toContain('Total defense bonus: +5');
    });

    test('should display empty equipment message', () => {
      const player = new Player({ name: 'TestPlayer' });

      const result = simulateEquipmentCommand(player);

      expect(result.success).toBe(true);
      expect(result.message).toBe('You are not wearing or wielding anything.');
    });
  });

  describe('Item Usage System', () => {
    test('should use health potion successfully', () => {
      const player = new Player({ name: 'TestPlayer' });
      player.attributes.health = 50; // Damaged health
      
      const potion = new Item({
        id: 'health_potion',
        name: 'a health potion',
        type: 'POTION',
        metadata: { healing: 30 }
      });

      player.inventory.add(potion);

      const result = simulateUseCommand(player, 'potion');

      expect(result.success).toBe(true);
      expect(result.message).toContain('You drink a health potion and restored 30 health.');
      expect(player.attributes.health).toBe(80);
      expect(player.inventory.has(potion)).toBe(false); // Item consumed
    });

    test('should not overheal with health potion', () => {
      const player = new Player({ name: 'TestPlayer' });
      player.attributes.health = 90; // Near full health
      
      const potion = new Item({
        id: 'health_potion',
        name: 'a health potion',
        type: 'POTION',
        metadata: { healing: 30 }
      });

      player.inventory.add(potion);

      const result = simulateUseCommand(player, 'potion');

      expect(result.success).toBe(true);
      expect(result.message).toContain('You drink a health potion and restored 10 health.');
      expect(player.attributes.health).toBe(100);
    });

    test('should use food item successfully', () => {
      const player = new Player({ name: 'TestPlayer' });
      player.attributes.stamina = 50; // Low stamina
      
      const bread = new Item({
        id: 'bread',
        name: 'a loaf of bread',
        type: 'FOOD',
        metadata: { nutrition: 20 }
      });

      player.inventory.add(bread);

      const result = simulateUseCommand(player, 'bread');

      expect(result.success).toBe(true);
      expect(result.message).toContain('You eat a loaf of bread and restored 20 stamina.');
      expect(player.attributes.stamina).toBe(70);
      expect(player.inventory.has(bread)).toBe(false); // Item consumed
    });

    test('should use scroll with sufficient mana', () => {
      const player = new Player({ name: 'TestPlayer' });
      player.attributes.mana = 20; // Sufficient mana
      
      const scroll = new Item({
        id: 'spell_scroll',
        name: 'a spell scroll',
        type: 'SCROLL',
        metadata: { spell: 'magic_missile' }
      });

      player.inventory.add(scroll);

      const result = simulateUseCommand(player, 'scroll');

      expect(result.success).toBe(true);
      expect(result.message).toContain('You read a spell scroll. Magical energy crackles around you briefly.');
      expect(player.attributes.mana).toBe(10); // 10 mana consumed
      expect(player.inventory.has(scroll)).toBe(false); // Item consumed
    });

    test('should fail to use scroll with insufficient mana', () => {
      const player = new Player({ name: 'TestPlayer' });
      player.attributes.mana = 5; // Insufficient mana
      
      const scroll = new Item({
        id: 'spell_scroll',
        name: 'a spell scroll',
        type: 'SCROLL',
        metadata: { spell: 'magic_missile' }
      });

      player.inventory.add(scroll);

      const result = simulateUseCommand(player, 'scroll');

      expect(result.success).toBe(false);
      expect(result.message).toContain("You don't have enough mana to use a spell scroll. You need 10 mana.");
      expect(player.attributes.mana).toBe(5); // Mana unchanged
      expect(player.inventory.has(scroll)).toBe(true); // Item not consumed
    });

    test('should prevent using non-usable items', () => {
      const player = new Player({ name: 'TestPlayer' });
      
      const weapon = new Item({
        id: 'sword',
        name: 'a sword',
        type: 'WEAPON'
      });

      player.inventory.add(weapon);

      const result = simulateUseCommand(player, 'sword');

      expect(result.success).toBe(false);
      expect(result.message).toBe('You cannot use a sword.');
    });

    test('should handle healing scroll', () => {
      const player = new Player({ name: 'TestPlayer' });
      player.attributes.health = 50;
      player.attributes.mana = 20;
      
      const healScroll = new Item({
        id: 'heal_scroll',
        name: 'a healing scroll',
        type: 'SCROLL',
        metadata: { spell: 'heal' }
      });

      player.inventory.add(healScroll);

      const result = simulateUseCommand(player, 'heal');

      expect(result.success).toBe(true);
      expect(result.message).toContain('You feel magical healing energy flow through you, restoring 25 health.');
      expect(player.attributes.health).toBe(75);
      expect(player.attributes.mana).toBe(10);
    });
  });

  describe('Integration Tests', () => {
    test('should handle complete equipment workflow', () => {
      const player = new Player({ name: 'TestPlayer' });
      const weapon = new Item({
        id: 'sword',
        name: 'a sword',
        type: 'WEAPON',
        metadata: { damage: 10 }
      });

      player.inventory.add(weapon);

      // Equip the weapon
      const equipResult = simulateEquipCommand(player, 'sword');
      expect(equipResult.success).toBe(true);
      expect(player.equipment.weapon).toBe(weapon);

      // Check inventory shows equipped item
      const invResult = simulateInventoryCommand(player);
      expect(invResult.message).toContain('a sword [equipped]');

      // Check equipment display
      const eqResult = simulateEquipmentCommand(player);
      expect(eqResult.message).toContain('Wielded: a sword (+10 damage)');

      // Unequip the weapon
      const unequipResult = simulateUnequipCommand(player, 'sword');
      expect(unequipResult.success).toBe(true);
      expect(player.equipment.weapon).toBeUndefined();
      expect(player.inventory.has(weapon)).toBe(true);
    });

    test('should handle inventory limits during unequip', () => {
      const player = new Player({ name: 'TestPlayer' });
      const weapon = new Item({
        id: 'sword',
        name: 'a sword',
        type: 'WEAPON'
      });

      // Fill inventory to capacity
      for (let i = 0; i < 20; i++) {
        player.inventory.add(new Item({
          id: `item${i}`,
          name: `item ${i}`,
          type: 'MISC'
        }));
      }

      player.equipment.weapon = weapon;

      const result = simulateUnequipCommand(player, 'sword');

      expect(result.success).toBe(false);
      expect(result.message).toBe('Your inventory is full. You cannot unequip items right now.');
      expect(player.equipment.weapon).toBe(weapon);
    });
  });
});

// Helper functions that simulate the command logic
function simulateInventoryCommand(player) {
  if (!player.inventory || player.inventory.size === 0) {
    return { success: true, message: 'You are not carrying anything.' };
  }

  // Group items by type and count quantities
  const itemGroups = groupInventoryItems(player.inventory);
  
  let output = ['You are carrying:'];
  
  // Calculate total weight and count
  let totalWeight = 0;
  let totalItems = 0;
  
  // Display items by category
  const categories = ['WEAPON', 'ARMOR', 'POTION', 'FOOD', 'SCROLL', 'KEY', 'LIGHT', 'CURRENCY', 'GEM', 'BOOK', 'CONTAINER', 'MISC'];
  
  for (const category of categories) {
    if (itemGroups[category] && itemGroups[category].length > 0) {
      output.push(`\n${getCategoryDisplayName(category)}:`);
      
      for (const group of itemGroups[category]) {
        const item = group.items[0];
        const quantity = group.quantity;
        const weight = (item.metadata?.weight || 0) * quantity;
        
        totalWeight += weight;
        totalItems += quantity;
        
        let itemLine = `  ${item.name}`;
        if (quantity > 1) {
          itemLine += ` (${quantity})`;
        }
        
        // Show if item is equipped
        if (isItemEquipped(player, item)) {
          itemLine += ' [equipped]';
        }
        
        output.push(itemLine);
      }
    }
  }
  
  // Add summary
  output.push(`\nTotal items: ${totalItems}/20`);
  output.push(`Total weight: ${totalWeight.toFixed(1)}/100.0 lbs`);
  
  // Show capacity warnings
  if (totalItems >= 18) {
    output.push('Your inventory is nearly full!');
  }
  if (totalWeight >= 90) {
    output.push('You are carrying a heavy load!');
  }
  
  return { success: true, message: output.join('\n') };
}

function simulateEquipCommand(player, target) {
  if (!target || target.trim() === '') {
    return { success: false, message: 'Equip what?' };
  }

  const targetLower = target.trim().toLowerCase();
  
  // Check if player has inventory
  if (!player.inventory || player.inventory.size === 0) {
    return { success: false, message: 'You are not carrying anything to equip.' };
  }

  // Find the item in inventory
  const item = findItemInInventory(player, targetLower);
  if (!item) {
    return { success: false, message: `You don't have '${target}' in your inventory.` };
  }

  // Check if item can be equipped
  if (!canEquipItem(item)) {
    return { success: false, message: `You cannot equip ${item.name}.` };
  }

  // Initialize equipment if it doesn't exist
  if (!player.equipment) {
    player.equipment = {};
  }

  // Determine equipment slot
  const slot = getEquipmentSlot(item);
  if (!slot) {
    return { success: false, message: `${item.name} cannot be equipped.` };
  }

  // Check if slot is already occupied
  if (player.equipment[slot]) {
    const currentItem = player.equipment[slot];
    return { success: false, message: `You are already wearing ${currentItem.name} on your ${slot}. Unequip it first.` };
  }

  // Equip the item
  player.equipment[slot] = item;

  // Get appropriate verb
  const equipVerb = getEquipVerb(item.type);
  return { success: true, message: `You ${equipVerb} ${item.name}.` };
}

function simulateUnequipCommand(player, target) {
  if (!target || target.trim() === '') {
    return { success: false, message: 'Unequip what?' };
  }

  const targetLower = target.trim().toLowerCase();
  
  // Check if player has equipment
  if (!player.equipment || Object.keys(player.equipment).length === 0) {
    return { success: false, message: 'You are not wearing or wielding anything.' };
  }

  // Find the item in equipment
  const { item, slot } = findItemInEquipment(player, targetLower);
  if (!item) {
    return { success: false, message: `You are not wearing or wielding '${target}'.` };
  }

  // Check if item can be unequipped (cursed items, etc.)
  if (item.metadata && item.metadata.cursed) {
    return { success: false, message: `You cannot remove ${item.name}. It appears to be cursed!` };
  }

  // Check inventory space
  const inventoryLimit = 20;
  if (player.inventory && player.inventory.size >= inventoryLimit) {
    return { success: false, message: 'Your inventory is full. You cannot unequip items right now.' };
  }

  // Unequip the item
  delete player.equipment[slot];
  
  // Add to inventory if it exists, otherwise create it
  if (!player.inventory) {
    player.inventory = new Set();
  }
  player.inventory.add(item);

  // Get appropriate verb
  const unequipVerb = getUnequipVerb(item.type);
  return { success: true, message: `You ${unequipVerb} ${item.name}.` };
}

function simulateEquipmentCommand(player) {
  if (!player.equipment || Object.keys(player.equipment).length === 0) {
    return { success: true, message: 'You are not wearing or wielding anything.' };
  }

  let output = ['You are currently equipped with:'];
  
  // Define equipment slots in display order
  const slotOrder = ['weapon', 'shield', 'head', 'chest', 'legs', 'feet', 'hands', 'arms', 'neck', 'finger'];
  const slotNames = {
    'weapon': 'Wielded',
    'shield': 'Shield',
    'head': 'Head',
    'chest': 'Chest',
    'legs': 'Legs',
    'feet': 'Feet',
    'hands': 'Hands',
    'arms': 'Arms',
    'neck': 'Neck',
    'finger': 'Finger'
  };

  let totalDefense = 0;
  let totalDamage = 0;
  
  for (const slot of slotOrder) {
    if (player.equipment[slot]) {
      const item = player.equipment[slot];
      const slotName = slotNames[slot] || slot;
      
      let itemLine = `  ${slotName}: ${item.name}`;
      
      // Add item stats
      const stats = [];
      if (item.metadata?.damage) {
        stats.push(`+${item.metadata.damage} damage`);
        totalDamage += item.metadata.damage;
      }
      if (item.metadata?.defense) {
        stats.push(`+${item.metadata.defense} defense`);
        totalDefense += item.metadata.defense;
      }
      if (item.metadata?.durability) {
        stats.push(`${item.metadata.durability}% durability`);
      }
      
      if (stats.length > 0) {
        itemLine += ` (${stats.join(', ')})`;
      }
      
      output.push(itemLine);
    }
  }
  
  // Add summary stats
  if (totalDamage > 0 || totalDefense > 0) {
    output.push('');
    if (totalDamage > 0) {
      output.push(`Total damage bonus: +${totalDamage}`);
    }
    if (totalDefense > 0) {
      output.push(`Total defense bonus: +${totalDefense}`);
    }
  }
  
  return { success: true, message: output.join('\n') };
}

function simulateUseCommand(player, target) {
  if (!target || target.trim() === '') {
    return { success: false, message: 'Use what?' };
  }

  const targetLower = target.trim().toLowerCase();
  
  // Check if player has inventory
  if (!player.inventory || player.inventory.size === 0) {
    return { success: false, message: 'You are not carrying anything to use.' };
  }

  // Find the item in inventory
  const item = findItemInInventory(player, targetLower);
  if (!item) {
    return { success: false, message: `You don't have '${target}' in your inventory.` };
  }

  // Check if item can be used
  if (!canUseItem(item)) {
    return { success: false, message: `You cannot use ${item.name}.` };
  }

  // Use the item based on its type
  const result = useItem(player, item);
  
  if (result.success) {
    // Remove item from inventory if it's consumed
    if (result.consumed) {
      player.inventory.delete(item);
    }
    
    return { success: true, message: result.playerMessage };
  } else {
    return { success: false, message: result.message };
  }
}

// Helper functions
function groupInventoryItems(inventory) {
  const groups = {};
  
  for (const item of inventory) {
    const category = item.type || 'MISC';
    
    if (!groups[category]) {
      groups[category] = [];
    }
    
    // Find existing group for this item type
    const existingGroup = groups[category].find(group => 
      group.items[0].id === item.id
    );
    
    if (existingGroup) {
      existingGroup.items.push(item);
      existingGroup.quantity++;
    } else {
      groups[category].push({
        items: [item],
        quantity: 1
      });
    }
  }
  
  return groups;
}

function getCategoryDisplayName(category) {
  const displayNames = {
    'WEAPON': 'Weapons',
    'ARMOR': 'Armor & Shields',
    'POTION': 'Potions',
    'FOOD': 'Food & Drink',
    'SCROLL': 'Scrolls & Magic',
    'KEY': 'Keys',
    'LIGHT': 'Light Sources',
    'CURRENCY': 'Currency',
    'GEM': 'Gems & Jewelry',
    'BOOK': 'Books & Tomes',
    'CONTAINER': 'Containers',
    'MISC': 'Miscellaneous'
  };
  
  return displayNames[category] || 'Other Items';
}

function isItemEquipped(player, item) {
  if (!player.equipment) {
    return false;
  }
  
  // Check if item is in any equipment slot
  for (const slot in player.equipment) {
    if (player.equipment[slot] === item) {
      return true;
    }
  }
  
  return false;
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

function findItemInEquipment(player, target) {
  if (!player.equipment) {
    return { item: null, slot: null };
  }

  for (const slot in player.equipment) {
    const item = player.equipment[slot];
    if (item.name.toLowerCase().includes(target) || 
        item.id.toLowerCase().includes(target) ||
        item.name.toLowerCase() === target ||
        item.id.toLowerCase() === target) {
      return { item, slot };
    }
  }

  return { item: null, slot: null };
}

function canEquipItem(item) {
  const equipableTypes = ['WEAPON', 'ARMOR'];
  return equipableTypes.includes(item.type);
}

function getEquipmentSlot(item) {
  if (item.type === 'WEAPON') {
    return 'weapon';
  }
  
  if (item.type === 'ARMOR') {
    // Check metadata for specific slot
    if (item.metadata && item.metadata.slot) {
      return item.metadata.slot;
    }
    // Default armor slot
    return 'chest';
  }
  
  return null;
}

function getEquipVerb(itemType) {
  switch (itemType) {
    case 'WEAPON':
      return 'wield';
    case 'ARMOR':
      return 'wear';
    default:
      return 'equip';
  }
}

function getUnequipVerb(itemType) {
  switch (itemType) {
    case 'WEAPON':
      return 'unwield';
    case 'ARMOR':
      return 'remove';
    default:
      return 'unequip';
  }
}

function canUseItem(item) {
  const usableTypes = ['POTION', 'FOOD', 'SCROLL'];
  return usableTypes.includes(item.type);
}

function useItem(player, item) {
  switch (item.type) {
    case 'POTION':
      return usePotionItem(player, item);
    case 'FOOD':
      return useFoodItem(player, item);
    case 'SCROLL':
      return useScrollItem(player, item);
    default:
      return {
        success: false,
        message: `You cannot use ${item.name}.`
      };
  }
}

function usePotionItem(player, item) {
  // Initialize attributes if they don't exist
  if (!player.attributes) {
    player.attributes = { health: 100, mana: 50, stamina: 100 };
  }

  const healing = item.metadata?.healing || 0;
  const manaRestore = item.metadata?.mana || 0;
  const staminaRestore = item.metadata?.stamina || 0;

  let effects = [];
  
  if (healing > 0) {
    const currentHealth = player.attributes.health || 0;
    const maxHealth = 100; // Could be dynamic based on level
    const newHealth = Math.min(currentHealth + healing, maxHealth);
    const actualHealing = newHealth - currentHealth;
    
    player.attributes.health = newHealth;
    
    if (actualHealing > 0) {
      effects.push(`restored ${actualHealing} health`);
    } else {
      effects.push('but you are already at full health');
    }
  }
  
  if (manaRestore > 0) {
    const currentMana = player.attributes.mana || 0;
    const maxMana = 50; // Could be dynamic based on level
    const newMana = Math.min(currentMana + manaRestore, maxMana);
    const actualRestore = newMana - currentMana;
    
    player.attributes.mana = newMana;
    
    if (actualRestore > 0) {
      effects.push(`restored ${actualRestore} mana`);
    }
  }
  
  if (staminaRestore > 0) {
    const currentStamina = player.attributes.stamina || 0;
    const maxStamina = 100; // Could be dynamic based on level
    const newStamina = Math.min(currentStamina + staminaRestore, maxStamina);
    const actualRestore = newStamina - currentStamina;
    
    player.attributes.stamina = newStamina;
    
    if (actualRestore > 0) {
      effects.push(`restored ${actualRestore} stamina`);
    }
  }

  const effectText = effects.length > 0 ? ` and ${effects.join(', ')}` : '';
  
  return {
    success: true,
    consumed: true,
    playerMessage: `You drink ${item.name}${effectText}.`,
    roomMessage: `${player.name} drinks ${item.name}.`
  };
}

function useFoodItem(player, item) {
  // Initialize attributes if they don't exist
  if (!player.attributes) {
    player.attributes = { health: 100, mana: 50, stamina: 100 };
  }

  const nutrition = item.metadata?.nutrition || 0;
  const healing = item.metadata?.healing || 0;

  let effects = [];
  
  if (nutrition > 0) {
    const currentStamina = player.attributes.stamina || 0;
    const maxStamina = 100;
    const newStamina = Math.min(currentStamina + nutrition, maxStamina);
    const actualRestore = newStamina - currentStamina;
    
    player.attributes.stamina = newStamina;
    
    if (actualRestore > 0) {
      effects.push(`restored ${actualRestore} stamina`);
    } else {
      effects.push('but you are not hungry');
    }
  }
  
  if (healing > 0) {
    const currentHealth = player.attributes.health || 0;
    const maxHealth = 100;
    const newHealth = Math.min(currentHealth + healing, maxHealth);
    const actualHealing = newHealth - currentHealth;
    
    player.attributes.health = newHealth;
    
    if (actualHealing > 0) {
      effects.push(`restored ${actualHealing} health`);
    }
  }

  const effectText = effects.length > 0 ? ` and ${effects.join(', ')}` : '';
  
  return {
    success: true,
    consumed: true,
    playerMessage: `You eat ${item.name}${effectText}.`,
    roomMessage: `${player.name} eats ${item.name}.`
  };
}

function useScrollItem(player, item) {
  const spell = item.metadata?.spell;
  
  if (!spell) {
    return {
      success: false,
      message: `${item.name} appears to be blank or unreadable.`
    };
  }

  // Initialize attributes if they don't exist
  if (!player.attributes) {
    player.attributes = { health: 100, mana: 50, stamina: 100 };
  }

  // Check if player has enough mana (scrolls require 10 mana to use)
  const manaCost = 10;
  const currentMana = player.attributes.mana || 0;
  
  if (currentMana < manaCost) {
    return {
      success: false,
      message: `You don't have enough mana to use ${item.name}. You need ${manaCost} mana.`
    };
  }

  // Consume mana
  player.attributes.mana = currentMana - manaCost;

  // Apply spell effect (simplified magic missile example)
  let spellEffect = '';
  switch (spell) {
    case 'magic_missile':
      spellEffect = 'Magical energy crackles around you briefly.';
      break;
    case 'heal':
      const currentHealth = player.attributes.health || 0;
      const maxHealth = 100;
      const healing = 25;
      const newHealth = Math.min(currentHealth + healing, maxHealth);
      const actualHealing = newHealth - currentHealth;
      player.attributes.health = newHealth;
      spellEffect = `You feel magical healing energy flow through you, restoring ${actualHealing} health.`;
      break;
    default:
      spellEffect = 'The scroll glows briefly with magical energy.';
  }
  
  return {
    success: true,
    consumed: true,
    playerMessage: `You read ${item.name}. ${spellEffect}`,
    roomMessage: `${player.name} reads ${item.name}. The scroll glows with magical energy.`
  };
}
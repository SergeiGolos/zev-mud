'use strict';

const { Broadcast } = require('ranvier');

module.exports = {
  aliases: ['inv', 'i'],
  usage: 'inventory',
  command: (state) => (args, player) => {
    if (!player.inventory || player.inventory.size === 0) {
      return Broadcast.sayAt(player, 'You are not carrying anything.');
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
    
    return Broadcast.sayAt(player, output.join('\n'));
  }
};

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
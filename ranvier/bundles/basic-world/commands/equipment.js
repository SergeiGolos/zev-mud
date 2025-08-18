'use strict';

const { Broadcast } = require('ranvier');

module.exports = {
  aliases: ['eq', 'worn'],
  usage: 'equipment',
  command: (state) => (args, player) => {
    if (!player.equipment || Object.keys(player.equipment).length === 0) {
      return Broadcast.sayAt(player, 'You are not wearing or wielding anything.');
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
    
    return Broadcast.sayAt(player, output.join('\n'));
  }
};
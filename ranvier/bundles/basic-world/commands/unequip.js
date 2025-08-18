'use strict';

const { Broadcast } = require('ranvier');

module.exports = {
  aliases: ['remove', 'unwield'],
  usage: 'unequip <item>',
  command: (state) => (args, player) => {
    if (!args || args.trim() === '') {
      return Broadcast.sayAt(player, 'Unequip what?');
    }

    const target = args.trim().toLowerCase();
    
    // Check if player has equipment
    if (!player.equipment || Object.keys(player.equipment).length === 0) {
      return Broadcast.sayAt(player, 'You are not wearing or wielding anything.');
    }

    // Find the item in equipment
    const { item, slot } = findItemInEquipment(player, target);
    if (!item) {
      return Broadcast.sayAt(player, `You are not wearing or wielding '${target}'.`);
    }

    // Check if item can be unequipped (cursed items, etc.)
    if (item.metadata && item.metadata.cursed) {
      return Broadcast.sayAt(player, `You cannot remove ${item.name}. It appears to be cursed!`);
    }

    // Check inventory space
    const inventoryLimit = 20;
    if (player.inventory && player.inventory.size >= inventoryLimit) {
      return Broadcast.sayAt(player, 'Your inventory is full. You cannot unequip items right now.');
    }

    // Unequip the item
    delete player.equipment[slot];
    
    // Add to inventory if it exists, otherwise create it
    if (!player.inventory) {
      player.inventory = new Set();
    }
    player.inventory.add(item);

    // Broadcast messages
    const unequipVerb = getUnequipVerb(item.type);
    Broadcast.sayAt(player, `You ${unequipVerb} ${item.name}.`);
    Broadcast.sayAtExcept(player.room, `${player.name} ${unequipVerb}s ${item.name}.`, player);

    // Save player state
    if (player.save) {
      player.save();
    }
  }
};

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
'use strict';

const { Broadcast } = require('ranvier');

module.exports = {
  aliases: ['wear', 'wield'],
  usage: 'equip <item>',
  command: (state) => (args, player) => {
    if (!args || args.trim() === '') {
      return Broadcast.sayAt(player, 'Equip what?');
    }

    const target = args.trim().toLowerCase();
    
    // Check if player has inventory
    if (!player.inventory || player.inventory.size === 0) {
      return Broadcast.sayAt(player, 'You are not carrying anything to equip.');
    }

    // Find the item in inventory
    const item = findItemInInventory(player, target);
    if (!item) {
      return Broadcast.sayAt(player, `You don't have '${target}' in your inventory.`);
    }

    // Check if item can be equipped
    if (!canEquipItem(item)) {
      return Broadcast.sayAt(player, `You cannot equip ${item.name}.`);
    }

    // Initialize equipment if it doesn't exist
    if (!player.equipment) {
      player.equipment = {};
    }

    // Determine equipment slot
    const slot = getEquipmentSlot(item);
    if (!slot) {
      return Broadcast.sayAt(player, `${item.name} cannot be equipped.`);
    }

    // Check if slot is already occupied
    if (player.equipment[slot]) {
      const currentItem = player.equipment[slot];
      return Broadcast.sayAt(player, `You are already wearing ${currentItem.name} on your ${slot}. Unequip it first.`);
    }

    // Equip the item
    player.equipment[slot] = item;

    // Broadcast messages
    const equipVerb = getEquipVerb(item.type);
    Broadcast.sayAt(player, `You ${equipVerb} ${item.name}.`);
    Broadcast.sayAtExcept(player.room, `${player.name} ${equipVerb}s ${item.name}.`, player);

    // Save player state
    if (player.save) {
      player.save();
    }
  }
};

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
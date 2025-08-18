'use strict';

const { Broadcast } = require('ranvier');

module.exports = {
  aliases: ['get', 'pick'],
  usage: 'take <item>',
  command: (state) => (args, player) => {
    if (!args || args.trim() === '') {
      return Broadcast.sayAt(player, 'Take what?');
    }

    const target = args.trim().toLowerCase();
    const room = player.room;
    
    if (!room) {
      return Broadcast.sayAt(player, 'You are not in a valid location.');
    }

    // Find the item in the room
    const item = findItemInRoom(room, target);
    if (!item) {
      return Broadcast.sayAt(player, `You don't see '${target}' here.`);
    }

    // Check inventory capacity (default limit of 20 items)
    const inventoryLimit = 20;
    if (player.inventory && player.inventory.size >= inventoryLimit) {
      return Broadcast.sayAt(player, 'Your inventory is full. You cannot carry any more items.');
    }

    // Check if item can be taken (some items might be fixed)
    if (item.metadata && item.metadata.fixed) {
      return Broadcast.sayAt(player, `You cannot take ${item.name}.`);
    }

    // Check weight limit (optional - default 100 lbs capacity)
    const weightLimit = 100;
    const currentWeight = calculateInventoryWeight(player);
    const itemWeight = item.metadata ? (item.metadata.weight || 0) : 0;
    
    if (currentWeight + itemWeight > weightLimit) {
      return Broadcast.sayAt(player, `${item.name} is too heavy. You cannot carry any more weight.`);
    }

    // Take the item
    room.removeItem(item);
    
    // Initialize inventory if it doesn't exist
    if (!player.inventory) {
      player.inventory = new Set();
    }
    
    player.inventory.add(item);

    // Broadcast messages
    Broadcast.sayAt(player, `You take ${item.name}.`);
    Broadcast.sayAtExcept(room, `${player.name} takes ${item.name}.`, player);

    // Save player state
    if (player.save) {
      player.save();
    }
  }
};

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
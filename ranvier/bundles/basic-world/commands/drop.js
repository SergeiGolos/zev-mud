'use strict';

const { Broadcast } = require('ranvier');

module.exports = {
  aliases: ['put'],
  usage: 'drop <item>',
  command: (state) => (args, player) => {
    if (!args || args.trim() === '') {
      return Broadcast.sayAt(player, 'Drop what?');
    }

    const target = args.trim().toLowerCase();
    const room = player.room;
    
    if (!room) {
      return Broadcast.sayAt(player, 'You are not in a valid location.');
    }

    // Check if player has inventory
    if (!player.inventory || player.inventory.size === 0) {
      return Broadcast.sayAt(player, 'You are not carrying anything.');
    }

    // Find the item in inventory
    const item = findItemInInventory(player, target);
    if (!item) {
      return Broadcast.sayAt(player, `You don't have '${target}' in your inventory.`);
    }

    // Check if item can be dropped (some items might be cursed or bound)
    if (item.metadata && item.metadata.nodrop) {
      return Broadcast.sayAt(player, `You cannot drop ${item.name}.`);
    }

    // Drop the item
    player.inventory.delete(item);
    room.addItem(item);

    // Broadcast messages
    Broadcast.sayAt(player, `You drop ${item.name}.`);
    Broadcast.sayAtExcept(room, `${player.name} drops ${item.name}.`, player);

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
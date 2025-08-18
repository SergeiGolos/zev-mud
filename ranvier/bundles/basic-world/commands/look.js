'use strict';

const { Broadcast } = require('ranvier');

module.exports = {
  aliases: ['l'],
  usage: 'look [target]',
  command: (state) => (args, player) => {
    if (!args || args.trim() === '') {
      // Look at current room
      return showRoom(player);
    }

    const target = args.trim().toLowerCase();
    
    // Look at specific target
    lookAtTarget(player, target);
  }
};

function showRoom(player) {
  const room = player.room;
  if (!room) {
    return Broadcast.sayAt(player, 'You are not in a valid location.');
  }

  // Show room title and description
  Broadcast.sayAt(player, `<bold><cyan>${room.title}</cyan></bold>`);
  Broadcast.sayAt(player, room.description);
  
  // Show exits
  if (room.exits && room.exits.length > 0) {
    const exitNames = room.exits.map(exit => exit.direction).join(', ');
    Broadcast.sayAt(player, `\r\n<bold><yellow>Exits:</yellow></bold> ${exitNames}`);
  } else {
    Broadcast.sayAt(player, `\r\n<bold><yellow>Exits:</yellow></bold> none`);
  }
  
  // Show items in room
  if (room.items && room.items.size > 0) {
    Broadcast.sayAt(player, '\r\n<bold><green>Items here:</green></bold>');
    for (const item of room.items) {
      Broadcast.sayAt(player, `  ${item.name}`);
    }
  }
  
  // Show NPCs in room
  if (room.npcs && room.npcs.size > 0) {
    Broadcast.sayAt(player, '');
    for (const npc of room.npcs) {
      const hostileIndicator = npc.hostile ? ' <red>(hostile)</red>' : '';
      Broadcast.sayAt(player, `${npc.name} is here${hostileIndicator}.`);
    }
  }
  
  // Show other players in room
  if (room.players && room.players.size > 1) {
    Broadcast.sayAt(player, '');
    for (const otherPlayer of room.players) {
      if (otherPlayer !== player) {
        Broadcast.sayAt(player, `<bold><blue>${otherPlayer.name}</blue></bold> is here.`);
      }
    }
  }
}

function lookAtTarget(player, target) {
  const room = player.room;
  if (!room) {
    return Broadcast.sayAt(player, 'You are not in a valid location.');
  }

  // Look at room (same as 'look' with no arguments)
  if (target === 'room' || target === 'here') {
    return showRoom(player);
  }

  // Look at items in room
  if (room.items && room.items.size > 0) {
    const item = Array.from(room.items).find(i => 
      i.name.toLowerCase().includes(target) ||
      i.id.toLowerCase().includes(target)
    );
    if (item) {
      Broadcast.sayAt(player, `<bold><cyan>${item.name}</cyan></bold>`);
      Broadcast.sayAt(player, item.description);
      return;
    }
  }

  // Look at NPCs in room
  if (room.npcs && room.npcs.size > 0) {
    const npc = Array.from(room.npcs).find(n => 
      n.name.toLowerCase().includes(target) ||
      n.id.toLowerCase().includes(target)
    );
    if (npc) {
      Broadcast.sayAt(player, `<bold><cyan>${npc.name}</cyan></bold>`);
      Broadcast.sayAt(player, npc.description);
      return;
    }
  }

  // Look at other players in room
  if (room.players && room.players.size > 1) {
    const otherPlayer = Array.from(room.players).find(p => 
      p !== player && p.name.toLowerCase().includes(target)
    );
    if (otherPlayer) {
      Broadcast.sayAt(player, `<bold><blue>${otherPlayer.name}</blue></bold> is a fellow adventurer.`);
      return;
    }
  }

  // Look at items in inventory
  if (player.inventory && player.inventory.size > 0) {
    const item = Array.from(player.inventory).find(i => 
      i.name.toLowerCase().includes(target) ||
      i.id.toLowerCase().includes(target)
    );
    if (item) {
      Broadcast.sayAt(player, `<bold><cyan>${item.name}</cyan></bold>`);
      Broadcast.sayAt(player, item.description);
      return;
    }
  }

  Broadcast.sayAt(player, `You don't see '${target}' here.`);
}
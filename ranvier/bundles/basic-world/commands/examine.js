'use strict';

const { Broadcast } = require('ranvier');

module.exports = {
  aliases: ['exam', 'ex'],
  usage: 'examine <target>',
  command: (state) => (args, player) => {
    if (!args || args.trim() === '') {
      return Broadcast.sayAt(player, 'Examine what?');
    }

    const target = args.trim().toLowerCase();
    examineTarget(player, target);
  }
};

function examineTarget(player, target) {
  const room = player.room;
  if (!room) {
    return Broadcast.sayAt(player, 'You are not in a valid location.');
  }

  // Examine items in room
  if (room.items && room.items.size > 0) {
    const item = Array.from(room.items).find(i => 
      i.name.toLowerCase().includes(target) ||
      i.id.toLowerCase().includes(target)
    );
    if (item) {
      return showDetailedItemInfo(player, item);
    }
  }

  // Examine NPCs in room
  if (room.npcs && room.npcs.size > 0) {
    const npc = Array.from(room.npcs).find(n => 
      n.name.toLowerCase().includes(target) ||
      n.id.toLowerCase().includes(target)
    );
    if (npc) {
      return showDetailedNPCInfo(player, npc);
    }
  }

  // Examine other players in room
  if (room.players && room.players.size > 1) {
    const otherPlayer = Array.from(room.players).find(p => 
      p !== player && p.name.toLowerCase().includes(target)
    );
    if (otherPlayer) {
      return showDetailedPlayerInfo(player, otherPlayer);
    }
  }

  // Examine items in inventory
  if (player.inventory && player.inventory.size > 0) {
    const item = Array.from(player.inventory).find(i => 
      i.name.toLowerCase().includes(target) ||
      i.id.toLowerCase().includes(target)
    );
    if (item) {
      return showDetailedItemInfo(player, item);
    }
  }

  // Examine room features
  if (target === 'room' || target === 'here') {
    return showDetailedRoomInfo(player);
  }

  Broadcast.sayAt(player, `You don't see '${target}' here to examine.`);
}

function showDetailedItemInfo(player, item) {
  Broadcast.sayAt(player, `<bold><cyan>${item.name}</cyan></bold>`);
  Broadcast.sayAt(player, item.description);
  
  if (item.metadata) {
    const details = [];
    
    if (item.type) {
      details.push(`<bold>Type:</bold> ${item.type}`);
    }
    
    if (item.metadata.weight) {
      details.push(`<bold>Weight:</bold> ${item.metadata.weight} lbs`);
    }
    
    if (item.metadata.value) {
      details.push(`<bold>Value:</bold> ${item.metadata.value} gold`);
    }
    
    if (item.metadata.damage) {
      details.push(`<bold>Damage:</bold> ${item.metadata.damage}`);
    }
    
    if (item.metadata.defense) {
      details.push(`<bold>Defense:</bold> ${item.metadata.defense}`);
    }
    
    if (item.metadata.healing) {
      details.push(`<bold>Healing:</bold> ${item.metadata.healing} HP`);
    }
    
    if (item.metadata.durability) {
      details.push(`<bold>Durability:</bold> ${item.metadata.durability}%`);
    }
    
    if (item.metadata.magical) {
      details.push(`<bold><magenta>Magical:</magenta></bold> Yes`);
    }
    
    if (details.length > 0) {
      Broadcast.sayAt(player, '');
      details.forEach(detail => Broadcast.sayAt(player, detail));
    }
  }
}

function showDetailedNPCInfo(player, npc) {
  Broadcast.sayAt(player, `<bold><cyan>${npc.name}</cyan></bold>`);
  Broadcast.sayAt(player, npc.description);
  
  if (npc.level) {
    Broadcast.sayAt(player, `\r\n<bold>Level:</bold> ${npc.level}`);
  }
  
  if (npc.hostile) {
    Broadcast.sayAt(player, `<bold><red>This creature appears hostile!</red></bold>`);
  } else {
    Broadcast.sayAt(player, `<bold><green>This creature seems peaceful.</green></bold>`);
  }
  
  // Show health status
  if (npc.attributes && npc.attributes.health) {
    const maxHealth = npc.attributes.maxHealth || npc.attributes.health;
    const healthPercent = (npc.attributes.health / maxHealth) * 100;
    let healthStatus = 'excellent condition';
    let healthColor = 'green';
    
    if (healthPercent < 25) {
      healthStatus = 'near death';
      healthColor = 'red';
    } else if (healthPercent < 50) {
      healthStatus = 'badly wounded';
      healthColor = 'red';
    } else if (healthPercent < 75) {
      healthStatus = 'wounded';
      healthColor = 'yellow';
    }
    
    Broadcast.sayAt(player, `<bold>Health:</bold> <${healthColor}>${healthStatus}</${healthColor}>`);
  }
  
  // Show stats if available
  if (npc.stats) {
    const statDetails = [];
    if (npc.stats.strength) statDetails.push(`STR: ${npc.stats.strength}`);
    if (npc.stats.constitution) statDetails.push(`CON: ${npc.stats.constitution}`);
    if (npc.stats.dexterity) statDetails.push(`DEX: ${npc.stats.dexterity}`);
    if (npc.stats.intelligence) statDetails.push(`INT: ${npc.stats.intelligence}`);
    
    if (statDetails.length > 0) {
      Broadcast.sayAt(player, `<bold>Stats:</bold> ${statDetails.join(', ')}`);
    }
  }
  
  // Show behaviors
  if (npc.behaviors && npc.behaviors.length > 0) {
    Broadcast.sayAt(player, `<bold>Behaviors:</bold> ${npc.behaviors.join(', ')}`);
  }
}

function showDetailedPlayerInfo(player, otherPlayer) {
  Broadcast.sayAt(player, `<bold><blue>${otherPlayer.name}</blue></bold> is a fellow adventurer.`);
  
  if (otherPlayer.stats && otherPlayer.stats.level) {
    Broadcast.sayAt(player, `<bold>Level:</bold> ${otherPlayer.stats.level}`);
  }
  
  // Show health status (general)
  if (otherPlayer.attributes && otherPlayer.attributes.health) {
    const maxHealth = otherPlayer.getMaxAttribute('health');
    const healthPercent = (otherPlayer.attributes.health / maxHealth) * 100;
    let healthStatus = 'looks healthy';
    let healthColor = 'green';
    
    if (healthPercent < 25) {
      healthStatus = 'looks near death';
      healthColor = 'red';
    } else if (healthPercent < 50) {
      healthStatus = 'looks badly wounded';
      healthColor = 'red';
    } else if (healthPercent < 75) {
      healthStatus = 'looks wounded';
      healthColor = 'yellow';
    }
    
    Broadcast.sayAt(player, `They <${healthColor}>${healthStatus}</${healthColor}>.`);
  }
  
  // Show equipment if visible
  if (otherPlayer.equipment) {
    const visibleEquipment = [];
    if (otherPlayer.equipment.weapon) {
      visibleEquipment.push(`wielding ${otherPlayer.equipment.weapon.name}`);
    }
    if (otherPlayer.equipment.armor) {
      visibleEquipment.push(`wearing ${otherPlayer.equipment.armor.name}`);
    }
    
    if (visibleEquipment.length > 0) {
      Broadcast.sayAt(player, `They are ${visibleEquipment.join(' and ')}.`);
    }
  }
}

function showDetailedRoomInfo(player) {
  const room = player.room;
  if (!room) {
    return Broadcast.sayAt(player, 'You are not in a valid location.');
  }

  Broadcast.sayAt(player, `<bold><cyan>${room.title}</cyan></bold>`);
  Broadcast.sayAt(player, room.description);
  
  // Show detailed exit information
  if (room.exits && room.exits.length > 0) {
    Broadcast.sayAt(player, '\r\n<bold><yellow>Detailed Exits:</yellow></bold>');
    room.exits.forEach(exit => {
      Broadcast.sayAt(player, `  <bold>${exit.direction}:</bold> leads to another area`);
    });
  } else {
    Broadcast.sayAt(player, '\r\n<bold><yellow>Exits:</yellow></bold> There are no obvious exits.');
  }
  
  // Show room dimensions or special features
  Broadcast.sayAt(player, '\r\n<bold>Room Details:</bold>');
  Broadcast.sayAt(player, `This area can accommodate multiple adventurers and contains various objects.`);
  
  // Count entities in room
  const itemCount = room.items ? room.items.size : 0;
  const npcCount = room.npcs ? room.npcs.size : 0;
  const playerCount = room.players ? room.players.size : 0;
  
  Broadcast.sayAt(player, `Currently contains: ${itemCount} items, ${npcCount} creatures, ${playerCount} adventurers.`);
}
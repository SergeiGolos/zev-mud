'use strict';

const { Broadcast } = require('ranvier');

module.exports = {
  aliases: ['att', 'kill', 'fight'],
  usage: 'attack <target>',
  command: (state) => (args, player) => {
    if (!args || args.trim() === '') {
      return Broadcast.sayAt(player, 'Attack what?');
    }

    const target = args.trim().toLowerCase();
    initiateAttack(player, target, state);
  }
};

function initiateAttack(player, targetName, state) {
  const room = player.room;
  if (!room) {
    return Broadcast.sayAt(player, 'You are not in a valid location.');
  }

  // Check if player is already in combat
  if (player.combatState.inCombat) {
    return Broadcast.sayAt(player, 'You are already in combat!');
  }

  // Find target NPC in room
  let target = null;
  if (room.npcs && room.npcs.size > 0) {
    target = Array.from(room.npcs).find(npc => 
      npc.name.toLowerCase().includes(targetName) ||
      npc.id.toLowerCase().includes(targetName)
    );
  }

  if (!target) {
    return Broadcast.sayAt(player, `You don't see '${targetName}' here to attack.`);
  }

  // Check if target is already dead
  if (target.attributes.health <= 0) {
    return Broadcast.sayAt(player, `${target.name} is already dead.`);
  }

  // Check if target is already in combat with someone else
  if (target.combatState && target.combatState.inCombat && target.combatState.target !== player) {
    return Broadcast.sayAt(player, `${target.name} is already fighting someone else.`);
  }

  // Initialize combat state for both combatants
  initializeCombat(player, target);

  // Announce combat initiation
  Broadcast.sayAt(player, `You attack ${target.name}!`);
  
  // Announce to room
  room.getBroadcastTargets().forEach(otherPlayer => {
    if (otherPlayer !== player) {
      Broadcast.sayAt(otherPlayer, `${player.name} attacks ${target.name}!`);
    }
  });

  // Start combat round
  startCombatRound(player, target, state);
}

function initializeCombat(player, target) {
  // Set combat state for player
  player.combatState = {
    inCombat: true,
    target: target,
    initiative: calculateInitiative(player),
    lastAction: new Date()
  };

  // Set combat state for target
  target.combatState = {
    inCombat: true,
    target: player,
    initiative: calculateInitiative(target),
    lastAction: new Date()
  };
}

function calculateInitiative(combatant) {
  // Base initiative on dexterity + random factor
  const dexterity = combatant.stats?.dexterity || 10;
  const randomFactor = Math.floor(Math.random() * 20) + 1; // 1-20
  return dexterity + randomFactor;
}

function startCombatRound(player, target, state) {
  // Determine turn order based on initiative
  const playerInitiative = player.combatState.initiative;
  const targetInitiative = target.combatState.initiative;

  if (playerInitiative >= targetInitiative) {
    // Player goes first
    performPlayerAttack(player, target, state);
  } else {
    // Target goes first
    performNPCAttack(target, player, state);
  }
}

function performPlayerAttack(player, target, state) {
  if (!player.combatState.inCombat || !target.combatState.inCombat) {
    return;
  }

  // Calculate damage
  const damage = calculateDamage(player, target);
  
  // Apply damage
  const currentHealth = target.attributes.health;
  const newHealth = Math.max(0, currentHealth - damage);
  target.attributes.health = newHealth;

  // Announce attack
  Broadcast.sayAt(player, `You hit ${target.name} for ${damage} damage!`);
  
  // Announce to room
  player.room.getBroadcastTargets().forEach(otherPlayer => {
    if (otherPlayer !== player) {
      Broadcast.sayAt(otherPlayer, `${player.name} hits ${target.name} for ${damage} damage!`);
    }
  });

  // Update last action
  player.combatState.lastAction = new Date();

  // Check if target is dead
  if (newHealth <= 0) {
    handleDeath(target, player, state);
    return;
  }

  // Target's turn to attack
  setTimeout(() => {
    if (player.combatState.inCombat && target.combatState.inCombat) {
      performNPCAttack(target, player, state);
    }
  }, 1500); // 1.5 second delay between attacks
}

function performNPCAttack(npc, player, state) {
  if (!npc.combatState.inCombat || !player.combatState.inCombat) {
    return;
  }

  // Calculate damage
  const damage = calculateDamage(npc, player);
  
  // Apply damage
  const currentHealth = player.attributes.health;
  const newHealth = Math.max(0, currentHealth - damage);
  player.attributes.health = newHealth;

  // Announce attack
  Broadcast.sayAt(player, `${npc.name} hits you for ${damage} damage!`);
  
  // Announce to room
  player.room.getBroadcastTargets().forEach(otherPlayer => {
    if (otherPlayer !== player) {
      Broadcast.sayAt(otherPlayer, `${npc.name} hits ${player.name} for ${damage} damage!`);
    }
  });

  // Update last action
  npc.combatState.lastAction = new Date();

  // Check if player is dead
  if (newHealth <= 0) {
    handleDeath(player, npc, state);
    return;
  }

  // Player's turn to attack
  setTimeout(() => {
    if (player.combatState.inCombat && npc.combatState.inCombat) {
      performPlayerAttack(player, npc, state);
    }
  }, 1500); // 1.5 second delay between attacks
}

function calculateDamage(attacker, defender) {
  // Base damage from strength
  let baseDamage = attacker.stats?.strength || 10;
  
  // Add weapon damage if equipped
  if (attacker.equipment && attacker.equipment.weapon) {
    const weaponDamage = attacker.equipment.weapon.metadata?.damage || 0;
    baseDamage += weaponDamage;
  }
  
  // Add random variance (80-120% of base damage)
  const variance = 0.8 + (Math.random() * 0.4);
  let finalDamage = Math.floor(baseDamage * variance);
  
  // Apply defender's armor/defense
  let defense = 0;
  if (defender.equipment && defender.equipment.armor) {
    defense = defender.equipment.armor.metadata?.defense || 0;
  }
  
  // Constitution provides natural defense
  const constitution = defender.stats?.constitution || 10;
  defense += Math.floor(constitution / 4); // 1 defense per 4 constitution
  
  // Apply defense (minimum 1 damage)
  finalDamage = Math.max(1, finalDamage - defense);
  
  return finalDamage;
}

function handleDeath(deceased, killer, state) {
  // End combat for both participants
  endCombat(deceased, killer);

  if (deceased.name) {
    // Player death
    handlePlayerDeath(deceased, killer, state);
  } else {
    // NPC death
    handleNPCDeath(deceased, killer, state);
  }
}

function handlePlayerDeath(player, killer, state) {
  // Announce death
  Broadcast.sayAt(player, 'You have been defeated!');
  
  player.room.getBroadcastTargets().forEach(otherPlayer => {
    if (otherPlayer !== player) {
      Broadcast.sayAt(otherPlayer, `${player.name} has been defeated by ${killer.name}!`);
    }
  });

  // Respawn player at safe location
  const safeRoom = state.RoomManager?.getRoom('basic-area:room8') || 
                   Array.from(state.rooms.values()).find(r => r.id === 'room8');
  
  if (safeRoom) {
    // Remove from current room
    player.room.removePlayer(player);
    
    // Add to safe room
    safeRoom.addPlayer(player);
    player.room = safeRoom;
    player.roomId = 'basic-area:room8';
    
    // Restore health to 50%
    const maxHealth = player.attributes.maxHealth || 100;
    player.attributes.health = Math.floor(maxHealth * 0.5);
    
    Broadcast.sayAt(player, 'You wake up in a safe place, battered but alive.');
    
    // Show the safe room
    setTimeout(() => {
      if (player.socket && !player.socket.destroyed) {
        showRoom(player);
      }
    }, 2000);
  }
}

function handleNPCDeath(npc, killer, state) {
  // Announce death
  Broadcast.sayAt(killer, `You have defeated ${npc.name}!`);
  
  killer.room.getBroadcastTargets().forEach(otherPlayer => {
    if (otherPlayer !== killer) {
      Broadcast.sayAt(otherPlayer, `${killer.name} has defeated ${npc.name}!`);
    }
  });

  // Award experience
  const expGained = (npc.level || 1) * 10;
  killer.stats.experience = (killer.stats.experience || 0) + expGained;
  Broadcast.sayAt(killer, `You gain ${expGained} experience points!`);

  // Remove NPC from room
  killer.room.npcs.delete(npc);

  // Schedule respawn
  if (npc.def && npc.def.respawn) {
    setTimeout(() => {
      respawnNPC(npc, killer.room, state);
    }, npc.def.respawn);
  }
}

function respawnNPC(originalNPC, room, state) {
  // Create new instance of the NPC
  const NPC = require('../../../src/server').NPC;
  const newNPC = new NPC(originalNPC.def);
  
  // Add back to room
  room.npcs.add(newNPC);
  
  // Announce respawn to players in room
  room.getBroadcastTargets().forEach(player => {
    Broadcast.sayAt(player, `${newNPC.name} appears in the area.`);
  });
}

function endCombat(combatant1, combatant2) {
  // Reset combat state for both combatants
  if (combatant1.combatState) {
    combatant1.combatState = {
      inCombat: false,
      target: null,
      initiative: 0,
      lastAction: null
    };
  }

  if (combatant2.combatState) {
    combatant2.combatState = {
      inCombat: false,
      target: null,
      initiative: 0,
      lastAction: null
    };
  }
}

function showRoom(player) {
  const room = player.room;
  if (!room) {
    Broadcast.sayAt(player, 'You are not in a valid location.');
    return;
  }

  Broadcast.sayAt(player, `\r\n${room.title}`);
  Broadcast.sayAt(player, room.description);
  
  // Show exits
  if (room.exits && room.exits.length > 0) {
    const exitNames = room.exits.map(exit => exit.direction).join(', ');
    Broadcast.sayAt(player, `\r\nExits: ${exitNames}`);
  }
  
  // Show items
  if (room.items && room.items.size > 0) {
    Broadcast.sayAt(player, '\r\nItems here:');
    for (const item of room.items) {
      Broadcast.sayAt(player, `  ${item.name}`);
    }
  }
  
  // Show NPCs
  if (room.npcs && room.npcs.size > 0) {
    Broadcast.sayAt(player, '');
    for (const npc of room.npcs) {
      const hostileIndicator = npc.hostile ? ' (hostile)' : '';
      Broadcast.sayAt(player, `${npc.name} is here${hostileIndicator}.`);
    }
  }
  
  // Show other players
  if (room.players && room.players.size > 1) {
    Broadcast.sayAt(player, '');
    for (const otherPlayer of room.players) {
      if (otherPlayer !== player) {
        Broadcast.sayAt(player, `${otherPlayer.name} is here.`);
      }
    }
  }
}
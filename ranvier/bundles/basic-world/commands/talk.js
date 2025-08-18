'use strict';

const { Broadcast } = require('ranvier');

module.exports = {
  aliases: ['say', 'speak'],
  usage: 'talk <npc>',
  command: (state) => (args, player) => {
    if (!args || args.trim() === '') {
      return Broadcast.sayAt(player, 'Talk to whom?');
    }

    const target = args.trim().toLowerCase();
    const room = player.room;
    
    if (!room) {
      return Broadcast.sayAt(player, 'You are not in a valid location.');
    }

    // Find NPC in room
    const npc = findNPCInRoom(room, target);
    if (!npc) {
      return Broadcast.sayAt(player, `You don't see '${target}' here to talk to.`);
    }

    // Check if NPC is in combat
    if (npc.hasEffectType && npc.hasEffectType('combat')) {
      return Broadcast.sayAt(player, `${npc.name} is too busy fighting to talk!`);
    }

    // Check if player is in combat
    if (player.hasEffectType && player.hasEffectType('combat')) {
      return Broadcast.sayAt(player, 'You are too busy fighting to have a conversation!');
    }

    // Initialize dialogue state if not exists
    if (!player.dialogueState) {
      player.dialogueState = {};
    }

    // Get or initialize dialogue state for this NPC
    const npcId = npc.id || npc.entityReference;
    if (!player.dialogueState[npcId]) {
      player.dialogueState[npcId] = {
        currentNode: 'default',
        history: [],
        lastInteraction: Date.now()
      };
    }

    const dialogueState = player.dialogueState[npcId];
    
    // Handle dialogue
    handleDialogue(player, npc, dialogueState, state);
  }
};

function findNPCInRoom(room, target) {
  if (!room.npcs || room.npcs.size === 0) {
    return null;
  }

  // Try exact name match first
  for (const npc of room.npcs) {
    if (npc.name.toLowerCase() === target) {
      return npc;
    }
  }

  // Try partial name match
  for (const npc of room.npcs) {
    if (npc.name.toLowerCase().includes(target)) {
      return npc;
    }
  }

  // Try ID match
  for (const npc of room.npcs) {
    if (npc.id && npc.id.toLowerCase().includes(target)) {
      return npc;
    }
  }

  return null;
}

function handleDialogue(player, npc, dialogueState, state) {
  // Get dialogue tree from NPC
  const dialogueTree = getDialogueTree(npc);
  
  if (!dialogueTree) {
    // Fallback to simple dialogue
    const message = getSimpleDialogue(npc, dialogueState);
    Broadcast.sayAt(player, `${npc.name} says: "${message}"`);
    
    // Announce to room
    Broadcast.sayAtExcept(player.room, `${player.name} talks to ${npc.name}.`, player);
    return;
  }

  // Get current dialogue node
  const currentNode = dialogueTree[dialogueState.currentNode] || dialogueTree['default'];
  
  if (!currentNode) {
    Broadcast.sayAt(player, `${npc.name} has nothing to say.`);
    return;
  }

  // Display NPC's message
  const message = typeof currentNode.message === 'function' 
    ? currentNode.message(player, npc, dialogueState)
    : currentNode.message;
    
  Broadcast.sayAt(player, `${npc.name} says: "${message}"`);
  
  // Announce to room
  Broadcast.sayAtExcept(player.room, `${player.name} talks to ${npc.name}.`, player);
  
  // Show response options if available
  if (currentNode.responses && currentNode.responses.length > 0) {
    Broadcast.sayAt(player, '\nYou can respond with:');
    currentNode.responses.forEach((response, index) => {
      const responseText = typeof response.text === 'function'
        ? response.text(player, npc, dialogueState)
        : response.text;
      Broadcast.sayAt(player, `  ${index + 1}. ${responseText}`);
    });
    Broadcast.sayAt(player, '\nUse "respond <number>" to choose your response.');
    
    // Set waiting for response state
    dialogueState.waitingForResponse = true;
    dialogueState.availableResponses = currentNode.responses;
  } else {
    // No responses available, conversation ends
    dialogueState.currentNode = 'default';
    dialogueState.waitingForResponse = false;
  }

  // Update dialogue history
  dialogueState.history.push({
    node: dialogueState.currentNode,
    timestamp: Date.now(),
    message: message
  });
  
  // Execute any node actions
  if (currentNode.action) {
    if (typeof currentNode.action === 'function') {
      currentNode.action(player, npc, dialogueState, state);
    } else if (typeof currentNode.action === 'string') {
      // Handle string-based actions
      if (npc.emit) {
        npc.emit('dialogueAction', currentNode.action, player, dialogueState);
      }
    }
  }
}

function getDialogueTree(npc) {
  // Check if NPC has a dialogue tree defined
  if (npc.dialogueTree) {
    return npc.dialogueTree;
  }
  
  // Check if NPC has dialogue metadata
  if (npc.metadata && npc.metadata.dialogueTree) {
    return npc.metadata.dialogueTree;
  }
  
  return null;
}

function getSimpleDialogue(npc, dialogueState) {
  // Use dialogue from NPC definition if available
  if (npc.dialogue) {
    // Check for combat state
    if (npc.hostile && npc.dialogue.aggressive) {
      return npc.dialogue.aggressive;
    }
    
    // Check for specific dialogue states
    if (npc.dialogue.default) {
      return npc.dialogue.default;
    }
    
    // If dialogue is just a string
    if (typeof npc.dialogue === 'string') {
      return npc.dialogue;
    }
  }
  
  // Fallback messages
  const fallbackMessages = [
    "I have nothing to say to you.",
    "...",
    "The creature looks at you silently.",
    "You sense this being has no words for you."
  ];
  
  return fallbackMessages[Math.floor(Math.random() * fallbackMessages.length)];
}
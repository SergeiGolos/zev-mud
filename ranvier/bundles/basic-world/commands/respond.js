'use strict';

const { Broadcast } = require('ranvier');

module.exports = {
  aliases: ['reply', 'r'],
  usage: 'respond <number>',
  command: (state) => (args, player) => {
    if (!args || args.trim() === '') {
      return Broadcast.sayAt(player, 'Respond with what? Use "respond <number>" to choose a response.');
    }

    const responseNumber = parseInt(args.trim());
    
    if (isNaN(responseNumber) || responseNumber < 1) {
      return Broadcast.sayAt(player, 'Please specify a valid response number.');
    }

    // Check if player has dialogue state
    if (!player.dialogueState) {
      return Broadcast.sayAt(player, 'You are not currently in a conversation.');
    }

    // Find the NPC the player is talking to
    const room = player.room;
    if (!room) {
      return Broadcast.sayAt(player, 'You are not in a valid location.');
    }

    // Find which NPC the player is in dialogue with
    let activeNPC = null;
    let activeDialogueState = null;
    
    for (const [npcId, dialogueState] of Object.entries(player.dialogueState)) {
      if (dialogueState.waitingForResponse) {
        // Find the NPC in the room
        for (const npc of room.npcs) {
          if ((npc.id || npc.entityReference) === npcId) {
            activeNPC = npc;
            activeDialogueState = dialogueState;
            break;
          }
        }
        if (activeNPC) break;
      }
    }

    if (!activeNPC || !activeDialogueState) {
      return Broadcast.sayAt(player, 'You are not currently in a conversation that requires a response.');
    }

    // Check if response number is valid
    const availableResponses = activeDialogueState.availableResponses;
    if (!availableResponses || responseNumber > availableResponses.length) {
      return Broadcast.sayAt(player, `Please choose a number between 1 and ${availableResponses ? availableResponses.length : 0}.`);
    }

    const chosenResponse = availableResponses[responseNumber - 1];
    
    // Display player's response
    const responseText = typeof chosenResponse.text === 'function'
      ? chosenResponse.text(player, activeNPC, activeDialogueState)
      : chosenResponse.text;
      
    Broadcast.sayAt(player, `You say: "${responseText}"`);
    Broadcast.sayAtExcept(room, `${player.name} responds to ${activeNPC.name}.`, player);

    // Clear waiting state
    activeDialogueState.waitingForResponse = false;
    activeDialogueState.availableResponses = null;

    // Execute response action if available
    if (chosenResponse.action) {
      if (typeof chosenResponse.action === 'function') {
        chosenResponse.action(player, activeNPC, activeDialogueState, state);
      } else if (typeof chosenResponse.action === 'string') {
        // Handle string-based actions
        if (activeNPC.emit) {
          activeNPC.emit('dialogueAction', chosenResponse.action, player, activeDialogueState);
        }
      }
    }

    // Move to next dialogue node
    if (chosenResponse.nextNode) {
      activeDialogueState.currentNode = chosenResponse.nextNode;
      
      // Continue dialogue with new node
      setTimeout(() => {
        if (player.room === room && room.npcs.has(activeNPC)) {
          handleDialogueNode(player, activeNPC, activeDialogueState, state);
        }
      }, 1000); // Small delay for natural conversation flow
    } else {
      // End conversation
      activeDialogueState.currentNode = 'default';
      Broadcast.sayAt(player, 'The conversation comes to an end.');
    }

    // Update dialogue history
    activeDialogueState.history.push({
      type: 'response',
      responseIndex: responseNumber - 1,
      text: responseText,
      timestamp: Date.now()
    });
  }
};

function handleDialogueNode(player, npc, dialogueState, state) {
  // Get dialogue tree from NPC
  const dialogueTree = getDialogueTree(npc);
  
  if (!dialogueTree) {
    return;
  }

  // Get current dialogue node
  const currentNode = dialogueTree[dialogueState.currentNode];
  
  if (!currentNode) {
    dialogueState.currentNode = 'default';
    return;
  }

  // Display NPC's message
  const message = typeof currentNode.message === 'function' 
    ? currentNode.message(player, npc, dialogueState)
    : currentNode.message;
    
  Broadcast.sayAt(player, `${npc.name} says: "${message}"`);
  
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
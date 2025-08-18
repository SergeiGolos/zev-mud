'use strict';

const { Broadcast } = require('ranvier');

module.exports = {
  aliases: ['consume', 'drink', 'eat'],
  usage: 'use <item>',
  command: (state) => (args, player) => {
    if (!args || args.trim() === '') {
      return Broadcast.sayAt(player, 'Use what?');
    }

    const target = args.trim().toLowerCase();
    
    // Check if player has inventory
    if (!player.inventory || player.inventory.size === 0) {
      return Broadcast.sayAt(player, 'You are not carrying anything to use.');
    }

    // Find the item in inventory
    const item = findItemInInventory(player, target);
    if (!item) {
      return Broadcast.sayAt(player, `You don't have '${target}' in your inventory.`);
    }

    // Check if item can be used
    if (!canUseItem(item)) {
      return Broadcast.sayAt(player, `You cannot use ${item.name}.`);
    }

    // Use the item based on its type
    const result = useItem(player, item);
    
    if (result.success) {
      // Remove item from inventory if it's consumed
      if (result.consumed) {
        player.inventory.delete(item);
      }
      
      // Broadcast messages
      Broadcast.sayAt(player, result.playerMessage);
      if (result.roomMessage) {
        Broadcast.sayAtExcept(player.room, result.roomMessage, player);
      }
      
      // Save player state
      if (player.save) {
        player.save();
      }
    } else {
      Broadcast.sayAt(player, result.message);
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

function canUseItem(item) {
  const usableTypes = ['POTION', 'FOOD', 'SCROLL'];
  return usableTypes.includes(item.type);
}

function useItem(player, item) {
  switch (item.type) {
    case 'POTION':
      return usePotionItem(player, item);
    case 'FOOD':
      return useFoodItem(player, item);
    case 'SCROLL':
      return useScrollItem(player, item);
    default:
      return {
        success: false,
        message: `You cannot use ${item.name}.`
      };
  }
}

function usePotionItem(player, item) {
  // Initialize attributes if they don't exist
  if (!player.attributes) {
    player.attributes = { health: 100, mana: 50, stamina: 100 };
  }

  const healing = item.metadata?.healing || 0;
  const manaRestore = item.metadata?.mana || 0;
  const staminaRestore = item.metadata?.stamina || 0;

  let effects = [];
  
  if (healing > 0) {
    const currentHealth = player.attributes.health || 0;
    const maxHealth = 100; // Could be dynamic based on level
    const newHealth = Math.min(currentHealth + healing, maxHealth);
    const actualHealing = newHealth - currentHealth;
    
    player.attributes.health = newHealth;
    
    if (actualHealing > 0) {
      effects.push(`restored ${actualHealing} health`);
    } else {
      effects.push('but you are already at full health');
    }
  }
  
  if (manaRestore > 0) {
    const currentMana = player.attributes.mana || 0;
    const maxMana = 50; // Could be dynamic based on level
    const newMana = Math.min(currentMana + manaRestore, maxMana);
    const actualRestore = newMana - currentMana;
    
    player.attributes.mana = newMana;
    
    if (actualRestore > 0) {
      effects.push(`restored ${actualRestore} mana`);
    }
  }
  
  if (staminaRestore > 0) {
    const currentStamina = player.attributes.stamina || 0;
    const maxStamina = 100; // Could be dynamic based on level
    const newStamina = Math.min(currentStamina + staminaRestore, maxStamina);
    const actualRestore = newStamina - currentStamina;
    
    player.attributes.stamina = newStamina;
    
    if (actualRestore > 0) {
      effects.push(`restored ${actualRestore} stamina`);
    }
  }

  const effectText = effects.length > 0 ? ` and ${effects.join(', ')}` : '';
  
  return {
    success: true,
    consumed: true,
    playerMessage: `You drink ${item.name}${effectText}.`,
    roomMessage: `${player.name} drinks ${item.name}.`
  };
}

function useFoodItem(player, item) {
  // Initialize attributes if they don't exist
  if (!player.attributes) {
    player.attributes = { health: 100, mana: 50, stamina: 100 };
  }

  const nutrition = item.metadata?.nutrition || 0;
  const healing = item.metadata?.healing || 0;

  let effects = [];
  
  if (nutrition > 0) {
    const currentStamina = player.attributes.stamina || 0;
    const maxStamina = 100;
    const newStamina = Math.min(currentStamina + nutrition, maxStamina);
    const actualRestore = newStamina - currentStamina;
    
    player.attributes.stamina = newStamina;
    
    if (actualRestore > 0) {
      effects.push(`restored ${actualRestore} stamina`);
    } else {
      effects.push('but you are not hungry');
    }
  }
  
  if (healing > 0) {
    const currentHealth = player.attributes.health || 0;
    const maxHealth = 100;
    const newHealth = Math.min(currentHealth + healing, maxHealth);
    const actualHealing = newHealth - currentHealth;
    
    player.attributes.health = newHealth;
    
    if (actualHealing > 0) {
      effects.push(`restored ${actualHealing} health`);
    }
  }

  const effectText = effects.length > 0 ? ` and ${effects.join(', ')}` : '';
  
  return {
    success: true,
    consumed: true,
    playerMessage: `You eat ${item.name}${effectText}.`,
    roomMessage: `${player.name} eats ${item.name}.`
  };
}

function useScrollItem(player, item) {
  const spell = item.metadata?.spell;
  
  if (!spell) {
    return {
      success: false,
      message: `${item.name} appears to be blank or unreadable.`
    };
  }

  // Initialize attributes if they don't exist
  if (!player.attributes) {
    player.attributes = { health: 100, mana: 50, stamina: 100 };
  }

  // Check if player has enough mana (scrolls require 10 mana to use)
  const manaCost = 10;
  const currentMana = player.attributes.mana || 0;
  
  if (currentMana < manaCost) {
    return {
      success: false,
      message: `You don't have enough mana to use ${item.name}. You need ${manaCost} mana.`
    };
  }

  // Consume mana
  player.attributes.mana = currentMana - manaCost;

  // Apply spell effect (simplified magic missile example)
  let spellEffect = '';
  switch (spell) {
    case 'magic_missile':
      spellEffect = 'Magical energy crackles around you briefly.';
      break;
    case 'heal':
      const currentHealth = player.attributes.health || 0;
      const maxHealth = 100;
      const healing = 25;
      const newHealth = Math.min(currentHealth + healing, maxHealth);
      const actualHealing = newHealth - currentHealth;
      player.attributes.health = newHealth;
      spellEffect = `You feel magical healing energy flow through you, restoring ${actualHealing} health.`;
      break;
    default:
      spellEffect = 'The scroll glows briefly with magical energy.';
  }
  
  return {
    success: true,
    consumed: true,
    playerMessage: `You read ${item.name}. ${spellEffect}`,
    roomMessage: `${player.name} reads ${item.name}. The scroll glows with magical energy.`
  };
}
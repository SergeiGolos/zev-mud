module.exports = {
  listeners: {
    // Handle dialogue actions
    dialogueAction: state => function (action, player, dialogueState) {
      switch (action) {
        case 'initiate_combat':
          this.handleCombatInitiation(player);
          break;
        case 'give_item':
          this.handleItemGiving(player, dialogueState);
          break;
        case 'heal_player':
          this.handlePlayerHealing(player);
          break;
        case 'teleport_player':
          this.handlePlayerTeleport(player, dialogueState);
          break;
        default:
          // Custom action handling can be added here
          break;
      }
    }
  },

  methods: {
    handleCombatInitiation: function (player) {
      if (this.hasEffectType && this.hasEffectType('combat')) {
        return;
      }

      // Set as hostile if not already
      this.hostile = true;
      
      // Announce combat initiation
      player.socket.write(`${this.name} prepares to attack!\r\n`);
      
      this.room.getBroadcastTargets().forEach(otherPlayer => {
        if (otherPlayer !== player) {
          otherPlayer.socket.write(`${this.name} prepares to attack ${player.name}!\r\n`);
        }
      });

      // Start combat after a brief delay
      setTimeout(() => {
        if (player.room === this.room && !this.hasEffectType('combat')) {
          this.initiateCombat(player);
        }
      }, 2000);
    },

    handleItemGiving: function (player, dialogueState) {
      // This would handle giving items to players based on dialogue
      // Implementation depends on specific item giving logic
      const itemId = dialogueState.giveItem;
      if (itemId) {
        // Logic to create and give item to player
        player.socket.write(`${this.name} gives you something.\r\n`);
      }
    },

    handlePlayerHealing: function (player) {
      const currentHealth = player.getAttribute('health');
      const maxHealth = player.getMaxAttribute('health');
      
      if (currentHealth < maxHealth) {
        const healAmount = Math.floor(maxHealth * 0.5); // Heal 50%
        const newHealth = Math.min(maxHealth, currentHealth + healAmount);
        player.setAttributeBase('health', newHealth);
        
        player.socket.write(`${this.name} channels healing energy into you. You feel much better!\r\n`);
        
        this.room.getBroadcastTargets().forEach(otherPlayer => {
          if (otherPlayer !== player) {
            otherPlayer.socket.write(`${this.name} heals ${player.name}.\r\n`);
          }
        });
      } else {
        player.socket.write(`${this.name} looks at you and nods. You are already in good health.\r\n`);
      }
    },

    handlePlayerTeleport: function (player, dialogueState) {
      // This would handle teleporting players to different locations
      // Implementation depends on specific teleport logic
      const targetRoomId = dialogueState.teleportTo;
      if (targetRoomId) {
        // Logic to teleport player
        player.socket.write(`${this.name} gestures, and the world shifts around you...\r\n`);
      }
    },

    initiateCombat: function (target) {
      if (!target || this.hasEffectType('combat')) {
        return;
      }

      target.socket.write(`${this.name} attacks you!\r\n`);
      
      // Tell others in the room
      this.room.getBroadcastTargets().forEach(player => {
        if (player !== target) {
          player.socket.write(`${this.name} attacks ${target.name}!\r\n`);
        }
      });

      // Start combat (simplified for now)
      this.combatTarget = target;
      target.combatTarget = this;
      
      // Add combat effect to both
      this.addEffect('combat', { target: target });
      target.addEffect('combat', { target: this });
    }
  }
};
module.exports = {
  listeners: {
    playerEnter: state => function (player) {
      // Skip if already in combat
      if (this.hasEffectType('combat')) {
        return;
      }

      // Aggressive NPCs attack players on sight
      if (this.hostile) {
        // Small delay before attacking to give player a chance to see the room
        setTimeout(() => {
          if (player.room === this.room && !this.hasEffectType('combat')) {
            this.initiateAttack(player);
          }
        }, 2000); // 2 second delay
      }
    },

    // React to being attacked
    hit: state => function (damage, attacker) {
      if (!this.hasEffectType('combat') && attacker) {
        this.initiateAttack(attacker);
      }
    }
  },

  methods: {
    initiateAttack: function (target) {
      if (!target || this.hasEffectType('combat')) {
        return;
      }

      // Announce the attack
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
      
      // Perform first attack
      this.performAttack(target);
    },

    performAttack: function (target) {
      if (!target || !this.combatTarget) {
        return;
      }

      // Simple damage calculation
      const baseDamage = this.stats?.strength || 10;
      const damage = Math.floor(baseDamage * (0.8 + Math.random() * 0.4)); // 80-120% of base damage
      
      // Apply damage
      const currentHealth = target.getAttribute('health');
      const newHealth = Math.max(0, currentHealth - damage);
      target.setAttributeBase('health', newHealth);
      
      // Announce damage
      target.socket.write(`${this.name} hits you for ${damage} damage!\r\n`);
      
      this.room.getBroadcastTargets().forEach(player => {
        if (player !== target) {
          player.socket.write(`${this.name} hits ${target.name} for ${damage} damage!\r\n`);
        }
      });

      // Check if target is dead
      if (newHealth <= 0) {
        this.handleTargetDeath(target);
      } else {
        // Continue combat
        setTimeout(() => {
          if (this.combatTarget === target && target.room === this.room) {
            this.performAttack(target);
          }
        }, 3000); // Attack every 3 seconds
      }
    },

    handleTargetDeath: function (target) {
      target.socket.write('You have been defeated!\r\n');
      
      this.room.getBroadcastTargets().forEach(player => {
        if (player !== target) {
          player.socket.write(`${target.name} has been defeated by ${this.name}!\r\n`);
        }
      });

      // End combat
      this.combatTarget = null;
      target.combatTarget = null;
      
      this.removeEffect('combat');
      target.removeEffect('combat');
      
      // Respawn target at safe location
      const safeRoom = state.RoomManager.getRoom('basic-area:room8');
      if (safeRoom) {
        target.room.removePlayer(target);
        safeRoom.addPlayer(target);
        target.room = safeRoom;
        target.roomId = safeRoom.entityReference;
        
        // Restore some health
        target.setAttributeBase('health', Math.floor(target.getMaxAttribute('health') * 0.5));
        target.socket.write('You wake up in a safe place, battered but alive.\r\n');
      }
    }
  }
};
module.exports = {
  listeners: {
    spawn: state => function () {
      // Initialize AI state
      this.aiState = {
        alertLevel: 0, // 0 = calm, 1 = suspicious, 2 = hostile
        lastPlayerSeen: null,
        patrolRoute: this.metadata?.patrolRoute || [],
        currentPatrolIndex: 0,
        patrolDirection: 1, // 1 = forward, -1 = backward
        lastPatrolMove: Date.now(),
        combatTactics: this.metadata?.combatTactics || 'aggressive',
        aggroRange: this.metadata?.aggroRange || 1, // rooms away to detect players
        memoryDuration: this.metadata?.memoryDuration || 30000 // 30 seconds
      };

      // Start patrol behavior if patrol route is defined
      if (this.aiState.patrolRoute.length > 0) {
        this.startPatrol(state);
      }

      // Start periodic AI updates
      this.startAILoop(state);
    },

    playerEnter: state => function (player) {
      // Skip if already in combat
      if (this.hasEffectType('combat')) {
        return;
      }

      // Update AI state
      this.aiState.lastPlayerSeen = Date.now();
      
      // Determine aggression response based on NPC type and player actions
      if (this.hostile) {
        this.detectThreat(player, state);
      } else {
        // Non-hostile NPCs might become suspicious
        this.evaluatePlayer(player, state);
      }
    },

    playerLeave: state => function (player) {
      // If the player was our combat target and they left, pursue or give up
      if (this.combatTarget === player) {
        this.handleTargetFled(player, state);
      }
    },

    // React to being attacked
    hit: state => function (damage, attacker) {
      if (!this.hasEffectType('combat') && attacker) {
        this.aiState.alertLevel = 2; // Maximum hostility
        this.initiateAttack(attacker);
      }
    },

    // Handle death and respawn
    death: state => function () {
      this.scheduleRespawn(state);
    }
  },

  methods: {
    startAILoop: function (state) {
      // Run AI decision making every 5 seconds
      this.aiInterval = setInterval(() => {
        this.updateAI(state);
      }, 5000);
    },

    updateAI: function (state) {
      if (this.hasEffectType('combat')) {
        this.updateCombatAI(state);
        return;
      }

      // Decay alert level over time
      if (this.aiState.lastPlayerSeen && Date.now() - this.aiState.lastPlayerSeen > this.aiState.memoryDuration) {
        this.aiState.alertLevel = Math.max(0, this.aiState.alertLevel - 1);
      }

      // Look for nearby threats
      this.scanForThreats(state);

      // Continue patrol if not in combat
      if (this.aiState.patrolRoute.length > 0 && !this.hasEffectType('combat')) {
        this.continuePatrol(state);
      }
    },

    detectThreat: function (player, state) {
      // Immediate hostility for aggressive NPCs
      this.aiState.alertLevel = 2;
      
      // Small delay before attacking to give player a chance to see the room
      setTimeout(() => {
        if (player.room === this.room && !this.hasEffectType('combat')) {
          this.initiateAttack(player);
        }
      }, 2000); // 2 second delay
    },

    evaluatePlayer: function (player, state) {
      // Non-hostile NPCs evaluate player threat level
      let threatLevel = 0;

      // Check if player is armed
      if (player.equipment && player.equipment.weapon) {
        threatLevel += 1;
      }

      // Check if player has attacked other NPCs recently
      if (player.combatHistory && player.combatHistory.length > 0) {
        threatLevel += 1;
      }

      // Update alert level
      this.aiState.alertLevel = Math.min(2, threatLevel);

      if (this.aiState.alertLevel >= 2) {
        // Become hostile
        this.hostile = true;
        this.detectThreat(player, state);
      } else if (this.aiState.alertLevel >= 1) {
        // Show suspicion
        this.room.getBroadcastTargets().forEach(p => {
          p.socket.write(`${this.name} eyes you suspiciously.\r\n`);
        });
      }
    },

    scanForThreats: function (state) {
      if (!this.room || this.hasEffectType('combat')) {
        return;
      }

      // Look for hostile players in the room
      const players = Array.from(this.room.players || []);
      for (const player of players) {
        if (this.isPlayerThreat(player)) {
          this.detectThreat(player, state);
          break;
        }
      }

      // Scan adjacent rooms if aggro range > 1
      if (this.aiState.aggroRange > 1) {
        this.scanAdjacentRooms(state);
      }
    },

    scanAdjacentRooms: function (state) {
      if (!this.room || !this.room.exits) {
        return;
      }

      for (const [direction, roomId] of Object.entries(this.room.exits)) {
        const adjacentRoom = state.RoomManager.getRoom(roomId);
        if (adjacentRoom && adjacentRoom.players) {
          const players = Array.from(adjacentRoom.players);
          for (const player of players) {
            if (this.isPlayerThreat(player)) {
              // Move towards the threat
              this.moveToRoom(adjacentRoom, state);
              return;
            }
          }
        }
      }
    },

    isPlayerThreat: function (player) {
      // Determine if a player is considered a threat
      if (!this.hostile) {
        return false;
      }

      // Check if player has attacked this NPC or allies recently
      if (player.combatHistory) {
        const recentCombat = player.combatHistory.find(entry => 
          entry.target === this.id && Date.now() - entry.timestamp < 300000 // 5 minutes
        );
        if (recentCombat) {
          return true;
        }
      }

      return this.hostile; // Default to hostile behavior
    },

    startPatrol: function (state) {
      if (this.aiState.patrolRoute.length === 0) {
        return;
      }

      this.patrolInterval = setInterval(() => {
        if (!this.hasEffectType('combat')) {
          this.continuePatrol(state);
        }
      }, 10000); // Move every 10 seconds
    },

    continuePatrol: function (state) {
      if (this.hasEffectType('combat') || this.aiState.patrolRoute.length === 0) {
        return;
      }

      // Don't move if recently moved
      if (Date.now() - this.aiState.lastPatrolMove < 8000) {
        return;
      }

      const currentRoomId = this.aiState.patrolRoute[this.aiState.currentPatrolIndex];
      const targetRoom = state.RoomManager.getRoom(currentRoomId);

      if (targetRoom && targetRoom !== this.room) {
        this.moveToRoom(targetRoom, state);
      }

      // Update patrol index
      this.aiState.currentPatrolIndex += this.aiState.patrolDirection;

      // Reverse direction at ends of patrol route
      if (this.aiState.currentPatrolIndex >= this.aiState.patrolRoute.length) {
        this.aiState.currentPatrolIndex = this.aiState.patrolRoute.length - 2;
        this.aiState.patrolDirection = -1;
      } else if (this.aiState.currentPatrolIndex < 0) {
        this.aiState.currentPatrolIndex = 1;
        this.aiState.patrolDirection = 1;
      }

      this.aiState.lastPatrolMove = Date.now();
    },

    moveToRoom: function (targetRoom, state) {
      if (!targetRoom || targetRoom === this.room) {
        return;
      }

      // Announce movement
      if (this.room) {
        this.room.getBroadcastTargets().forEach(player => {
          player.socket.write(`${this.name} leaves.\r\n`);
        });
        this.room.removeNpc(this);
      }

      // Move to new room
      this.room = targetRoom;
      targetRoom.addNpc(this);

      // Announce arrival
      targetRoom.getBroadcastTargets().forEach(player => {
        player.socket.write(`${this.name} arrives.\r\n`);
      });
    },

    updateCombatAI: function (state) {
      if (!this.combatTarget || !this.hasEffectType('combat')) {
        return;
      }

      // Different combat tactics based on NPC type
      switch (this.aiState.combatTactics) {
        case 'aggressive':
          // Always attack, never retreat
          break;
        case 'defensive':
          // Try to maintain distance, use defensive abilities
          this.considerDefensiveTactics(state);
          break;
        case 'tactical':
          // Use environment and abilities strategically
          this.considerTacticalOptions(state);
          break;
      }
    },

    considerDefensiveTactics: function (state) {
      const currentHealth = this.getAttribute('health');
      const maxHealth = this.getMaxAttribute('health');
      const healthPercent = currentHealth / maxHealth;

      // Retreat if health is low
      if (healthPercent < 0.3) {
        this.attemptRetreat(state);
      }
    },

    considerTacticalOptions: function (state) {
      // Look for tactical advantages
      const currentHealth = this.getAttribute('health');
      const maxHealth = this.getMaxAttribute('health');
      const healthPercent = currentHealth / maxHealth;

      if (healthPercent < 0.5) {
        // Try to use healing items or abilities
        this.attemptHealing(state);
      }

      // Consider calling for help
      this.callForHelp(state);
    },

    attemptRetreat: function (state) {
      if (!this.room || !this.room.exits) {
        return;
      }

      // Find a random exit to retreat through
      const exits = Object.keys(this.room.exits);
      if (exits.length > 0) {
        const randomExit = exits[Math.floor(Math.random() * exits.length)];
        const retreatRoomId = this.room.exits[randomExit];
        const retreatRoom = state.RoomManager.getRoom(retreatRoomId);

        if (retreatRoom) {
          // Announce retreat
          this.room.getBroadcastTargets().forEach(player => {
            player.socket.write(`${this.name} retreats ${randomExit}!\r\n`);
          });

          // End combat
          this.endCombat();
          
          // Move to retreat room
          this.moveToRoom(retreatRoom, state);
        }
      }
    },

    attemptHealing: function (state) {
      // Simple healing attempt (could be expanded with items/abilities)
      const currentHealth = this.getAttribute('health');
      const maxHealth = this.getMaxAttribute('health');
      
      if (currentHealth < maxHealth * 0.5) {
        const healAmount = Math.floor(maxHealth * 0.2);
        const newHealth = Math.min(maxHealth, currentHealth + healAmount);
        this.setAttributeBase('health', newHealth);

        this.room.getBroadcastTargets().forEach(player => {
          player.socket.write(`${this.name} glows briefly with healing energy.\r\n`);
        });
      }
    },

    callForHelp: function (state) {
      if (!this.room) {
        return;
      }

      // Look for allied NPCs in the room
      const allies = Array.from(this.room.npcs || []).filter(npc => 
        npc !== this && 
        npc.hostile && 
        !npc.hasEffectType('combat')
      );

      if (allies.length > 0) {
        const ally = allies[0];
        ally.hostile = true;
        ally.aiState.alertLevel = 2;
        
        // Make ally attack our target
        if (this.combatTarget) {
          ally.initiateAttack(this.combatTarget);
        }

        this.room.getBroadcastTargets().forEach(player => {
          player.socket.write(`${this.name} calls for help! ${ally.name} joins the fight!\r\n`);
        });
      }
    },

    handleTargetFled: function (player, state) {
      // Decide whether to pursue or give up
      if (this.aiState.combatTactics === 'aggressive') {
        // Pursue for a short time
        setTimeout(() => {
          if (player.room && this.hasEffectType('combat')) {
            this.moveToRoom(player.room, state);
          }
        }, 2000);
      } else {
        // Give up pursuit
        this.endCombat();
        this.room.getBroadcastTargets().forEach(p => {
          p.socket.write(`${this.name} stops pursuing and returns to guard duty.\r\n`);
        });
      }
    },

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
      this.endCombat();
      
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
    },

    endCombat: function () {
      this.combatTarget = null;
      this.removeEffect('combat');
      
      // Reset alert level gradually
      this.aiState.alertLevel = Math.max(0, this.aiState.alertLevel - 1);
    },

    scheduleRespawn: function (state) {
      const respawnTime = this.respawn || 180000; // Default 3 minutes
      
      setTimeout(() => {
        this.respawnNPC(state);
      }, respawnTime);
    },

    respawnNPC: function (state) {
      // Find the original spawn room
      const spawnRoomId = this.metadata?.spawnRoom || this.room?.entityReference;
      const spawnRoom = state.RoomManager.getRoom(spawnRoomId);
      
      if (spawnRoom) {
        // Reset NPC state
        this.setAttributeBase('health', this.getMaxAttribute('health'));
        this.hostile = this.metadata?.originalHostile || false;
        this.aiState.alertLevel = 0;
        this.combatTarget = null;
        
        // Move back to spawn room if not already there
        if (this.room !== spawnRoom) {
          if (this.room) {
            this.room.removeNpc(this);
          }
          this.room = spawnRoom;
          spawnRoom.addNpc(this);
        }
        
        // Announce respawn
        spawnRoom.getBroadcastTargets().forEach(player => {
          player.socket.write(`${this.name} emerges from the shadows.\r\n`);
        });
      }
    },

    cleanup: function () {
      // Clean up intervals when NPC is removed
      if (this.aiInterval) {
        clearInterval(this.aiInterval);
      }
      if (this.patrolInterval) {
        clearInterval(this.patrolInterval);
      }
    }
  }
};
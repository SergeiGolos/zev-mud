module.exports = {
  listeners: {
    playerEnter: state => function (player) {
      if (this.hasEffectType('combat')) {
        return;
      }

      // Guardian only activates if player has been in the room for a while
      // or if they try to take the ancient key
      this.guardianActivated = this.guardianActivated || false;
      
      if (!this.guardianActivated) {
        player.socket.write('The stone guardian\'s eyes begin to glow as you enter.\r\n');
        
        // Set a timer to activate if player stays too long
        this.guardianTimer = setTimeout(() => {
          if (player.room === this.room && !this.hasEffectType('combat')) {
            this.activateGuardian(player);
          }
        }, 10000); // 10 seconds
      }
    },

    playerLeave: state => function (player) {
      if (this.guardianTimer) {
        clearTimeout(this.guardianTimer);
        this.guardianTimer = null;
      }
    },

    // Activate when someone tries to take the ancient key
    itemTaken: state => function (item, player) {
      if (item.id === 'ancient_key' && !this.guardianActivated) {
        this.activateGuardian(player);
      }
    }
  },

  methods: {
    activateGuardian: function (player) {
      this.guardianActivated = true;
      
      // Clear any existing timer
      if (this.guardianTimer) {
        clearTimeout(this.guardianTimer);
        this.guardianTimer = null;
      }

      // Announce activation
      this.room.getBroadcastTargets().forEach(target => {
        target.socket.write('The stone guardian suddenly comes to life with a grinding sound!\r\n');
      });

      // Set as hostile and initiate combat
      this.hostile = true;
      
      // Start combat with the player who triggered it
      if (player && player.room === this.room) {
        this.initiateCombat(player);
      }
    },

    initiateCombat: function (target) {
      if (!target || this.hasEffectType('combat')) {
        return;
      }

      target.socket.write('The stone guardian attacks you!\r\n');
      
      // Tell others in the room
      this.room.getBroadcastTargets().forEach(player => {
        if (player !== target) {
          player.socket.write(`The stone guardian attacks ${target.name}!\r\n`);
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
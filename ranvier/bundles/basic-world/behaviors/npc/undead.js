module.exports = {
  listeners: {
    // Undead are immune to certain effects
    effectAdded: state => function (effect) {
      // Undead are immune to fear, charm, and sleep effects
      const immuneEffects = ['fear', 'charm', 'sleep', 'poison'];
      
      if (immuneEffects.includes(effect.id)) {
        this.removeEffect(effect.id);
        
        // Announce immunity
        if (this.room) {
          this.room.getBroadcastTargets().forEach(player => {
            player.socket.write(`${this.name} is immune to ${effect.id}!\r\n`);
          });
        }
      }
    },

    // Undead make different sounds when hit
    hit: state => function (damage, attacker) {
      const sounds = [
        'The skeleton\'s bones rattle ominously.',
        'You hear the grinding of ancient bones.',
        'The undead creature lets out a hollow moan.'
      ];
      
      const sound = sounds[Math.floor(Math.random() * sounds.length)];
      
      if (this.room) {
        this.room.getBroadcastTargets().forEach(player => {
          player.socket.write(`${sound}\r\n`);
        });
      }
    },

    // Special death behavior for undead
    death: state => function () {
      if (this.room) {
        this.room.getBroadcastTargets().forEach(player => {
          player.socket.write(`${this.name} crumbles to dust, its bones scattering across the floor.\r\n`);
        });
      }
    }
  },

  methods: {
    // Undead regenerate slowly over time
    regenerate: function () {
      if (this.hasEffectType('combat')) {
        return; // Don't regenerate during combat
      }

      const currentHealth = this.getAttribute('health');
      const maxHealth = this.getMaxAttribute('health');
      
      if (currentHealth < maxHealth) {
        const regenAmount = Math.floor(maxHealth * 0.05); // 5% of max health
        const newHealth = Math.min(maxHealth, currentHealth + regenAmount);
        this.setAttributeBase('health', newHealth);
        
        if (this.room) {
          this.room.getBroadcastTargets().forEach(player => {
            player.socket.write(`${this.name}'s bones knit together slightly.\r\n`);
          });
        }
      }
    }
  }
};
const { TelnetServer, GameState, Player, NPC, Room } = require('../src/server');

describe('Combat Integration Tests', () => {
  let gameState;
  let server;
  let player;
  let npc;
  let room;
  let safeRoom;

  beforeEach(() => {
    // Create game state
    gameState = new GameState();
    
    // Override loadWorld to prevent file system access
    gameState.loadWorld = jest.fn();
    
    // Create server instance
    server = new TelnetServer(gameState);

    // Create test rooms
    room = new Room({
      id: 'combat_room',
      title: 'Combat Arena',
      description: 'A room for testing combat',
      exits: []
    });

    safeRoom = new Room({
      id: 'room8',
      title: 'Safe Room',
      description: 'A safe place to respawn',
      exits: []
    });

    // Add rooms to game state
    gameState.rooms.set('combat_room', room);
    gameState.rooms.set('room8', safeRoom);

    // Create test player
    player = new Player({
      name: 'CombatTester',
      attributes: { health: 100, maxHealth: 100, mana: 50, maxMana: 50, stamina: 100, maxStamina: 100 },
      stats: { level: 2, experience: 50, strength: 15, dexterity: 12, constitution: 14, intelligence: 10 },
      roomId: 'basic-area:combat_room',
      inventory: [],
      equipment: { weapon: null, armor: null, accessories: [] },
      combatState: { inCombat: false, target: null, initiative: 0, lastAction: null }
    });

    // Create test NPC
    npc = new NPC({
      id: 'combat_skeleton',
      name: 'a combat skeleton',
      description: 'A skeletal warrior ready for battle',
      level: 2,
      attributes: { health: 40, mana: 0, stamina: 30 },
      stats: { strength: 12, constitution: 10, dexterity: 14, intelligence: 3 },
      hostile: true,
      respawn: 60000 // 1 minute respawn
    });

    // Set up room relationships
    player.room = room;
    room.addPlayer(player);
    room.npcs.add(npc);

    // Mock socket
    player.socket = {
      write: jest.fn(),
      destroyed: false,
      writable: true,
      readyState: 'open'
    };

    // Mock safeWrite
    server.safeWrite = jest.fn((socket, data) => {
      if (socket && socket.write) {
        socket.write(data);
        return true;
      }
      return false;
    });

    // Mock showRoom
    server.showRoom = jest.fn();
  });

  describe('Full Combat Scenario', () => {
    test('should complete full combat encounter with player victory', async () => {
      jest.useFakeTimers();
      
      // Start combat
      server.attackTarget(player, 'skeleton');
      
      // Verify combat initiated
      expect(player.combatState.inCombat).toBe(true);
      expect(npc.combatState.inCombat).toBe(true);
      
      // Simulate combat until NPC dies
      let rounds = 0;
      const maxRounds = 20; // Prevent infinite loops
      
      while (npc.attributes.health > 0 && rounds < maxRounds) {
        if (player.combatState.initiative >= npc.combatState.initiative) {
          server.performPlayerAttack(player, npc);
          if (npc.attributes.health > 0) {
            jest.advanceTimersByTime(1500);
            server.performNPCAttack(npc, player);
          }
        } else {
          server.performNPCAttack(npc, player);
          if (player.attributes.health > 0) {
            jest.advanceTimersByTime(1500);
            server.performPlayerAttack(player, npc);
          }
        }
        rounds++;
        jest.advanceTimersByTime(1500);
      }
      
      // Verify NPC defeated
      expect(npc.attributes.health).toBe(0);
      expect(player.combatState.inCombat).toBe(false);
      expect(npc.combatState.inCombat).toBe(false);
      expect(room.npcs.has(npc)).toBe(false);
      expect(player.stats.experience).toBeGreaterThan(50); // Should have gained exp
      
      jest.useRealTimers();
    });

    test('should handle player death and respawn', async () => {
      jest.useFakeTimers();
      
      // Weaken player for quick death
      player.attributes.health = 5;
      
      // Start combat
      server.attackTarget(player, 'skeleton');
      
      // Let NPC attack until player dies
      while (player.attributes.health > 0) {
        server.performNPCAttack(npc, player);
        jest.advanceTimersByTime(1500);
      }
      
      // Verify player death and respawn
      expect(player.attributes.health).toBe(0);
      expect(player.combatState.inCombat).toBe(false);
      expect(npc.combatState.inCombat).toBe(false);
      
      // Advance timers to trigger respawn logic
      jest.advanceTimersByTime(2000);
      
      // Verify respawn occurred
      expect(player.room).toBe(safeRoom);
      expect(player.roomId).toBe('basic-area:room8');
      expect(player.attributes.health).toBeGreaterThan(0);
      expect(server.showRoom).toHaveBeenCalledWith(player);
      
      jest.useRealTimers();
    });
  });

  describe('Combat with Equipment', () => {
    test('should apply weapon damage in combat', () => {
      const weapon = {
        id: 'test_sword',
        name: 'a test sword',
        metadata: { damage: 8 }
      };
      player.equipment.weapon = weapon;
      
      const damage = server.calculateDamage(player, npc);
      
      // Damage should include weapon bonus
      expect(damage).toBeGreaterThan(8); // Base strength + weapon damage
    });

    test('should apply armor defense in combat', () => {
      const armor = {
        id: 'test_armor',
        name: 'test armor',
        metadata: { defense: 5 }
      };
      npc.equipment = { armor: armor };
      
      const damage = server.calculateDamage(player, npc);
      
      // Damage should be reduced by armor but still at least 1
      expect(damage).toBeGreaterThanOrEqual(1);
    });
  });

  describe('Multiple Combat Scenarios', () => {
    test('should prevent attacking while already in combat', () => {
      // Start combat with first NPC
      server.attackTarget(player, 'skeleton');
      expect(player.combatState.inCombat).toBe(true);
      
      // Try to attack again
      server.attackTarget(player, 'skeleton');
      
      expect(server.safeWrite).toHaveBeenCalledWith(
        player.socket, 
        'You are already in combat!\r\n'
      );
    });

    test('should prevent attacking dead NPCs', () => {
      npc.attributes.health = 0;
      
      server.attackTarget(player, 'skeleton');
      
      expect(player.combatState.inCombat).toBe(false);
      expect(server.safeWrite).toHaveBeenCalledWith(
        player.socket, 
        'a combat skeleton is already dead.\r\n'
      );
    });
  });

  describe('NPC Respawn', () => {
    test('should respawn NPC after configured time', () => {
      jest.useFakeTimers();
      
      // Kill the NPC
      server.handleNPCDeath(npc, player);
      
      // Verify NPC is removed
      expect(room.npcs.has(npc)).toBe(false);
      
      // Advance time to trigger respawn
      jest.advanceTimersByTime(60000); // 1 minute
      
      // Verify NPC respawned
      expect(room.npcs.size).toBe(1);
      const respawnedNPC = Array.from(room.npcs)[0];
      expect(respawnedNPC.name).toBe('a combat skeleton');
      expect(respawnedNPC.attributes.health).toBe(40); // Full health
      
      jest.useRealTimers();
    });
  });

  describe('Experience and Progression', () => {
    test('should award appropriate experience for NPC level', () => {
      const initialExp = player.stats.experience;
      const expectedExp = npc.level * 10; // 2 * 10 = 20
      
      server.handleNPCDeath(npc, player);
      
      expect(player.stats.experience).toBe(initialExp + expectedExp);
      expect(server.safeWrite).toHaveBeenCalledWith(
        player.socket, 
        `You gain ${expectedExp} experience points!\r\n`
      );
    });

    test('should handle NPCs with no level', () => {
      npc.level = undefined;
      const initialExp = player.stats.experience;
      const expectedExp = 1 * 10; // Default level 1
      
      server.handleNPCDeath(npc, player);
      
      expect(player.stats.experience).toBe(initialExp + expectedExp);
    });
  });

  describe('Room Broadcasting', () => {
    let otherPlayer;

    beforeEach(() => {
      otherPlayer = new Player({
        name: 'Observer',
        attributes: { health: 100, maxHealth: 100 },
        stats: { level: 1 },
        combatState: { inCombat: false, target: null, initiative: 0, lastAction: null }
      });
      
      otherPlayer.socket = {
        write: jest.fn(),
        destroyed: false,
        writable: true,
        readyState: 'open'
      };
      
      otherPlayer.room = room;
      room.addPlayer(otherPlayer);
    });

    test('should broadcast combat initiation to room', () => {
      server.attackTarget(player, 'skeleton');
      
      expect(server.safeWrite).toHaveBeenCalledWith(
        otherPlayer.socket, 
        'CombatTester attacks a combat skeleton!\r\n'
      );
    });

    test('should broadcast combat damage to room', () => {
      server.initializeCombat(player, npc);
      server.performPlayerAttack(player, npc);
      
      expect(server.safeWrite).toHaveBeenCalledWith(
        otherPlayer.socket, 
        expect.stringMatching(/CombatTester hits a combat skeleton for \d+ damage!/)
      );
    });

    test('should broadcast death to room', () => {
      server.handleNPCDeath(npc, player);
      
      expect(server.safeWrite).toHaveBeenCalledWith(
        otherPlayer.socket, 
        'CombatTester has defeated a combat skeleton!\r\n'
      );
    });
  });

  describe('Error Handling', () => {
    test('should handle missing room gracefully', () => {
      player.room = null;
      
      server.attackTarget(player, 'skeleton');
      
      expect(server.safeWrite).toHaveBeenCalledWith(
        player.socket, 
        'You are not in a valid location.\r\n'
      );
    });

    test('should handle missing safe room during respawn', () => {
      gameState.rooms.delete('room8');
      gameState.getRoom = jest.fn().mockReturnValue(null);
      
      player.attributes.health = 1;
      server.performNPCAttack(npc, player);
      
      // Should not crash, even if safe room is missing
      expect(player.attributes.health).toBe(0);
    });

    test('should handle socket errors during combat', () => {
      player.socket.destroyed = true;
      
      server.performPlayerAttack(player, npc);
      
      // Should not crash when socket is destroyed
      expect(npc.attributes.health).toBeLessThan(40);
    });
  });
});
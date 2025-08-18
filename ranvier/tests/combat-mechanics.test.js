const { TelnetServer, GameState, Player, NPC, Room } = require('../src/server');

describe('Combat Mechanics', () => {
  let gameState;
  let server;
  let player;
  let npc;
  let room;

  beforeEach(() => {
    // Create mock game state
    gameState = {
      rooms: new Map(),
      getRoom: jest.fn()
    };

    // Create server instance
    server = new TelnetServer(gameState);

    // Create test room
    room = new Room({
      id: 'test_room',
      title: 'Test Room',
      description: 'A test room for combat',
      exits: []
    });

    // Create test player
    player = new Player({
      name: 'TestPlayer',
      attributes: { health: 100, maxHealth: 100, mana: 50, maxMana: 50, stamina: 100, maxStamina: 100 },
      stats: { level: 1, experience: 0, strength: 12, dexterity: 10, constitution: 10, intelligence: 10 },
      roomId: 'test_room',
      inventory: [],
      equipment: { weapon: null, armor: null, accessories: [] },
      combatState: { inCombat: false, target: null, initiative: 0, lastAction: null }
    });

    // Create test NPC
    npc = new NPC({
      id: 'test_skeleton',
      name: 'a test skeleton',
      description: 'A skeletal warrior for testing',
      level: 2,
      attributes: { health: 50, mana: 0, stamina: 40 },
      stats: { strength: 10, constitution: 8, dexterity: 12, intelligence: 3 },
      hostile: true
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
  });

  describe('Combat Initiation', () => {
    test('should initiate combat with valid target', () => {
      server.attackTarget(player, 'skeleton');

      expect(player.combatState.inCombat).toBe(true);
      expect(player.combatState.target).toBe(npc);
      expect(npc.combatState.inCombat).toBe(true);
      expect(npc.combatState.target).toBe(player);
      expect(server.safeWrite).toHaveBeenCalledWith(player.socket, 'You attack a test skeleton!\r\n');
    });

    test('should reject attack on non-existent target', () => {
      server.attackTarget(player, 'dragon');

      expect(player.combatState.inCombat).toBe(false);
      expect(server.safeWrite).toHaveBeenCalledWith(player.socket, "You don't see 'dragon' here to attack.\r\n");
    });

    test('should reject attack when already in combat', () => {
      player.combatState.inCombat = true;
      
      server.attackTarget(player, 'skeleton');

      expect(server.safeWrite).toHaveBeenCalledWith(player.socket, 'You are already in combat!\r\n');
    });

    test('should reject attack on dead target', () => {
      npc.attributes.health = 0;
      
      server.attackTarget(player, 'skeleton');

      expect(player.combatState.inCombat).toBe(false);
      expect(server.safeWrite).toHaveBeenCalledWith(player.socket, 'a test skeleton is already dead.\r\n');
    });
  });

  describe('Initiative Calculation', () => {
    test('should calculate initiative based on dexterity and random factor', () => {
      const initiative = server.calculateInitiative(player);
      
      expect(initiative).toBeGreaterThanOrEqual(11); // min: 10 dex + 1 random
      expect(initiative).toBeLessThanOrEqual(30); // max: 10 dex + 20 random
    });

    test('should handle missing dexterity stat', () => {
      const noDexPlayer = new Player({
        name: 'NoDexPlayer',
        stats: { strength: 10 }
      });
      
      const initiative = server.calculateInitiative(noDexPlayer);
      
      expect(initiative).toBeGreaterThanOrEqual(11); // min: 10 default + 1 random
      expect(initiative).toBeLessThanOrEqual(30); // max: 10 default + 20 random
    });
  });

  describe('Damage Calculation', () => {
    test('should calculate basic damage from strength', () => {
      const damage = server.calculateDamage(player, npc);
      
      expect(damage).toBeGreaterThanOrEqual(1); // minimum damage
      expect(damage).toBeGreaterThan(0);
    });

    test('should include weapon damage when equipped', () => {
      const weapon = {
        name: 'test sword',
        metadata: { damage: 5 }
      };
      player.equipment.weapon = weapon;
      
      const damage = server.calculateDamage(player, npc);
      
      expect(damage).toBeGreaterThan(5); // should be more than weapon damage alone
    });

    test('should apply armor defense', () => {
      const armor = {
        name: 'test armor',
        metadata: { defense: 3 }
      };
      npc.equipment = { armor: armor };
      
      const baseDamage = server.calculateDamage(player, npc);
      
      // Damage should be reduced but not below 1
      expect(baseDamage).toBeGreaterThanOrEqual(1);
    });

    test('should apply constitution-based defense', () => {
      npc.stats.constitution = 20; // High constitution for defense
      
      const damage = server.calculateDamage(player, npc);
      
      expect(damage).toBeGreaterThanOrEqual(1); // minimum damage always applies
    });

    test('should ensure minimum damage of 1', () => {
      // Set up scenario where defense would reduce damage to 0 or negative
      player.stats.strength = 1;
      npc.stats.constitution = 40;
      npc.equipment = { armor: { metadata: { defense: 10 } } };
      
      const damage = server.calculateDamage(player, npc);
      
      expect(damage).toBe(1);
    });
  });

  describe('Combat Flow', () => {
    test('should handle player attack sequence', () => {
      jest.useFakeTimers();
      
      // Initialize combat state first
      server.initializeCombat(player, npc);
      
      server.performPlayerAttack(player, npc);
      
      expect(npc.attributes.health).toBeLessThan(50); // NPC should take damage
      expect(player.combatState.lastAction).toBeInstanceOf(Date);
      expect(server.safeWrite).toHaveBeenCalledWith(
        player.socket, 
        expect.stringMatching(/You hit a test skeleton for \d+ damage!/)
      );
      
      jest.useRealTimers();
    });

    test('should handle NPC attack sequence', () => {
      jest.useFakeTimers();
      
      // Initialize combat state first
      server.initializeCombat(player, npc);
      
      server.performNPCAttack(npc, player);
      
      expect(player.attributes.health).toBeLessThan(100); // Player should take damage
      expect(npc.combatState.lastAction).toBeInstanceOf(Date);
      expect(server.safeWrite).toHaveBeenCalledWith(
        player.socket, 
        expect.stringMatching(/a test skeleton hits you for \d+ damage!/)
      );
      
      jest.useRealTimers();
    });

    test('should not attack if not in combat', () => {
      player.combatState.inCombat = false;
      const initialHealth = npc.attributes.health;
      
      server.performPlayerAttack(player, npc);
      
      expect(npc.attributes.health).toBe(initialHealth);
    });
  });

  describe('Death Handling', () => {
    test('should handle NPC death', () => {
      npc.attributes.health = 1;
      const initialExp = player.stats.experience;
      
      // Initialize combat state first
      server.initializeCombat(player, npc);
      
      server.performPlayerAttack(player, npc);
      
      expect(npc.attributes.health).toBe(0);
      expect(player.stats.experience).toBeGreaterThan(initialExp);
      expect(player.combatState.inCombat).toBe(false);
      expect(npc.combatState.inCombat).toBe(false);
      expect(room.npcs.has(npc)).toBe(false);
      expect(server.safeWrite).toHaveBeenCalledWith(player.socket, 'You have defeated a test skeleton!\r\n');
    });

    test('should handle player death and respawn', () => {
      player.attributes.health = 1;
      gameState.getRoom.mockReturnValue(room); // Mock safe room
      
      // Initialize combat state first
      server.initializeCombat(player, npc);
      
      server.performNPCAttack(npc, player);
      
      // Player should be dead initially, then respawned
      expect(player.combatState.inCombat).toBe(false);
      expect(npc.combatState.inCombat).toBe(false);
      expect(server.safeWrite).toHaveBeenCalledWith(player.socket, 'You have been defeated!\r\n');
      // Health should be restored to 50% after respawn
      expect(player.attributes.health).toBeGreaterThan(0);
    });

    test('should award experience for NPC kills', () => {
      const initialExp = player.stats.experience;
      const expectedExp = npc.level * 10;
      
      server.handleNPCDeath(npc, player);
      
      expect(player.stats.experience).toBe(initialExp + expectedExp);
      expect(server.safeWrite).toHaveBeenCalledWith(
        player.socket, 
        `You gain ${expectedExp} experience points!\r\n`
      );
    });
  });

  describe('Combat State Management', () => {
    test('should properly initialize combat state', () => {
      server.initializeCombat(player, npc);
      
      expect(player.combatState.inCombat).toBe(true);
      expect(player.combatState.target).toBe(npc);
      expect(player.combatState.initiative).toBeGreaterThan(0);
      expect(player.combatState.lastAction).toBeInstanceOf(Date);
      
      expect(npc.combatState.inCombat).toBe(true);
      expect(npc.combatState.target).toBe(player);
      expect(npc.combatState.initiative).toBeGreaterThan(0);
      expect(npc.combatState.lastAction).toBeInstanceOf(Date);
    });

    test('should properly end combat state', () => {
      // Set up combat state
      player.combatState.inCombat = true;
      player.combatState.target = npc;
      npc.combatState.inCombat = true;
      npc.combatState.target = player;
      
      server.endCombat(player, npc);
      
      expect(player.combatState.inCombat).toBe(false);
      expect(player.combatState.target).toBe(null);
      expect(npc.combatState.inCombat).toBe(false);
      expect(npc.combatState.target).toBe(null);
    });
  });

  describe('Turn Order', () => {
    test('should start combat with higher initiative first', () => {
      const performPlayerAttackSpy = jest.spyOn(server, 'performPlayerAttack');
      const performNPCAttackSpy = jest.spyOn(server, 'performNPCAttack');
      
      // Set initiative directly instead of mocking calculation
      player.combatState.initiative = 20;
      npc.combatState.initiative = 10;
      
      server.startCombatRound(player, npc);
      
      expect(performPlayerAttackSpy).toHaveBeenCalledWith(player, npc);
      expect(performNPCAttackSpy).not.toHaveBeenCalled();
      
      // Clean up spies
      performPlayerAttackSpy.mockRestore();
      performNPCAttackSpy.mockRestore();
    });

    test('should start combat with NPC first if higher initiative', () => {
      const performPlayerAttackSpy = jest.spyOn(server, 'performPlayerAttack');
      const performNPCAttackSpy = jest.spyOn(server, 'performNPCAttack');
      
      // Set initiative directly instead of mocking calculation
      player.combatState.initiative = 10;
      npc.combatState.initiative = 20;
      
      server.startCombatRound(player, npc);
      
      expect(performNPCAttackSpy).toHaveBeenCalledWith(npc, player);
      expect(performPlayerAttackSpy).not.toHaveBeenCalled();
      
      // Clean up spies
      performPlayerAttackSpy.mockRestore();
      performNPCAttackSpy.mockRestore();
    });
  });
});
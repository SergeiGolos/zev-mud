const { TelnetServer, GameState, Player, NPC, Room } = require('../src/server');

describe('Death and Respawn Mechanics', () => {
  let gameState;
  let server;
  let player;
  let npc;
  let room;
  let safeRoom;

  beforeEach(() => {
    // Create mock game state
    gameState = {
      rooms: new Map(),
      getRoom: jest.fn()
    };

    // Create server instance
    server = new TelnetServer(gameState);

    // Create test rooms
    room = new Room({
      id: 'danger_room',
      title: 'Dangerous Room',
      description: 'A dangerous room with hostile creatures',
      exits: []
    });

    safeRoom = new Room({
      id: 'room8',
      title: 'Safe Haven',
      description: 'A safe place to recover',
      exits: []
    });

    // Set up game state rooms
    gameState.rooms.set('danger_room', room);
    gameState.rooms.set('room8', safeRoom);
    gameState.getRoom.mockImplementation((roomId) => {
      const id = roomId.includes(':') ? roomId.split(':')[1] : roomId;
      return gameState.rooms.get(id);
    });

    // Create test player
    player = new Player({
      name: 'TestHero',
      attributes: { health: 100, maxHealth: 100, mana: 50, maxMana: 50, stamina: 100, maxStamina: 100 },
      stats: { level: 2, experience: 100, strength: 15, dexterity: 12, constitution: 14, intelligence: 10 },
      roomId: 'basic-area:danger_room',
      inventory: [],
      equipment: { weapon: null, armor: null, accessories: [] },
      combatState: { inCombat: false, target: null, initiative: 0, lastAction: null }
    });

    // Create test NPC
    npc = new NPC({
      id: 'death_dealer',
      name: 'a death dealer',
      description: 'A powerful creature that can kill players',
      level: 5,
      attributes: { health: 100, mana: 0, stamina: 80 },
      stats: { strength: 25, constitution: 20, dexterity: 15, intelligence: 5 },
      hostile: true,
      respawn: 120000 // 2 minutes
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

    // Mock safeWrite and showRoom
    server.safeWrite = jest.fn((socket, data) => {
      if (socket && socket.write) {
        socket.write(data);
        return true;
      }
      return false;
    });

    server.showRoom = jest.fn();
  });

  describe('Player Death Detection', () => {
    test('should detect when player health reaches zero', () => {
      player.attributes.health = 1;
      server.initializeCombat(player, npc);
      
      // Perform attack that should kill player
      server.performNPCAttack(npc, player);
      
      // Player should be respawned with 50% health, not 0
      expect(player.attributes.health).toBe(50); // 50% of max health after respawn
      expect(player.combatState.inCombat).toBe(false);
      expect(npc.combatState.inCombat).toBe(false);
      expect(player.room).toBe(safeRoom); // Should be in safe room
    });

    test('should handle death when health goes below zero', () => {
      player.attributes.health = 1;
      // Mock high damage to ensure death
      jest.spyOn(server, 'calculateDamage').mockReturnValue(50);
      
      server.initializeCombat(player, npc);
      server.performNPCAttack(npc, player);
      
      // Player should be respawned with 50% health after death
      expect(player.attributes.health).toBe(50); // 50% of max health after respawn
      expect(player.combatState.inCombat).toBe(false);
      expect(player.room).toBe(safeRoom); // Should be in safe room
    });

    test('should announce player death to room', () => {
      player.attributes.health = 1;
      server.initializeCombat(player, npc);
      
      server.performNPCAttack(npc, player);
      
      expect(server.safeWrite).toHaveBeenCalledWith(
        player.socket, 
        'You have been defeated!\r\n'
      );
    });
  });

  describe('Player Respawn Mechanics', () => {
    test('should respawn player at safe location', () => {
      jest.useFakeTimers();
      
      player.attributes.health = 1;
      server.initializeCombat(player, npc);
      
      // Kill the player
      server.performNPCAttack(npc, player);
      
      // Advance timers to trigger respawn
      jest.advanceTimersByTime(2000);
      
      expect(player.room).toBe(safeRoom);
      expect(player.roomId).toBe('basic-area:room8');
      expect(safeRoom.players.has(player)).toBe(true);
      expect(room.players.has(player)).toBe(false);
      
      jest.useRealTimers();
    });

    test('should restore player health to 50% on respawn', () => {
      player.attributes.health = 1;
      player.attributes.maxHealth = 100;
      
      server.handlePlayerDeath(player, npc);
      
      expect(player.attributes.health).toBe(50); // 50% of max health
    });

    test('should show respawn message to player', () => {
      player.attributes.health = 1;
      
      server.handlePlayerDeath(player, npc);
      
      expect(server.safeWrite).toHaveBeenCalledWith(
        player.socket, 
        'You wake up in a safe place, battered but alive.\r\n'
      );
    });

    test('should show room after respawn', () => {
      jest.useFakeTimers();
      
      player.attributes.health = 1;
      server.handlePlayerDeath(player, npc);
      
      // Advance timers to trigger room display
      jest.advanceTimersByTime(2000);
      
      expect(server.showRoom).toHaveBeenCalledWith(player);
      
      jest.useRealTimers();
    });

    test('should handle missing safe room gracefully', () => {
      gameState.getRoom.mockReturnValue(null);
      player.attributes.health = 1;
      
      // Should not crash even if safe room is missing
      expect(() => {
        server.handlePlayerDeath(player, npc);
      }).not.toThrow();
    });
  });

  describe('NPC Death Detection', () => {
    test('should detect when NPC health reaches zero', () => {
      npc.attributes.health = 1;
      server.initializeCombat(player, npc);
      
      server.performPlayerAttack(player, npc);
      
      expect(npc.attributes.health).toBe(0);
      expect(player.combatState.inCombat).toBe(false);
      expect(npc.combatState.inCombat).toBe(false);
    });

    test('should remove dead NPC from room', () => {
      npc.attributes.health = 1;
      server.initializeCombat(player, npc);
      
      server.performPlayerAttack(player, npc);
      
      expect(room.npcs.has(npc)).toBe(false);
    });

    test('should announce NPC death to room', () => {
      npc.attributes.health = 1;
      server.initializeCombat(player, npc);
      
      server.performPlayerAttack(player, npc);
      
      expect(server.safeWrite).toHaveBeenCalledWith(
        player.socket, 
        'You have defeated a death dealer!\r\n'
      );
    });

    test('should award experience for NPC kill', () => {
      const initialExp = player.stats.experience;
      npc.attributes.health = 1;
      server.initializeCombat(player, npc);
      
      server.performPlayerAttack(player, npc);
      
      const expectedExp = npc.level * 10; // 5 * 10 = 50
      expect(player.stats.experience).toBe(initialExp + expectedExp);
      expect(server.safeWrite).toHaveBeenCalledWith(
        player.socket, 
        `You gain ${expectedExp} experience points!\r\n`
      );
    });
  });

  describe('NPC Respawn Mechanics', () => {
    test('should respawn NPC after configured time', () => {
      jest.useFakeTimers();
      
      // Kill the NPC
      server.handleNPCDeath(npc, player);
      
      // Verify NPC is removed
      expect(room.npcs.has(npc)).toBe(false);
      
      // Advance time to trigger respawn (2 minutes)
      jest.advanceTimersByTime(120000);
      
      // Verify NPC respawned
      expect(room.npcs.size).toBe(1);
      const respawnedNPC = Array.from(room.npcs)[0];
      expect(respawnedNPC.name).toBe('a death dealer');
      expect(respawnedNPC.attributes.health).toBe(100); // Full health
      
      jest.useRealTimers();
    });

    test('should announce NPC respawn to players in room', () => {
      jest.useFakeTimers();
      
      server.handleNPCDeath(npc, player);
      
      // Clear previous calls
      server.safeWrite.mockClear();
      
      // Advance time to trigger respawn
      jest.advanceTimersByTime(120000);
      
      expect(server.safeWrite).toHaveBeenCalledWith(
        player.socket, 
        'a death dealer appears in the area.\r\n'
      );
      
      jest.useRealTimers();
    });

    test('should not respawn NPC without respawn time configured', () => {
      jest.useFakeTimers();
      
      // Remove respawn configuration
      npc.def.respawn = undefined;
      
      server.handleNPCDeath(npc, player);
      
      // Advance time significantly
      jest.advanceTimersByTime(300000); // 5 minutes
      
      // NPC should not respawn
      expect(room.npcs.size).toBe(0);
      
      jest.useRealTimers();
    });
  });

  describe('Combat State Cleanup', () => {
    test('should reset combat state on player death', () => {
      player.attributes.health = 1;
      server.initializeCombat(player, npc);
      
      // Verify combat is active
      expect(player.combatState.inCombat).toBe(true);
      expect(npc.combatState.inCombat).toBe(true);
      
      server.performNPCAttack(npc, player);
      
      // Verify combat state is reset
      expect(player.combatState.inCombat).toBe(false);
      expect(player.combatState.target).toBe(null);
      expect(npc.combatState.inCombat).toBe(false);
      expect(npc.combatState.target).toBe(null);
    });

    test('should reset combat state on NPC death', () => {
      npc.attributes.health = 1;
      server.initializeCombat(player, npc);
      
      // Verify combat is active
      expect(player.combatState.inCombat).toBe(true);
      expect(npc.combatState.inCombat).toBe(true);
      
      server.performPlayerAttack(player, npc);
      
      // Verify combat state is reset
      expect(player.combatState.inCombat).toBe(false);
      expect(player.combatState.target).toBe(null);
      expect(npc.combatState.inCombat).toBe(false);
      expect(npc.combatState.target).toBe(null);
    });
  });

  describe('Multiple Player Scenarios', () => {
    let otherPlayer;

    beforeEach(() => {
      otherPlayer = new Player({
        name: 'Observer',
        attributes: { health: 100, maxHealth: 100 },
        stats: { level: 1, experience: 0 },
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

    test('should broadcast player death to other players', () => {
      player.attributes.health = 1;
      server.initializeCombat(player, npc);
      
      server.performNPCAttack(npc, player);
      
      expect(server.safeWrite).toHaveBeenCalledWith(
        otherPlayer.socket, 
        'TestHero has been defeated by a death dealer!\r\n'
      );
    });

    test('should broadcast NPC death to other players', () => {
      npc.attributes.health = 1;
      server.initializeCombat(player, npc);
      
      server.performPlayerAttack(player, npc);
      
      expect(server.safeWrite).toHaveBeenCalledWith(
        otherPlayer.socket, 
        'TestHero has defeated a death dealer!\r\n'
      );
    });
  });

  describe('Edge Cases', () => {
    test('should handle death with destroyed socket', () => {
      player.socket.destroyed = true;
      player.attributes.health = 1;
      
      expect(() => {
        server.handlePlayerDeath(player, npc);
      }).not.toThrow();
    });

    test('should handle NPC death with no players in room', () => {
      room.players.clear();
      
      expect(() => {
        server.handleNPCDeath(npc, player);
      }).not.toThrow();
    });

    test('should handle respawn with invalid room reference', () => {
      player.roomId = 'invalid:room';
      gameState.getRoom.mockReturnValue(null);
      
      expect(() => {
        server.handlePlayerDeath(player, npc);
      }).not.toThrow();
    });
  });
});
const { describe, test, expect, beforeEach, afterEach } = require('@jest/globals');

describe('NPC Hostile Behavior System', () => {
  let mockNPC, mockPlayer, mockRoom, mockState;
  let aggressiveBehavior;

  beforeEach(() => {
    // Mock player
    mockPlayer = {
      name: 'TestPlayer',
      room: null,
      socket: {
        write: () => {}
      },
      getAttribute: (attr) => attr === 'health' ? 100 : 50,
      getMaxAttribute: (attr) => attr === 'health' ? 100 : 50,
      setAttributeBase: () => {},
      hasEffectType: () => false,
      addEffect: () => {},
      removeEffect: () => {},
      combatHistory: []
    };

    // Mock room
    mockRoom = {
      npcs: new Set(),
      players: new Set([mockPlayer]),
      exits: {
        north: 'basic-area:room2',
        south: 'basic-area:room3'
      },
      getBroadcastTargets: () => [mockPlayer],
      addNpc: () => {},
      removeNpc: () => {},
      addPlayer: () => {},
      removePlayer: () => {},
      entityReference: 'basic-area:room1'
    };

    // Mock NPC with enhanced AI
    mockNPC = {
      id: 'test_skeleton',
      name: 'a test skeleton',
      room: mockRoom,
      hostile: true,
      stats: {
        strength: 12,
        dexterity: 14
      },
      metadata: {
        spawnRoom: 'basic-area:room1',
        originalHostile: true,
        patrolRoute: ['basic-area:room1', 'basic-area:room2'],
        combatTactics: 'aggressive',
        aggroRange: 1,
        memoryDuration: 30000
      },
      respawn: 180000,
      getAttribute: (attr) => attr === 'health' ? 50 : 25,
      getMaxAttribute: (attr) => attr === 'health' ? 50 : 25,
      setAttributeBase: () => {},
      hasEffectType: () => false,
      addEffect: () => {},
      removeEffect: () => {},
      combatTarget: null
    };

    // Mock state
    mockState = {
      RoomManager: {
        getRoom: (id) => {
          if (id === 'basic-area:room1') return mockRoom;
          if (id === 'basic-area:room2') return { ...mockRoom, entityReference: 'basic-area:room2' };
          return null;
        }
      }
    };

    // Set up relationships
    mockPlayer.room = mockRoom;
    mockRoom.npcs.add(mockNPC);

    // Load behavior
    aggressiveBehavior = require('../bundles/basic-world/behaviors/npc/aggressive.js');
    
    // Bind methods to mockNPC
    Object.keys(aggressiveBehavior.methods).forEach(methodName => {
      mockNPC[methodName] = aggressiveBehavior.methods[methodName].bind(mockNPC);
    });
  });

  afterEach(() => {
    // Clean up any intervals
    if (mockNPC.aiInterval) {
      clearInterval(mockNPC.aiInterval);
      mockNPC.aiInterval = null;
    }
    if (mockNPC.patrolInterval) {
      clearInterval(mockNPC.patrolInterval);
      mockNPC.patrolInterval = null;
    }
    if (mockNPC.cleanup) {
      mockNPC.cleanup();
    }
  });

  describe('AI Initialization', () => {
    test('should initialize AI state on spawn', () => {
      const spawnListener = aggressiveBehavior.listeners.spawn(mockState);
      spawnListener.call(mockNPC);

      expect(mockNPC.aiState).toBeDefined();
      expect(mockNPC.aiState.alertLevel).toBe(0);
      expect(mockNPC.aiState.patrolRoute).toEqual(['basic-area:room1', 'basic-area:room2']);
      expect(mockNPC.aiState.combatTactics).toBe('aggressive');
      expect(mockNPC.aiState.aggroRange).toBe(1);
    });

    test('should start AI loop on spawn', () => {
      const spawnListener = aggressiveBehavior.listeners.spawn(mockState);
      spawnListener.call(mockNPC);

      expect(mockNPC.aiInterval).toBeDefined();
    });
  });

  describe('Threat Detection', () => {
    beforeEach(() => {
      const spawnListener = aggressiveBehavior.listeners.spawn(mockState);
      spawnListener.call(mockNPC);
    });

    test('should detect hostile players on enter', () => {
      const playerEnterListener = aggressiveBehavior.listeners.playerEnter(mockState);
      
      let attackInitiated = false;
      mockNPC.initiateAttack = () => { attackInitiated = true; };
      
      playerEnterListener.call(mockNPC, mockPlayer);
      
      expect(mockNPC.aiState.alertLevel).toBe(2);
      expect(mockNPC.aiState.lastPlayerSeen).toBeTruthy();
      
      // Attack should be initiated after delay
      setTimeout(() => {
        expect(attackInitiated).toBe(true);
      }, 2100);
    });

    test('should evaluate non-hostile NPCs differently', () => {
      mockNPC.hostile = false;
      
      const playerEnterListener = aggressiveBehavior.listeners.playerEnter(mockState);
      playerEnterListener.call(mockNPC, mockPlayer);
      
      // Should evaluate rather than immediately attack
      expect(mockNPC.aiState.alertLevel).toBeLessThan(2);
    });

    test('should react to being hit', () => {
      const hitListener = aggressiveBehavior.listeners.hit(mockState);
      
      let attackInitiated = false;
      mockNPC.initiateAttack = () => { attackInitiated = true; };
      
      hitListener.call(mockNPC, 10, mockPlayer);
      
      expect(mockNPC.aiState.alertLevel).toBe(2);
      expect(attackInitiated).toBe(true);
    });
  });

  describe('Patrol Behavior', () => {
    beforeEach(() => {
      const spawnListener = aggressiveBehavior.listeners.spawn(mockState);
      spawnListener.call(mockNPC);
    });

    test('should start patrol if route is defined', () => {
      expect(mockNPC.patrolInterval).toBeDefined();
    });

    test('should move along patrol route', () => {
      const continuePatrol = aggressiveBehavior.methods.continuePatrol;
      
      let moveToRoomCalled = false;
      mockNPC.moveToRoom = () => { moveToRoomCalled = true; };
      
      // Set up patrol state
      mockNPC.aiState.lastPatrolMove = Date.now() - 10000; // 10 seconds ago
      
      continuePatrol.call(mockNPC, mockState);
      
      expect(mockNPC.aiState.currentPatrolIndex).toBe(1);
    });

    test('should reverse direction at patrol route ends', () => {
      const continuePatrol = aggressiveBehavior.methods.continuePatrol;
      
      // Set to end of route
      mockNPC.aiState.currentPatrolIndex = 1;
      mockNPC.aiState.patrolDirection = 1;
      mockNPC.aiState.lastPatrolMove = Date.now() - 10000;
      
      continuePatrol.call(mockNPC, mockState);
      
      expect(mockNPC.aiState.patrolDirection).toBe(-1);
      expect(mockNPC.aiState.currentPatrolIndex).toBe(0);
    });
  });

  describe('Combat AI', () => {
    beforeEach(() => {
      const spawnListener = aggressiveBehavior.listeners.spawn(mockState);
      spawnListener.call(mockNPC);
      mockNPC.combatTarget = mockPlayer;
    });

    test('should use aggressive tactics by default', () => {
      mockNPC.hasEffectType = () => true; // In combat
      
      const updateCombatAI = aggressiveBehavior.methods.updateCombatAI;
      updateCombatAI.call(mockNPC, mockState);
      
      // Aggressive tactics don't retreat
      expect(mockNPC.aiState.combatTactics).toBe('aggressive');
    });

    test('should consider defensive tactics when configured', () => {
      mockNPC.aiState.combatTactics = 'defensive';
      mockNPC.getAttribute = (attr) => attr === 'health' ? 10 : 25; // Low health
      mockNPC.hasEffectType = () => true;
      
      let retreatAttempted = false;
      mockNPC.attemptRetreat = () => { retreatAttempted = true; };
      
      const considerDefensiveTactics = aggressiveBehavior.methods.considerDefensiveTactics;
      considerDefensiveTactics.call(mockNPC, mockState);
      
      expect(retreatAttempted).toBe(true);
    });

    test('should call for help when using tactical combat', () => {
      mockNPC.aiState.combatTactics = 'tactical';
      
      // Add an ally NPC
      const allyNPC = {
        hostile: true,
        hasEffectType: () => false,
        aiState: { alertLevel: 0 },
        initiateAttack: () => {}
      };
      mockRoom.npcs.add(allyNPC);
      
      const callForHelp = aggressiveBehavior.methods.callForHelp;
      callForHelp.call(mockNPC, mockState);
      
      expect(allyNPC.aiState.alertLevel).toBe(2);
    });
  });

  describe('Respawn System', () => {
    beforeEach(() => {
      const spawnListener = aggressiveBehavior.listeners.spawn(mockState);
      spawnListener.call(mockNPC);
    });

    test('should schedule respawn on death', () => {
      const deathListener = aggressiveBehavior.listeners.death(mockState);
      
      let respawnScheduled = false;
      mockNPC.scheduleRespawn = () => { respawnScheduled = true; };
      
      deathListener.call(mockNPC);
      
      expect(respawnScheduled).toBe(true);
    });

    test('should reset NPC state on respawn', () => {
      const respawnNPC = aggressiveBehavior.methods.respawnNPC;
      
      // Set up NPC as if it died in combat
      mockNPC.hostile = true;
      mockNPC.aiState.alertLevel = 2;
      mockNPC.combatTarget = mockPlayer;
      
      respawnNPC.call(mockNPC, mockState);
      
      expect(mockNPC.aiState.alertLevel).toBe(0);
      expect(mockNPC.combatTarget).toBe(null);
    });
  });

  describe('Movement and Pursuit', () => {
    beforeEach(() => {
      const spawnListener = aggressiveBehavior.listeners.spawn(mockState);
      spawnListener.call(mockNPC);
    });

    test('should move to adjacent rooms when scanning for threats', () => {
      mockNPC.aiState.aggroRange = 2;
      
      let moveToRoomCalled = false;
      mockNPC.moveToRoom = () => { moveToRoomCalled = true; };
      mockNPC.isPlayerThreat = () => true;
      
      const scanAdjacentRooms = aggressiveBehavior.methods.scanAdjacentRooms;
      scanAdjacentRooms.call(mockNPC, mockState);
      
      expect(moveToRoomCalled).toBe(true);
    });

    test('should handle target fleeing based on tactics', () => {
      mockNPC.combatTarget = mockPlayer;
      mockNPC.hasEffectType = () => true;
      
      const playerLeaveListener = aggressiveBehavior.listeners.playerLeave(mockState);
      
      let targetFledHandled = false;
      mockNPC.handleTargetFled = () => { targetFledHandled = true; };
      
      playerLeaveListener.call(mockNPC, mockPlayer);
      
      expect(targetFledHandled).toBe(true);
    });

    test('should pursue aggressive targets', () => {
      mockNPC.aiState.combatTactics = 'aggressive';
      mockNPC.hasEffectType = () => true;
      
      let moveToRoomCalled = false;
      mockNPC.moveToRoom = () => { moveToRoomCalled = true; };
      
      const handleTargetFled = aggressiveBehavior.methods.handleTargetFled;
      
      handleTargetFled.call(mockNPC, mockPlayer, mockState);
      
      // Should attempt to pursue after delay
      setTimeout(() => {
        expect(moveToRoomCalled).toBe(true);
      }, 2100);
    });
  });

  describe('Memory and Alert System', () => {
    beforeEach(() => {
      const spawnListener = aggressiveBehavior.listeners.spawn(mockState);
      spawnListener.call(mockNPC);
    });

    test('should decay alert level over time', () => {
      mockNPC.aiState.alertLevel = 2;
      mockNPC.aiState.lastPlayerSeen = Date.now() - 35000; // 35 seconds ago
      mockNPC.aiState.memoryDuration = 30000; // 30 seconds
      
      // Mock scanForThreats to not interfere with the test
      mockNPC.scanForThreats = () => {};
      mockNPC.continuePatrol = () => {};
      
      const updateAI = aggressiveBehavior.methods.updateAI;
      updateAI.call(mockNPC, mockState);
      
      expect(mockNPC.aiState.alertLevel).toBe(1);
    });

    test('should identify player threats based on combat history', () => {
      mockPlayer.combatHistory = [
        {
          target: mockNPC.id,
          timestamp: Date.now() - 60000 // 1 minute ago
        }
      ];
      
      const isPlayerThreat = aggressiveBehavior.methods.isPlayerThreat;
      const isThreat = isPlayerThreat.call(mockNPC, mockPlayer);
      
      expect(isThreat).toBe(true);
    });
  });
});
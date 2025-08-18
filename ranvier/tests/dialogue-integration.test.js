const { describe, test, expect, beforeEach, afterEach } = require('@jest/globals');
const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');

describe('NPC Dialogue Integration Tests', () => {
  let mockPlayer, mockRoom, mockState;
  let talkCommand, respondCommand;
  let guardianNPC, skeletonNPC;

  beforeEach(() => {
    // Mock player
    mockPlayer = {
      name: 'TestPlayer',
      room: null,
      dialogueState: {},
      socket: {
        write: () => {}
      },
      hasEffectType: () => false
    };

    // Mock room
    mockRoom = {
      npcs: new Set(),
      getBroadcastTargets: () => [mockPlayer]
    };

    // Mock state
    mockState = {
      RoomManager: {
        getRoom: () => {}
      }
    };

    // Load actual NPC data from YAML
    const npcsPath = path.join(__dirname, '../bundles/basic-world/areas/basic-area/npcs.yml');
    const npcsData = yaml.load(fs.readFileSync(npcsPath, 'utf8'));

    // Create guardian NPC from actual data
    const guardianData = npcsData.find(npc => npc.id === 'guardian_statue');
    guardianNPC = {
      id: guardianData.id,
      name: guardianData.name,
      description: guardianData.description,
      room: mockRoom,
      hostile: guardianData.hostile,
      dialogue: guardianData.dialogue,
      metadata: guardianData.metadata,
      hasEffectType: () => false,
      emit: () => {}
    };

    // Create skeleton NPC from actual data
    const skeletonData = npcsData.find(npc => npc.id === 'skeleton_warrior');
    skeletonNPC = {
      id: skeletonData.id,
      name: skeletonData.name,
      description: skeletonData.description,
      room: mockRoom,
      hostile: skeletonData.hostile,
      dialogue: skeletonData.dialogue,
      metadata: skeletonData.metadata,
      hasEffectType: () => false,
      emit: () => {},
      addEffect: () => {},
      combatTarget: null
    };

    // Set up relationships
    mockPlayer.room = mockRoom;
    mockRoom.npcs.add(guardianNPC);
    mockRoom.npcs.add(skeletonNPC);

    // Mock Broadcast with tracking
    global.Broadcast = {
      sayAt: function(player, message) {
        this.lastSayAt = { player, message };
      },
      sayAtExcept: function(room, message, except) {
        this.lastSayAtExcept = { room, message, except };
      }
    };

    // Load commands
    talkCommand = require('../bundles/basic-world/commands/talk.js');
    respondCommand = require('../bundles/basic-world/commands/respond.js');
  });

  afterEach(() => {
    // Clear any state if needed
  });

  describe('Guardian Statue Dialogue Flow', () => {
    test('should start with default greeting', () => {
      talkCommand.command(mockState)('guardian', mockPlayer);
      
      expect(global.Broadcast.sayAt).toHaveBeenCalledWith(
        mockPlayer, 
        expect.stringContaining('I am the keeper of this sacred place')
      );
      
      // Should show response options
      expect(global.Broadcast.sayAt).toHaveBeenCalledWith(
        mockPlayer, 
        '  1. I\'m just exploring this place.'
      );
      expect(global.Broadcast.sayAt).toHaveBeenCalledWith(
        mockPlayer, 
        '  2. I seek the ancient treasures hidden here.'
      );
      expect(global.Broadcast.sayAt).toHaveBeenCalledWith(
        mockPlayer, 
        '  3. I mean no harm, great guardian.'
      );
    });

    test('should handle exploring response path', () => {
      // Start dialogue
      talkCommand.command(mockState)('guardian', mockPlayer);
      
      // Choose exploring option
      respondCommand.command(mockState)('1', mockPlayer);
      
      expect(global.Broadcast.sayAt).toHaveBeenCalledWith(
        mockPlayer, 
        'You say: "I\'m just exploring this place."'
      );
      
      // Wait for continuation
      setTimeout(() => {
        expect(global.Broadcast.sayAt).toHaveBeenCalledWith(
          mockPlayer, 
          expect.stringContaining('Curiosity is not a sin')
        );
      }, 1100);
    });

    test('should handle treasure seeker response path', () => {
      // Start dialogue
      talkCommand.command(mockState)('guardian', mockPlayer);
      
      // Choose treasure seeker option
      respondCommand.command(mockState)('2', mockPlayer);
      
      expect(global.Broadcast.sayAt).toHaveBeenCalledWith(
        mockPlayer, 
        'You say: "I seek the ancient treasures hidden here."'
      );
      
      // Wait for continuation
      setTimeout(() => {
        expect(global.Broadcast.sayAt).toHaveBeenCalledWith(
          mockPlayer, 
          expect.stringContaining('Greed has been the downfall')
        );
      }, 1100);
    });

    test('should handle peaceful response path', () => {
      // Start dialogue
      talkCommand.command(mockState)('guardian', mockPlayer);
      
      // Choose peaceful option
      respondCommand.command(mockState)('3', mockPlayer);
      
      expect(global.Broadcast.sayAt).toHaveBeenCalledWith(
        mockPlayer, 
        'You say: "I mean no harm, great guardian."'
      );
      
      // Wait for continuation
      setTimeout(() => {
        expect(global.Broadcast.sayAt).toHaveBeenCalledWith(
          mockPlayer, 
          expect.stringContaining('Your respectful manner is noted')
        );
      }, 1100);
    });

    test('should maintain dialogue state across interactions', () => {
      // Start dialogue
      talkCommand.command(mockState)('guardian', mockPlayer);
      
      const dialogueState = mockPlayer.dialogueState[guardianNPC.id];
      expect(dialogueState).toBeDefined();
      expect(dialogueState.currentNode).toBe('default');
      expect(dialogueState.waitingForResponse).toBe(true);
      expect(dialogueState.history).toHaveLength(1);
    });
  });

  describe('Skeleton Warrior Dialogue Flow', () => {
    test('should start with default undead greeting', () => {
      talkCommand.command(mockState)('skeleton', mockPlayer);
      
      expect(global.Broadcast.sayAt).toHaveBeenCalledWith(
        mockPlayer, 
        expect.stringContaining('Death... comes... for... all...')
      );
      
      // Should show response options
      expect(global.Broadcast.sayAt).toHaveBeenCalledWith(
        mockPlayer, 
        '  1. Who are you? What happened to you?'
      );
      expect(global.Broadcast.sayAt).toHaveBeenCalledWith(
        mockPlayer, 
        '  2. I don\'t want to fight you.'
      );
      expect(global.Broadcast.sayAt).toHaveBeenCalledWith(
        mockPlayer, 
        '  3. Prepare to be destroyed, undead!'
      );
    });

    test('should handle identity inquiry', () => {
      // Start dialogue
      talkCommand.command(mockState)('skeleton', mockPlayer);
      
      // Choose identity option
      respondCommand.command(mockState)('1', mockPlayer);
      
      expect(global.Broadcast.sayAt).toHaveBeenCalledWith(
        mockPlayer, 
        'You say: "Who are you? What happened to you?"'
      );
      
      // Wait for continuation
      setTimeout(() => {
        expect(global.Broadcast.sayAt).toHaveBeenCalledWith(
          mockPlayer, 
          expect.stringContaining('I... was... a guardian... long ago...')
        );
      }, 1100);
    });

    test('should handle peaceful approach', () => {
      // Start dialogue
      talkCommand.command(mockState)('skeleton', mockPlayer);
      
      // Choose peaceful option
      respondCommand.command(mockState)('2', mockPlayer);
      
      expect(global.Broadcast.sayAt).toHaveBeenCalledWith(
        mockPlayer, 
        'You say: "I don\'t want to fight you."'
      );
      
      // Wait for continuation
      setTimeout(() => {
        expect(global.Broadcast.sayAt).toHaveBeenCalledWith(
          mockPlayer, 
          expect.stringContaining('Peace... is... for... the... living...')
        );
      }, 1100);
    });

    test('should initiate combat on hostile response', () => {
      // Start dialogue
      talkCommand.command(mockState)('skeleton', mockPlayer);
      
      // Choose hostile option
      respondCommand.command(mockState)('3', mockPlayer);
      
      expect(global.Broadcast.sayAt).toHaveBeenCalledWith(
        mockPlayer, 
        'You say: "Prepare to be destroyed, undead!"'
      );
      
      // Should trigger combat initiation action
      expect(skeletonNPC.emit).toHaveBeenCalledWith(
        'dialogueAction', 
        'initiate_combat', 
        mockPlayer, 
        expect.any(Object)
      );
    });
  });

  describe('Dialogue System Edge Cases', () => {
    test('should handle multiple concurrent conversations', () => {
      // Talk to guardian
      talkCommand.command(mockState)('guardian', mockPlayer);
      
      // Talk to skeleton (should start new conversation)
      talkCommand.command(mockState)('skeleton', mockPlayer);
      
      expect(mockPlayer.dialogueState[guardianNPC.id]).toBeDefined();
      expect(mockPlayer.dialogueState[skeletonNPC.id]).toBeDefined();
    });

    test('should prevent dialogue during combat', () => {
      mockPlayer.hasEffectType = () => true;
      
      talkCommand.command(mockState)('guardian', mockPlayer);
      
      expect(global.Broadcast.sayAt).toHaveBeenCalledWith(
        mockPlayer, 
        'You are too busy fighting to have a conversation!'
      );
    });

    test('should prevent dialogue with NPC in combat', () => {
      guardianNPC.hasEffectType = () => true;
      
      talkCommand.command(mockState)('guardian', mockPlayer);
      
      expect(global.Broadcast.sayAt).toHaveBeenCalledWith(
        mockPlayer, 
        'a stone guardian statue is too busy fighting to talk!'
      );
    });

    test('should handle invalid response numbers', () => {
      // Start dialogue
      talkCommand.command(mockState)('guardian', mockPlayer);
      
      // Try invalid response
      respondCommand.command(mockState)('99', mockPlayer);
      
      expect(global.Broadcast.sayAt).toHaveBeenCalledWith(
        mockPlayer, 
        'Please choose a number between 1 and 3.'
      );
    });

    test('should handle response when not in conversation', () => {
      respondCommand.command(mockState)('1', mockPlayer);
      
      expect(global.Broadcast.sayAt).toHaveBeenCalledWith(
        mockPlayer, 
        'You are not currently in a conversation.'
      );
    });
  });

  describe('Dialogue History and State Persistence', () => {
    test('should maintain conversation history', () => {
      // Start dialogue
      talkCommand.command(mockState)('guardian', mockPlayer);
      
      const dialogueState = mockPlayer.dialogueState[guardianNPC.id];
      expect(dialogueState.history).toHaveLength(1);
      expect(dialogueState.history[0]).toMatchObject({
        node: 'default',
        message: expect.any(String),
        timestamp: expect.any(Number)
      });
    });

    test('should track response history', () => {
      // Start dialogue
      talkCommand.command(mockState)('guardian', mockPlayer);
      
      // Make a response
      respondCommand.command(mockState)('1', mockPlayer);
      
      const dialogueState = mockPlayer.dialogueState[guardianNPC.id];
      expect(dialogueState.history).toHaveLength(2); // Initial + response
      
      const responseEntry = dialogueState.history.find(entry => entry.type === 'response');
      expect(responseEntry).toMatchObject({
        type: 'response',
        responseIndex: 0,
        text: expect.any(String),
        timestamp: expect.any(Number)
      });
    });

    test('should handle dialogue state cleanup', () => {
      // Start dialogue
      talkCommand.command(mockState)('guardian', mockPlayer);
      
      // End conversation by choosing option with no next node
      const dialogueState = mockPlayer.dialogueState[guardianNPC.id];
      dialogueState.availableResponses = [
        { text: 'Goodbye', nextNode: null }
      ];
      
      respondCommand.command(mockState)('1', mockPlayer);
      
      expect(dialogueState.currentNode).toBe('default');
      expect(dialogueState.waitingForResponse).toBe(false);
    });
  });

  describe('NPC Dialogue Behavior Integration', () => {
    test('should load dialogue behavior from NPC definition', () => {
      expect(guardianNPC.metadata.dialogueTree).toBeDefined();
      expect(guardianNPC.metadata.dialogueTree.default).toBeDefined();
      expect(guardianNPC.metadata.dialogueTree.default.message).toBeTruthy();
      expect(guardianNPC.metadata.dialogueTree.default.responses).toHaveLength(3);
    });

    test('should handle NPCs with simple dialogue fallback', () => {
      // Create NPC with only simple dialogue
      const simpleNPC = {
        id: 'simple_npc',
        name: 'a simple villager',
        room: mockRoom,
        hasEffectType: () => false,
        dialogue: {
          default: 'Hello there, traveler!'
        }
      };
      
      mockRoom.npcs.add(simpleNPC);
      
      talkCommand.command(mockState)('simple', mockPlayer);
      
      expect(global.Broadcast.sayAt).toHaveBeenCalledWith(
        mockPlayer, 
        'a simple villager says: "Hello there, traveler!"'
      );
    });

    test('should handle NPCs with no dialogue', () => {
      // Create NPC with no dialogue
      const silentNPC = {
        id: 'silent_npc',
        name: 'a silent statue',
        room: mockRoom,
        hasEffectType: () => false
      };
      
      mockRoom.npcs.add(silentNPC);
      
      talkCommand.command(mockState)('silent', mockPlayer);
      
      expect(global.Broadcast.sayAt).toHaveBeenCalledWith(
        mockPlayer, 
        expect.stringMatching(/says: ".*(nothing|silent|words).*"/)
      );
    });
  });
});
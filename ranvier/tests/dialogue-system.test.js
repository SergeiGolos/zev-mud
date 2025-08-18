const { describe, test, expect, beforeEach, afterEach } = require('@jest/globals');

describe('NPC Dialogue System', () => {
  let mockPlayer, mockNPC, mockRoom, mockState;
  let talkCommand, respondCommand;

  beforeEach(() => {
    // Mock player
    mockPlayer = {
      name: 'TestPlayer',
      room: null,
      dialogueState: {},
      socket: {
        write: () => {}
      }
    };

    // Mock room
    mockRoom = {
      npcs: new Set(),
      getBroadcastTargets: () => [mockPlayer]
    };

    // Mock NPC with dialogue tree
    mockNPC = {
      id: 'test_npc',
      name: 'a test NPC',
      description: 'A test NPC for dialogue testing',
      room: mockRoom,
      hostile: false,
      hasEffectType: () => false,
      emit: () => {},
      metadata: {
        dialogueTree: {
          default: {
            message: 'Hello, traveler! How can I help you?',
            responses: [
              {
                text: 'I need information.',
                nextNode: 'information'
              },
              {
                text: 'Just passing through.',
                nextNode: 'passing'
              }
            ]
          },
          information: {
            message: 'What would you like to know?',
            responses: [
              {
                text: 'Tell me about this place.',
                nextNode: 'place_info'
              }
            ]
          },
          passing: {
            message: 'Safe travels, friend!'
          },
          place_info: {
            message: 'This is an ancient dungeon filled with mysteries.',
            action: 'give_info'
          }
        }
      }
    };

    // Mock state
    mockState = {
      RoomManager: {
        getRoom: () => {}
      }
    };

    // Set up relationships
    mockPlayer.room = mockRoom;
    mockRoom.npcs.add(mockNPC);

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

  describe('Talk Command', () => {
    test('should require a target', () => {
      talkCommand.command(mockState)('', mockPlayer);
      
      expect(global.Broadcast.lastSayAt.player).toBe(mockPlayer);
      expect(global.Broadcast.lastSayAt.message).toBe('Talk to whom?');
    });

    test('should handle NPC not found', () => {
      talkCommand.command(mockState)('nonexistent', mockPlayer);
      
      expect(global.Broadcast.sayAt).toHaveBeenCalledWith(
        mockPlayer, 
        "You don't see 'nonexistent' here to talk to."
      );
    });

    test('should prevent talking during combat', () => {
      mockPlayer.hasEffectType = () => true;
      
      talkCommand.command(mockState)('test', mockPlayer);
      
      expect(global.Broadcast.sayAt).toHaveBeenCalledWith(
        mockPlayer, 
        'You are too busy fighting to have a conversation!'
      );
    });

    test('should prevent talking to NPC in combat', () => {
      mockNPC.hasEffectType = () => true;
      
      talkCommand.command(mockState)('test', mockPlayer);
      
      expect(global.Broadcast.sayAt).toHaveBeenCalledWith(
        mockPlayer, 
        'a test NPC is too busy fighting to talk!'
      );
    });

    test('should initiate dialogue with NPC', () => {
      talkCommand.command(mockState)('test', mockPlayer);
      
      expect(global.Broadcast.sayAt).toHaveBeenCalledWith(
        mockPlayer, 
        'a test NPC says: "Hello, traveler! How can I help you?"'
      );
      
      expect(global.Broadcast.sayAtExcept).toHaveBeenCalledWith(
        mockRoom, 
        'TestPlayer talks to a test NPC.', 
        mockPlayer
      );
    });

    test('should show response options', () => {
      talkCommand.command(mockState)('test', mockPlayer);
      
      expect(global.Broadcast.sayAt).toHaveBeenCalledWith(
        mockPlayer, 
        '\nYou can respond with:'
      );
      expect(global.Broadcast.sayAt).toHaveBeenCalledWith(
        mockPlayer, 
        '  1. I need information.'
      );
      expect(global.Broadcast.sayAt).toHaveBeenCalledWith(
        mockPlayer, 
        '  2. Just passing through.'
      );
    });

    test('should initialize dialogue state', () => {
      talkCommand.command(mockState)('test', mockPlayer);
      
      expect(mockPlayer.dialogueState).toBeDefined();
      expect(mockPlayer.dialogueState['test_npc']).toBeDefined();
      expect(mockPlayer.dialogueState['test_npc'].currentNode).toBe('default');
      expect(mockPlayer.dialogueState['test_npc'].waitingForResponse).toBe(true);
    });

    test('should handle NPC with simple dialogue', () => {
      // Create NPC without dialogue tree
      const simpleNPC = {
        id: 'simple_npc',
        name: 'a simple NPC',
        room: mockRoom,
        hasEffectType: () => false,
        dialogue: {
          default: 'I have nothing important to say.'
        }
      };
      
      mockRoom.npcs.clear();
      mockRoom.npcs.add(simpleNPC);
      
      talkCommand.command(mockState)('simple', mockPlayer);
      
      expect(global.Broadcast.sayAt).toHaveBeenCalledWith(
        mockPlayer, 
        'a simple NPC says: "I have nothing important to say."'
      );
    });
  });

  describe('Respond Command', () => {
    beforeEach(() => {
      // Set up dialogue state
      mockPlayer.dialogueState = {
        'test_npc': {
          currentNode: 'default',
          waitingForResponse: true,
          availableResponses: [
            {
              text: 'I need information.',
              nextNode: 'information'
            },
            {
              text: 'Just passing through.',
              nextNode: 'passing'
            }
          ],
          history: []
        }
      };
    });

    test('should require a response number', () => {
      respondCommand.command(mockState)('', mockPlayer);
      
      expect(global.Broadcast.sayAt).toHaveBeenCalledWith(
        mockPlayer, 
        'Respond with what? Use "respond <number>" to choose a response.'
      );
    });

    test('should require valid response number', () => {
      respondCommand.command(mockState)('invalid', mockPlayer);
      
      expect(global.Broadcast.sayAt).toHaveBeenCalledWith(
        mockPlayer, 
        'Please specify a valid response number.'
      );
    });

    test('should handle no active conversation', () => {
      mockPlayer.dialogueState = {};
      
      respondCommand.command(mockState)('1', mockPlayer);
      
      expect(global.Broadcast.sayAt).toHaveBeenCalledWith(
        mockPlayer, 
        'You are not currently in a conversation.'
      );
    });

    test('should handle response out of range', () => {
      respondCommand.command(mockState)('5', mockPlayer);
      
      expect(global.Broadcast.sayAt).toHaveBeenCalledWith(
        mockPlayer, 
        'Please choose a number between 1 and 2.'
      );
    });

    test('should process valid response', () => {
      respondCommand.command(mockState)('1', mockPlayer);
      
      expect(global.Broadcast.sayAt).toHaveBeenCalledWith(
        mockPlayer, 
        'You say: "I need information."'
      );
      
      expect(global.Broadcast.sayAtExcept).toHaveBeenCalledWith(
        mockRoom, 
        'TestPlayer responds to a test NPC.', 
        mockPlayer
      );
    });

    test('should update dialogue state after response', () => {
      respondCommand.command(mockState)('1', mockPlayer);
      
      const dialogueState = mockPlayer.dialogueState['test_npc'];
      expect(dialogueState.waitingForResponse).toBe(false);
      expect(dialogueState.availableResponses).toBe(null);
      expect(dialogueState.currentNode).toBe('information');
    });

    test('should continue dialogue with new node', (done) => {
      respondCommand.command(mockState)('1', mockPlayer);
      
      // Wait for the setTimeout in the respond command
      setTimeout(() => {
        expect(global.Broadcast.sayAt).toHaveBeenCalledWith(
          mockPlayer, 
          'a test NPC says: "What would you like to know?"'
        );
        done();
      }, 1100);
    });

    test('should end conversation when no next node', () => {
      respondCommand.command(mockState)('2', mockPlayer);
      
      const dialogueState = mockPlayer.dialogueState['test_npc'];
      expect(dialogueState.currentNode).toBe('default');
      
      expect(global.Broadcast.sayAt).toHaveBeenCalledWith(
        mockPlayer, 
        'The conversation comes to an end.'
      );
    });

    test('should execute response actions', () => {
      // Add action to response
      mockPlayer.dialogueState['test_npc'].availableResponses[0].action = 'test_action';
      
      respondCommand.command(mockState)('1', mockPlayer);
      
      expect(mockNPC.emit).toHaveBeenCalledWith(
        'dialogueAction', 
        'test_action', 
        mockPlayer, 
        mockPlayer.dialogueState['test_npc']
      );
    });
  });

  describe('Dialogue State Management', () => {
    test('should maintain conversation history', () => {
      talkCommand.command(mockState)('test', mockPlayer);
      
      const dialogueState = mockPlayer.dialogueState['test_npc'];
      expect(dialogueState.history).toHaveLength(1);
      expect(dialogueState.history[0].node).toBe('default');
      expect(dialogueState.history[0].message).toBe('Hello, traveler! How can I help you?');
    });

    test('should handle multiple NPCs', () => {
      const secondNPC = {
        id: 'second_npc',
        name: 'another NPC',
        room: mockRoom,
        hasEffectType: () => false,
        dialogue: { default: 'Hello from second NPC!' }
      };
      
      mockRoom.npcs.add(secondNPC);
      
      // Talk to first NPC
      talkCommand.command(mockState)('test', mockPlayer);
      
      // Talk to second NPC
      talkCommand.command(mockState)('another', mockPlayer);
      
      expect(mockPlayer.dialogueState['test_npc']).toBeDefined();
      expect(mockPlayer.dialogueState['second_npc']).toBeDefined();
    });

    test('should handle dialogue timeout scenarios', () => {
      // Set up old dialogue state
      mockPlayer.dialogueState = {
        'test_npc': {
          currentNode: 'default',
          waitingForResponse: true,
          availableResponses: [],
          lastInteraction: Date.now() - 600000 // 10 minutes ago
        }
      };
      
      // This would be handled by a cleanup system in a real implementation
      expect(mockPlayer.dialogueState['test_npc'].lastInteraction).toBeLessThan(Date.now());
    });
  });

  describe('NPC Dialogue Behavior', () => {
    test('should find NPC by partial name match', () => {
      talkCommand.command(mockState)('test', mockPlayer);
      
      expect(global.Broadcast.sayAt).toHaveBeenCalledWith(
        mockPlayer, 
        'a test NPC says: "Hello, traveler! How can I help you?"'
      );
    });

    test('should find NPC by ID match', () => {
      talkCommand.command(mockState)('test_npc', mockPlayer);
      
      expect(global.Broadcast.sayAt).toHaveBeenCalledWith(
        mockPlayer, 
        'a test NPC says: "Hello, traveler! How can I help you?"'
      );
    });

    test('should handle case insensitive matching', () => {
      talkCommand.command(mockState)('TEST', mockPlayer);
      
      expect(global.Broadcast.sayAt).toHaveBeenCalledWith(
        mockPlayer, 
        'a test NPC says: "Hello, traveler! How can I help you?"'
      );
    });
  });
});
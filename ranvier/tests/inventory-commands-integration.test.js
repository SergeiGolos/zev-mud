const path = require('path');

// Mock the Ranvier module before any imports
jest.mock('ranvier', () => ({
  Broadcast: {
    sayAt: jest.fn(),
    sayAtExcept: jest.fn()
  }
}));

const { Broadcast } = require('ranvier');

describe('Inventory Commands Integration', () => {
  let mockPlayer;
  let mockRoom;
  let mockItem;

  beforeEach(() => {
    // Clear all mocks
    jest.clearAllMocks();

    // Mock player
    mockPlayer = {
      name: 'TestPlayer',
      inventory: new Set(),
      equipment: {},
      attributes: { health: 100, mana: 50, stamina: 100 },
      room: null,
      save: jest.fn()
    };

    // Mock room
    mockRoom = {
      items: new Set(),
      players: new Set([mockPlayer]),
      addItem: jest.fn(function(item) { this.items.add(item); }),
      removeItem: jest.fn(function(item) { this.items.delete(item); })
    };

    mockPlayer.room = mockRoom;

    // Mock item
    mockItem = {
      id: 'test_sword',
      name: 'a test sword',
      type: 'WEAPON',
      metadata: { weight: 8, damage: 10 }
    };
  });

  describe('Inventory Command', () => {
    test('should execute inventory command with empty inventory', () => {
      // Load the inventory command
      const inventoryCommand = require('../bundles/basic-world/commands/inventory.js');
      
      // Mock the Ranvier Broadcast
      const mockState = {};
      const command = inventoryCommand.command(mockState);
      
      // Execute command
      command('', mockPlayer);
      
      // Verify broadcast was called with correct message
      expect(Broadcast.sayAt).toHaveBeenCalledWith(
        mockPlayer, 
        'You are not carrying anything.'
      );
    });

    test('should execute inventory command with items', () => {
      // Add item to inventory
      mockPlayer.inventory.add(mockItem);
      
      // Load the inventory command
      const inventoryCommand = require('../bundles/basic-world/commands/inventory.js');
      
      // Mock the Ranvier Broadcast
      const mockState = {};
      const command = inventoryCommand.command(mockState);
      
      // Execute command
      command('', mockPlayer);
      
      // Verify broadcast was called (we can't easily test the exact message due to formatting)
      expect(Broadcast.sayAt).toHaveBeenCalled();
      const message = Broadcast.sayAt.mock.calls[0][1];
      expect(message).toContain('You are carrying:');
      expect(message).toContain('a test sword');
    });
  });

  describe('Equip Command', () => {
    test('should execute equip command successfully', () => {
      // Add weapon to inventory
      mockPlayer.inventory.add(mockItem);
      
      // Load the equip command
      const equipCommand = require('../bundles/basic-world/commands/equip.js');
      
      // Mock the Ranvier Broadcast
      const mockState = {};
      const command = equipCommand.command(mockState);
      
      // Execute command
      command('sword', mockPlayer);
      
      // Verify item was equipped
      expect(mockPlayer.equipment.weapon).toBe(mockItem);
      expect(Broadcast.sayAt).toHaveBeenCalledWith(
        mockPlayer,
        'You wield a test sword.'
      );
    });

    test('should handle equip command with no arguments', () => {
      // Load the equip command
      const equipCommand = require('../bundles/basic-world/commands/equip.js');
      
      // Mock the Ranvier Broadcast
      const mockState = {};
      const command = equipCommand.command(mockState);
      
      // Execute command with no args
      command('', mockPlayer);
      
      expect(Broadcast.sayAt).toHaveBeenCalledWith(
        mockPlayer,
        'Equip what?'
      );
    });
  });

  describe('Use Command', () => {
    test('should execute use command with health potion', () => {
      // Create health potion
      const potion = {
        id: 'health_potion',
        name: 'a health potion',
        type: 'POTION',
        metadata: { healing: 30 }
      };
      
      // Set player health to 50
      mockPlayer.attributes.health = 50;
      mockPlayer.inventory.add(potion);
      
      // Load the use command
      const useCommand = require('../bundles/basic-world/commands/use.js');
      
      // Mock the Ranvier Broadcast
      const mockState = {};
      const command = useCommand.command(mockState);
      
      // Execute command
      command('potion', mockPlayer);
      
      // Verify health was restored
      expect(mockPlayer.attributes.health).toBe(80);
      expect(mockPlayer.inventory.has(potion)).toBe(false); // Item consumed
      expect(Broadcast.sayAt).toHaveBeenCalled();
      const message = Broadcast.sayAt.mock.calls[0][1];
      expect(message).toContain('You drink a health potion');
    });

    test('should handle use command with non-usable item', () => {
      // Add weapon to inventory
      mockPlayer.inventory.add(mockItem);
      
      // Load the use command
      const useCommand = require('../bundles/basic-world/commands/use.js');
      
      // Mock the Ranvier Broadcast
      const mockState = {};
      const command = useCommand.command(mockState);
      
      // Execute command
      command('sword', mockPlayer);
      
      expect(Broadcast.sayAt).toHaveBeenCalledWith(
        mockPlayer,
        'You cannot use a test sword.'
      );
    });
  });

  describe('Equipment Command', () => {
    test('should execute equipment command with no equipment', () => {
      // Load the equipment command
      const equipmentCommand = require('../bundles/basic-world/commands/equipment.js');
      
      // Mock the Ranvier Broadcast
      const mockState = {};
      const command = equipmentCommand.command(mockState);
      
      // Execute command
      command('', mockPlayer);
      
      expect(Broadcast.sayAt).toHaveBeenCalledWith(
        mockPlayer,
        'You are not wearing or wielding anything.'
      );
    });

    test('should execute equipment command with equipped items', () => {
      // Equip weapon
      mockPlayer.equipment.weapon = mockItem;
      
      // Load the equipment command
      const equipmentCommand = require('../bundles/basic-world/commands/equipment.js');
      
      // Mock the Ranvier Broadcast
      const mockState = {};
      const command = equipmentCommand.command(mockState);
      
      // Execute command
      command('', mockPlayer);
      
      expect(Broadcast.sayAt).toHaveBeenCalled();
      const message = Broadcast.sayAt.mock.calls[0][1];
      expect(message).toContain('You are currently equipped with:');
      expect(message).toContain('Wielded: a test sword');
    });
  });

  describe('Unequip Command', () => {
    test('should execute unequip command successfully', () => {
      // Equip weapon first
      mockPlayer.equipment.weapon = mockItem;
      
      // Load the unequip command
      const unequipCommand = require('../bundles/basic-world/commands/unequip.js');
      
      // Mock the Ranvier Broadcast
      const mockState = {};
      const command = unequipCommand.command(mockState);
      
      // Execute command
      command('sword', mockPlayer);
      
      // Verify item was unequipped and added to inventory
      expect(mockPlayer.equipment.weapon).toBeUndefined();
      expect(mockPlayer.inventory.has(mockItem)).toBe(true);
      expect(Broadcast.sayAt).toHaveBeenCalledWith(
        mockPlayer,
        'You unwield a test sword.'
      );
    });

    test('should handle unequip command with no equipment', () => {
      // Load the unequip command
      const unequipCommand = require('../bundles/basic-world/commands/unequip.js');
      
      // Mock the Ranvier Broadcast
      const mockState = {};
      const command = unequipCommand.command(mockState);
      
      // Execute command
      command('sword', mockPlayer);
      
      expect(Broadcast.sayAt).toHaveBeenCalledWith(
        mockPlayer,
        'You are not wearing or wielding anything.'
      );
    });
  });

  describe('Command Aliases', () => {
    test('should have correct aliases for inventory command', () => {
      const inventoryCommand = require('../bundles/basic-world/commands/inventory.js');
      expect(inventoryCommand.aliases).toEqual(['inv', 'i']);
    });

    test('should have correct aliases for equip command', () => {
      const equipCommand = require('../bundles/basic-world/commands/equip.js');
      expect(equipCommand.aliases).toEqual(['wear', 'wield']);
    });

    test('should have correct aliases for unequip command', () => {
      const unequipCommand = require('../bundles/basic-world/commands/unequip.js');
      expect(unequipCommand.aliases).toEqual(['remove', 'unwield']);
    });

    test('should have correct aliases for equipment command', () => {
      const equipmentCommand = require('../bundles/basic-world/commands/equipment.js');
      expect(equipmentCommand.aliases).toEqual(['eq', 'worn']);
    });

    test('should have correct aliases for use command', () => {
      const useCommand = require('../bundles/basic-world/commands/use.js');
      expect(useCommand.aliases).toEqual(['consume', 'drink', 'eat']);
    });
  });


});
const path = require('path');
const fs = require('fs');
const NedbDataSource = require('../src/datasources/nedb');

describe('NeDB Database', () => {
  let db;
  const testDbPath = path.join(__dirname, '../data/test-db.db');

  beforeEach(() => {
    // Clean up test database
    if (fs.existsSync(testDbPath)) {
      fs.unlinkSync(testDbPath);
    }

    db = new NedbDataSource({
      path: testDbPath
    });
  });

  afterEach(() => {
    // Clean up test database
    if (fs.existsSync(testDbPath)) {
      fs.unlinkSync(testDbPath);
    }
  });

  test('should save and load player data', async () => {
    const playerData = {
      name: 'TestPlayer',
      attributes: { health: 100, mana: 50, stamina: 100 },
      roomId: 'basic-area:room1',
      inventory: [],
      createdAt: new Date()
    };

    // Save player data
    await db.save('player', 'TestPlayer', playerData);

    // Load player data
    const loadedData = await db.load('player', 'TestPlayer');
    
    expect(loadedData).toBeDefined();
    expect(loadedData.name).toBe('TestPlayer');
    expect(loadedData.attributes.health).toBe(100);
    expect(loadedData.roomId).toBe('basic-area:room1');
  });

  test('should return null for non-existent data', async () => {
    const result = await db.load('player', 'NonExistentPlayer');
    expect(result).toBeNull();
  });

  test('should update existing data', async () => {
    const initialData = {
      name: 'TestPlayer',
      attributes: { health: 100, mana: 50, stamina: 100 },
      roomId: 'basic-area:room1'
    };

    // Save initial data
    await db.save('player', 'TestPlayer', initialData);

    // Update data
    const updatedData = {
      name: 'TestPlayer',
      attributes: { health: 80, mana: 30, stamina: 90 },
      roomId: 'basic-area:room2'
    };

    await db.save('player', 'TestPlayer', updatedData);

    // Load updated data
    const loadedData = await db.load('player', 'TestPlayer');
    
    expect(loadedData.attributes.health).toBe(80);
    expect(loadedData.roomId).toBe('basic-area:room2');
  });

  test('should delete data', async () => {
    const playerData = {
      name: 'TestPlayer',
      attributes: { health: 100, mana: 50, stamina: 100 }
    };

    // Save data
    await db.save('player', 'TestPlayer', playerData);
    
    // Verify it exists
    let loadedData = await db.load('player', 'TestPlayer');
    expect(loadedData).toBeDefined();

    // Delete data
    const deleted = await db.delete('player', 'TestPlayer');
    expect(deleted).toBe(true);

    // Verify it's gone
    loadedData = await db.load('player', 'TestPlayer');
    expect(loadedData).toBeNull();
  });

  test('should load all data of a type', async () => {
    const players = [
      { name: 'Player1', level: 1 },
      { name: 'Player2', level: 2 },
      { name: 'Player3', level: 3 }
    ];

    // Save multiple players
    for (const player of players) {
      await db.save('player', player.name, player);
    }

    // Load all players
    const allPlayers = await db.loadAll('player');
    
    expect(Object.keys(allPlayers)).toHaveLength(3);
    expect(allPlayers['Player1'].level).toBe(1);
    expect(allPlayers['Player2'].level).toBe(2);
    expect(allPlayers['Player3'].level).toBe(3);
  });

  test('should handle concurrent operations', async () => {
    const operations = [];
    
    // Create multiple concurrent save operations
    for (let i = 0; i < 10; i++) {
      operations.push(
        db.save('player', `Player${i}`, {
          name: `Player${i}`,
          level: i,
          createdAt: new Date()
        })
      );
    }

    // Wait for all operations to complete
    await Promise.all(operations);

    // Verify all data was saved
    const allPlayers = await db.loadAll('player');
    expect(Object.keys(allPlayers)).toHaveLength(10);

    // Verify data integrity
    for (let i = 0; i < 10; i++) {
      expect(allPlayers[`Player${i}`].level).toBe(i);
    }
  });
});
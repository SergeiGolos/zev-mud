module.exports = {
  // Server configuration
  port: process.env.PORT || 3000,
  
  // Database configuration
  database: {
    type: 'nedb',
    path: './data/characters.db'
  },
  
  // Game configuration
  game: {
    maxPlayers: 50,
    saveInterval: 30000, // 30 seconds
    startingRoom: 'basic-area:room1'
  },
  
  // Logging configuration
  logging: {
    level: process.env.NODE_ENV === 'production' ? 'info' : 'debug',
    file: './data/server.log'
  }
};
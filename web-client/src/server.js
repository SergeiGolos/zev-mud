const express = require('express');
const path = require('path');

class WebClientServer {
  constructor() {
    this.port = process.env.PORT || 3001;
    this.app = express();
    this.setupMiddleware();
    this.setupRoutes();
  }

  setupMiddleware() {
    // Serve static files
    this.app.use(express.static(path.join(__dirname, '../public')));
  }

  setupRoutes() {
    // Health check endpoint
    this.app.get('/health', (req, res) => {
      res.status(200).json({ 
        status: 'healthy', 
        timestamp: new Date().toISOString() 
      });
    });

    // Main application route
    this.app.get('/', (req, res) => {
      res.sendFile(path.join(__dirname, '../public/index.html'));
    });

    // Catch all route
    this.app.get('*', (req, res) => {
      res.redirect('/');
    });
  }

  start() {
    this.app.listen(this.port, () => {
      console.log(`Web client server listening on port ${this.port}`);
    });
  }
}

// Start server
const server = new WebClientServer();
server.start();

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('Received SIGTERM, shutting down gracefully');
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('Received SIGINT, shutting down gracefully');
  process.exit(0);
});
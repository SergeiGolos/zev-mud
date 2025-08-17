const net = require('net');
const path = require('path');

// Basic Ranvier server setup
class RanvierServer {
  constructor() {
    this.port = process.env.PORT || 3000;
    this.server = null;
    this.clients = new Map();
  }

  start() {
    this.server = net.createServer((socket) => {
      console.log('New client connected');
      
      const clientId = `${socket.remoteAddress}:${socket.remotePort}`;
      this.clients.set(clientId, socket);

      // Send welcome message
      socket.write('Welcome to zev-mud!\r\n');
      socket.write('Enter your character name: ');

      socket.on('data', (data) => {
        const input = data.toString().trim();
        console.log(`Client ${clientId} sent: ${input}`);
        
        // Echo back for now (will be replaced with actual game logic)
        socket.write(`You entered: ${input}\r\n`);
        socket.write('> ');
      });

      socket.on('close', () => {
        console.log(`Client ${clientId} disconnected`);
        this.clients.delete(clientId);
      });

      socket.on('error', (err) => {
        console.error(`Socket error for ${clientId}:`, err);
        this.clients.delete(clientId);
      });
    });

    this.server.listen(this.port, () => {
      console.log(`Ranvier server listening on port ${this.port}`);
    });

    this.server.on('error', (err) => {
      console.error('Server error:', err);
    });
  }

  stop() {
    if (this.server) {
      this.server.close();
      this.clients.forEach(client => client.destroy());
      this.clients.clear();
    }
  }
}

// Start server
const server = new RanvierServer();
server.start();

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('Received SIGTERM, shutting down gracefully');
  server.stop();
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('Received SIGINT, shutting down gracefully');
  server.stop();
  process.exit(0);
});
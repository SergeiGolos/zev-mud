class MudClient {
  constructor() {
    this.terminal = null;
    this.websocket = null;
    this.wsUrl = `ws://${window.location.hostname}:8080`;
    this.statusElement = document.getElementById('connection-status');
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 5;
    
    this.initTerminal();
    this.connect();
  }

  initTerminal() {
    this.terminal = new Terminal({
      cursorBlink: true,
      fontSize: 14,
      fontFamily: 'Courier New, monospace',
      theme: {
        background: '#000000',
        foreground: '#ffffff',
        cursor: '#ffffff'
      }
    });

    const container = document.getElementById('terminal-container');
    this.terminal.open(container);
    
    // Handle terminal input
    this.terminal.onData((data) => {
      if (this.websocket && this.websocket.readyState === WebSocket.OPEN) {
        this.websocket.send(data);
      }
    });

    this.terminal.writeln('zev-mud Browser Client');
    this.terminal.writeln('Connecting to server...');
  }

  connect() {
    this.updateStatus('connecting', 'Connecting...');
    
    try {
      this.websocket = new WebSocket(this.wsUrl);
      
      this.websocket.onopen = () => {
        this.updateStatus('connected', 'Connected');
        this.reconnectAttempts = 0;
        this.terminal.writeln('Connected to server!');
      };

      this.websocket.onmessage = (event) => {
        this.terminal.write(event.data);
      };

      this.websocket.onclose = () => {
        this.updateStatus('disconnected', 'Disconnected');
        this.terminal.writeln('\r\nConnection lost. Attempting to reconnect...');
        this.attemptReconnect();
      };

      this.websocket.onerror = (error) => {
        console.error('WebSocket error:', error);
        this.updateStatus('disconnected', 'Connection Error');
      };
      
    } catch (error) {
      console.error('Failed to create WebSocket:', error);
      this.updateStatus('disconnected', 'Connection Failed');
      this.attemptReconnect();
    }
  }

  attemptReconnect() {
    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      this.reconnectAttempts++;
      const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts), 10000);
      
      this.terminal.writeln(`Reconnect attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts} in ${delay/1000}s...`);
      
      setTimeout(() => {
        this.connect();
      }, delay);
    } else {
      this.terminal.writeln('Max reconnection attempts reached. Please refresh the page.');
      this.updateStatus('disconnected', 'Connection Failed');
    }
  }

  updateStatus(className, text) {
    this.statusElement.className = className;
    this.statusElement.textContent = text;
  }
}

// Initialize client when page loads
document.addEventListener('DOMContentLoaded', () => {
  new MudClient();
});
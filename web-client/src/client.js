/**
 * Testable version of MudClient for unit testing
 */

class MudClient {
  constructor() {
    this.terminal = null;
    this.websocket = null;
    this.wsUrl = typeof window !== 'undefined' ? `ws://${window.location.hostname}:8080` : 'ws://localhost:8080';
    this.statusElement = typeof document !== 'undefined' ? document.getElementById('connection-status') : null;
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 5;
    this.reconnectDelay = 1000;
    this.connectionState = 'disconnected';
    this.commandHistory = [];
    this.historyIndex = -1;
    this.currentInput = '';
    
    this.initTerminal();
    this.connect();
  }

  initTerminal() {
    this.terminal = new Terminal({
      cursorBlink: true,
      fontSize: 14,
      fontFamily: 'Courier New, monospace',
      scrollback: 1000,
      allowTransparency: true,
      theme: {
        background: '#000000',
        foreground: '#ffffff',
        cursor: '#ffffff',
        cursorAccent: '#000000',
        selection: '#ffffff40',
        black: '#000000',
        red: '#cd0000',
        green: '#00cd00',
        yellow: '#cdcd00',
        blue: '#0000ee',
        magenta: '#cd00cd',
        cyan: '#00cdcd',
        white: '#e5e5e5',
        brightBlack: '#7f7f7f',
        brightRed: '#ff0000',
        brightGreen: '#00ff00',
        brightYellow: '#ffff00',
        brightBlue: '#5c5cff',
        brightMagenta: '#ff00ff',
        brightCyan: '#00ffff',
        brightWhite: '#ffffff'
      }
    });

    if (typeof document !== 'undefined') {
      const container = document.getElementById('terminal-container');
      if (container) {
        this.terminal.open(container);
      }
    }
    
    // Initialize fit addon for proper terminal sizing
    if (typeof FitAddon !== 'undefined') {
      this.fitAddon = new FitAddon.FitAddon();
      this.terminal.loadAddon(this.fitAddon);
      this.fitAddon.fit();
    }
    
    // Handle terminal input with command history and special keys
    this.terminal.onData((data) => {
      this.handleTerminalInput(data);
    });

    // Handle terminal resize
    if (typeof window !== 'undefined') {
      window.addEventListener('resize', () => {
        if (this.fitAddon) {
          this.fitAddon.fit();
        }
      });
    }

    this.terminal.writeln('zev-mud Browser Client v1.0');
    this.terminal.writeln('Connecting to server...');
  }

  handleTerminalInput(data) {
    const code = data.charCodeAt(0);
    
    // Handle special keys
    if (code === 13) { // Enter
      if (this.currentInput.trim()) {
        this.commandHistory.unshift(this.currentInput);
        if (this.commandHistory.length > 50) {
          this.commandHistory.pop();
        }
      }
      this.historyIndex = -1;
      this.sendCommand(this.currentInput + '\r\n');
      this.currentInput = '';
    } else if (code === 127 || code === 8) { // Backspace/Delete
      if (this.currentInput.length > 0) {
        this.currentInput = this.currentInput.slice(0, -1);
      }
      this.sendCommand(data);
    } else if (code === 27) { // Escape sequences (arrow keys)
      this.handleEscapeSequence(data);
    } else if (code >= 32 && code <= 126) { // Printable characters
      this.currentInput += data;
      this.sendCommand(data);
    } else {
      // Pass through other control characters
      this.sendCommand(data);
    }
  }

  handleEscapeSequence(data) {
    // Handle arrow keys for command history
    if (data === '\x1b[A') { // Up arrow
      if (this.historyIndex < this.commandHistory.length - 1) {
        this.historyIndex++;
        this.replaceCurrentLine(this.commandHistory[this.historyIndex]);
      }
    } else if (data === '\x1b[B') { // Down arrow
      if (this.historyIndex > 0) {
        this.historyIndex--;
        this.replaceCurrentLine(this.commandHistory[this.historyIndex]);
      } else if (this.historyIndex === 0) {
        this.historyIndex = -1;
        this.replaceCurrentLine('');
      }
    } else {
      // Pass through other escape sequences
      this.sendCommand(data);
    }
  }

  replaceCurrentLine(newText) {
    // Clear current input and replace with new text
    const clearLength = this.currentInput.length;
    this.sendCommand('\b'.repeat(clearLength) + ' '.repeat(clearLength) + '\b'.repeat(clearLength));
    this.currentInput = newText;
    this.sendCommand(newText);
  }

  sendCommand(data) {
    if (this.websocket && this.websocket.readyState === WebSocket.OPEN) {
      this.websocket.send(data);
    }
  }

  connect() {
    this.updateStatus('connecting', 'Connecting...');
    this.connectionState = 'connecting';
    
    try {
      this.websocket = new WebSocket(this.wsUrl);
      
      this.websocket.onopen = () => {
        this.updateStatus('connected', 'Connected');
        this.connectionState = 'connected';
        this.reconnectAttempts = 0;
        this.terminal.writeln('\r\n\x1b[32mConnected to server!\x1b[0m');
      };

      this.websocket.onmessage = (event) => {
        this.processServerMessage(event.data);
      };

      this.websocket.onclose = (event) => {
        this.connectionState = 'disconnected';
        this.updateStatus('disconnected', 'Disconnected');
        
        if (event.wasClean) {
          this.terminal.writeln('\r\n\x1b[33mConnection closed cleanly.\x1b[0m');
        } else {
          this.terminal.writeln('\r\n\x1b[31mConnection lost unexpectedly.\x1b[0m');
          this.attemptReconnect();
        }
      };

      this.websocket.onerror = (error) => {
        console.error('WebSocket error:', error);
        this.connectionState = 'error';
        this.updateStatus('disconnected', 'Connection Error');
        this.terminal.writeln('\r\n\x1b[31mConnection error occurred.\x1b[0m');
      };
      
    } catch (error) {
      console.error('Failed to create WebSocket:', error);
      this.connectionState = 'error';
      this.updateStatus('disconnected', 'Connection Failed');
      this.terminal.writeln('\r\n\x1b[31mFailed to establish connection.\x1b[0m');
      this.attemptReconnect();
    }
  }

  processServerMessage(data) {
    // Process ANSI color codes and special formatting
    const processedData = this.processAnsiCodes(data);
    this.terminal.write(processedData);
  }

  processAnsiCodes(data) {
    // xterm.js handles most ANSI codes natively, but we can add custom processing here
    // For now, just pass through the data as xterm.js handles ANSI well
    return data;
  }

  attemptReconnect() {
    if (this.connectionState === 'connecting') {
      return; // Already attempting to connect
    }

    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      this.reconnectAttempts++;
      const delay = Math.min(this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1), 10000);
      
      this.terminal.writeln(`\x1b[33mReconnect attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts} in ${delay/1000}s...\x1b[0m`);
      this.updateStatus('connecting', `Reconnecting... (${this.reconnectAttempts}/${this.maxReconnectAttempts})`);
      
      setTimeout(() => {
        if (this.connectionState !== 'connected') {
          this.connect();
        }
      }, delay);
    } else {
      this.terminal.writeln('\x1b[31mMax reconnection attempts reached. Please refresh the page to try again.\x1b[0m');
      this.updateStatus('disconnected', 'Connection Failed');
      this.connectionState = 'failed';
    }
  }

  updateStatus(className, text) {
    if (this.statusElement) {
      this.statusElement.className = className;
      this.statusElement.textContent = text;
      
      // Update the parent status container class for indicator styling
      const statusContainer = this.statusElement.closest('.status');
      if (statusContainer) {
        statusContainer.className = `status ${className}`;
      }
    }
    
    // Update button states
    this.updateControlButtons();
  }

  updateControlButtons() {
    if (typeof document !== 'undefined') {
      const reconnectBtn = document.getElementById('reconnect-btn');
      const disconnectBtn = document.getElementById('disconnect-btn');
      
      if (reconnectBtn && disconnectBtn) {
        const isConnected = this.isConnected();
        const isConnecting = this.connectionState === 'connecting';
        
        reconnectBtn.disabled = isConnected || isConnecting;
        disconnectBtn.disabled = !isConnected && !isConnecting;
      }
    }
  }

  // Public methods for external control
  disconnect() {
    if (this.websocket) {
      this.websocket.close(1000, 'User requested disconnect');
    }
    this.connectionState = 'disconnected';
    this.updateStatus('disconnected', 'Disconnected');
  }

  reconnect() {
    this.disconnect();
    this.reconnectAttempts = 0;
    setTimeout(() => this.connect(), 100);
  }

  getConnectionState() {
    return this.connectionState;
  }

  isConnected() {
    return this.connectionState === 'connected' && 
           this.websocket && 
           this.websocket.readyState === WebSocket.OPEN;
  }
}

// Export for testing
if (typeof module !== 'undefined' && module.exports) {
  module.exports = MudClient;
}
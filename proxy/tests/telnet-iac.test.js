const WebSocketTelnetProxy = require('../src/proxy');

describe('Telnet IAC Filtering', () => {
  let proxy;

  beforeEach(() => {
    proxy = new WebSocketTelnetProxy();
  });

  afterEach(async () => {
    if (proxy) {
      await proxy.stop();
    }
  });

  describe('filterTelnetIAC', () => {
    test('should remove IAC WILL sequences', () => {
      // IAC WILL ECHO (255, 251, 1)
      const input = Buffer.from([72, 101, 108, 108, 111, 255, 251, 1, 32, 87, 111, 114, 108, 100]);
      const result = proxy.filterTelnetIAC(input.toString('binary'));
      expect(result).toBe('Hello World');
    });

    test('should remove IAC WONT sequences', () => {
      // IAC WONT ECHO (255, 252, 1)
      const input = Buffer.from([84, 101, 115, 116, 255, 252, 1, 32, 77, 101, 115, 115, 97, 103, 101]);
      const result = proxy.filterTelnetIAC(input.toString('binary'));
      expect(result).toBe('Test Message');
    });

    test('should remove IAC DO sequences', () => {
      // IAC DO ECHO (255, 253, 1)
      const input = Buffer.from([71, 97, 109, 101, 255, 253, 1, 32, 83, 116, 97, 114, 116]);
      const result = proxy.filterTelnetIAC(input.toString('binary'));
      expect(result).toBe('Game Start');
    });

    test('should remove IAC DONT sequences', () => {
      // IAC DONT ECHO (255, 254, 1)
      const input = Buffer.from([69, 110, 100, 255, 254, 1, 32, 71, 97, 109, 101]);
      const result = proxy.filterTelnetIAC(input.toString('binary'));
      expect(result).toBe('End Game');
    });

    test('should remove multiple IAC sequences', () => {
      // Multiple IAC sequences in one message
      const input = Buffer.from([
        72, 101, 108, 108, 111, // "Hello"
        255, 251, 1,             // IAC WILL ECHO
        32,                      // " "
        255, 253, 3,             // IAC DO SUPPRESS_GO_AHEAD
        87, 111, 114, 108, 100   // "World"
      ]);
      const result = proxy.filterTelnetIAC(input.toString('binary'));
      expect(result).toBe('Hello World');
    });

    test('should preserve normal text without IAC sequences', () => {
      const input = 'This is a normal message without any IAC sequences.';
      const result = proxy.filterTelnetIAC(input);
      expect(result).toBe(input);
    });

    test('should handle empty input', () => {
      const result = proxy.filterTelnetIAC('');
      expect(result).toBe('');
    });

    test('should handle IAC at end of buffer', () => {
      // IAC at the end without command - should be preserved as data
      const input = Buffer.from([72, 101, 108, 108, 111, 255]);
      const result = proxy.filterTelnetIAC(input.toString('binary'));
      expect(result).toBe('Hello\xff');
    });

    test('should handle incomplete IAC sequence', () => {
      // IAC with command but no option
      const input = Buffer.from([72, 101, 108, 108, 111, 255, 251]);
      const result = proxy.filterTelnetIAC(input.toString('binary'));
      expect(result).toBe('Hello');
    });

    test('should preserve non-IAC 255 values', () => {
      // 255 followed by non-command value
      const input = Buffer.from([72, 101, 108, 108, 111, 255, 100, 87, 111, 114, 108, 100]);
      const result = proxy.filterTelnetIAC(input.toString('binary'));
      expect(result).toBe('Hello\xffdWorld');
    });

    test('should handle IAC SE (Subnegotiation End)', () => {
      // IAC SE (255, 240)
      const input = Buffer.from([84, 101, 115, 116, 255, 240, 32, 77, 115, 103]);
      const result = proxy.filterTelnetIAC(input.toString('binary'));
      expect(result).toBe('Test Msg');
    });

    test('should handle IAC SB (Subnegotiation Begin)', () => {
      // IAC SB (255, 250)
      const input = Buffer.from([84, 101, 115, 116, 255, 250, 32, 77, 115, 103]);
      const result = proxy.filterTelnetIAC(input.toString('binary'));
      expect(result).toBe('Test Msg');
    });

    test('should handle complex MUD output with ANSI and IAC', () => {
      // Simulate typical MUD output with ANSI colors and IAC sequences
      const mudOutput = Buffer.from([
        27, 91, 49, 59, 51, 49, 109,  // ANSI: ESC[1;31m (bold red)
        89, 111, 117, 32, 97, 114, 101, 32, 105, 110, 32, 97, 32, 114, 111, 111, 109, // "You are in a room"
        255, 251, 1,                   // IAC WILL ECHO
        27, 91, 48, 109,              // ANSI: ESC[0m (reset)
        10, 13                        // \n\r
      ]);
      
      const result = proxy.filterTelnetIAC(mudOutput.toString('binary'));
      expect(result).toContain('You are in a room');
      expect(result).toContain('\x1b[1;31m'); // ANSI should be preserved
      expect(result).toContain('\x1b[0m');    // ANSI should be preserved
      expect(result).not.toContain('\xff\xfb\x01'); // IAC should be removed
    });
  });

  describe('processTelnetMessage', () => {
    test('should filter IAC sequences from Telnet messages', () => {
      const input = Buffer.from([
        72, 101, 108, 108, 111, 255, 251, 1, 32, 87, 111, 114, 108, 100
      ]);
      
      const result = proxy.processTelnetMessage(input);
      expect(result).toBe('Hello World');
    });

    test('should preserve ANSI escape sequences', () => {
      const input = Buffer.from([
        27, 91, 49, 59, 51, 49, 109,  // ANSI red
        72, 101, 108, 108, 111,       // "Hello"
        27, 91, 48, 109               // ANSI reset
      ]);
      
      const result = proxy.processTelnetMessage(input);
      expect(result).toBe('\x1b[1;31mHello\x1b[0m');
    });
  });

  describe('processWebSocketMessage', () => {
    test('should add CRLF to WebSocket messages', () => {
      const input = Buffer.from('look');
      const result = proxy.processWebSocketMessage(input);
      expect(result).toBe('look\r\n');
    });

    test('should not add CRLF if already present', () => {
      const input = Buffer.from('look\r\n');
      const result = proxy.processWebSocketMessage(input);
      expect(result).toBe('look\r\n');
    });

    test('should handle LF-only line endings', () => {
      const input = Buffer.from('look\n');
      const result = proxy.processWebSocketMessage(input);
      expect(result).toBe('look\n');
    });

    test('should handle empty messages', () => {
      const input = Buffer.from('');
      const result = proxy.processWebSocketMessage(input);
      expect(result).toBe('\r\n');
    });
  });
});
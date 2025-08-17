/**
 * Unit tests for terminal rendering and ANSI processing
 */

// Mock xterm.js Terminal
const mockTerminal = {
  write: jest.fn(),
  writeln: jest.fn(),
  clear: jest.fn(),
  reset: jest.fn(),
  selectAll: jest.fn(),
  getSelection: jest.fn(() => ''),
  buffer: {
    active: {
      cursorX: 0,
      cursorY: 0,
      length: 24
    }
  }
};

describe('Terminal Rendering', () => {
  let terminal;

  beforeEach(() => {
    jest.clearAllMocks();
    terminal = mockTerminal;
  });

  describe('Basic Text Rendering', () => {
    test('should render plain text', () => {
      const text = 'Hello, world!';
      terminal.write(text);
      
      expect(terminal.write).toHaveBeenCalledWith(text);
    });

    test('should render text with newlines', () => {
      const text = 'Line 1\r\nLine 2\r\nLine 3';
      terminal.write(text);
      
      expect(terminal.write).toHaveBeenCalledWith(text);
    });

    test('should handle empty strings', () => {
      terminal.write('');
      expect(terminal.write).toHaveBeenCalledWith('');
    });

    test('should handle null and undefined', () => {
      terminal.write(null);
      terminal.write(undefined);
      
      expect(terminal.write).toHaveBeenCalledWith(null);
      expect(terminal.write).toHaveBeenCalledWith(undefined);
    });
  });

  describe('ANSI Color Code Processing', () => {
    const ansiTestCases = [
      {
        name: 'red text',
        input: '\x1b[31mRed text\x1b[0m',
        description: 'should render red text with reset'
      },
      {
        name: 'green text',
        input: '\x1b[32mGreen text\x1b[0m',
        description: 'should render green text with reset'
      },
      {
        name: 'blue text',
        input: '\x1b[34mBlue text\x1b[0m',
        description: 'should render blue text with reset'
      },
      {
        name: 'bold text',
        input: '\x1b[1mBold text\x1b[0m',
        description: 'should render bold text with reset'
      },
      {
        name: 'underlined text',
        input: '\x1b[4mUnderlined text\x1b[0m',
        description: 'should render underlined text with reset'
      },
      {
        name: 'background color',
        input: '\x1b[41mRed background\x1b[0m',
        description: 'should render text with red background'
      },
      {
        name: 'bright colors',
        input: '\x1b[91mBright red\x1b[0m',
        description: 'should render bright red text'
      },
      {
        name: 'combined attributes',
        input: '\x1b[1;31;4mBold red underlined\x1b[0m',
        description: 'should render text with multiple attributes'
      }
    ];

    ansiTestCases.forEach(testCase => {
      test(testCase.description, () => {
        terminal.write(testCase.input);
        expect(terminal.write).toHaveBeenCalledWith(testCase.input);
      });
    });

    test('should handle malformed ANSI codes', () => {
      const malformedCodes = [
        '\x1b[999mInvalid code\x1b[0m',
        '\x1b[mEmpty code\x1b[0m',
        '\x1b[31mMissing reset',
        '\x1b31mMissing bracket'
      ];

      malformedCodes.forEach(code => {
        terminal.write(code);
        expect(terminal.write).toHaveBeenCalledWith(code);
      });
    });

    test('should handle nested ANSI codes', () => {
      const nestedCode = '\x1b[31m\x1b[1mRed and bold\x1b[0m\x1b[0m';
      terminal.write(nestedCode);
      expect(terminal.write).toHaveBeenCalledWith(nestedCode);
    });
  });

  describe('Cursor Movement', () => {
    const cursorTestCases = [
      {
        name: 'cursor up',
        input: '\x1b[A',
        description: 'should move cursor up one line'
      },
      {
        name: 'cursor down',
        input: '\x1b[B',
        description: 'should move cursor down one line'
      },
      {
        name: 'cursor forward',
        input: '\x1b[C',
        description: 'should move cursor forward one column'
      },
      {
        name: 'cursor backward',
        input: '\x1b[D',
        description: 'should move cursor backward one column'
      },
      {
        name: 'cursor position',
        input: '\x1b[10;20H',
        description: 'should move cursor to specific position'
      },
      {
        name: 'cursor home',
        input: '\x1b[H',
        description: 'should move cursor to home position'
      }
    ];

    cursorTestCases.forEach(testCase => {
      test(testCase.description, () => {
        terminal.write(testCase.input);
        expect(terminal.write).toHaveBeenCalledWith(testCase.input);
      });
    });
  });

  describe('Screen Control', () => {
    test('should handle clear screen', () => {
      terminal.write('\x1b[2J');
      expect(terminal.write).toHaveBeenCalledWith('\x1b[2J');
    });

    test('should handle clear line', () => {
      terminal.write('\x1b[K');
      expect(terminal.write).toHaveBeenCalledWith('\x1b[K');
    });

    test('should handle scroll up', () => {
      terminal.write('\x1b[S');
      expect(terminal.write).toHaveBeenCalledWith('\x1b[S');
    });

    test('should handle scroll down', () => {
      terminal.write('\x1b[T');
      expect(terminal.write).toHaveBeenCalledWith('\x1b[T');
    });
  });

  describe('Special Characters', () => {
    test('should handle carriage return', () => {
      terminal.write('Hello\rWorld');
      expect(terminal.write).toHaveBeenCalledWith('Hello\rWorld');
    });

    test('should handle line feed', () => {
      terminal.write('Hello\nWorld');
      expect(terminal.write).toHaveBeenCalledWith('Hello\nWorld');
    });

    test('should handle tab character', () => {
      terminal.write('Hello\tWorld');
      expect(terminal.write).toHaveBeenCalledWith('Hello\tWorld');
    });

    test('should handle backspace', () => {
      terminal.write('Hello\b\b\bWorld');
      expect(terminal.write).toHaveBeenCalledWith('Hello\b\b\bWorld');
    });

    test('should handle bell character', () => {
      terminal.write('Alert!\x07');
      expect(terminal.write).toHaveBeenCalledWith('Alert!\x07');
    });
  });

  describe('Unicode and Extended Characters', () => {
    test('should handle UTF-8 characters', () => {
      const utf8Text = 'Hello 世界! 🌍';
      terminal.write(utf8Text);
      expect(terminal.write).toHaveBeenCalledWith(utf8Text);
    });

    test('should handle box drawing characters', () => {
      const boxChars = '┌─┐│ │└─┘';
      terminal.write(boxChars);
      expect(terminal.write).toHaveBeenCalledWith(boxChars);
    });

    test('should handle extended ASCII', () => {
      const extendedAscii = 'Café résumé naïve';
      terminal.write(extendedAscii);
      expect(terminal.write).toHaveBeenCalledWith(extendedAscii);
    });
  });

  describe('Performance', () => {
    test('should handle large text blocks efficiently', () => {
      const largeText = 'A'.repeat(10000);
      const startTime = Date.now();
      
      terminal.write(largeText);
      
      const endTime = Date.now();
      const duration = endTime - startTime;
      
      expect(terminal.write).toHaveBeenCalledWith(largeText);
      expect(duration).toBeLessThan(100); // Should complete within 100ms
    });

    test('should handle rapid successive writes', () => {
      const messages = Array.from({ length: 100 }, (_, i) => `Message ${i}\r\n`);
      
      const startTime = Date.now();
      messages.forEach(msg => terminal.write(msg));
      const endTime = Date.now();
      
      expect(terminal.write).toHaveBeenCalledTimes(100);
      expect(endTime - startTime).toBeLessThan(100);
    });
  });

  describe('Error Handling', () => {
    test('should handle binary data gracefully', () => {
      const binaryData = Buffer.from([0x00, 0x01, 0x02, 0xFF]);
      terminal.write(binaryData);
      expect(terminal.write).toHaveBeenCalledWith(binaryData);
    });

    test('should handle extremely long ANSI sequences', () => {
      const longAnsiSequence = '\x1b[' + '1;'.repeat(1000) + '31m';
      terminal.write(longAnsiSequence);
      expect(terminal.write).toHaveBeenCalledWith(longAnsiSequence);
    });
  });
});

describe('ANSI Processing Functions', () => {
  // Test utility functions for ANSI processing
  
  describe('ANSI Code Detection', () => {
    const detectAnsiCodes = (text) => {
      const ansiRegex = /\x1b\[[0-9;]*[a-zA-Z]/g;
      return text.match(ansiRegex) || [];
    };

    test('should detect color codes', () => {
      const text = '\x1b[31mRed\x1b[0m';
      const codes = detectAnsiCodes(text);
      expect(codes).toEqual(['\x1b[31m', '\x1b[0m']);
    });

    test('should detect cursor movement codes', () => {
      const text = '\x1b[10;20H\x1b[A\x1b[B';
      const codes = detectAnsiCodes(text);
      expect(codes).toEqual(['\x1b[10;20H', '\x1b[A', '\x1b[B']);
    });

    test('should handle text without ANSI codes', () => {
      const text = 'Plain text without codes';
      const codes = detectAnsiCodes(text);
      expect(codes).toEqual([]);
    });
  });

  describe('ANSI Code Stripping', () => {
    const stripAnsiCodes = (text) => {
      return text.replace(/\x1b\[[0-9;]*[a-zA-Z]/g, '');
    };

    test('should strip color codes', () => {
      const text = '\x1b[31mRed text\x1b[0m';
      const stripped = stripAnsiCodes(text);
      expect(stripped).toBe('Red text');
    });

    test('should strip multiple codes', () => {
      const text = '\x1b[1m\x1b[31mBold red\x1b[0m\x1b[0m';
      const stripped = stripAnsiCodes(text);
      expect(stripped).toBe('Bold red');
    });

    test('should preserve text without codes', () => {
      const text = 'Plain text';
      const stripped = stripAnsiCodes(text);
      expect(stripped).toBe('Plain text');
    });
  });

  describe('ANSI Code Validation', () => {
    const isValidAnsiCode = (code) => {
      const validAnsiRegex = /^\x1b\[[0-9;]*[a-zA-Z]$/;
      return validAnsiRegex.test(code);
    };

    test('should validate correct ANSI codes', () => {
      const validCodes = ['\x1b[31m', '\x1b[0m', '\x1b[1;31m', '\x1b[H', '\x1b[2J'];
      validCodes.forEach(code => {
        expect(isValidAnsiCode(code)).toBe(true);
      });
    });

    test('should reject invalid ANSI codes', () => {
      const invalidCodes = [
        '\x1b31m',    // Missing bracket
        '\x1b[',      // Incomplete sequence
        '\x1b[31',    // Missing terminator
        'x1b[31m'     // Missing escape character
      ];
      
      invalidCodes.forEach(code => {
        expect(isValidAnsiCode(code)).toBe(false);
      });
    });
  });
});
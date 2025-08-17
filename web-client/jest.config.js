module.exports = {
  testEnvironment: 'jsdom',
  collectCoverageFrom: [
    'public/**/*.js',
    'src/**/*.js',
    '!**/node_modules/**',
    '!**/coverage/**'
  ],
  coverageDirectory: 'coverage',
  coverageReporters: ['text', 'lcov', 'html'],
  testMatch: [
    '**/tests/**/*.test.js'
  ],
  setupFilesAfterEnv: ['<rootDir>/tests/setup.js'],
  verbose: true,
  testTimeout: 10000,
  projects: [
    {
      displayName: 'client',
      testEnvironment: 'jsdom',
      testMatch: ['**/tests/client*.test.js', '**/tests/terminal-rendering.test.js']
    },
    {
      displayName: 'integration',
      testEnvironment: 'node',
      testMatch: ['**/tests/websocket-integration.test.js']
    }
  ]
};
# Contributing to zev-mud

Welcome to the zev-mud project! This document provides guidelines for contributing to the browser-based MUD game system.

## Development Setup

### Prerequisites

- **Node.js 18+**: For running individual services locally
- **Docker & Docker Compose**: For containerized development environment  
- **Git**: For version control and collaboration
- **Modern Web Browser**: Chrome/Firefox/Safari for testing the web interface

### Initial Setup

1. **Clone the repository**
   ```bash
   git clone https://github.com/SergeiGolos/zev-mud.git
   cd zev-mud
   ```

2. **Choose development approach:**

   **Option A: Containerized Development (Recommended)**
   ```bash
   # Start all services with hot reload
   docker compose -f docker-compose.dev.yml up --build
   ```

   **Option B: Local Development**
   ```bash
   # Install dependencies for all services
   cd ranvier && npm install && cd ..
   cd proxy && npm install && cd ..  
   cd web-client && npm install && cd ..

   # Start services in separate terminals
   cd ranvier && npm run dev      # Terminal 1
   cd proxy && npm run dev        # Terminal 2  
   cd web-client && npm run dev   # Terminal 3
   ```

3. **Verify setup**
   - Web Client: http://localhost:3001
   - Proxy Health: http://localhost:8080/health
   - Direct Telnet: telnet localhost 3000

## Project Structure

```
zev-mud/
├── .kiro/                      # Project documentation and specifications
│   ├── specs/                  # Technical specifications and requirements
│   └── steering/               # High-level project guidance
├── ranvier/                    # MUD game server (Node.js)
│   ├── bundles/                # Game content and logic
│   ├── data/                   # Persistent game data
│   ├── tests/                  # Server tests
│   └── src/                    # Core server code
├── proxy/                      # WebSocket-Telnet proxy (Node.js)
│   ├── src/                    # Proxy source code
│   ├── config/                 # Proxy configuration
│   └── tests/                  # Proxy tests
├── web-client/                 # Browser client (Express + xterm.js)
│   ├── src/                    # Client source code
│   ├── public/                 # Static web assets
│   └── tests/                  # Client tests
├── docker-compose.yml          # Production deployment
├── docker-compose.dev.yml      # Development environment
└── README.md                   # Main project documentation
```

## Development Workflow

### Making Changes

1. **Create a feature branch**
   ```bash
   git checkout -b feature/your-feature-name
   ```

2. **Make your changes following the guidelines below**

3. **Test your changes**
   ```bash
   # Run all tests
   npm run test:all
   
   # Or test individual services
   cd ranvier && npm test
   cd proxy && npm test
   cd web-client && npm test
   ```

4. **Commit your changes**
   ```bash
   git add .
   git commit -m "feat: add your feature description"
   ```

5. **Push and create pull request**
   ```bash
   git push origin feature/your-feature-name
   # Create PR through GitHub interface
   ```

### Commit Message Standards

Follow conventional commit format:

- `feat:` new features
- `fix:` bug fixes
- `docs:` documentation changes
- `test:` adding or updating tests
- `refactor:` code refactoring
- `perf:` performance improvements
- `chore:` maintenance tasks

Examples:
- `feat: add inventory sorting command`
- `fix: resolve WebSocket reconnection issue`
- `docs: update API documentation`

## Code Style Guidelines

### General Principles

- **Consistency**: Follow existing patterns in each codebase
- **Readability**: Write self-documenting code with clear variable names
- **Simplicity**: Prefer simple solutions over complex ones
- **Testing**: Write tests for new functionality
- **Documentation**: Update relevant documentation

### JavaScript/Node.js Standards

- Use **ES6+ features** where appropriate
- Follow **camelCase** for variables and functions
- Use **PascalCase** for classes and constructors
- Include **JSDoc comments** for public API functions
- Prefer **const** over **let**, avoid **var**
- Use **async/await** over promises where possible

**Example:**
```javascript
/**
 * Handles WebSocket message forwarding to telnet connection
 * @param {string} message - Message to forward
 * @param {Object} connection - Telnet connection object
 * @returns {Promise<boolean>} Success status
 */
async function forwardMessage(message, connection) {
  try {
    await connection.send(message);
    return true;
  } catch (error) {
    logger.error('Message forwarding failed:', error);
    return false;
  }
}
```

### Game Content Standards

**YAML Configuration:**
```yaml
# Use lowercase with hyphens for IDs
- id: rusty-sword
  name: "Rusty Sword"
  description: "An old sword with rust along the blade"
  type: weapon
  properties:
    damage: 5
    durability: 80
```

**Ranvier Bundles:**
- Place new content in appropriate bundle directories
- Follow existing naming conventions
- Include comprehensive descriptions
- Test all game mechanics

## Testing Guidelines

### Test Requirements

**All new features must include:**
- Unit tests for core logic
- Integration tests for component interactions
- End-to-end tests for user-facing features

**Testing Commands:**
```bash
# Individual service tests
cd ranvier && npm test
cd proxy && npm run test:unit && npm run test:integration
cd web-client && npm run test:coverage

# Run all tests
docker compose -f docker-compose.dev.yml exec ranvier npm test
docker compose -f docker-compose.dev.yml exec proxy npm test  
docker compose -f docker-compose.dev.yml exec web-client npm test
```

### Test Categories

**Unit Tests:**
- Game mechanics (combat, inventory, movement)
- Proxy message processing
- Client connection handling
- Data validation and persistence

**Integration Tests:**
- WebSocket-Telnet communication flows
- Database operations
- Service health checks
- Cross-component messaging

**End-to-End Tests:**
- Complete player workflows
- Character creation and persistence
- Gameplay scenarios (movement, combat, NPCs)
- Browser compatibility

### Writing Good Tests

```javascript
describe('Character Movement System', () => {
  it('should move character to valid adjacent room', async () => {
    // Arrange
    const character = await createTestCharacter();
    const startRoom = 'room1';
    const targetRoom = 'room2';
    
    // Act
    const result = await character.move('north');
    
    // Assert
    expect(result.success).toBe(true);
    expect(character.currentRoom).toBe(targetRoom);
  });

  it('should reject movement to invalid direction', async () => {
    // Arrange
    const character = await createTestCharacter();
    
    // Act & Assert
    await expect(character.move('invalid-direction'))
      .rejects.toThrow('Invalid direction');
  });
});
```

## Component-Specific Guidelines

### Ranvier Server

**Key Areas:**
- Game logic in `bundles/basic-world/`
- Commands in `bundles/basic-world/commands/`
- NPC behaviors in `bundles/basic-world/behaviors/`
- World data in `bundles/basic-world/areas/`

**Development Tips:**
- Use Ranvier's built-in event system
- Follow the bundle structure for new content
- Test game mechanics with automated tests
- Use the `debug` npm script for detailed logging

### WebSocket Proxy

**Key Areas:**
- Connection management in `src/websocket-server.js`
- Protocol conversion in `src/telnet-proxy.js`
- Health checks in `src/health-check.js`

**Development Tips:**
- Handle connection edge cases gracefully
- Preserve ANSI escape codes
- Filter Telnet IAC sequences appropriately
- Include comprehensive error handling

### Web Client

**Key Areas:**
- Terminal handling in `src/client.js`
- Server logic in `src/server.js`
- UI components in `public/index.html`

**Development Tips:**
- Test across multiple browsers
- Ensure responsive design works
- Handle WebSocket connection states properly
- Optimize terminal performance

## Documentation Standards

### Documentation Requirements

**All changes should include:**
- Updated README files if functionality changes
- Code comments for complex logic
- API documentation for new endpoints
- Architecture documentation for design changes

### Documentation Style

- Use **Markdown** for all documentation
- Include **code examples** for APIs and usage
- Provide **clear headings** and structure
- Keep **language simple** and accessible
- Add **links** between related documents

### Architecture Decision Records

**Major architectural changes should be documented in `.kiro/`:**
- Design rationale and alternatives considered
- Implementation details and trade-offs
- Impact on existing systems
- Future considerations

## Pull Request Process

### Before Submitting

- [ ] All tests pass locally
- [ ] Code follows project style guidelines
- [ ] Documentation is updated
- [ ] Commit messages follow conventional format
- [ ] Changes are focused and atomic

### PR Description Template

```markdown
## Description
Brief description of changes and motivation.

## Type of Change
- [ ] Bug fix
- [ ] New feature  
- [ ] Documentation update
- [ ] Refactoring
- [ ] Performance improvement

## Testing
- [ ] Unit tests added/updated
- [ ] Integration tests pass
- [ ] Manual testing completed

## Documentation
- [ ] README updated
- [ ] Code comments added
- [ ] API documentation updated

## Checklist
- [ ] Code follows style guidelines
- [ ] Self-review completed
- [ ] No merge conflicts
```

### Review Process

1. **Automated Checks**: All tests and lints must pass
2. **Code Review**: At least one maintainer review required
3. **Testing**: Verify functionality works as expected
4. **Documentation**: Ensure docs are accurate and complete
5. **Merge**: Squash and merge when approved

## Issue Reporting

### Bug Reports

**Use the bug report template:**
- Environment details (browser, OS, etc.)
- Steps to reproduce
- Expected vs actual behavior
- Screenshots/logs if applicable
- Minimal reproduction case

### Feature Requests

**Include in feature requests:**
- Use case and motivation
- Proposed solution
- Alternative approaches considered
- Impact on existing functionality

### Performance Issues

**For performance reports:**
- Specific scenarios where performance is poor
- Metrics or measurements
- Environment details
- Proposed optimizations if any

## Community Guidelines

### Code of Conduct

- Be respectful and inclusive
- Welcome newcomers and help them learn
- Focus on constructive feedback
- Assume positive intent
- Follow project maintainer guidance

### Getting Help

**Preferred channels:**
1. Check existing documentation first
2. Search existing issues
3. Create a new issue with details
4. Join community discussions

### Recognition

Contributors are recognized through:
- Git commit attribution
- README contributor acknowledgments  
- Release notes mentions
- Community highlights

Thank you for contributing to zev-mud! Your involvement helps make this project better for everyone.